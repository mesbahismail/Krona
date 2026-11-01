'use client';

import * as React from 'react';
import { localData } from '@/lib/localData';
import {
	fetchUserRoutineRows,
	getRoutineRowsForDay,
	mapDbRowsToRoutineItems,
} from '@/lib/routineDb';
import {
	getRoutineTimeState,
	routineActivityEmoji,
	routineActivityLabel,
} from '@/lib/routine';
import { localDateKey } from '@/lib/localDate';
import {
	KRONA_TASK_STATUS_CHANGED,
	type TaskStatusChangedDetail,
} from '@/lib/kronaDataEvents';
import {
	hydrateNotificationPreferencesFromDb,
	readNotificationPreferences,
} from '@/lib/notificationPreferences';
import {
	playNotificationSound,
	primeNotificationAudio,
} from '@/lib/notificationSound';
import { showKronaToast } from '@/lib/kronaToast';
import { reminderDueIso } from '@/lib/reminders';
import {
	ensureBrowserNotificationPermission,
	showKronaBrowserNotification,
} from '@/lib/browserNotifications';
import { useTeamMode } from '@/components/teams/TeamModeContext';

const POLL_MS = 20_000;

function crossedDue(dueMs: number, lastCheckMs: number, nowMs: number): boolean {
	return Number.isFinite(dueMs) && lastCheckMs < dueMs && nowMs >= dueMs;
}

/**
 * Background alerts: reminder due, deadline due, routine block start, task complete.
 * Pro-only surfaces (routine) stay silent for free users.
 * Reminder checks keep running while the tab is hidden so browser notifications fire.
 */
