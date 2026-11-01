'use client';

import { localData } from '@/lib/localData';
import { loadUserAppSettings, saveUserAppSettings } from '@/lib/userAppSettings';

export type TimerStyle = 'pomodoro' | 'workFree';

export const TIMER_STYLE_KEY = 'krona:timer-style';
export const TIMER_STYLE_CHANGED_EVENT = 'krona:timer-style-changed';

const POMODORO_CONFIG_KEY = 'krona:pomodoro-config';
const DEFAULT_STYLE: TimerStyle = 'pomodoro';
const DEFAULT_TIMER_MINUTES = {
	workMinutes: 25,
	breakMinutes: 5,
	longBreakMinutes: 15,
} as const;

/** Bumped on every local style write so in-flight hydrations can detect staleness. */
let timerStyleWriteGeneration = 0;

export function getTimerStyleWriteGeneration(): number {
	return timerStyleWriteGeneration;
}

export function normalizeTimerStyle(raw: unknown): TimerStyle {
	return raw === 'workFree' ? 'workFree' : 'pomodoro';
}

export function readTimerStyle(): TimerStyle {
	if (typeof window === 'undefined') return DEFAULT_STYLE;
	try {
		return normalizeTimerStyle(window.localStorage.getItem(TIMER_STYLE_KEY));
	} catch {
		return DEFAULT_STYLE;
	}
}

function readLocalTimerMinutes(): {
	workMinutes: number;
	breakMinutes: number;
	longBreakMinutes: number;
} {
	if (typeof window === 'undefined') {
		return { ...DEFAULT_TIMER_MINUTES };
	}
	try {
		const raw = window.localStorage.getItem(POMODORO_CONFIG_KEY);
		if (!raw) return { ...DEFAULT_TIMER_MINUTES };
		const parsed = JSON.parse(raw) as {
			work?: number;
			break?: number;
			longBreak?: number;
		};
		const workMinutes =
			Number.isFinite(parsed.work) && Number(parsed.work) >= 60
				? Math.round(Number(parsed.work) / 60)
				: DEFAULT_TIMER_MINUTES.workMinutes;
		const breakMinutes =
			Number.isFinite(parsed.break) && Number(parsed.break) >= 60
				? Math.round(Number(parsed.break) / 60)
				: DEFAULT_TIMER_MINUTES.breakMinutes;
		const longBreakMinutes =
			Number.isFinite(parsed.longBreak) && Number(parsed.longBreak) >= 60
				? Math.round(Number(parsed.longBreak) / 60)
				: DEFAULT_TIMER_MINUTES.longBreakMinutes;
		return { workMinutes, breakMinutes, longBreakMinutes };
	} catch {
		return { ...DEFAULT_TIMER_MINUTES };
	}
}

export function writeTimerStyleLocal(style: TimerStyle): void {
	if (typeof window === 'undefined') return;
	try {
		timerStyleWriteGeneration += 1;
		window.localStorage.setItem(TIMER_STYLE_KEY, style);
		window.dispatchEvent(new Event(TIMER_STYLE_CHANGED_EVENT));
	} catch {
		/* ignore */
	}
}

/**
 * Apply DB style only when nothing wrote locally since this hydrate began.
 * Returns the style that should be active (local wins on concurrent writes).
 */
export async function hydrateTimerStyleFromDb(): Promise<TimerStyle> {
	const localAtStart = readTimerStyle();
	const generationAtStart = timerStyleWriteGeneration;
	try {
		const {
			data: { user },
		} = await localData.auth.getUser();
		if (!user) return readTimerStyle();
		const settings = await loadUserAppSettings(user.id);

		// A local persist happened while we were fetching — keep local.
		if (timerStyleWriteGeneration !== generationAtStart) {
			return readTimerStyle();
		}

		if (!settings.timer?.style) return readTimerStyle();

		const next = normalizeTimerStyle(settings.timer.style);
		if (next === localAtStart && timerStyleWriteGeneration === generationAtStart) {
			return next;
		}

		if (timerStyleWriteGeneration !== generationAtStart) {
			return readTimerStyle();
		}

		writeTimerStyleLocal(next);
		return next;
	} catch {
		return readTimerStyle();
	}
}

export function persistTimerStyle(style: TimerStyle): TimerStyle {
	const next = normalizeTimerStyle(style);
	writeTimerStyleLocal(next);
	void (async () => {
		try {
			const {
				data: { user },
			} = await localData.auth.getUser();
			if (!user) return;
			const current = await loadUserAppSettings(user.id);
			const localMinutes = readLocalTimerMinutes();
			const existing = current.timer;
			await saveUserAppSettings(
				user.id,
				{
					timer: {
						workMinutes:
							typeof existing?.workMinutes === 'number' &&
							existing.workMinutes > 0
								? existing.workMinutes
								: localMinutes.workMinutes,
						breakMinutes:
							typeof existing?.breakMinutes === 'number' &&
							existing.breakMinutes > 0
								? existing.breakMinutes
								: localMinutes.breakMinutes,
						longBreakMinutes:
							typeof existing?.longBreakMinutes === 'number' &&
							existing.longBreakMinutes > 0
								? existing.longBreakMinutes
								: localMinutes.longBreakMinutes,
						style: next,
					},
				},
				user.email,
			);
		} catch {
			/* ignore */
		}
	})();
	return next;
}
