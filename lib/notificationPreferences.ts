'use client';

import { localData } from '@/lib/localData';
import {
	saveUserAppSettings,
	type NotificationPreferences,
} from '@/lib/userAppSettings';

export type KronaNotificationPreferences = NotificationPreferences & {
	notifyTaskComplete: boolean;
};

export const NOTIFICATION_PREFS_KEY = 'krona:notification-preferences';
export const NOTIFICATION_PREFS_CHANGED_EVENT =
	'krona:notification-preferences-changed';

const DEFAULT_PREFERENCES: KronaNotificationPreferences = {
	allowAll: true,
	notifyReminders: true,
	notifyRoutine: true,
	notifyDeadlines: true,
	notifyTaskComplete: true,
};

function normalizePreferences(
	raw: Partial<KronaNotificationPreferences> | null | undefined,
): KronaNotificationPreferences {
	return {
		allowAll: raw?.allowAll !== false,
		notifyReminders: raw?.notifyReminders !== false,
		notifyRoutine: raw?.notifyRoutine !== false,
		notifyDeadlines: raw?.notifyDeadlines !== false,
		notifyTaskComplete: raw?.notifyTaskComplete !== false,
	};
}

export function readNotificationPreferences(): KronaNotificationPreferences {
	if (typeof window === 'undefined') return DEFAULT_PREFERENCES;
	try {
		const raw = window.localStorage.getItem(NOTIFICATION_PREFS_KEY);
		if (!raw) return DEFAULT_PREFERENCES;
		return normalizePreferences(
			JSON.parse(raw) as Partial<KronaNotificationPreferences>,
		);
	} catch {
		return DEFAULT_PREFERENCES;
	}
}

export function persistNotificationPreferences(
	patch: Partial<KronaNotificationPreferences>,
): KronaNotificationPreferences {
	const next = normalizePreferences({
		...readNotificationPreferences(),
		...patch,
	});
	try {
		window.localStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(next));
		window.dispatchEvent(new Event(NOTIFICATION_PREFS_CHANGED_EVENT));
		void (async () => {
			try {
				const {
					data: { user },
				} = await localData.auth.getUser();
				if (!user) return;
				await saveUserAppSettings(
					user.id,
					{ notifications: next },
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

/** Merge DB-stored notification prefs into localStorage. */
export async function hydrateNotificationPreferencesFromDb(): Promise<KronaNotificationPreferences> {
	if (typeof window === 'undefined') return DEFAULT_PREFERENCES;
	try {
		const {
			data: { user },
		} = await localData.auth.getUser();
		if (!user) return readNotificationPreferences();
		const { data } = await localData
			.from('personal')
			.select('app_settings')
			.eq('user_id', user.id)
			.maybeSingle();
		const stored = (
			data?.app_settings as { notifications?: Partial<KronaNotificationPreferences> }
		)?.notifications;
		if (!stored) return readNotificationPreferences();
		const merged = normalizePreferences({
			...readNotificationPreferences(),
			...stored,
		});
		window.localStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(merged));
		window.dispatchEvent(new Event(NOTIFICATION_PREFS_CHANGED_EVENT));
		return merged;
	} catch {
		return readNotificationPreferences();
	}
}
