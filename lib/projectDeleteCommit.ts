import { removeTasksFromTodayDailyChallenges } from '@/lib/challenges';
import {
	notifyChallengesSyncNow,
	notifyRemindersUpdated,
	notifyTasksUpdated,
} from '@/lib/kronaDataEvents';
import { deleteRemindersForProject } from '@/lib/reminderSync';
import { localData } from '@/lib/localData';

export { TASK_DELETE_UNDO_MS as PROJECT_DELETE_UNDO_MS } from '@/lib/taskDeleteCommit';

/** Permanently delete a project row (tasks keep rows with project_id set null). */
export async function commitProjectDeleteToServer(
	userId: string,
	projectId: string,
): Promise<boolean> {
	const { data: projectTasks } = await localData
		.from('tasks')
		.select('id')
		.eq('user_id', userId)
		.eq('project_id', projectId);

	const taskIds = (projectTasks ?? [])
		.map((row) => String(row.id ?? ''))
		.filter(Boolean);

	if (taskIds.length > 0) {
		await removeTasksFromTodayDailyChallenges(taskIds);
	}

	try {
		await deleteRemindersForProject(userId, projectId);
	} catch {
		/* ignore */
	}

	const { error } = await localData
		.from('projects')
		.delete()
		.eq('id', projectId)
		.eq('user_id', userId);

	if (error) return false;

	notifyTasksUpdated();
	notifyRemindersUpdated();
	notifyChallengesSyncNow();
	return true;
}
