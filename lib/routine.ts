export const ROUTINE_WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export type RoutineItem = {
	time: string;
	activity: string;
	/** End time HH:mm; from DB or inferred from next activity. */
	endTime?: string;
	/** Weekdays 0=Sun … 6=Sat when this block repeats. */
	repeatDays?: number[];
	/** Stable id for editor list rows (not persisted). */
	editorKey?: string;
};

export function formatRoutineRepeatDays(days: number[]): string {
	if (!days.length) return '';
	return [...days]
		.sort((a, b) => a - b)
		.map((d) => ROUTINE_WEEKDAY_LABELS[d] ?? '')
		.filter(Boolean)
		.join(', ');
}

export function normalizeRoutineRepeatDays(
	days: number[] | undefined,
	fallbackDay: number,
): number[] {
	return [...new Set(days?.length ? days : [fallbackDay])].sort((a, b) => a - b);
}

export function toggleRoutineRepeatDay(
	current: number[] | undefined,
	day: number,
	fallbackDay: number,
): number[] {
	const normalized = normalizeRoutineRepeatDays(current, fallbackDay);
	if (normalized.includes(day)) {
		if (normalized.length === 1) return normalized;
		return normalized.filter((d) => d !== day);
	}
	return [...normalized, day].sort((a, b) => a - b);
}

export const DEFAULT_ROUTINE: RoutineItem[] = [
	{ time: '07:00', activity: 'Wake up' },
	{ time: '07:30', activity: 'Shower' },
	{ time: '08:00', activity: 'Breakfast' },
	{ time: '09:00', activity: 'Work/Study' },
	{ time: '10:30', activity: 'Workout' },
	{ time: '12:00', activity: 'Lunch' },
	{ time: '13:00', activity: 'Work/Study' },
	{ time: '16:00', activity: 'Break' },
	{ time: '18:00', activity: 'Walk' },
	{ time: '19:00', activity: 'Dinner' },
	{ time: '20:00', activity: 'Reading' },
	{ time: '22:00', activity: 'Sleep' },
];

