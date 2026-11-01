/** Dashboard + performance page helpers (7-day window by default). */

export type WorkTrendDirection = 'up' | 'down';

export function isTaskDone(task: {
	status?: string | null;
	time_assigned_minutes?: number | null;
	total_time_worked_minutes?: number | null;
}): boolean {
	if (task.status) return task.status === 'done';
	const assigned = Number(task.time_assigned_minutes || 0);
	const worked = Number(task.total_time_worked_minutes || 0);
	return assigned > 0 && worked >= assigned;
}

/** 7-day average daily work (seconds → hours), always over 7 calendar days. */
export function computeAvgDailyWorkHours(
	last7Days: Array<{ work: number }>,
): number {
	const days = Array.isArray(last7Days) ? last7Days : [];
	const totalWorkSec = days.reduce((s, d) => s + (d.work || 0), 0);
	return totalWorkSec / 7 / 3600;
}

export type TaskCompletionRow = {
	status?: string | null;
	time_assigned_minutes?: number | null;
	total_time_worked_minutes?: number | null;
	completed_at?: string | null;
	updated_at?: string | null;
};

/** Tasks marked done within [startMs, endMs] by completion timestamp. */
export function countTasksFinishedInRange(
	tasks: TaskCompletionRow[],
	startMs: number,
	endMs = Date.now(),
): number {
	return tasks.filter((task) => {
		if (!isTaskDone(task)) return false;
		const stamp = task.completed_at || task.updated_at;
		if (!stamp) return false;
		const at = new Date(stamp).getTime();
		return at >= startMs && at <= endMs;
	}).length;
}

/** Compare today's work time to yesterday; `last7Days[0]` is today. */
export function computeWorkTrendVsPreviousDay(
	last7Days: Array<{ work: number }>,
): WorkTrendDirection | null {
	if (!Array.isArray(last7Days) || last7Days.length < 2) return null;
	const today = last7Days[0]?.work ?? 0;
	const yesterday = last7Days[1]?.work ?? 0;
	if (today === yesterday) return null;
	return today > yesterday ? 'up' : 'down';
}
