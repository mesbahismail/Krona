import type { LocalDataClient } from '@/lib/localData';
import {
	minutesToTime,
	sortRoutineItemsByTime,
	timeToMinutes,
	type RoutineItem,
} from '@/lib/routine';
import {
	collectAffectedRoutineDays,
	itemsForRoutineDay,
} from '@/lib/routineRepeat';
import { localData } from '@/lib/localData';

const HHMM_RE = /^(\d{1,2}):(\d{2})$/;

function explicitEndTimeToSql(endHHmm: string): string | null {
	const m = endHHmm.trim().match(HHMM_RE);
	if (!m) return null;
	const h = Number(m[1]);
	const min = Number(m[2]);
	if (!Number.isInteger(h) || !Number.isInteger(min) || h < 0 || h > 23 || min < 0 || min > 59) {
		return null;
	}
	return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`;
}

/** Resolved `activity_end_time` for DB and display (HH:mm:ss). */
export function resolveActivityEndSql(item: RoutineItem, nextItem?: RoutineItem): string {
	if (item.endTime) {
		const fromExplicit = explicitEndTimeToSql(item.endTime);
		if (fromExplicit) {
			// Ignore zero-length ends (legacy rows from the old hour-23 cap).
			if (timeToMinutes(item.endTime) !== timeToMinutes(item.time)) {
				return fromExplicit;
			}
		}
	}
	return toActivityEndSql(item.time, nextItem?.time);
}

const DEFAULT_ACTIVITY_DURATION_MINUTES = 60;
const MINUTES_PER_DAY = 24 * 60;

export function toActivityEndSql(startTime: string, nextStartTime?: string): string {
	if (nextStartTime) return `${nextStartTime}:00`;
	const endMinutes = timeToMinutes(startTime) + DEFAULT_ACTIVITY_DURATION_MINUTES;
	const h = Math.floor(endMinutes / 60);
	const m = endMinutes % 60;
	return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
}

/** DB requires activity_end_time > activity_start_time (same calendar day). */
export function coerceActivityEndSqlForDb(startHhmm: string, endHhmmSs: string): string {
	return coerceRoutineActivityTimesForDb(startHhmm, endHhmmSs).endSql;
}

function coerceRoutineActivityTimesForDb(
	startHhmm: string,
	endHhmmSs: string,
): { start: string; endSql: string } {
	let startMin = timeToMinutes(startHhmm);
	let endMin = timeToMinutes(endHhmmSs.slice(0, 5));

	if (endMin <= startMin) {
		endMin = Math.min(startMin + DEFAULT_ACTIVITY_DURATION_MINUTES, MINUTES_PER_DAY - 1);
	}
	if (endMin <= startMin) {
		endMin = Math.min(startMin + 15, MINUTES_PER_DAY - 1);
	}
	if (endMin <= startMin) {
		endMin = MINUTES_PER_DAY - 1;
		startMin = Math.max(0, endMin - DEFAULT_ACTIVITY_DURATION_MINUTES);
	}

	return {
		start: minutesToTime(startMin),
		endSql: `${minutesToTime(endMin)}:00`,
	};
}

function normalizeRoutineItemTimesForDb(
	item: RoutineItem,
	nextItem?: RoutineItem,
): { start: string; endSql: string } {
	return coerceRoutineActivityTimesForDb(
		item.time,
		resolveActivityEndSql(item, nextItem),
	);
}

export function mapDbRowsToRoutineItems(
	rows: Array<{
		activity_name: string;
		activity_start_time: string;
		activity_end_time: string | null;
	}>,
): RoutineItem[] {
	return rows.map((row) => {
		const time = row.activity_start_time.slice(0, 5);
		const endRaw = row.activity_end_time?.slice(0, 5);
		const endTime =
			endRaw && timeToMinutes(endRaw) !== timeToMinutes(time) ? endRaw : undefined;
		return {
			time,
			endTime,
			activity: row.activity_name,
		};
	});
}

export function routineItemsToInsertRows(
	items: RoutineItem[],
	userId: string,
	dayOfWeek: number,
): Array<{
	user_id: string;
	version: number;
	activity_name: string;
	activity_start_time: string;
	activity_end_time: string;
	day_of_week: number;
}> {
	return items.map((item, idx) => {
		const { start, endSql } = normalizeRoutineItemTimesForDb(item, items[idx + 1]);
		return {
			user_id: userId,
			version: 1,
			activity_name: item.activity,
			activity_start_time: `${start}:00`,
			activity_end_time: endSql,
			day_of_week: dayOfWeek,
		};
	});
}

export type RoutineDbRow = {
	activity_name: string;
	activity_start_time: string;
	activity_end_time: string | null;
	day_of_week: number | null;
};

export function getRoutineRowsForDay(rows: RoutineDbRow[], day: number): RoutineDbRow[] {
	const specific = rows.filter((r) => r.day_of_week === day);
	if (specific.length) return specific;
	return rows.filter((r) => r.day_of_week === null);
}

export async function fetchUserRoutineRows(
	userId: string,
	client?: LocalDataClient,
): Promise<RoutineDbRow[]> {
	const db = client ?? localData;
	const { data, error } = await db
		.from('routine')
		.select('activity_name, activity_start_time, activity_end_time, day_of_week')
		.eq('user_id', userId)
		.order('activity_start_time', { ascending: true });

	if (error) {
		throw new Error(error.message);
	}
	return (data ?? []) as RoutineDbRow[];
}

export type SaveUserRoutineInput = {
	userId: string;
	items: RoutineItem[];
	baselineItems: RoutineItem[];
	selectedDays: number[];
	anchorDay: number;
	title: string;
};

export async function saveUserRoutine(
	input: SaveUserRoutineInput,
): Promise<{ ok: true } | { ok: false; message: string }> {
	const { userId, items, baselineItems, selectedDays, anchorDay, title } = input;
	const sorted = sortRoutineItemsByTime(items);
	const affectedDays = collectAffectedRoutineDays(sorted, baselineItems, anchorDay);

	const { error: legacyDeleteError } = await localData
		.from('routine')
		.delete()
		.eq('user_id', userId)
		.is('day_of_week', null);

	if (legacyDeleteError) {
		return { ok: false, message: legacyDeleteError.message };
	}

	const snapshots: Array<{ day: number; rows: RoutineDbRow[] }> = [];
	for (const day of affectedDays) {
		const { data: existing, error: fetchError } = await localData
			.from('routine')
			.select('activity_name, activity_start_time, activity_end_time, day_of_week')
			.eq('user_id', userId)
			.eq('day_of_week', day);
		if (fetchError) {
			return { ok: false, message: fetchError.message };
		}
		snapshots.push({ day, rows: (existing ?? []) as RoutineDbRow[] });

		const { error } = await localData
			.from('routine')
			.delete()
			.eq('user_id', userId)
			.eq('day_of_week', day);
		if (error) {
			return { ok: false, message: error.message };
		}
	}

	const inserts = affectedDays.flatMap((day) =>
		routineItemsToInsertRows(itemsForRoutineDay(sorted, day, anchorDay), userId, day),
	);

	if (inserts.length > 0) {
		const { error } = await localData.from('routine').insert(inserts);
		if (error) {
			// Restore prior rows so a failed insert cannot leave days empty.
			for (const snap of snapshots) {
				if (!snap.rows.length) continue;
				const restore = snap.rows.map((row) => ({
					user_id: userId,
					activity_name: row.activity_name,
					activity_start_time: row.activity_start_time,
					activity_end_time: row.activity_end_time,
					day_of_week: row.day_of_week,
				}));
				const { error: restoreError } = await localData
					.from('routine')
					.insert(restore);
				if (restoreError) {
					console.warn(
						'[routineDb] restore after failed insert:',
						restoreError.message,
					);
				}
			}
			return { ok: false, message: error.message };
		}
	}

	const scheduleTitle = title.trim() || 'My routine';
	const scheduleDays = [...selectedDays].sort((a, b) => a - b);
	for (const day of scheduleDays) {
		const { error } = await localData.from('routine_schedule').upsert(
			{
				user_id: userId,
				day_of_week: day,
				title: scheduleTitle,
			},
			{ onConflict: 'user_id,day_of_week' },
		);
		if (error) {
			return { ok: false, message: error.message };
		}
	}

	return { ok: true };
}