export default function NotificationAlerts() {
	const { mode: workspaceMode } = useTeamMode();
	/** Separate cursors — hidden tabs still poll reminders but skip deadlines. */
	const lastReminderCheckRef = React.useRef<number>(Date.now());
	const lastDeadlineCheckRef = React.useRef<number>(Date.now());
	const routineItemKeyRef = React.useRef<string | null>(null);
	const routineReadyRef = React.useRef(false);
	const firedKeysRef = React.useRef<Set<string>>(new Set());
	/** Due reminders that crossed while hidden without a delivered alert — retry later. */
	const pendingReminderKeysRef = React.useRef<Set<string>>(new Set());

	React.useEffect(() => {
		if (workspaceMode === 'team') return;
		void hydrateNotificationPreferencesFromDb();

		const prime = () => {
			primeNotificationAudio();
			const prefs = readNotificationPreferences();
			if (prefs.allowAll) {
				void ensureBrowserNotificationPermission();
			}
		};
		window.addEventListener('pointerdown', prime, { once: true });
		window.addEventListener('keydown', prime, { once: true });

		const onTaskStatusChanged = (event: Event) => {
			const detail = (event as CustomEvent<TaskStatusChangedDetail>).detail;
			if (detail?.status !== 'done' || !detail.taskId) return;
			const prefs = readNotificationPreferences();
			if (!prefs.allowAll || !prefs.notifyTaskComplete) return;
			playNotificationSound('taskComplete');
		};
		window.addEventListener(KRONA_TASK_STATUS_CHANGED, onTaskStatusChanged);

		return () => {
			window.removeEventListener('pointerdown', prime);
			window.removeEventListener('keydown', prime);
			window.removeEventListener(KRONA_TASK_STATUS_CHANGED, onTaskStatusChanged);
		};
	}, [workspaceMode]);

	React.useEffect(() => {
		if (workspaceMode === 'team') return;
		let cancelled = false;

		const tick = async () => {
			if (cancelled) return;

			const now = Date.now();
			const lastReminderCheck = lastReminderCheckRef.current;
			const lastDeadlineCheck = lastDeadlineCheckRef.current;
			const prefs = readNotificationPreferences();
			const tabVisible = document.visibilityState === 'visible';

			let ranReminders = false;
			let ranDeadlines = false;

			try {
				const {
					data: { user },
				} = await localData.auth.getUser();
				if (!user || cancelled) return;

				const wantReminders = prefs.allowAll && prefs.notifyReminders;
				const wantDeadlines =
					tabVisible && prefs.allowAll && prefs.notifyDeadlines;
				const wantRoutine =
					tabVisible &&
					prefs.allowAll &&
					prefs.notifyRoutine;

				const [reminderRes, taskRes, routineRows] = await Promise.all([
					wantReminders
						? localData
								.from('reminders')
								.select('id, name, due_date, date_created, type')
								.eq('user_id', user.id)
								.limit(200)
						: Promise.resolve({ data: null }),
					wantDeadlines
						? localData
								.from('tasks')
								.select('id, name, deadline, status')
								.eq('user_id', user.id)
								.not('deadline', 'is', null)
								.neq('status', 'done')
								.limit(200)
						: Promise.resolve({ data: null }),
					wantRoutine
						? fetchUserRoutineRows(user.id, localData)
						: Promise.resolve([]),
				]);

				if (cancelled) return;

				if (wantReminders) {
					ranReminders = true;
					for (const row of reminderRes.data || []) {
						const dueIso = reminderDueIso(row);
						const dueMs = Date.parse(dueIso);
						const key = `reminder:${row.id}:${dueIso}`;
						if (firedKeysRef.current.has(key)) {
							pendingReminderKeysRef.current.delete(key);
							continue;
						}
						const newlyCrossed = crossedDue(dueMs, lastReminderCheck, now);
						const pendingRetry = pendingReminderKeysRef.current.has(key);
						if (!newlyCrossed && !pendingRetry) continue;
						if (newlyCrossed) pendingReminderKeysRef.current.add(key);

						const title = row.name || 'Upcoming reminder';
						const browserShown = showKronaBrowserNotification('reminder', {
							title: 'Krona reminder',
							body: title,
							tag: key,
							href: '/reminders',
						});
						if (tabVisible) {
							playNotificationSound('reminder');
							showKronaToast(`Reminder: ${title}`);
						}
						/* Only clear retries after a real alert — permission denied /
						 * no-op must keep the reminder pending for the next poll. */
						if (tabVisible || browserShown) {
							firedKeysRef.current.add(key);
							pendingReminderKeysRef.current.delete(key);
						}
					}
				} else {
					pendingReminderKeysRef.current.clear();
				}

				if (wantDeadlines) {
					ranDeadlines = true;
					for (const row of taskRes.data || []) {
						if (!row.deadline) continue;
						const dueMs = Date.parse(row.deadline);
						const key = `deadline:${row.id}:${row.deadline}`;
						if (firedKeysRef.current.has(key)) continue;
						if (!crossedDue(dueMs, lastDeadlineCheck, now)) continue;
						firedKeysRef.current.add(key);
						playNotificationSound('deadline');
						showKronaToast(`Deadline: ${row.name || 'Task due'}`);
					}
				}

				if (wantRoutine) {
					const dayKey = new Date().getDay();
					const items = mapDbRowsToRoutineItems(
						getRoutineRowsForDay(routineRows, dayKey),
					);
					const state = getRoutineTimeState(items, new Date());
					const currentKey = state.currentItem
						? `${localDateKey(new Date())}:${state.currentItem.activity}:${state.currentItem.time}`
						: null;

					if (!routineReadyRef.current) {
						routineItemKeyRef.current = currentKey;
						routineReadyRef.current = true;
					} else if (currentKey && currentKey !== routineItemKeyRef.current) {
						routineItemKeyRef.current = currentKey;
						const activity = state.currentItem?.activity || 'Routine';
						const emoji = routineActivityEmoji(activity);
						const label = routineActivityLabel(activity) || 'Routine';
						playNotificationSound('routine');
						showKronaToast(`${emoji} Routine: ${label}`);
					} else {
						routineItemKeyRef.current = currentKey;
					}
				} else if (tabVisible) {
					routineReadyRef.current = false;
					routineItemKeyRef.current = null;
				}
			} catch {
				/* ignore */
			} finally {
				if (ranReminders) lastReminderCheckRef.current = now;
				if (ranDeadlines) lastDeadlineCheckRef.current = now;
			}
		};

		void tick();
		const interval = window.setInterval(() => void tick(), POLL_MS);
		const onVisible = () => {
			if (document.visibilityState === 'visible') void tick();
		};
		document.addEventListener('visibilitychange', onVisible);

		return () => {
			cancelled = true;
			window.clearInterval(interval);
			document.removeEventListener('visibilitychange', onVisible);
		};
	}, [workspaceMode]);

	return null;
}
