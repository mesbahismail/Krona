'use client';

import { localData } from '@/lib/localData';
import { saveUserAppSettings } from '@/lib/userAppSettings';

export type PomodoroPreferences = {
	allowSound: boolean;
	notifyTimer: boolean;
	/** When true, the next work/rest period starts automatically when one ends. */
	autoAdvance: boolean;
};

export const POMODORO_PREFS_KEY = 'krona:pomodoro-preferences';
export const POMODORO_PREFS_CHANGED_EVENT = 'krona:pomodoro-preferences-changed';

const DEFAULT_PREFERENCES: PomodoroPreferences = {
	allowSound: true,
	notifyTimer: true,
	autoAdvance: true,
};

function normalizePreferences(
	raw: Partial<PomodoroPreferences> | null | undefined,
): PomodoroPreferences {
	return {
		allowSound: raw?.allowSound !== false,
		notifyTimer: raw?.notifyTimer !== false,
		autoAdvance: raw?.autoAdvance !== false,
	};
}

export function readPomodoroPreferences(): PomodoroPreferences {
	if (typeof window === 'undefined') return DEFAULT_PREFERENCES;
	try {
		const raw = window.localStorage.getItem(POMODORO_PREFS_KEY);
		if (!raw) return DEFAULT_PREFERENCES;
		return normalizePreferences(JSON.parse(raw) as Partial<PomodoroPreferences>);
	} catch {
		return DEFAULT_PREFERENCES;
	}
}

/** Merge DB-stored pomodoro prefs into localStorage (cross-device sync). */
export async function hydratePomodoroPreferencesFromDb(): Promise<PomodoroPreferences> {
	if (typeof window === 'undefined') return DEFAULT_PREFERENCES;
	try {
		const {
			data: { user },
		} = await localData.auth.getUser();
		if (!user) return readPomodoroPreferences();
		const { data } = await localData
			.from('personal')
			.select('app_settings')
			.eq('user_id', user.id)
			.maybeSingle();
		const stored = (data?.app_settings as { pomodoro?: Partial<PomodoroPreferences> })
			?.pomodoro;
		if (!stored) return readPomodoroPreferences();
		const merged = normalizePreferences({
			...readPomodoroPreferences(),
			...stored,
		});
		window.localStorage.setItem(POMODORO_PREFS_KEY, JSON.stringify(merged));
		window.dispatchEvent(new Event(POMODORO_PREFS_CHANGED_EVENT));
		return merged;
	} catch {
		return readPomodoroPreferences();
	}
}

export function persistPomodoroPreferences(
	patch: Partial<PomodoroPreferences>,
): PomodoroPreferences {
	const next = normalizePreferences({
		...readPomodoroPreferences(),
		...patch,
	});
	try {
		window.localStorage.setItem(POMODORO_PREFS_KEY, JSON.stringify(next));
		window.dispatchEvent(new Event(POMODORO_PREFS_CHANGED_EVENT));
		void (async () => {
			try {
				const {
					data: { user },
				} = await localData.auth.getUser();
				if (!user) return;
				await saveUserAppSettings(
					user.id,
					{ pomodoro: next },
					user.email,
				);
			} catch {
				/* ignore */
			}
		})();
	} catch {
		/* ignore */
	}
	return next;
}