/** Stable editor row id (not persisted). Safari-safe when randomUUID is unavailable. */
export function createRoutineEditorKey(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		try {
			return `rb-${crypto.randomUUID()}`;
		} catch {
			/* non-secure context */
		}
	}
	return `rb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function matchLeadingEmojiSegment(activity: string): string | null {
	if (!activity) return null;
	try {
		const match = activity.match(
			/^(\p{Extended_Pictographic}(?:\p{Emoji_Modifier}|\uFE0F|\u200D\p{Extended_Pictographic})*)/u,
		);
		if (match) return match[0];
	} catch {
		/* Safari < 16.4: Unicode property escapes unsupported */
	}
	const known = [...ROUTINE_ACTIVITY_EMOJI_OPTIONS].sort((a, b) => b.length - a.length);
	for (const emoji of known) {
		if (activity.startsWith(emoji)) return emoji;
	}
	const first = activity.codePointAt(0);
	if (first === undefined) return null;
	if (
		(first >= 0x1f300 && first <= 0x1faff) ||
		(first >= 0x2600 && first <= 0x27bf)
	) {
		return String.fromCodePoint(first);
	}
	return null;
}

/** Keyword → emoji when activity name has no leading emoji. */
const ROUTINE_LABEL_EMOJI: ReadonlyArray<[string, string]> = [
	['wake', '☀️'],
	['shower', '🚿'],
	['breakfast', '🍳'],
	['lunch', '🍽️'],
	['dinner', '🍽️'],
	['workout', '💪'],
	['work', '💼'],
	['study', '📚'],
	['walk', '🚶'],
	['break', '☕'],
	['reading', '📖'],
	['read', '📖'],
	['sleep', '🌙'],
	['meditat', '🧘'],
	['coffee', '☕'],
	['meal', '🍽️'],
];

export function timeToMinutes(t: string): number {
	const [h, m] = t.split(':').map(Number);
	return h * 60 + m;
}

export function minutesToTime(totalMinutes: number): string {
	const mins = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
	const h = Math.floor(mins / 60);
	const m = mins % 60;
	return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const ROUTINE_DEFAULT_DURATION_MINUTES = 60;
const ROUTINE_MIN_BLOCK_MINUTES = 15;
const MINUTES_PER_DAY = 24 * 60;

export function sortRoutineItemsByTime(items: RoutineItem[]): RoutineItem[] {
	return [...items].sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
}

function routineItemDurationMinutes(item: RoutineItem): number {
	if (item.endTime) {
		const start = timeToMinutes(item.time);
		const end = timeToMinutes(item.endTime);
		if (end > start) return end - start;
		if (end < start) return end + MINUTES_PER_DAY - start;
	}
	return ROUTINE_DEFAULT_DURATION_MINUTES;
}

function routineItemEndMinutes(item: RoutineItem, nextItem?: RoutineItem): number {
	if (item.endTime) {
		const start = timeToMinutes(item.time);
		const end = timeToMinutes(item.endTime);
		if (end > start) return end;
		if (end < start) return end + MINUTES_PER_DAY;
		return start + ROUTINE_DEFAULT_DURATION_MINUTES;
	}
	if (nextItem) return timeToMinutes(nextItem.time);
	return timeToMinutes(item.time) + ROUTINE_DEFAULT_DURATION_MINUTES;
}

/** Pick valid same-day start/end for a newly added routine block. */
export function suggestNewRoutineBlockTimes(
	items: RoutineItem[],
): { time: string; endTime: string } {
	if (items.length === 0) {
		return { time: '09:00', endTime: '10:00' };
	}

	const sorted = sortRoutineItemsByTime(items);
	const last = sorted[sorted.length - 1]!;
	const startAfterLast = routineItemEndMinutes(last) % MINUTES_PER_DAY;
	const endAfterLast = startAfterLast + ROUTINE_DEFAULT_DURATION_MINUTES;

	if (endAfterLast < MINUTES_PER_DAY && endAfterLast > startAfterLast) {
		return {
			time: minutesToTime(startAfterLast),
			endTime: minutesToTime(endAfterLast),
		};
	}

	let bestStart = 8 * 60;
	let bestSize = 0;

	for (let i = 0; i <= sorted.length; i += 1) {
		const prev = i > 0 ? sorted[i - 1]! : null;
		const next = i < sorted.length ? sorted[i]! : null;
		const gapStart =
			prev === null ? 0 : routineItemEndMinutes(prev, next ?? undefined) % MINUTES_PER_DAY;
		const gapEnd = next === null ? MINUTES_PER_DAY - 1 : timeToMinutes(next.time);

		if (gapEnd > gapStart) {
			const size = gapEnd - gapStart;
			if (size > bestSize) {
				bestSize = size;
				bestStart = gapStart;
			}
		}
	}

	if (bestSize >= ROUTINE_MIN_BLOCK_MINUTES) {
		const duration = Math.min(ROUTINE_DEFAULT_DURATION_MINUTES, bestSize);
		return {
			time: minutesToTime(bestStart),
			endTime: minutesToTime(bestStart + duration),
		};
	}

	return { time: '08:00', endTime: '09:00' };
}

function placeRoutineItemInGap(
	item: RoutineItem,
	prev: RoutineItem | null,
	next: RoutineItem | null,
): RoutineItem {
	const duration = Math.max(
		ROUTINE_MIN_BLOCK_MINUTES,
		Math.min(routineItemDurationMinutes(item), MINUTES_PER_DAY),
	);

	if (!prev && !next) {
		return item;
	}

	if (!prev && next) {
		const nextStart = timeToMinutes(next.time);
		const end = nextStart;
		const start = Math.max(0, end - duration);
		return {
			...item,
			time: minutesToTime(start),
			endTime: minutesToTime(end),
		};
	}

	if (prev && !next) {
		const { time, endTime } = suggestNewRoutineBlockTimes([prev]);
		return {
			...item,
			time,
			endTime,
		};
	}

	if (prev && next) {
		const gapStart = routineItemEndMinutes(prev, next) % MINUTES_PER_DAY;
		const gapEnd = timeToMinutes(next.time);
		if (gapEnd > gapStart) {
			const dur = Math.min(duration, gapEnd - gapStart);
			const start = gapStart;
			const end = gapStart + dur;
			return {
				...item,
				time: minutesToTime(start),
				endTime: minutesToTime(end),
			};
		}
	}

	if (prev) {
		const start = routineItemEndMinutes(prev) % MINUTES_PER_DAY;
		const end = Math.min(start + duration, MINUTES_PER_DAY - 1);
		return {
			...item,
			time: minutesToTime(start),
			endTime: minutesToTime(Math.max(end, start + ROUTINE_MIN_BLOCK_MINUTES)),
		};
	}

	return item;
}

/** Reorder by drag: only the moved block may get new times; other blocks keep theirs. */
export function reorderRoutineItemsByDrag(
	items: RoutineItem[],
	fromIndex: number,
	toIndex: number,
): RoutineItem[] {
	const sorted = sortRoutineItemsByTime(items);
	if (
		fromIndex < 0 ||
		toIndex < 0 ||
		fromIndex >= sorted.length ||
		toIndex >= sorted.length ||
		fromIndex === toIndex
	) {
		return items;
	}

	const moved = sorted[fromIndex]!;
	const without = sorted.filter((_, i) => i !== fromIndex);
	const insertAt = toIndex > fromIndex ? toIndex - 1 : toIndex;
	const prev = insertAt > 0 ? without[insertAt - 1]! : null;
	const next = insertAt < without.length ? without[insertAt]! : null;

	const placed = placeRoutineItemInGap(moved, prev, next);
	without.splice(insertAt, 0, placed);
	return sortRoutineItemsByTime(without);
}

export function formatTime12h(time24: string): string {
	const [h, m] = time24.split(':').map(Number);
	const period = h >= 12 ? 'PM' : 'AM';
	const h12 = h % 12 || 12;
	return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

export function formatRoutineDuration(totalMinutes: number): string {
	const h = Math.floor(totalMinutes / 60);
	const m = totalMinutes % 60;
	if (h > 0 && m > 0) {
		return `${h} hour${h === 1 ? '' : 's'} ${m} minute${m === 1 ? '' : 's'}`;
	}
	if (h > 0) return `${h} hour${h === 1 ? '' : 's'}`;
	return `${m} minute${m === 1 ? '' : 's'}`;
}

export function routineSegmentDurationMinutes(
	item: RoutineItem,
	nextItem?: RoutineItem,
): number {
	const start = timeToMinutes(item.time);
	let end: number;
	if (item.endTime) {
		end = timeToMinutes(item.endTime);
	} else if (nextItem) {
		end = timeToMinutes(nextItem.time);
	} else {
		end = start + 60;
	}
	let mins = end - start;
	if (mins <= 0) mins += 24 * 60;
	return mins;
}

export function midpointTime(timeA: string, timeB: string): string {
	return minutesToTime(Math.floor((timeToMinutes(timeA) + timeToMinutes(timeB)) / 2));
}

export const ROUTINE_ACTIVITY_EMOJI_OPTIONS = [
	'✨',
	'☀️',
	'🌙',
	'🚿',
	'🍳',
	'🍽️',
	'🥗',
	'🍕',
	'☕',
	'💪',
	'🏃',
	'🚶',
	'🧘',
	'💼',
	'📚',
	'📖',
	'✏️',
	'🎮',
	'🎧',
	'🎬',
	'🛏️',
	'🧹',
	'🚗',
	'🎯',
	'💊',
	'📞',
] as const;

export function suggestRoutineActivityEmoji(label: string): string {
	const normalized = label.trim().toLowerCase();
	if (!normalized) return '✨';
	for (const [key, emoji] of ROUTINE_LABEL_EMOJI) {
		if (normalized.includes(key)) return emoji;
	}
	return '✨';
}

export function formatRoutineActivity(emoji: string, label: string): string {
	const trimmed = label.trim();
	if (!trimmed) return emoji;
	return `${emoji} ${trimmed}`;
}

export function routineActivityEmoji(activity: string): string {
	const emoji = matchLeadingEmojiSegment(activity);
	if (emoji) return emoji;
	return suggestRoutineActivityEmoji(routineActivityLabel(activity));
}

export function routineActivityLabel(activity: string): string {
	const emoji = matchLeadingEmojiSegment(activity);
	return emoji ? activity.slice(emoji.length).trimStart() : activity;
}

export function getRoutineItemEndMinutes(
	item: RoutineItem,
	index: number,
	items: RoutineItem[],
): number {
	const segments = buildRoutineSegments(items);
	return segments[index]?.end ?? timeToMinutes(item.time) + 60;
}

function minutesUntilSegmentEnd(nowMinutes: number, start: number, end: number): number {
	if (end > start) {
		return Math.max(0, end - nowMinutes);
	}
	if (nowMinutes >= start) {
		return 24 * 60 - nowMinutes + end;
	}
	return Math.max(0, end - nowMinutes);
}

export function formatRoutineTimeLeft(totalMinutes: number): string {
	if (totalMinutes <= 0) return 'Ending soon';
	if (totalMinutes < 60) return `${totalMinutes}m left`;
	const h = Math.floor(totalMinutes / 60);
	const m = totalMinutes % 60;
	if (m === 0) return `${h}h left`;
	return `${h}h ${m}m left`;
}

export function getNextRoutineItem(
	items: RoutineItem[],
	currentIndex: number,
): RoutineItem | null {
	if (currentIndex < 0 || items.length === 0) return null;
	if (items.length === 1) return null;
	return items[(currentIndex + 1) % items.length];
}

type RoutineSegment = { start: number; end: number };

function buildRoutineSegments(items: RoutineItem[]): RoutineSegment[] {
	return items.map((item, index) => {
		const start = timeToMinutes(item.time);
		let end: number;
		if (item.endTime) {
			end = timeToMinutes(item.endTime);
		} else if (index < items.length - 1) {
			end = timeToMinutes(items[index + 1].time);
		} else {
			end = timeToMinutes(items[0].time);
		}
		return { start, end };
	});
}

function isMinuteInSegment(nowMinutes: number, start: number, end: number): boolean {
	if (end > start) {
		return nowMinutes >= start && nowMinutes < end;
	}
	return nowMinutes >= start || nowMinutes < end;
}

function isWithinRoutineWindow(nowMinutes: number, segments: RoutineSegment[]): boolean {
	return segments.some((seg) => isMinuteInSegment(nowMinutes, seg.start, seg.end));
}

/** Activity block active at `now` (null during sleep / outside routine window). */
export function getCurrentRoutineItem(
	routine: RoutineItem[],
	now: Date,
): { item: RoutineItem; index: number } | null {
	const safeRoutine = routine.length > 0 ? routine : DEFAULT_ROUTINE;
	const segments = buildRoutineSegments(safeRoutine);
	const nowMinutes = now.getHours() * 60 + now.getMinutes();
	if (!isWithinRoutineWindow(nowMinutes, segments)) return null;

	for (let i = 0; i < safeRoutine.length; i++) {
		const seg = segments[i];
		if (isMinuteInSegment(nowMinutes, seg.start, seg.end)) {
			return { item: safeRoutine[i], index: i };
		}
	}
	return null;
}

export function formatRoutineItemTimeRange(
	item: RoutineItem,
	index: number,
	items: RoutineItem[],
): string {
	let end = item.endTime;
	if (!end && index < items.length - 1) {
		end = items[index + 1].time;
	} else if (!end) {
		end = minutesToTime(timeToMinutes(item.time) + 60);
	}
	return `${formatTime12h(item.time)} – ${formatTime12h(end)}`;
}

export function getRoutineTimeState(routine: RoutineItem[], now: Date) {
	if (routine.length === 0) {
		const currentTimeStr = now.toLocaleTimeString([], {
			hour: '2-digit',
			minute: '2-digit',
		});
		return {
			safeRoutine: [],
			isSleepMode: false,
			lineTopPercent: 0,
			currentTimeStr,
			currentItem: null,
			currentItemIndex: -1,
			nextItem: null,
			minutesLeft: 0,
			timeLeftLabel: formatRoutineTimeLeft(0),
		};
	}

	const safeRoutine = routine;
	const segments = buildRoutineSegments(safeRoutine);
	const nowMinutes = now.getHours() * 60 + now.getMinutes();
	const isSleepMode = !isWithinRoutineWindow(nowMinutes, segments);
	const current = isSleepMode ? null : getCurrentRoutineItem(safeRoutine, now);
	const currentItemIndex = current?.index ?? -1;
	const nextItem = current ? getNextRoutineItem(safeRoutine, currentItemIndex) : null;

	let minutesLeft = 0;
	if (current) {
		const seg = segments[currentItemIndex];
		minutesLeft = minutesUntilSegmentEnd(nowMinutes, seg.start, seg.end);
	}

	let lineTopPercent = 0;
	if (!isSleepMode && safeRoutine.length > 1) {
		for (let i = 0; i < safeRoutine.length - 1; i++) {
			const t1 = timeToMinutes(safeRoutine[i].time);
			const t2 = timeToMinutes(safeRoutine[i + 1].time);
			if (nowMinutes >= t1 && nowMinutes < t2) {
				const segPercent = (nowMinutes - t1) / (t2 - t1);
				lineTopPercent = ((i + segPercent) / (safeRoutine.length - 1)) * 100;
				break;
			}
		}
		const routineStart = timeToMinutes(safeRoutine[0].time);
		const last = segments[segments.length - 1];
		const routineEnd = last.end > last.start ? last.end : last.end + 24 * 60;
		if (nowMinutes < routineStart) lineTopPercent = 0;
		if (nowMinutes >= routineEnd % (24 * 60)) lineTopPercent = 100;
	}

	const currentTimeStr = now.toLocaleTimeString([], {
		hour: '2-digit',
		minute: '2-digit',
	});

	return {
		safeRoutine,
		isSleepMode,
		lineTopPercent,
		currentTimeStr,
		currentItem: current?.item ?? null,
		currentItemIndex,
		nextItem,
		minutesLeft,
		timeLeftLabel: formatRoutineTimeLeft(minutesLeft),
	};
}
