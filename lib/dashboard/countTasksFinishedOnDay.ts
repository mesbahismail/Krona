import { isTaskDone } from '@/lib/performanceMetrics';
import { localDateKey } from '@/lib/localDate';
import type { LocalDataClient } from '@/lib/localData';

type TaskRow = {
	status?: string | null;
	completed_at?: string | null;
	updated_at?: string | null;
};

/** Tasks marked done with `completed_at` (fallback: `updated_at`) on the local calendar day. */
export function countTasksFinishedOnDay(tasks: TaskRow[], day: Date): number {
	const key = localDateKey(day);
	return tasks.filter((task) => {
		if (!isTaskDone(task)) return false;
		const stamp = task.completed_at || task.updated_at;
		if (!stamp) return false;
		return localDateKey(new Date(stamp)) === key;
	}).length;
}

/**
 * Accurate "tasks finished today" count — not limited to the dashboard's
 * newest-300-by-created_at task slice (which undercounts older completions).
 */
export async function fetchTasksFinishedTodayCount(
	localData: LocalDataClient,
	userId: string,
	day = new Date(),
): Promise<number> {
	const start = new Date(day);
	start.setHours(0, 0, 0, 0);
	const startIso = start.toISOString();

	const [byCompleted, byLegacyUpdated] = await Promise.all([
		localData
			.from('tasks')
			.select('status, completed_at, updated_at')
			.eq('user_id', userId)
			.eq('status', 'done')
			.gte('completed_at', startIso),
		localData
			.from('tasks')
			.select('status, completed_at, updated_at')
			.eq('user_id', userId)
			.eq('status', 'done')
			.is('completed_at', null)
			.gte('updated_at', startIso),
	]);

	if (byCompleted.error) {
		console.warn(
			'[dashboard] tasks finished (completed_at) load failed',
			byCompleted.error.message,
		);
	}
	if (byLegacyUpdated.error) {
		console.warn(
			'[dashboard] tasks finished (legacy updated_at) load failed',
			byLegacyUpdated.error.message,
		);
	}

	const rows = [
		...((byCompleted.data as TaskRow[]) || []),
		...((byLegacyUpdated.data as TaskRow[]) || []),
	];
	return countTasksFinishedOnDay(rows, day);
}
