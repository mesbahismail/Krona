'use client';

import * as React from 'react';
import dayjs from 'dayjs';
import { notifyVacationModeUpdated } from '@/lib/kronaDataEvents';
import { localDateKey } from '@/lib/localDate';
import { showKronaError } from '@/lib/kronaToast';
import { localData } from '@/lib/localData';
import {
	buildVacationSettingsForToggle,
	isVacationModeActive,
	markTodayVacationIfActive,
	normalizeVacationSettings,
	readVacationDays,
	syncVacationModeCache,
} from '@/lib/vacationMode';
import {
	loadUserAppSettings,
	saveUserAppSettings,
	type VacationSettings,
} from '@/lib/userAppSettings';
import { useAppRuntimeActive } from '@/app/AppRuntimeActiveContext';

type VacationModeState = {
	active: boolean;
	days: string[];
	loading: boolean;
	setActive: (next: boolean) => Promise<void>;
	isVacationDay: (dateKey: string) => boolean;
};

const VacationModeContext = React.createContext<VacationModeState | null>(null);

async function applyScheduledVacationReminders(
	userId: string,
	current: VacationSettings,
): Promise<VacationSettings> {
	type VacationReminderRow = {
		due_date: string | null;
		vacation_end_date?: string | null;
		activate_vacation_mode?: boolean | null;
	};
	const extended = await localData
		.from('reminders')
		.select('due_date, vacation_end_date, activate_vacation_mode')
		.eq('user_id', userId)
		.eq('type', 'Vacation');
	let data: VacationReminderRow[] | null =
		(extended.data as VacationReminderRow[] | null) ?? null;
	let error = extended.error;
	if (error) {
		const missingColumn =
			error.code === '42703' ||
			error.code === 'PGRST204' ||
			/vacation_end_date|activate_vacation_mode|does not exist/i.test(
				error.message,
			);
		if (missingColumn) {
			const base = await localData
				.from('reminders')
				.select('due_date')
				.eq('user_id', userId)
				.eq('type', 'Vacation');
			data = (base.data as VacationReminderRow[] | null) ?? null;
			error = base.error;
		}
	}
	if (error) {
		console.warn('[vacation] scheduled reminder lookup failed', error.message);
		return current;
	}

	const nextScheduledDays = new Set<string>();
	for (const row of data ?? []) {
		if (row.activate_vacation_mode === false) continue;
		const start = dayjs(row.due_date).startOf('day');
		const endRaw = row.vacation_end_date ?? row.due_date;
		const end = dayjs(endRaw).startOf('day');
		if (!start.isValid() || !end.isValid() || end.isBefore(start)) continue;
		const rangeDays = Math.min(730, end.diff(start, 'day'));
		for (let offset = 0; offset <= rangeDays; offset += 1) {
			nextScheduledDays.add(start.add(offset, 'day').format('YYYY-MM-DD'));
		}
	}

	const previousScheduled = new Set(current.scheduledDays ?? []);
	const manualDays = current.days.filter((day) => !previousScheduled.has(day));
	const scheduledDays = [...nextScheduledDays].sort();
	const days = [...new Set([...manualDays, ...scheduledDays])].sort();
	const today = localDateKey();
	const scheduledActive = nextScheduledDays.has(today);
	const suppress = Boolean(current.suppressScheduledActivation);

	// Schedule no longer covers today — clear suppression so a future trip can auto-on.
	if (!scheduledActive) {
		if (current.activatedBySchedule || suppress) {
			return {
				...current,
				active: current.activatedBySchedule ? false : current.active,
				days,
				scheduledDays,
				startedAt: current.activatedBySchedule ? undefined : current.startedAt,
				activatedBySchedule: false,
				suppressScheduledActivation: false,
			};
		}
		return { ...current, days, scheduledDays, suppressScheduledActivation: false };
	}

	// Reminder covers today, but user already chose “Back to work”.
	if (suppress) {
		return {
			...current,
			active: false,
			days,
			scheduledDays,
			startedAt: undefined,
			activatedBySchedule: false,
			suppressScheduledActivation: true,
		};
	}

	if (!current.active) {
		return {
			...current,
			active: true,
			days,
			scheduledDays,
			startedAt: today,
			activatedBySchedule: true,
			suppressScheduledActivation: false,
		};
	}

	return { ...current, days, scheduledDays };
}

export function useVacationMode(): VacationModeState {
	const ctx = React.useContext(VacationModeContext);
	if (!ctx) {
		throw new Error('useVacationMode must be used within VacationModeProvider');
	}
	return ctx;
}

