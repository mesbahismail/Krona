'use client';

import React, {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import { isSameLocalDay, localDateKey, localDayStart } from '@/lib/localDate';
import { localData } from '@/lib/localData';
import { addTaskWorkedSeconds } from '@/lib/taskTimeSync';
import {
	scheduleBackfillLocalSessionsToDb,
	persistSessionToDb,
	reviseSessionLog,
	POMODORO_REST_SESSIONS_KEY,
	POMODORO_SESSIONS_KEY,
	readLocalSessions,
	type LocalSessionEntry,
	type SessionLogIdentity,
	type SessionLogPatch,
} from '@/lib/sessionSync';
import { logEventSync } from '@/lib/telemetry';
import {
	POMODORO_PREFS_CHANGED_EVENT,
	readPomodoroPreferences,
} from '@/lib/pomodoroPreferences';
import {
	playTimerPeriodBell,
	primeTimerAlertAudio,
} from '@/lib/timerAlertSound';
import { showKronaBrowserNotification } from '@/lib/browserNotifications';
import {
	loadUserAppSettings,
	saveUserAppSettings,
} from '@/lib/userAppSettings';
import {
	TIMER_STYLE_CHANGED_EVENT,
	getTimerStyleWriteGeneration,
	hydrateTimerStyleFromDb,
	persistTimerStyle,
	readTimerStyle,
	type TimerStyle,
} from '@/lib/timerStyle';
import { showKronaToast } from '@/lib/kronaToast';
import { isVacationModeActive } from '@/lib/vacationMode';
import {
	persistSelectedTimerTask,
	SELECTED_TASK_CHANGED_EVENT,
} from '@/lib/selectedTimerTask';
import {
	KRONA_TASK_STATUS_CHANGED,
	type TaskStatusChangedDetail,
} from '@/lib/kronaDataEvents';
import { useAppRuntimeActive } from '@/app/AppRuntimeActiveContext';

export type PomodoroStatsState = {
	todayTotal: { work: number; rest: number };
	last7Days: Array<{ date: Date; work: number; rest: number; key: string }>;
	sessions: LocalSessionEntry[];
	restSessions: LocalSessionEntry[];
	/** Correct an accidentally recorded session (duration / task / kind). */
	updateSessionLog: (
		previous: SessionLogIdentity,
		next: SessionLogPatch,
	) => Promise<boolean>;
	/** Remove an accidentally recorded session. */
	deleteSessionLog: (previous: SessionLogIdentity) => Promise<boolean>;
};

export type PomodoroTimerState = {
	mode: 'work' | 'break' | 'longBreak';
	/** Selected tab in the timer widget. */
	viewMode: 'work' | 'break' | 'longBreak';
	setMode: (mode: 'work' | 'break' | 'longBreak') => void;
	remaining: number;
	running: boolean;
	/** Remaining seconds shown in the widget for the selected tab. */
	displayRemaining: number;
	/** Whether the widget play/pause control reflects a running session on the selected tab. */
	displayRunning: boolean;
	start: (modeOverride?: 'work' | 'break' | 'longBreak') => void;
	pause: () => void;
	skip: () => void;
	reset: () => void;
	format: (seconds: number) => string;
	formatHours: (seconds: number) => string;
	resetTimerForMode: (mode: 'work' | 'break' | 'longBreak') => void;
	durations: {
		workMinutes: number;
		breakMinutes: number;
		longBreakMinutes: number;
	};
	setDurations: (next: {
		workMinutes: number;
		breakMinutes: number;
		longBreakMinutes: number;
	}) => void;
	/** Pomodoro (work / short / long) or Work free (work / rest + on/off). */
	timerStyle: TimerStyle;
	setTimerStyle: (style: TimerStyle) => void;
};

/** @deprecated Prefer usePomodoroTimer + usePomodoroStats so stats UI does not re-render every tick. */
export type PomodoroState = PomodoroTimerState & PomodoroStatsState;

const PomodoroTimerContext = createContext<PomodoroTimerState | null>(null);
const PomodoroStatsContext = createContext<PomodoroStatsState | null>(null);

/** High-churn: remaining, running, mode — use only in timer controls and task sync. */
export function usePomodoroTimer() {
	const ctx = useContext(PomodoroTimerContext);
	if (!ctx)
		throw new Error('usePomodoroTimer must be used within PomodoroProvider');
	return ctx;
}

/** Low-churn: sessions / charts — does not update every second while the timer runs. */
export function usePomodoroStats() {
	const ctx = useContext(PomodoroStatsContext);
	if (!ctx)
		throw new Error('usePomodoroStats must be used within PomodoroProvider');
	return ctx;
}

/** Merged hook: re-renders on every timer tick. Prefer split hooks in new code. */
export function usePomodoro(): PomodoroState {
	return { ...usePomodoroTimer(), ...usePomodoroStats() };
}

const DEFAULT_WORK_SECONDS = 25 * 60;
const DEFAULT_BREAK_SECONDS = 5 * 60;
const DEFAULT_LONG_BREAK_SECONDS = 15 * 60;
const SESSIONS_KEY = POMODORO_SESSIONS_KEY;
const REST_SESSIONS_KEY = POMODORO_REST_SESSIONS_KEY;
const POMODORO_CONFIG_KEY = 'krona:pomodoro-config';
const POMODORO_STATE_KEY = 'pomodoro_state';

type PomodoroDurationsSeconds = {
	work: number;
	break: number;
	longBreak: number;
};

const DEFAULT_DURATIONS: PomodoroDurationsSeconds = {
	work: DEFAULT_WORK_SECONDS,
	break: DEFAULT_BREAK_SECONDS,
	longBreak: DEFAULT_LONG_BREAK_SECONDS,
};

function readPomodoroDurations(): PomodoroDurationsSeconds {
	if (typeof window === 'undefined') return DEFAULT_DURATIONS;
	try {
		const raw = window.localStorage.getItem(POMODORO_CONFIG_KEY);
		if (!raw) return DEFAULT_DURATIONS;
		const parsed = JSON.parse(raw) as Partial<PomodoroDurationsSeconds>;
		return {
			work:
				Number.isFinite(parsed.work) && Number(parsed.work) >= 60
					? Number(parsed.work)
					: DEFAULT_WORK_SECONDS,
			break:
				Number.isFinite(parsed.break) && Number(parsed.break) >= 60
					? Number(parsed.break)
					: DEFAULT_BREAK_SECONDS,
			longBreak:
				Number.isFinite(parsed.longBreak) && Number(parsed.longBreak) >= 60
					? Number(parsed.longBreak)
					: DEFAULT_LONG_BREAK_SECONDS,
		};
	} catch {
		return DEFAULT_DURATIONS;
	}
}

type SessionEntry = LocalSessionEntry;

function mergeSessions(...lists: SessionEntry[][]): SessionEntry[] {
	const map = new Map<number, SessionEntry>();
	for (const list of lists) {
		const sourceEntries = new Map<number, SessionEntry>();
		for (const entry of list) {
			if (!sourceEntries.has(entry.timestamp)) {
				sourceEntries.set(entry.timestamp, entry);
			}
		}
		for (const [timestamp, entry] of sourceEntries) {
			map.set(timestamp, entry);
		}
	}
	return [...map.values()]
		.sort((a, b) => b.timestamp - a.timestamp)
		.slice(0, 500);
}

function secondsForMode(
	m: 'work' | 'break' | 'longBreak',
	values: PomodoroDurationsSeconds,
) {
	return m === 'work'
		? values.work
		: m === 'break'
			? values.break
			: values.longBreak;
}

export const PomodoroProvider = ({
	children,
}: {
	children: React.ReactNode;
}) => {
	const runtimeActive = useAppRuntimeActive();
	const [durationsSeconds, setDurationsSeconds] =
		useState<PomodoroDurationsSeconds>(DEFAULT_DURATIONS);

	const [mode, setModeState] = useState<'work' | 'break' | 'longBreak'>('work');
	const [viewMode, setViewModeState] = useState<'work' | 'break' | 'longBreak'>(
		'work',
	);
	// Keep SSR and the client's first paint identical — restore from localStorage in
	// useLayoutEffect below (reading storage here causes hydration mismatches).
	const [remaining, setRemaining] = useState<number>(DEFAULT_WORK_SECONDS);
	const [running, setRunning] = useState<boolean>(false);
	const [todayKey, setTodayKey] = useState<string | null>(null);

	const [workCycleCount, setWorkCycleCount] = useState<number>(0);
	const [timerStyle, setTimerStyleState] = useState<TimerStyle>('pomodoro');

	// Seed empty on SSR/first paint; hydrate from localStorage in useLayoutEffect.
	const [sessions, setSessions] = useState<SessionEntry[]>([]);

	const [restSessions, setRestSessions] = useState<SessionEntry[]>([]);

	/** Persist only after timer state has been restored (avoids writing running:false over a live session). */
	const [storageReady, setStorageReady] = useState(false);

	const [inProgressWorkSeconds, setInProgressWorkSeconds] = useState(0);
	const [inProgressRestSeconds, setInProgressRestSeconds] = useState(0);

	const runningRef = useRef(running);
	const modeRef = useRef(mode);
	const viewModeRef = useRef(viewMode);
	const durationsRef = useRef(durationsSeconds);
	const remainingRef = useRef(remaining);
	const workCycleCountRef = useRef(workCycleCount);
	const timerStyleRef = useRef(timerStyle);
	const autoAdvanceRef = useRef(readPomodoroPreferences().autoAdvance);
	const workPeriodEndHandledRef = useRef(false);

	useEffect(() => {
		if (!runtimeActive) return;
		autoAdvanceRef.current = readPomodoroPreferences().autoAdvance;
		const syncPrefs = () => {
			autoAdvanceRef.current = readPomodoroPreferences().autoAdvance;
		};
		window.addEventListener(POMODORO_PREFS_CHANGED_EVENT, syncPrefs);
		return () =>
			window.removeEventListener(POMODORO_PREFS_CHANGED_EVENT, syncPrefs);
	}, [runtimeActive]);

	useEffect(() => {
		if (!runtimeActive) return;
		setTimerStyleState(readTimerStyle());
		let cancelled = false;
		const generationAtStart = getTimerStyleWriteGeneration();
		void hydrateTimerStyleFromDb().then((style) => {
			if (cancelled) return;
			// Ignore hydrate result if the user wrote a newer style while fetching.
			if (getTimerStyleWriteGeneration() !== generationAtStart) {
				setTimerStyleState(readTimerStyle());
				return;
			}
			// Only adopt style from DB when idle — never mid-session (avoids wiping
			// Work Free elapsed / unflushed segments without going through setTimerStyle).
			if (
				timerStyleRef.current !== style &&
				!runningRef.current &&
				workFreeBaseRef.current === 0 &&
				activeStartAtRef.current == null
			) {
				setTimerStyleState(style);
				timerStyleRef.current = style;
			} else if (timerStyleRef.current === style) {
				setTimerStyleState(style);
			}
		});
		const syncStyle = () => {
			const next = readTimerStyle();
			// Same-tab setTimerStyle already applied transition; other tabs only
			// update the label when idle so we don't desync a running clock.
			if (next === timerStyleRef.current) {
				setTimerStyleState(next);
				return;
			}
			if (runningRef.current || workFreeBaseRef.current > 0) return;
			setTimerStyleState(next);
			timerStyleRef.current = next;
		};
		window.addEventListener(TIMER_STYLE_CHANGED_EVENT, syncStyle);
		return () => {
			cancelled = true;
			window.removeEventListener(TIMER_STYLE_CHANGED_EVENT, syncStyle);
		};
	}, [runtimeActive]);

	useLayoutEffect(() => {
		runningRef.current = running;
		modeRef.current = mode;
		viewModeRef.current = viewMode;
		durationsRef.current = durationsSeconds;
		remainingRef.current = remaining;
		workCycleCountRef.current = workCycleCount;
		timerStyleRef.current = timerStyle;
	}, [
		running,
		mode,
		viewMode,
		durationsSeconds,
		remaining,
		workCycleCount,
		timerStyle,
	]);

	const activeStartAtRef = useRef<number | null>(null);
	const activeTaskIdRef = useRef<string | null>(null);
	const periodEndAtRef = useRef<number | null>(null);
	const clientReadyRef = useRef(false);
	/** Work free: seconds already recorded for the current work/rest stretch. */
	const workFreeBaseRef = useRef(0);

	/**
	 * Synchronous live-clock snapshot. Timestamps are the source of truth, so
	 * Work Free and Pomodoro can both resume accurately after logout/reload.
	 */
	const persistTimerSnapshot = useCallback(() => {
		if (typeof window === 'undefined') return;
		try {
			window.localStorage.setItem(
				POMODORO_STATE_KEY,
				JSON.stringify({
					remaining: remainingRef.current,
					mode: modeRef.current,
					running: runningRef.current,
					periodEndAt: periodEndAtRef.current,
					segmentStartedAt: runningRef.current
						? activeStartAtRef.current
						: null,
					workFreeBase: workFreeBaseRef.current,
					style: timerStyleRef.current,
					workStartedAt:
						runningRef.current && modeRef.current === 'work'
							? activeStartAtRef.current
							: null,
				}),
			);
		} catch {
			/* localStorage unavailable */
		}
	}, []);

	useEffect(() => {
		const {
			data: { subscription },
		} = localData.auth.onAuthStateChange((event) => {
			if (event === 'SIGNED_OUT') persistTimerSnapshot();
		});
		const onPageHide = () => persistTimerSnapshot();
		window.addEventListener('pagehide', onPageHide);
		return () => {
			persistTimerSnapshot();
			window.removeEventListener('pagehide', onPageHide);
			subscription.unsubscribe();
		};
	}, [persistTimerSnapshot]);

	const syncRemainingFromDeadline = useCallback(() => {
		if (!runningRef.current) return;
		if (timerStyleRef.current === 'workFree') {
			// Never freeze a running Work Free clock — re-arm the segment if cleared.
			if (activeStartAtRef.current == null) {
				activeStartAtRef.current = Date.now();
			}
			const next =
				workFreeBaseRef.current +
				Math.max(0, Math.floor((Date.now() - activeStartAtRef.current) / 1000));
			if (next !== remainingRef.current) {
				setRemaining(next);
				remainingRef.current = next;
			}
			return;
		}
		if (periodEndAtRef.current == null) {
			// Rebuild deadline from remaining so a lost periodEndAt cannot stall the UI.
			const secs = Math.max(0, remainingRef.current);
			if (secs <= 0) return;
			periodEndAtRef.current = Date.now() + secs * 1000;
		}
		const next = Math.max(
			0,
			Math.ceil((periodEndAtRef.current - Date.now()) / 1000),
		);
		if (next !== remainingRef.current) {
			setRemaining(next);
		}
	}, []);

	/** Credit the current Work Free segment into the stretch base after a flush. */
	const advanceWorkFreeBaseAfterFlush = (elapsedSeconds: number) => {
		if (timerStyleRef.current !== 'workFree') return;
		const elapsed = Math.max(0, Math.floor(elapsedSeconds));
		if (elapsed <= 0) return;
		workFreeBaseRef.current += elapsed;
		setRemaining(workFreeBaseRef.current);
		remainingRef.current = workFreeBaseRef.current;
	};

	const getSelectedTaskId = () => {
		try {
			return typeof window !== 'undefined'
				? window.localStorage.getItem('krona:selectedTaskId')
				: null;
		} catch {
			return null;
		}
	};

	const recordWorkSession = useCallback(
		(
			duration: number,
			timestamp = Date.now(),
			taskId: string | null = getSelectedTaskId(),
		) => {
			if (duration <= 0 || isVacationModeActive()) return;
			const entry: SessionEntry = { timestamp, duration, taskId };
			setSessions((s) => {
				const next = mergeSessions([entry], s);
				// Sync write so team-task worked_seconds can read local history
				// before React's localStorage effect runs.
				try {
					window.localStorage.setItem(SESSIONS_KEY, JSON.stringify(next));
				} catch {
					/* ignore */
				}
				return next;
			});
			window.dispatchEvent(new Event('krona:sessions-updated'));
			logEventSync('session_completed', {
				kind: 'work',
				duration_seconds: duration,
			});
			void (async () => {
				try {
					const {
						data: { user },
					} = await localData.auth.getUser();
					if (!user) return;
					await persistSessionToDb(user.id, {
						timestamp,
						duration,
						sessionKind: 'work',
						taskId,
					});
					// persistSessionToDb notifies after insert; keep a fallback ping
					// so assigned team-task totals refresh even if insert was a no-op dedupe.
					window.dispatchEvent(new Event('krona:sessions-updated'));
				} catch {
					/* ignore */
				}
			})();
		},
		[],
	);

	const flushActiveWork = (overrideSeconds?: number) => {
		if (modeRef.current !== 'work') return;
		const now = Date.now();
		let duration = 0;
		if (typeof overrideSeconds === 'number') {
			duration = overrideSeconds;
		} else if (activeStartAtRef.current) {
			duration = Math.max(
				0,
				Math.floor((now - activeStartAtRef.current) / 1000),
			);
		}
		if (duration > 0 && !isVacationModeActive()) {
			const taskId = activeTaskIdRef.current;
			logEventSync('task_time_add', {
				task_id: taskId,
				duration_seconds: duration,
				at: new Date().toISOString(),
			});
			if (typeof overrideSeconds !== 'number') {
				recordWorkSession(duration, now, taskId);
			}
			void (async () => {
				try {
					if (!taskId) return;
					const {
						data: { user },
					} = await localData.auth.getUser();
					if (!user) return;
					await addTaskWorkedSeconds(user.id, taskId, duration);
				} catch {}
			})();
		}
		activeStartAtRef.current = null;
		activeTaskIdRef.current = null;
	};

	const flushActiveWorkRef = useRef(flushActiveWork);
	useLayoutEffect(() => {
		flushActiveWorkRef.current = flushActiveWork;
	}, [flushActiveWork]);

	const flushActiveRest = () => {
		const currentMode = modeRef.current;
		if (currentMode !== 'break' && currentMode !== 'longBreak') return;
		const elapsed =
			timerStyleRef.current === 'workFree' && activeStartAtRef.current != null
				? Math.max(
						0,
						Math.floor((Date.now() - activeStartAtRef.current) / 1000),
					)
				: Math.max(
						0,
						secondsForMode(currentMode, durationsRef.current) -
							remainingRef.current,
					);
		if (elapsed > 0 && !isVacationModeActive()) {
			const timestamp = Date.now();
			const newRest = { timestamp, duration: elapsed };
			setRestSessions((s) => [newRest, ...s].slice(0, 500));
			window.dispatchEvent(new Event('krona:sessions-updated'));
			logEventSync('session_completed', {
				kind: 'rest',
				duration_seconds: elapsed,
			});
			void (async () => {
				try {
					const {
						data: { user },
					} = await localData.auth.getUser();
					if (!user) return;
					await persistSessionToDb(user.id, {
						timestamp,
						duration: elapsed,
						sessionKind: 'rest',
					});
				} catch {}
			})();
		}
		activeStartAtRef.current = null;
		activeTaskIdRef.current = null;
	};

	const commitActiveSession = useCallback(() => {
		if (periodEndAtRef.current != null) {
			const next = Math.max(
				0,
				Math.ceil((periodEndAtRef.current - Date.now()) / 1000),
			);
			setRemaining(next);
			remainingRef.current = next;
			periodEndAtRef.current = null;
		}
		if (!runningRef.current) return;

		if (modeRef.current === 'work') {
			flushActiveWork();
			setWorkCycleCount((wc) => wc + 1);
		} else {
			flushActiveRest();
		}
		setRunning(false);
	}, []);

	const hydrateSessionsFromDb = useCallback(async (options?: { backfill?: boolean }) => {
		try {
			const {
				data: { user },
			} = await localData.auth.getUser();
			if (!user) return;
			const since = new Date();
			since.setDate(since.getDate() - 30);
			if (options?.backfill !== false) {
				void scheduleBackfillLocalSessionsToDb(user.id);
			}
			const withTeam = await localData
				.from('sessions')
				.select(
					'duration_seconds,session_kind,started_at,task_id,team_task_id,created_at',
				)
				.eq('user_id', user.id)
				.gte('started_at', since.toISOString())
				.order('created_at', { ascending: true })
				.order('started_at', { ascending: false });
			const rows = withTeam.error
				? (
						await localData
							.from('sessions')
							.select(
								'duration_seconds,session_kind,started_at,task_id,created_at',
							)
							.eq('user_id', user.id)
							.gte('started_at', since.toISOString())
							.order('created_at', { ascending: true })
							.order('started_at', { ascending: false })
					).data
				: withTeam.data;

			const localWork = readLocalSessions(SESSIONS_KEY);
			const localRest = readLocalSessions(REST_SESSIONS_KEY);
			const work: SessionEntry[] = [];
			const rest: SessionEntry[] = [];
			for (const row of rows || []) {
				const duration = Number(row.duration_seconds || 0);
				const entry: SessionEntry = {
					// Local sessions store completion time; align DB hydration with that shape.
					timestamp: new Date(row.started_at).getTime() + duration * 1000,
					duration,
					taskId:
						row.task_id ??
						('team_task_id' in row ? row.team_task_id : null) ??
						null,
				};
				if (row.session_kind === 'work') work.push(entry);
				else rest.push(entry);
			}
			// Merge into current React state so just-flushed sessions are never dropped
			// when localStorage has not caught up yet.
			setSessions((prev) => mergeSessions(prev, localWork, work));
			setRestSessions((prev) => mergeSessions(prev, localRest, rest));
		} catch {
			/* ignore */
		}
	}, []);

	const lastHydrateAtRef = useRef(0);
	const HYDRATE_FOCUS_MIN_MS = 60_000;

	useEffect(() => {
		if (typeof window === 'undefined') return;
		// Sessions already seeded from localStorage; defer the 30-day DB pull so the
		// dashboard bundle wins the network on refresh/back.
		let cancelled = false;
		const runHydrate = () => {
			if (cancelled) return;
			void hydrateSessionsFromDb({ backfill: true });
			lastHydrateAtRef.current = Date.now();
		};
		const deferId = window.setTimeout(runHydrate, 250);
		const onFocus = () => {
			// Never clobber an active clock's in-memory flushes mid-session.
			if (runningRef.current) return;
			if (Date.now() - lastHydrateAtRef.current < HYDRATE_FOCUS_MIN_MS) return;
			lastHydrateAtRef.current = Date.now();
			// Focus refresh: read recent rows only — never re-trigger year/month backfill.
			void hydrateSessionsFromDb({ backfill: false });
		};
		window.addEventListener('focus', onFocus);
		return () => {
			cancelled = true;
			window.clearTimeout(deferId);
			window.removeEventListener('focus', onFocus);
		};
	}, [hydrateSessionsFromDb]);

	// Restore clock from localStorage BEFORE paint/persist effects so we never write
	// default running:false over a live session (Strict Mode remounts included).
	useLayoutEffect(() => {
		if (!runtimeActive) return;
		if (typeof window === 'undefined') return;

		const durations = readPomodoroDurations();
		setDurationsSeconds(durations);
		setSessions(readLocalSessions(SESSIONS_KEY));
		setRestSessions(readLocalSessions(REST_SESSIONS_KEY));

		void (async () => {
			try {
				const {
					data: { user },
				} = await localData.auth.getUser();
				if (!user) return;
				const settings = await loadUserAppSettings(user.id);
				if (settings.timer) {
					const t = settings.timer;
					const updated = {
						work:
							Number(t.workMinutes) > 0
								? Math.round(Number(t.workMinutes) * 60)
								: durations.work,
						break:
							Number(t.breakMinutes) > 0
								? Math.round(Number(t.breakMinutes) * 60)
								: durations.break,
						longBreak:
							Number(t.longBreakMinutes) > 0
								? Math.round(Number(t.longBreakMinutes) * 60)
								: durations.longBreak,
					};
					setDurationsSeconds(updated);
				}
			} catch {
				/* ignore */
			}
		})();

		try {
			const saved = localStorage.getItem(POMODORO_STATE_KEY);
			if (saved) {
				const {
					remaining: r,
					mode: m,
					running: wasRunning,
					periodEndAt,
					workStartedAt,
					segmentStartedAt,
					workFreeBase,
					style: savedStyle,
				} = JSON.parse(saved) as {
					remaining?: number;
					mode?: string;
					running?: boolean;
					periodEndAt?: number | null;
					workStartedAt?: number | null;
					segmentStartedAt?: number | null;
					workFreeBase?: number | null;
					style?: TimerStyle;
				};
				const restoredMode: 'work' | 'break' | 'longBreak' =
					m === 'break' || m === 'longBreak' ? m : 'work';
				const restoredStyle = savedStyle ?? readTimerStyle();
				setTimerStyleState(restoredStyle);
				timerStyleRef.current = restoredStyle;
				if (restoredStyle === 'workFree') {
					const startedAt =
						typeof segmentStartedAt === 'number' &&
						Number.isFinite(segmentStartedAt)
							? segmentStartedAt
							: typeof workStartedAt === 'number' &&
								  Number.isFinite(workStartedAt)
								? workStartedAt
								: Date.now();
					const workFreeMode =
						restoredMode === 'longBreak' ? 'break' : restoredMode;
					const shouldRun = Boolean(wasRunning);
					const base =
						typeof workFreeBase === 'number' && Number.isFinite(workFreeBase)
							? Math.max(0, workFreeBase)
							: 0;
					workFreeBaseRef.current = base;
					const elapsed = shouldRun
						? base + Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
						: base;
					setModeState(workFreeMode);
					setViewModeState(workFreeMode);
					modeRef.current = workFreeMode;
					viewModeRef.current = workFreeMode;
					setRemaining(elapsed);
					remainingRef.current = elapsed;
					setRunning(shouldRun);
					runningRef.current = shouldRun;
					if (shouldRun) {
						activeStartAtRef.current = startedAt;
						activeTaskIdRef.current =
							workFreeMode === 'work' ? getSelectedTaskId() : null;
					} else {
						activeStartAtRef.current = null;
						activeTaskIdRef.current = null;
					}
					periodEndAtRef.current = null;
				} else {
					const maxForMode = secondsForMode(restoredMode, durations);
					let clampedRemaining = maxForMode;
					let shouldRun = false;
					let completedWhileAway = false;

					if (
						wasRunning &&
						typeof periodEndAt === 'number' &&
						Number.isFinite(periodEndAt)
					) {
						const fromDeadline = Math.max(
							0,
							Math.ceil((periodEndAt - Date.now()) / 1000),
						);
						clampedRemaining = Math.min(maxForMode, fromDeadline);
						if (fromDeadline > 0) {
							periodEndAtRef.current = periodEndAt;
							shouldRun = true;
						} else {
							// Let the normal completion effect credit this finished period.
							// Resetting to a full idle period here silently discarded work.
							periodEndAtRef.current = null;
							shouldRun = true;
							completedWhileAway = true;
							clampedRemaining = 0;
						}
					} else {
						const restoredRemaining = Number(r);
						clampedRemaining =
							isFinite(restoredRemaining) && restoredRemaining > 0
								? Math.min(maxForMode, restoredRemaining)
								: maxForMode;
						shouldRun = Boolean(wasRunning) && clampedRemaining > 0;
						// Rebuild deadline if we were running but lost periodEndAt.
						periodEndAtRef.current = shouldRun
							? Date.now() + clampedRemaining * 1000
							: null;
					}

					setModeState(restoredMode);
					setViewModeState(restoredMode);
					modeRef.current = restoredMode;
					viewModeRef.current = restoredMode;
					setRemaining(clampedRemaining);
					remainingRef.current = clampedRemaining;
					setRunning(shouldRun);
					runningRef.current = shouldRun;
					if (shouldRun) {
						const elapsed = Math.max(0, maxForMode - clampedRemaining);
						if (restoredMode === 'work') {
							activeTaskIdRef.current = getSelectedTaskId();
							if (completedWhileAway) {
								activeStartAtRef.current = Date.now() - maxForMode * 1000;
							} else if (
								typeof workStartedAt === 'number' &&
								Number.isFinite(workStartedAt)
							) {
								activeStartAtRef.current = workStartedAt;
							} else {
								activeStartAtRef.current = Date.now() - elapsed * 1000;
							}
						} else {
							// Break/longBreak: keep live rest totals accurate while counting down.
							activeTaskIdRef.current = null;
							activeStartAtRef.current = Date.now() - elapsed * 1000;
						}
					} else {
						activeStartAtRef.current = null;
						activeTaskIdRef.current = null;
					}
				}
			} else {
				const style = readTimerStyle();
				setTimerStyleState(style);
				timerStyleRef.current = style;
				setRemaining(
					style === 'workFree' ? 0 : secondsForMode('work', durations),
				);
			}
		} catch {
			const style = readTimerStyle();
			setTimerStyleState(style);
			timerStyleRef.current = style;
			setRemaining(
				style === 'workFree' ? 0 : secondsForMode('work', durations),
			);
		}

		const syncTodayKey = () => {
			setTodayKey((prev) => {
				const next = localDateKey();
				return prev === next ? prev : next;
			});
		};
		syncTodayKey();
		const interval = setInterval(syncTodayKey, 60_000);
		clientReadyRef.current = true;
		setStorageReady(true);
		return () => clearInterval(interval);
	}, [runtimeActive]);

	useEffect(() => {
		if (!running || !activeStartAtRef.current) {
			setInProgressWorkSeconds(0);
			setInProgressRestSeconds(0);
			return;
		}
		const tick = () => {
			if (!activeStartAtRef.current) {
				setInProgressWorkSeconds(0);
				setInProgressRestSeconds(0);
				return;
			}
			const elapsed = Math.max(
				0,
				Math.floor((Date.now() - activeStartAtRef.current) / 1000),
			);
			setInProgressWorkSeconds(mode === 'work' ? elapsed : 0);
			setInProgressRestSeconds(mode === 'work' ? 0 : elapsed);
		};
		tick();
		const interval = setInterval(tick, 1000);
		return () => clearInterval(interval);
	}, [running, mode]);

	useEffect(() => {
		if (!storageReady || typeof window === 'undefined') return;
		localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
	}, [sessions, storageReady]);

	useEffect(() => {
		if (!storageReady || typeof window === 'undefined') return;
		localStorage.setItem(REST_SESSIONS_KEY, JSON.stringify(restSessions));
	}, [restSessions, storageReady]);

	useEffect(() => {
		if (!storageReady || typeof window === 'undefined') return;
		localStorage.setItem(POMODORO_CONFIG_KEY, JSON.stringify(durationsSeconds));
	}, [durationsSeconds, storageReady]);

	useEffect(() => {
		if (!storageReady || typeof window === 'undefined') return;
		persistTimerSnapshot();
	}, [
		remaining,
		mode,
		running,
		timerStyle,
		storageReady,
		persistTimerSnapshot,
	]);

	useEffect(() => {
		if (!running) return;
		syncRemainingFromDeadline();
		const interval = setInterval(syncRemainingFromDeadline, 250);
		return () => clearInterval(interval);
	}, [running, syncRemainingFromDeadline]);

	/* Exact wake at period end — background tabs throttle setInterval, so a
	 * one-shot timeout keeps session-end toasts/notifications on time. */
	useEffect(() => {
		if (!running) return;
		if (timerStyle === 'workFree') return;
		const endAt = periodEndAtRef.current;
		if (endAt == null || !Number.isFinite(endAt)) return;
		const delay = Math.max(0, endAt - Date.now() + 40);
		const id = window.setTimeout(() => {
			syncRemainingFromDeadline();
		}, delay);
		return () => window.clearTimeout(id);
	}, [running, remaining, mode, timerStyle, syncRemainingFromDeadline]);

	useEffect(() => {
		const onVisible = () => {
			if (document.visibilityState === 'visible') {
				syncRemainingFromDeadline();
			}
		};
		const onFocus = () => syncRemainingFromDeadline();
		document.addEventListener('visibilitychange', onVisible);
		window.addEventListener('focus', onFocus);
		return () => {
			document.removeEventListener('visibilitychange', onVisible);
			window.removeEventListener('focus', onFocus);
		};
	}, [syncRemainingFromDeadline]);

	useEffect(() => {
		// Work free has no fixed periods — remaining 0 means idle/paused, not "done".
		if (timerStyleRef.current === 'workFree') {
			workPeriodEndHandledRef.current = false;
			return;
		}
		if (remaining > 0) {
			workPeriodEndHandledRef.current = false;
			return;
		}
		// Only complete a period that was actually running — never re-fire from an
		// idle remaining===0 left over after restore/style switch.
		if (!runningRef.current) {
			workPeriodEndHandledRef.current = false;
			return;
		}
		if (workPeriodEndHandledRef.current) return;
		workPeriodEndHandledRef.current = true;

		const currentDurations = durationsRef.current;
		const shouldAutoAdvance = autoAdvanceRef.current;
		periodEndAtRef.current = null;
		const endedMode = modeRef.current;
		const sessionTitle =
			endedMode === 'work'
				? 'Work session complete'
				: endedMode === 'break'
					? 'Short break complete'
					: 'Long break complete';
		const inTeamInterface = window.location.pathname.startsWith('/team');
		if (!inTeamInterface) {
			playTimerPeriodBell();
			showKronaToast(sessionTitle);
			showKronaBrowserNotification('session', {
				title: 'Krona',
				body: sessionTitle,
				tag: `session-end:${endedMode}:${Date.now()}`,
				href: '/',
			});
		}

		if (modeRef.current === 'work') {
			// Record only elapsed work since start/resume — never the full period again
			// (pauses already flushed partial sessions; overriding with full period inflated totals).
			if (activeStartAtRef.current) {
				flushActiveWork();
			} else {
				recordWorkSession(currentDurations.work);
			}

			const wc = workCycleCountRef.current;
			const nextMode: 'break' | 'longBreak' =
				(wc + 1) % 4 === 0 ? 'longBreak' : 'break';
			setWorkCycleCount(wc + 1);
			setModeState(nextMode);
			setViewModeState(nextMode);
			const nextRemaining = secondsForMode(nextMode, currentDurations);
			setRemaining(nextRemaining);
			if (shouldAutoAdvance) {
				periodEndAtRef.current = Date.now() + nextRemaining * 1000;
			}
			setRunning(shouldAutoAdvance);
			return;
		}

		if (modeRef.current === 'break' || modeRef.current === 'longBreak') {
			const finishedDuration =
				modeRef.current === 'longBreak'
					? currentDurations.longBreak
					: currentDurations.break;
			if (!isVacationModeActive()) {
				const newRest = { timestamp: Date.now(), duration: finishedDuration };
				setRestSessions((s) => [newRest, ...s].slice(0, 500));
				window.dispatchEvent(new Event('krona:sessions-updated'));
				logEventSync('session_completed', {
					kind: 'rest',
					duration_seconds: finishedDuration,
				});

				void (async () => {
					try {
						const {
							data: { user },
						} = await localData.auth.getUser();
						if (!user) return;
						await persistSessionToDb(user.id, {
							timestamp: Date.now(),
							duration: finishedDuration,
							sessionKind: 'rest',
						});
					} catch {}
				})();
			}
			setModeState('work');
			setViewModeState('work');
			setRemaining(currentDurations.work);
			if (shouldAutoAdvance) {
				activeStartAtRef.current = Date.now();
				activeTaskIdRef.current = getSelectedTaskId();
				periodEndAtRef.current = Date.now() + currentDurations.work * 1000;
			} else {
				activeStartAtRef.current = null;
				periodEndAtRef.current = null;
			}
			setRunning(shouldAutoAdvance);
		}
	}, [remaining]); // flushActiveWork reads refs; keep stable transition logic

	useEffect(() => {
		if (!running) return;
		if (viewMode !== mode) {
			setViewModeState(mode);
		}
	}, [running, mode, viewMode]);

	useEffect(() => {
		if (typeof window === 'undefined') return;
		const onSelectedTaskChanged = () => {
			const taskId = getSelectedTaskId();

			const currentMode = modeRef.current;
			if (currentMode === 'work') {
				// Same task re-broadcast (e.g. dashboard refetch) must not flush —
				// that notifies tasks-updated and retriggers the broadcast.
				if (taskId === activeTaskIdRef.current) {
					if (viewModeRef.current !== 'work') {
						setViewModeState('work');
					}
					return;
				}
				if (runningRef.current && activeStartAtRef.current) {
					const segmentStartedAt = activeStartAtRef.current;
					const elapsed = Math.max(
						0,
						Math.floor((Date.now() - segmentStartedAt) / 1000),
					);
					flushActiveWorkRef.current();
					advanceWorkFreeBaseAfterFlush(elapsed);
					activeStartAtRef.current = Date.now();
				}
				activeTaskIdRef.current = taskId;
				if (viewModeRef.current !== 'work') {
					setViewModeState('work');
				}
				return;
			}
			if (!taskId) return;

			const wasRunning = runningRef.current;

			if (wasRunning && periodEndAtRef.current != null) {
				const next = Math.max(
					0,
					Math.ceil((periodEndAtRef.current - Date.now()) / 1000),
				);
				setRemaining(next);
				remainingRef.current = next;
				periodEndAtRef.current = null;
			}

			flushActiveRest();

			const workFree = timerStyleRef.current === 'workFree';
			const workSeconds = workFree
				? 0
				: secondsForMode('work', durationsRef.current);
			if (workFree) workFreeBaseRef.current = 0;
			setModeState('work');
			modeRef.current = 'work';
			setViewModeState('work');
			viewModeRef.current = 'work';
			setRemaining(workSeconds);
			remainingRef.current = workSeconds;

			if (wasRunning) {
				periodEndAtRef.current = workFree
					? null
					: Date.now() + workSeconds * 1000;
				activeStartAtRef.current = Date.now();
				activeTaskIdRef.current = taskId;
				setRunning(true);
			} else {
				periodEndAtRef.current = null;
				activeStartAtRef.current = null;
				activeTaskIdRef.current = null;
				setRunning(false);
			}
		};
		window.addEventListener(SELECTED_TASK_CHANGED_EVENT, onSelectedTaskChanged);
		return () =>
			window.removeEventListener(
				SELECTED_TASK_CHANGED_EVENT,
				onSelectedTaskChanged,
			);
	}, []);

	// Completing the tracked task: credit time so far, clear assignment, keep timer running.
	useEffect(() => {
		const onTaskStatusChanged = (event: Event) => {
			const detail = (event as CustomEvent<TaskStatusChangedDetail>).detail;
			if (!detail?.taskId || detail.status !== 'done') return;

			const selectedId = getSelectedTaskId();
			if (!selectedId || selectedId !== detail.taskId) return;

			const keepRunningWork = runningRef.current && modeRef.current === 'work';

			const segmentStartedAt = activeStartAtRef.current;
			const elapsed =
				keepRunningWork && segmentStartedAt != null
					? Math.max(0, Math.floor((Date.now() - segmentStartedAt) / 1000))
					: 0;
			flushActiveWorkRef.current();
			if (keepRunningWork) {
				advanceWorkFreeBaseAfterFlush(elapsed);
				activeStartAtRef.current = Date.now();
				activeTaskIdRef.current = null;
			}
			persistSelectedTimerTask(null, null);
		};

		window.addEventListener(KRONA_TASK_STATUS_CHANGED, onTaskStatusChanged);
		return () =>
			window.removeEventListener(
				KRONA_TASK_STATUS_CHANGED,
				onTaskStatusChanged,
			);
	}, []);

	const resetTimerForMode = useCallback((m: 'work' | 'break' | 'longBreak') => {
		if (runningRef.current) return;
		if (timerStyleRef.current === 'workFree') {
			const workFreeMode = m === 'longBreak' ? 'break' : m;
			workFreeBaseRef.current = 0;
			setRemaining(0);
			remainingRef.current = 0;
			setModeState(workFreeMode);
			setViewModeState(workFreeMode);
			return;
		}
		const seconds = secondsForMode(m, durationsRef.current);
		periodEndAtRef.current = null;
		setRemaining(seconds);
		setModeState(m);
		setViewModeState(m);
		setRunning(false);
	}, []);

	const setMode = useCallback((newMode: 'work' | 'break' | 'longBreak') => {
		if (timerStyleRef.current === 'workFree') {
			const targetMode = newMode === 'longBreak' ? 'break' : newMode;
			if (targetMode === modeRef.current) {
				setViewModeState(targetMode);
				return;
			}
			if (runningRef.current) {
				if (modeRef.current === 'work') {
					flushActiveWork();
				} else {
					flushActiveRest();
				}
				workFreeBaseRef.current = 0;
				activeStartAtRef.current = Date.now();
				activeTaskIdRef.current =
					targetMode === 'work' ? getSelectedTaskId() : null;
				setRemaining(0);
				remainingRef.current = 0;
				setModeState(targetMode);
				modeRef.current = targetMode;
				setViewModeState(targetMode);
				viewModeRef.current = targetMode;
				periodEndAtRef.current = null;
				return;
			}
			setViewModeState(targetMode);
			return;
		}
		// Browsing tabs while a period runs is preview-only: the running mode keeps
		// counting (`displayRunning` is false off-tab) until Play commits the switch.
		setViewModeState(newMode);
	}, []);

	const setDurations = useCallback(
		(next: {
			workMinutes: number;
			breakMinutes: number;
			longBreakMinutes: number;
		}) => {
			const work = Math.max(60, Math.round(Number(next.workMinutes || 0) * 60));
			const shortBreak = Math.max(
				60,
				Math.round(Number(next.breakMinutes || 0) * 60),
			);
			const longBreak = Math.max(
				60,
				Math.round(Number(next.longBreakMinutes || 0) * 60),
			);
			const updated = { work, break: shortBreak, longBreak: longBreak };
			setDurationsSeconds(updated);
			// Work Free is a count-up stopwatch — never clamp/reset its elapsed display
			// from Pomodoro duration settings (hydration would wipe a paused stretch).
			if (timerStyleRef.current !== 'workFree') {
				const nextRemaining = secondsForMode(modeRef.current, updated);
				setRemaining((current) =>
					runningRef.current ? Math.min(current, nextRemaining) : nextRemaining,
				);
			}
			void (async () => {
				try {
					const {
						data: { user },
					} = await localData.auth.getUser();
					if (!user) return;
					await saveUserAppSettings(
						user.id,
						{
							timer: {
								workMinutes: Math.round(work / 60),
								breakMinutes: Math.round(shortBreak / 60),
								longBreakMinutes: Math.round(longBreak / 60),
								style: timerStyleRef.current,
							},
						},
						user.email,
					);
				} catch {
					/* ignore */
				}
			})();
		},
		[],
	);

	const start = useCallback(
		(modeOverride?: 'work' | 'break' | 'longBreak') => {
			primeTimerAlertAudio();
			if (timerStyleRef.current === 'workFree') {
				if (runningRef.current) return;
				const requested = modeOverride ?? viewModeRef.current;
				const targetMode = requested === 'longBreak' ? 'break' : requested;
				// Switching stretch starts a fresh count; resuming the same one continues it.
				if (targetMode !== modeRef.current) {
					workFreeBaseRef.current = 0;
					setModeState(targetMode);
					modeRef.current = targetMode;
				}
				setViewModeState(targetMode);
				viewModeRef.current = targetMode;
				setRemaining(workFreeBaseRef.current);
				remainingRef.current = workFreeBaseRef.current;
				periodEndAtRef.current = null;
				activeStartAtRef.current = Date.now();
				activeTaskIdRef.current =
					targetMode === 'work' ? getSelectedTaskId() : null;
				setRunning(true);
				return;
			}
			const targetMode = modeOverride ?? viewModeRef.current;

			if (runningRef.current && modeRef.current === targetMode) return;

			if (runningRef.current && modeRef.current !== targetMode) {
				commitActiveSession();
			}

			let seconds = remainingRef.current;
			if (modeRef.current !== targetMode) {
				seconds = secondsForMode(targetMode, durationsRef.current);
				setModeState(targetMode);
				setRemaining(seconds);
				remainingRef.current = seconds;
				activeStartAtRef.current = null;
				activeTaskIdRef.current = null;
			} else if (seconds <= 0) {
				seconds = secondsForMode(targetMode, durationsRef.current);
				setRemaining(seconds);
				remainingRef.current = seconds;
			}

			if (modeOverride != null) {
				setViewModeState(targetMode);
			}

			periodEndAtRef.current = Date.now() + remainingRef.current * 1000;
			setRunning(true);
			if (targetMode === 'work' && !activeStartAtRef.current) {
				activeStartAtRef.current = Date.now();
				activeTaskIdRef.current = getSelectedTaskId();
			}
		},
		[commitActiveSession],
	);

	const pause = useCallback(() => {
		if (!runningRef.current) return;
		if (timerStyleRef.current === 'workFree') {
			const elapsed =
				activeStartAtRef.current != null
					? Math.max(
							0,
							Math.floor((Date.now() - activeStartAtRef.current) / 1000),
						)
					: 0;
			if (modeRef.current === 'work') {
				flushActiveWork();
			} else {
				flushActiveRest();
			}
			workFreeBaseRef.current += elapsed;
			periodEndAtRef.current = null;
			setRemaining(workFreeBaseRef.current);
			remainingRef.current = workFreeBaseRef.current;
			setRunning(false);
			return;
		}
		if (periodEndAtRef.current != null) {
			const next = Math.max(
				0,
				Math.ceil((periodEndAtRef.current - Date.now()) / 1000),
			);
			setRemaining(next);
			remainingRef.current = next;
			periodEndAtRef.current = null;
		}
		if (modeRef.current === 'work') {
			flushActiveWork();
		} else {
			flushActiveRest();
		}
		setRunning(false);
	}, []);

	const skip = useCallback(() => {
		if (timerStyleRef.current === 'workFree') {
			const targetMode = modeRef.current === 'work' ? 'break' : 'work';
			const wasRunning = runningRef.current;
			if (wasRunning) {
				if (modeRef.current === 'work') {
					flushActiveWork();
				} else {
					flushActiveRest();
				}
			}
			workFreeBaseRef.current = 0;
			periodEndAtRef.current = null;
			setModeState(targetMode);
			modeRef.current = targetMode;
			setViewModeState(targetMode);
			viewModeRef.current = targetMode;
			setRemaining(0);
			remainingRef.current = 0;
			if (wasRunning) {
				activeStartAtRef.current = Date.now();
				activeTaskIdRef.current =
					targetMode === 'work' ? getSelectedTaskId() : null;
			} else {
				activeStartAtRef.current = null;
				activeTaskIdRef.current = null;
			}
			return;
		}
		periodEndAtRef.current = null;
		const hasTrackedTask = Boolean(getSelectedTaskId());

		if (modeRef.current === 'work') {
			flushActiveWork();
			const n = (workCycleCountRef.current + 1) % 4;
			const nextMode: 'break' | 'longBreak' = n === 0 ? 'longBreak' : 'break';
			setWorkCycleCount(workCycleCountRef.current + 1);
			setModeState(nextMode);
			setViewModeState(nextMode);
			const nextRemaining =
				nextMode === 'longBreak'
					? durationsRef.current.longBreak
					: durationsRef.current.break;
			setRemaining(nextRemaining);
			remainingRef.current = nextRemaining;
		} else if (modeRef.current === 'break') {
			flushActiveRest();
			if (hasTrackedTask) {
				setModeState('work');
				setViewModeState('work');
				setRemaining(durationsRef.current.work);
				remainingRef.current = durationsRef.current.work;
				activeStartAtRef.current = null;
			} else {
				setModeState('longBreak');
				setViewModeState('longBreak');
				setRemaining(durationsRef.current.longBreak);
				remainingRef.current = durationsRef.current.longBreak;
			}
		} else {
			// Long break → always return to work (matches natural period completion).
			flushActiveRest();
			setModeState('work');
			setViewModeState('work');
			setRemaining(durationsRef.current.work);
			remainingRef.current = durationsRef.current.work;
			activeStartAtRef.current = null;
		}
		setRunning(false);
	}, []);

	const setTimerStyle = useCallback((style: TimerStyle) => {
		const previous = timerStyleRef.current;
		const next = persistTimerStyle(style);
		setTimerStyleState(next);
		if (next === previous) return;

		if (runningRef.current) {
			if (modeRef.current === 'work') {
				flushActiveWork();
			} else {
				flushActiveRest();
			}
		}
		timerStyleRef.current = next;
		workFreeBaseRef.current = 0;
		periodEndAtRef.current = null;
		setRunning(false);
		setModeState('work');
		modeRef.current = 'work';
		setViewModeState('work');
		viewModeRef.current = 'work';
		const seconds = next === 'workFree' ? 0 : durationsRef.current.work;
		setRemaining(seconds);
		remainingRef.current = seconds;
		activeStartAtRef.current = null;
		activeTaskIdRef.current = null;
	}, []);

	const reset = useCallback(() => {
		if (timerStyleRef.current === 'workFree') {
			if (runningRef.current) {
				if (modeRef.current === 'work') flushActiveWork();
				else flushActiveRest();
			}
			workFreeBaseRef.current = 0;
			activeStartAtRef.current = null;
			activeTaskIdRef.current = null;
			periodEndAtRef.current = null;
			setRemaining(0);
			remainingRef.current = 0;
			setRunning(false);
			return;
		}
		if (viewModeRef.current !== modeRef.current) return;
		periodEndAtRef.current = null;
		if (modeRef.current === 'work') {
			flushActiveWork();
		}
		const m = modeRef.current;
		const seconds = secondsForMode(m, durationsRef.current);
		setRemaining(seconds);
		remainingRef.current = seconds;
		setRunning(false);
	}, []);

	const format = useCallback((seconds: number): string => {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins.toString().padStart(2, '0')}:${secs
			.toString()
			.padStart(2, '0')}`;
	}, []);

	const formatHours = useCallback((seconds: number): string => {
		const hours = Math.floor(seconds / 3600);
		const mins = Math.floor((seconds % 3600) / 60);
		if (mins === 0) return `${hours}h`;
		return `${hours}h ${mins}m`;
	}, []);

	const todayTotal = useMemo(() => {
		const acc = { work: 0, rest: 0 };
		if (!todayKey) return acc;
		for (const sess of sessions) {
			if (isSameLocalDay(sess.timestamp, todayKey)) {
				acc.work += sess.duration;
			}
		}
		for (const sess of restSessions) {
			if (isSameLocalDay(sess.timestamp, todayKey)) {
				acc.rest += sess.duration;
			}
		}
		acc.work += inProgressWorkSeconds;
		acc.rest += inProgressRestSeconds;
		return acc;
	}, [
		sessions,
		restSessions,
		todayKey,
		inProgressWorkSeconds,
		inProgressRestSeconds,
	]);

	const last7Days = useMemo(() => {
		if (!todayKey) return [];
		return Array.from({ length: 7 }).map((_, i) => {
			const date = localDayStart(todayKey);
			date.setDate(date.getDate() - i);
			const key = localDateKey(date);
			const dayWork = sessions
				.filter((sess) => isSameLocalDay(sess.timestamp, key))
				.reduce((sum, sess) => sum + sess.duration, 0);
			const dayRest = restSessions
				.filter((sess) => isSameLocalDay(sess.timestamp, key))
				.reduce((sum, sess) => sum + sess.duration, 0);
			return { date, work: dayWork, rest: dayRest, key };
		});
	}, [sessions, restSessions, todayKey]);

	const durationsPlain = useMemo(
		() => ({
			workMinutes: Math.round(durationsSeconds.work / 60),
			breakMinutes: Math.round(durationsSeconds.break / 60),
			longBreakMinutes: Math.round(durationsSeconds.longBreak / 60),
		}),
		[durationsSeconds.work, durationsSeconds.break, durationsSeconds.longBreak],
	);

	const displayRunning = running && viewMode === mode;
	const displayRemaining = useMemo(() => {
		if (timerStyle === 'workFree') {
			return viewMode === mode ? remaining : 0;
		}
		if (viewMode === mode) return remaining;
		return secondsForMode(viewMode, durationsSeconds);
	}, [viewMode, mode, remaining, durationsSeconds, timerStyle]);

	const removeSessionFromState = useCallback(
		(identity: SessionLogIdentity) => {
			const match = (entry: LocalSessionEntry) =>
				entry.timestamp === identity.timestamp &&
				entry.duration === identity.duration &&
				(entry.taskId ?? null) === (identity.taskId ?? null);

			if (identity.kind === 'work') {
				setSessions((prev) => {
					const index = prev.findIndex(match);
					if (index < 0) return prev;
					const next = prev.slice();
					next.splice(index, 1);
					return next;
				});
			} else {
				setRestSessions((prev) => {
					const index = prev.findIndex(match);
					if (index < 0) return prev;
					const next = prev.slice();
					next.splice(index, 1);
					return next;
				});
			}
		},
		[],
	);

	const addSessionToState = useCallback((entry: SessionLogPatch) => {
		const local: LocalSessionEntry = {
			timestamp: entry.timestamp,
			duration: entry.duration,
			taskId: entry.kind === 'work' ? entry.taskId ?? null : null,
		};
		if (entry.kind === 'work') {
			setSessions((prev) => mergeSessions([local], prev));
		} else {
			setRestSessions((prev) => mergeSessions([local], prev));
		}
	}, []);

	const updateSessionLog = useCallback(
		async (previous: SessionLogIdentity, next: SessionLogPatch) => {
			removeSessionFromState(previous);
			addSessionToState(next);
			window.dispatchEvent(new Event('krona:sessions-updated'));
			try {
				const {
					data: { user },
				} = await localData.auth.getUser();
				if (!user) return true;
				return await reviseSessionLog(user.id, previous, next);
			} catch {
				return false;
			}
		},
		[addSessionToState, removeSessionFromState],
	);

	const deleteSessionLog = useCallback(
		async (previous: SessionLogIdentity) => {
			removeSessionFromState(previous);
			window.dispatchEvent(new Event('krona:sessions-updated'));
			try {
				const {
					data: { user },
				} = await localData.auth.getUser();
				if (!user) return true;
				return await reviseSessionLog(user.id, previous, null);
			} catch {
				return false;
			}
		},
		[removeSessionFromState],
	);

	const statsValue = useMemo<PomodoroStatsState>(
		() => ({
			todayTotal,
			last7Days,
			sessions,
			restSessions,
			updateSessionLog,
			deleteSessionLog,
		}),
		[
			todayTotal,
			last7Days,
			sessions,
			restSessions,
			updateSessionLog,
			deleteSessionLog,
		],
	);

	const timerValue = useMemo<PomodoroTimerState>(
		() => ({
			mode,
			viewMode,
			setMode,
			remaining,
			running,
			displayRemaining,
			displayRunning,
			start,
			pause,
			skip,
			reset,
			format,
			formatHours,
			resetTimerForMode,
			durations: durationsPlain,
			setDurations,
			timerStyle,
			setTimerStyle,
		}),
		[
			mode,
			viewMode,
			remaining,
			running,
			displayRemaining,
			displayRunning,
			durationsPlain,
			setMode,
			start,
			pause,
			skip,
			reset,
			format,
			formatHours,
			resetTimerForMode,
			setDurations,
			timerStyle,
			setTimerStyle,
		],
	);

	return (
		<PomodoroStatsContext.Provider value={statsValue}>
			<PomodoroTimerContext.Provider value={timerValue}>
				{children}
			</PomodoroTimerContext.Provider>
		</PomodoroStatsContext.Provider>
	);
};
