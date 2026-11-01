'use client';

import { readNotificationPreferences } from '@/lib/notificationPreferences';
import { readPomodoroPreferences } from '@/lib/pomodoroPreferences';

export type KronaBrowserNotificationInput = {
	title: string;
	body?: string;
	/** Dedupes / replaces prior notifications with the same tag. */
	tag?: string;
	/** App path to open when the notification is clicked. */
	href?: string;
};

/** True when the browser Notification API is available. */
export function browserNotificationsSupported(): boolean {
	return typeof window !== 'undefined' && 'Notification' in window;
}

export function getBrowserNotificationPermission(): NotificationPermission | 'unsupported' {
	if (!browserNotificationsSupported()) return 'unsupported';
	return Notification.permission;
}

/**
 * Ask for permission after a user gesture (settings toggle, first interaction).
 * Safe to call repeatedly — no-ops when already granted/denied/unsupported.
 */
export async function ensureBrowserNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
	if (!browserNotificationsSupported()) return 'unsupported';
	if (Notification.permission === 'granted') return 'granted';
	if (Notification.permission === 'denied') return 'denied';
	try {
		return await Notification.requestPermission();
	} catch {
		return Notification.permission;
	}
}

function shouldShowBrowserNotification(kind: 'reminder' | 'session'): boolean {
	const notif = readNotificationPreferences();
	if (!notif.allowAll) return false;
	if (kind === 'reminder') return notif.notifyReminders;
	const pomodoro = readPomodoroPreferences();
	return pomodoro.notifyTimer;
}

/**
 * Show a system notification when permission is granted and prefs allow it.
 * Returns true when a Notification was created; false when unsupported, denied,
 * disabled, or the browser threw.
 */
export function showKronaBrowserNotification(
	kind: 'reminder' | 'session',
	input: KronaBrowserNotificationInput,
): boolean {
	if (!browserNotificationsSupported()) return false;
	if (Notification.permission !== 'granted') return false;
	if (!shouldShowBrowserNotification(kind)) return false;

	try {
		const notification = new Notification(input.title, {
			body: input.body,
			tag: input.tag,
			icon: '/favicon.ico',
		});
		notification.onclick = () => {
			try {
				window.focus();
				if (input.href) {
					const url = new URL(input.href, window.location.origin);
					if (url.origin === window.location.origin) {
						window.location.assign(`${url.pathname}${url.search}${url.hash}`);
					}
				}
			} catch {
				/* ignore */
			}
			notification.close();
		};
		return true;
	} catch {
		/* ignore — some browsers throw when the document is not fully active */
		return false;
	}
}
