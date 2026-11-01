import { removeTaskFromTodayDailyChallenges } from '@/lib/challenges';
import {
	notifyChallengesSyncNow,
	notifyNotesUpdated,
	notifyRemindersUpdated,
	notifyTasksUpdated,
} from '@/lib/kronaDataEvents';
import { removeChecklistItemsMatchingTask } from '@/lib/notes';
import {
	clearTaskDeleteNeedsRetry,
	clearTaskDeletePending,
	getPendingTaskDeleteIds,
	markDeletedTaskNameKey,
	markTaskDeleteCommitted,
	markTaskDeleteNeedsRetry,
	markTaskDeletePending,
} from '@/lib/pendingTaskDeletes';
import { deleteRemindersForTask } from '@/lib/reminderSync';
import { persistSelectedTimerTask } from '@/lib/selectedTimerTask';
import { clearTaskPrioritized } from '@/lib/taskPriority';
import { localData } from '@/lib/localData';

export const TASK_DELETE_UNDO_MS = 5000;

export type TaskDeleteCommitInput = {
	userId: string;
	taskId: string;
	wasPrioritized?: boolean;
	wasSelectedForTimer?: boolean;
};

async function stripTaskFromUserNotes(
	userId: string,
	taskName: string,
	projectId: string | null,
): Promise<void> {
	const name = taskName.trim();
	if (!name) return;

	const { data: notes, error } = await localData
		.from('notes')
		.select('id, body')
		.eq('user_id', userId);
	if (error || !notes?.length) return;

	await Promise.all(
		notes.map(async (note) => {
			const nextBody = removeChecklistItemsMatchingTask(note.body ?? '', {
				taskName: name,
				projectId,
			});
			if (nextBody === note.body) return;
			await localData
				.from('notes')
				.update({ body: nextBody })
				.eq('id', note.id)
				.eq('user_id', userId);
		}),
	);
	notifyNotesUpdated();
}

async function deleteTaskRow(
	userId: string,
	taskId: string,
): Promise<{ ok: boolean; errorMessage?: string }> {
	const { data, error } = await localData
		.from('tasks')
		.delete()
		.eq('id', taskId)
		.eq('user_id', userId)
		.select('id');

	if (error) {
		return { ok: false, errorMessage: error.message };
	}
	// local storage can return no error with 0 rows — treat that as failure.
	if (!data?.length) {
		return { ok: false, errorMessage: 'Task delete matched 0 rows' };
	}
	return { ok: true };
}

/** Permanently delete a task and related reminders/challenge/note links. */
export async function commitTaskDeleteToServer(
	input: TaskDeleteCommitInput,
	committedIds?: Set<string>,
): Promise<boolean> {
	if (!input.taskId) return false;
	if (committedIds?.has(input.taskId)) return true;

	markTaskDeletePending(input.taskId);
	markTaskDeleteNeedsRetry(input.taskId);

	if (input.wasPrioritized) {
		clearTaskPrioritized(input.taskId);
	}
	if (input.wasSelectedForTimer) {
		try {
			persistSelectedTimerTask(null, null);
		} catch {
			/* ignore */
		}
	}

	const { data: existing } = await localData
		.from('tasks')
		.select('id, name, project_id')
		.eq('id', input.taskId)
		.eq('user_id', input.userId)
		.maybeSingle();

	// Already gone from DB — still clean side effects and treat as success.
	if (!existing) {
		try {
			await deleteRemindersForTask(input.userId, input.taskId);
		} catch {
			/* ignore */
		}
		await removeTaskFromTodayDailyChallenges(input.taskId);
		markTaskDeleteCommitted(input.taskId);
		committedIds?.add(input.taskId);
		clearTaskDeletePending(input.taskId);
		clearTaskDeleteNeedsRetry(input.taskId);
		notifyTasksUpdated();
		notifyRemindersUpdated();
		notifyChallengesSyncNow();
		return true;
	}

	const taskName = String(existing.name ?? '');
	const projectId = existing.project_id ?? null;
	// Block note→project sync from re-inserting by name before the row is gone.
	markDeletedTaskNameKey(projectId, taskName);

	try {
		await deleteRemindersForTask(input.userId, input.taskId);
	} catch {
		/* ignore */
	}

	// Unlink from daily challenges before deleting the row so challenge sync
	// cannot keep treating this task as live during/after delete.
	await removeTaskFromTodayDailyChallenges(input.taskId);

	let result = await deleteTaskRow(input.userId, input.taskId);
	if (!result.ok) {
		// One retry for transient failures.
		result = await deleteTaskRow(input.userId, input.taskId);
	}

	if (!result.ok) {
		console.warn('[tasks] permanent delete failed', result.errorMessage);
		// Keep pending + retry so UI/refetch cannot resurrect until retry succeeds.
		return false;
	}

	try {
		await stripTaskFromUserNotes(input.userId, taskName, projectId);
	} catch (error) {
		console.warn('[tasks] note cleanup after delete failed', error);
	}

	markTaskDeleteCommitted(input.taskId);
	committedIds?.add(input.taskId);
	clearTaskDeletePending(input.taskId);
	clearTaskDeleteNeedsRetry(input.taskId);

	notifyTasksUpdated();
	notifyRemindersUpdated();
	notifyChallengesSyncNow();
	return true;
}

/** Retry any deletes that were staged but not confirmed after a reload/crash. */
export async function flushPendingTaskDeletes(userId: string): Promise<void> {
	const ids = getPendingTaskDeleteIds();
	if (!ids.length || !userId) return;

	await Promise.all(
		ids.map((taskId) =>
			commitTaskDeleteToServer({ userId, taskId }).catch((error) => {
				console.warn('[tasks] flush pending delete failed', taskId, error);
			}),
		),
	);
}
