import { localData } from '@/lib/localData';

export type PersistTaskCompletionResult =
	| { ok: true; status: 'done' | 'pending'; completedAt: string | null }
	| { ok: false; error: string };

/**
 * Persist a task's done/pending status to local storage and verify a row was updated.
 * Callers should broadcast krona task events after success.
 */
export async function persistTaskCompletion(input: {
	taskId: string;
	completed: boolean;
	userId?: string | null;
}): Promise<PersistTaskCompletionResult> {
	const taskId = input.taskId?.trim();
	if (!taskId) return { ok: false, error: 'missing_task' };

	let userId = input.userId ?? null;
	if (!userId) {
		const { data: userRes } = await localData.auth.getUser();
		userId = userRes.user?.id ?? null;
	}
	if (!userId) return { ok: false, error: 'not_signed_in' };

	const status = input.completed ? 'done' : 'pending';
	const completedAt = input.completed ? new Date().toISOString() : null;
	const { data, error } = await localData
		.from('tasks')
		.update({ status, completed_at: completedAt })
		.eq('id', taskId)
		.eq('user_id', userId)
		.select('id, status, completed_at')
		.maybeSingle();

	if (error) {
		console.warn('[tasks] persist completion failed:', error.message);
		return { ok: false, error: error.message };
	}
	if (!data?.id) {
		console.warn('[tasks] persist completion matched 0 rows', { taskId });
		return { ok: false, error: 'task_not_found' };
	}

	return {
		ok: true,
		status,
		completedAt: data.completed_at ? String(data.completed_at) : completedAt,
	};
}
