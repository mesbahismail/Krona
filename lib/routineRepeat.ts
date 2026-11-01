import {
	createRoutineEditorKey,
	normalizeRoutineRepeatDays,
	timeToMinutes,
	type RoutineItem,
} from '@/lib/routine';

type RoutineRow = {
	activity_name: string;
	activity_start_time: string;
	activity_end_time: string | null;
	day_of_week: number | null;
};

export function routineBlockSignature(
	item: Pick<RoutineItem, 'time' | 'activity' | 'endTime'>,
): string {
	return `${item.time}|${item.endTime ?? ''}|${item.activity}`;
}

function rowToSignature(row: RoutineRow): string {
	const time = row.activity_start_time.slice(0, 5);
	const endRaw = row.activity_end_time?.slice(0, 5);
	const endTime =
		endRaw && timeToMinutes(endRaw) !== timeToMinutes(time) ? endRaw : undefined;
	return routineBlockSignature({
		time,
		activity: row.activity_name,
		endTime,
	});
}

function getRowsForDay(rows: RoutineRow[], day: number): RoutineRow[] {
	const specific = rows.filter((r) => r.day_of_week === day);
	if (specific.length) return specific;
	return rows.filter((r) => r.day_of_week === null);
}

export function inferRoutineRepeatDays(
	item: RoutineItem,
	anchorDay: number,
	rows: RoutineRow[],
): number[] {
	const sig = routineBlockSignature(item);
	const days: number[] = [];
	for (let d = 0; d < 7; d++) {
		if (getRowsForDay(rows, d).some((row) => rowToSignature(row) === sig)) {
			days.push(d);
		}
	}
	return days.length ? days.sort((a, b) => a - b) : [anchorDay];
}

function ensureEditorKey(item: RoutineItem): RoutineItem {
	return item.editorKey ? item : { ...item, editorKey: createRoutineEditorKey() };
}

export function attachRoutineRepeatDays(
	items: RoutineItem[],
	anchorDay: number,
	rows: RoutineRow[],
): RoutineItem[] {
	return items.map((item) =>
		ensureEditorKey({
			...item,
			repeatDays: inferRoutineRepeatDays(item, anchorDay, rows),
		}),
	);
}

export function collectAffectedRoutineDays(
	items: RoutineItem[],
	baselineItems: RoutineItem[],
	anchorDay: number,
): number[] {
	const set = new Set<number>([anchorDay]);
	for (const item of [...items, ...baselineItems]) {
		for (const d of normalizeRoutineRepeatDays(item.repeatDays, anchorDay)) {
			set.add(d);
		}
	}
	return [...set].sort((a, b) => a - b);
}

export function itemsForRoutineDay(
	items: RoutineItem[],
	day: number,
	anchorDay: number,
): RoutineItem[] {
	return items
		.filter((item) => normalizeRoutineRepeatDays(item.repeatDays, anchorDay).includes(day))
		.sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
}