export function VacationModeProvider({ children }: { children: React.ReactNode }) {
	const runtimeActive = useAppRuntimeActive();
	// Always start inactive so SSR HTML matches the first client render.
	// localStorage is applied after mount, then remote settings via hydrate().
	const [active, setActiveState] = React.useState(false);
	const [days, setDays] = React.useState<string[]>([]);
	const [loading, setLoading] = React.useState(true);
	const userIdRef = React.useRef<string | null>(null);
	const vacationRef = React.useRef<VacationSettings>({
		active: false,
		days: [],
	});
	const daysRef = React.useRef(days);
	const savingRef = React.useRef(false);

	React.useEffect(() => {
		daysRef.current = days;
	}, [days]);

	const applyVacation = React.useCallback((vacation: VacationSettings) => {
		const normalized = normalizeVacationSettings(vacation);
		vacationRef.current = normalized;
		setActiveState(normalized.active);
		setDays(normalized.days);
		syncVacationModeCache(normalized.active, normalized.days);
	}, []);

	const resolveUserId = React.useCallback(async (): Promise<string | null> => {
		if (userIdRef.current) return userIdRef.current;
		const {
			data: { user },
		} = await localData.auth.getUser();
		if (!user) return null;
		userIdRef.current = user.id;
		return user.id;
	}, []);

	const hydrate = React.useCallback(async () => {
		try {
			const userId = await resolveUserId();
			if (!userId) {
				userIdRef.current = null;
				applyVacation(normalizeVacationSettings(null));
				return;
			}

			const settings = await loadUserAppSettings(userId);
			let vacation = normalizeVacationSettings(settings.vacation);
			const beforeSchedule = JSON.stringify(vacation);
			vacation = await applyScheduledVacationReminders(userId, vacation);
			// A concurrent “Back to work” may have landed while reminders resolved.
			if (!savingRef.current) {
				const latest = normalizeVacationSettings(
					(await loadUserAppSettings(userId)).vacation,
				);
				if (latest.suppressScheduledActivation) {
					vacation = {
						...vacation,
						active: false,
						startedAt: undefined,
						activatedBySchedule: false,
						suppressScheduledActivation: true,
					};
				}
			}
			let shouldSave = JSON.stringify(vacation) !== beforeSchedule;
			if (vacation.active) {
				const withToday = markTodayVacationIfActive(vacation);
				if (withToday.days.length !== vacation.days.length) {
					vacation = withToday;
					shouldSave = true;
				}
			}
			if (shouldSave) {
				if (savingRef.current) return;
				await saveUserAppSettings(userId, { vacation });
				notifyVacationModeUpdated();
			}
			// Don't clobber an in-flight toggle.
			if (savingRef.current) return;
			applyVacation(vacation);
		} catch {
			// Keep last known vacation state on transient fetch failures.
			if (!savingRef.current) {
				/* no-op */
			}
		} finally {
			setLoading(false);
		}
	}, [applyVacation, resolveUserId]);

	React.useEffect(() => {
		if (!runtimeActive) return;
		// Restore cached vacation after mount (never in useState — localStorage
		// differs from the SSR default and would hydrate-mismatch the banner).
		if (!savingRef.current) {
			applyVacation({
				active: isVacationModeActive(),
				days: readVacationDays(),
			});
		}
		void hydrate();
	}, [applyVacation, hydrate, runtimeActive]);

	React.useEffect(() => {
		if (!runtimeActive) return;
		const onRefresh = () => {
			if (savingRef.current) return;
			void hydrate();
		};
		window.addEventListener('krona:vacation-updated', onRefresh);
		window.addEventListener('krona:reminders-updated', onRefresh);
		return () => {
			window.removeEventListener('krona:vacation-updated', onRefresh);
			window.removeEventListener('krona:reminders-updated', onRefresh);
		};
	}, [hydrate, runtimeActive]);

	React.useEffect(() => {
		if (!runtimeActive) return;
		const interval = window.setInterval(() => void hydrate(), 60_000);
		return () => window.clearInterval(interval);
	}, [hydrate, runtimeActive]);

	React.useEffect(() => {
		if (!runtimeActive || !active) return;
		const tick = () => {
			const today = localDateKey();
			if (daysRef.current.includes(today)) return;
			void (async () => {
				const userId = await resolveUserId();
				if (!userId || savingRef.current) return;
				const settings = await loadUserAppSettings(userId);
				const vacation = markTodayVacationIfActive(
					normalizeVacationSettings(settings.vacation),
				);
				if (!vacation.active) return;
				const saved = await saveUserAppSettings(userId, { vacation });
				if (!saved) return;
				applyVacation(vacation);
			})();
		};
		tick();
		const interval = window.setInterval(tick, 60_000);
		return () => window.clearInterval(interval);
	}, [active, applyVacation, resolveUserId, runtimeActive]);

	const setActive = React.useCallback(
		async (next: boolean) => {
			if (savingRef.current) return;
			savingRef.current = true;

			const previous = normalizeVacationSettings(vacationRef.current);
			const optimistic = buildVacationSettingsForToggle(previous, next);
			applyVacation(optimistic);

			try {
				const userId = await resolveUserId();
				if (!userId) {
					applyVacation(previous);
					showKronaError('Could not update vacation mode. Please sign in again.');
					return;
				}

				const settings = await loadUserAppSettings(userId);
				const vacation = buildVacationSettingsForToggle(
					normalizeVacationSettings(settings.vacation),
					next,
				);
				const saved = await saveUserAppSettings(userId, { vacation });
				if (!saved) {
					applyVacation(previous);
					showKronaError('Could not update vacation mode. Please try again.');
					return;
				}
				applyVacation(vacation);
				notifyVacationModeUpdated();
			} catch {
				applyVacation(previous);
				showKronaError('Could not update vacation mode. Please try again.');
			} finally {
				savingRef.current = false;
				setLoading(false);
			}
		},
		[applyVacation, resolveUserId],
	);

	const value = React.useMemo(
		() => ({
			active,
			days,
			loading,
			setActive,
			isVacationDay: (dateKey: string) => days.includes(dateKey),
		}),
		[active, days, loading, setActive],
	);

	return (
		<VacationModeContext.Provider value={value}>{children}</VacationModeContext.Provider>
	);
}
