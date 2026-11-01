import { localDateKey } from '@/lib/localDate';
import { isVacationModeActive } from '@/lib/vacationMode';
import { notifySessionsUpdated, notifyTasksUpdated } from '@/lib/kronaDataEvents';
import { formatDecimalHours, secondsToWorkedMinutes } from '@/lib/taskTime';
import { localData } from '@/lib/localData';

/** Add worked seconds to a task, roll up project totals, and upsert daily work stats. */
export async function addTaskWorkedSeconds(
	userId: string,
	taskId: string,
	seconds: number,
): Promise<number | null> {
	if (isVacationModeActive()) return null;
	if (seconds <= 0) return null;

	const { data: task } = await localData
		.from('tasks')
		.select('id, project_id, total_time_worked_minutes')
		.eq('id', taskId)
		.eq('user_id', userId)
		.maybeSingle();

	if (!task) return null;

	const addedMinutes = secondsToWorkedMinutes(seconds);
	if (addedMinutes <= 0) return null;
	const newTotalMinutes =
		Number(task.total_time_worked_minutes || 0) + addedMinutes;

	const { error } = await localData
		.from('tasks')
		.update({ total_time_worked_minutes: newTotalMinutes })
		.eq('id', taskId)
		.eq('user_id', userId);

	if (error) return null;

	if (task.project_id) {
		await syncProjectWorkedMinutes(userId, task.project_id);
	}

	notifyTasksUpdated();
	return newTotalMinutes;
}

/** Sum child task minutes into projects.time_worked_minutes. */
export async function syncProjectWorkedMinutes(
	userId: string,
	projectId: string,
): Promise<void> {
	const { data: rows } = await localData
		.from('tasks')
		.select('total_time_worked_minutes')
		.eq('project_id', projectId)
		.eq('user_id', userId);

	const totalMinutes = (rows || []).reduce(
		(sum, row) => sum + Number(row.total_time_worked_minutes || 0),
		0,
	);

	await localData
		.from('projects')
		.update({ time_worked_minutes: totalMinutes })
		.eq('id', projectId)
		.eq('user_id', userId);
}

/** Increment daily work/rest totals in the work table for a session. */
export async function recordDailyWorkRest(
	userId: string,
	kind: 'work' | 'rest',
	seconds: number,
	timestamp = Date.now(),
): Promise<void> {
	if (seconds === 0) return;
	await adjustDailyWorkRest(userId, kind, seconds, timestamp);
}

/** Apply a signed seconds delta to daily work/rest hours (can be negative). */
export async function adjustDailyWorkRest(
	userId: string,
	kind: 'work' | 'rest',
	seconds: number,
	timestamp = Date.now(),
): Promise<void> {
	if (!Number.isFinite(seconds) || seconds === 0) return;

	const workDate = localDateKey(new Date(timestamp));
	const hours = Number(formatDecimalHours(Math.abs(seconds) / 3600));
	const signed = seconds < 0 ? -hours : hours;

	const { data: existing } = await localData
		.from('work')
		.select('hours_worked_daily, hours_rested_daily')
		.eq('user_id', userId)
		.eq('work_date', workDate)
		.maybeSingle();

	const worked = Number(existing?.hours_worked_daily || 0);
	const rested = Number(existing?.hours_rested_daily || 0);
	const nextWorked =
		kind === 'work' ? Math.max(0, worked + signed) : worked;
	const nextRested =
		kind === 'rest' ? Math.max(0, rested + signed) : rested;

	await localData.from('work').upsert(
		{
			user_id: userId,
			work_date: workDate,
			hours_worked_daily: Math.min(24, Number(formatDecimalHours(nextWorked))),
			hours_rested_daily: Math.min(24, Number(formatDecimalHours(nextRested))),
		},
		{ onConflict: 'user_id,work_date' },
	);

	notifySessionsUpdated();
}

/** Adjust task worked minutes by a signed seconds delta (can be negative). */
export async function adjustTaskWorkedSeconds(
	userId: string,
	taskId: string,
	seconds: number,
): Promise<number | null> {
	if (isVacationModeActive()) return null;
	if (!Number.isFinite(seconds) || seconds === 0) return null;

	if (seconds > 0) {
		return addTaskWorkedSeconds(userId, taskId, seconds);
	}

	const { data: task } = await localData
		.from('tasks')
		.select('id, project_id, total_time_worked_minutes')
		.eq('id', taskId)
		.eq('user_id', userId)
		.maybeSingle();

	if (!task) return null;

	const removedMinutes = secondsToWorkedMinutes(Math.abs(seconds));
	if (removedMinutes <= 0) return Number(task.total_time_worked_minutes || 0);

	const newTotalMinutes = Math.max(
		0,
		Number(task.total_time_worked_minutes || 0) - removedMinutes,
	);

	const { error } = await localData
		.from('tasks')
		.update({ total_time_worked_minutes: newTotalMinutes })
		.eq('id', taskId)
		.eq('user_id', userId);

	if (error) return null;

	if (task.project_id) {
		await syncProjectWorkedMinutes(userId, task.project_id);
	}

	notifyTasksUpdated();
	return newTotalMinutes;
}
