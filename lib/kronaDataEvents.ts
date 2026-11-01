import { clearTaskDeletePending, markTaskDeletePending } from '@/lib/pendingTaskDeletes';

/** Cross-page data sync events (dashboard widgets, performance, projects). */

export type TaskPendingDeleteDetail = { taskId: string };
export type TaskStatusChangedDetail = { taskId: string; status: 'done' | 'pending' };

export const KRONA_TASKS_UPDATED = 'krona:tasks-updated';
export const KRONA_TASK_PENDING_DELETE = 'krona:task-pending-delete';
export const KRONA_TASK_STATUS_CHANGED = 'krona:task-status-changed';

export function notifyTasksUpdated() {
	if (typeof window === 'undefined') return;
	window.dispatchEvent(new Event(KRONA_TASKS_UPDATED));
}

/** Optimistic removal while undo toast is open (dashboard ↔ projects). */
export function notifyTaskPendingDelete(taskId: string) {
	if (typeof window === 'undefined' || !taskId) return;
	markTaskDeletePending(taskId);
	window.dispatchEvent(
		new CustomEvent<TaskPendingDeleteDetail>(KRONA_TASK_PENDING_DELETE, {
			detail: { taskId },
		}),
	);
}

/** Undo a staged delete — allow the task to show again in refetches. */
export function notifyTaskDeleteReverted(taskId: string) {
	if (!taskId) return;
	clearTaskDeletePending(taskId);
}

/** Optimistic status move without waiting for a full reload. */
export function notifyTaskStatusChanged(taskId: string, status: 'done' | 'pending') {
	if (typeof window === 'undefined' || !taskId) return;
	window.dispatchEvent(
		new CustomEvent<TaskStatusChangedDetail>(KRONA_TASK_STATUS_CHANGED, {
			detail: { taskId, status },
		}),
	);
	if (status === 'done') {
		notifyKronaWin('task_done');
	}
}

/** Recompute daily challenge progress immediately (after task status changes). */
export function notifyChallengesSyncNow() {
	if (typeof window === 'undefined') return;
	window.dispatchEvent(new Event('krona:challenges-sync-now'));
}

export function notifyRemindersUpdated() {
	if (typeof window === 'undefined') return;
	window.dispatchEvent(new Event('krona:reminders-updated'));
}

export function notifyNotesUpdated() {
	if (typeof window === 'undefined') return;
	window.dispatchEvent(new Event('krona:notes-updated'));
}

export function notifySessionsUpdated() {
	if (typeof window === 'undefined') return;
	window.dispatchEvent(new Event('krona:sessions-updated'));
}

export function notifyChallengesUpdated() {
	if (typeof window === 'undefined') return;
	window.dispatchEvent(new Event('krona:challenges-updated'));
}

export function notifyRoutinesUpdated() {
	if (typeof window === 'undefined') return;
	window.dispatchEvent(new Event('krona:routines-updated'));
}

export function notifyVacationModeUpdated() {
	if (typeof window === 'undefined') return;
	window.dispatchEvent(new Event('krona:vacation-updated'));
}

export const KRONA_AVATAR_UPDATED = 'krona:avatar-updated';
export const KRONA_PROFILE_IDENTITY_UPDATED = 'krona:profile-identity-updated';

export function notifyProfileIdentityUpdated() {
	if (typeof window === 'undefined') return;
	window.dispatchEvent(new Event(KRONA_PROFILE_IDENTITY_UPDATED));
}

export function notifyAvatarUpdated(url?: string | null) {
	if (typeof window === 'undefined') return;
	window.dispatchEvent(
		new CustomEvent<{ url?: string | null }>(KRONA_AVATAR_UPDATED, {
			detail: { url },
		}),
	);
}

/** Positive user wins — motivational toasts (max a few per day). */
export type KronaWinKind = 'task_done' | 'project_created' | 'routine_saved';

export const KRONA_WIN = 'krona:win';

export function notifyKronaWin(kind: KronaWinKind) {
	if (typeof window === 'undefined') return;
	window.dispatchEvent(
		new CustomEvent<{ kind: KronaWinKind }>(KRONA_WIN, {
			detail: { kind },
		}),
	);
}
