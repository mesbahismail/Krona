/** Local calendar date as YYYY-MM-DD (avoids UTC drift from toISOString). */
export function localDateKey(date: Date = new Date()): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, '0');
	const d = String(date.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

export function isSameLocalDay(timestamp: number, dayKey: string): boolean {
	return localDateKey(new Date(timestamp)) === dayKey;
}

export const DEADLINE_PAST_MESSAGE =
	'Deadline can’t be a date that’s already past.';

/** True when YYYY-MM-DD (or a Date) is before the local calendar today. */
export function isDeadlineInPast(
	value: string | Date | null | undefined,
	today = localDateKey(),
): boolean {
	if (value == null || value === '') return false;
	let key: string;
	if (value instanceof Date) {
		if (Number.isNaN(value.getTime())) return false;
		const iso = value.toISOString();
		// `new Date('YYYY-MM-DD')` is UTC midnight; use that calendar day.
		key = iso.endsWith('T00:00:00.000Z')
			? iso.slice(0, 10)
			: localDateKey(value);
	} else {
		key = String(value).trim().slice(0, 10);
	}
	if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
	return key < today;
}

/** Parse YYYY-MM-DD (padded or not) as a local calendar date. Rejects zeros and overflow. */
export function parseLocalDateKey(
	dateKey: string,
	options?: { hour?: number; minute?: number },
): Date | null {
	const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(dateKey.trim());
	if (!match) return null;
	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	if (
		!Number.isInteger(year) ||
		!Number.isInteger(month) ||
		!Number.isInteger(day) ||
		month < 1 ||
		month > 12 ||
		day < 1 ||
		day > 31
	) {
		return null;
	}
	const date = new Date(
		year,
		month - 1,
		day,
		options?.hour ?? 0,
		options?.minute ?? 0,
		0,
		0,
	);
	if (
		date.getFullYear() !== year ||
		date.getMonth() !== month - 1 ||
		date.getDate() !== day
	) {
		return null;
	}
	return date;
}

export function localDateKeyToIso(
	dateKey: string,
	options?: { hour?: number; minute?: number },
): string | null {
	const date = parseLocalDateKey(dateKey, options);
	return date ? date.toISOString() : null;
}

export function localDayStart(dateKey: string): Date {
	const parsed = parseLocalDateKey(dateKey);
	if (parsed) return parsed;
	const today = new Date();
	return new Date(
		today.getFullYear(),
		today.getMonth(),
		today.getDate(),
		0,
		0,
		0,
		0,
	);
}
