import type { LocalDataClient } from '@/lib/localData';
import { localDateKey } from '@/lib/localDate';
import { notifyTasksUpdated } from '@/lib/kronaDataEvents';
import { localData as browserLocalData } from '@/lib/localData';

/**
 * Reset repeatable tasks completed on a previous local calendar day
 * back to pending (new day starts at local midnight).
 */
export async function resetStaleRepeatableTasks(
	userId: string,
	client: LocalDataClient = browserLocalData,
	options?: { notify?: boolean },
): Promise<number> {
	const todayKey = localDateKey();
	const { data: rows, error } = await client
		.from('tasks')
		.select('id, updated_at, completed_at')
		.eq('user_id', userId)
		.eq('repeatable', true)
		.eq('status', 'done');

	if (error || !rows?.length) return 0;

	const staleIds = rows
		.filter((row) => {
			const stamp = row.completed_at || row.updated_at;
			return localDateKey(new Date(stamp)) < todayKey;
		})
		.map((row) => row.id);

	if (staleIds.length === 0) return 0;

	const { error: updateError } = await client
		.from('tasks')
		.update({ status: 'pending', completed_at: null })
		.in('id', staleIds)
		.eq('user_id', userId);

	if (updateError) {
		console.warn('[repeatableTasks] reset failed:', updateError.message);
		return 0;
	}

	if (options?.notify !== false && typeof window !== 'undefined') {
		notifyTasksUpdated();
	}
	return staleIds.length;
}
