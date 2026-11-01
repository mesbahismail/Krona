/**
 * Convert tracked seconds to whole minutes for `tasks.total_time_worked_minutes`.
 * Values under 30s round to 0 with Math.round — we store at least 1 minute when
 * any work was recorded so dashboard persistence matches Pomodoro flushes.
 */
export function secondsToWorkedMinutes(seconds: number): number {
	if (!Number.isFinite(seconds) || seconds <= 0) return 0;
	const rounded = Math.round(seconds / 60);
	return rounded > 0 ? rounded : 1;
}

/** Round fractional hours for display (e.g. 0.433… → "0.4", 5 → "5"). */
export function formatDecimalHours(hours: number, decimals = 1): string {
	const n = Number(hours);
	if (!Number.isFinite(n)) return '0';
	const places = Math.min(1, Math.max(0, Math.floor(decimals)));
	const factor = 10 ** places;
	const rounded = Math.round(n * factor) / factor;
	if (n > 0 && rounded === 0) return '0.1';
	return String(rounded);
}

/** Numeric hours rounded from minutes (avoids 26/60 float noise in state). */
export function hoursFromMinutes(minutes: number, decimals = 1): number {
	const m = Number(minutes);
	if (!Number.isFinite(m) || m <= 0) return 0;
	return Number(formatDecimalHours(m / 60, decimals));
}

/** Hours with "h" suffix for compact labels (e.g. "0.4h"). */
export function formatDecimalHoursLabel(hours: number, decimals = 1): string {
	return `${formatDecimalHours(hours, decimals)}h`;
}

export function minutesToDisplayHours(minutes: number, decimals = 1): string {
	return formatDecimalHours(minutes / 60, decimals);
}

export function minutesToDisplayHoursLabel(minutes: number, decimals = 1): string {
	return formatDecimalHoursLabel(minutes / 60, decimals);
}

export function secondsToDisplayHours(seconds: number, decimals = 1): string {
	return formatDecimalHours(seconds / 3600, decimals);
}

/** Compact dashboard meta: "0 hrs work", "8 hrs left". */
export function formatHoursWorkLabel(hours: number): string {
	const safe = Math.max(0, hours);
	if (safe > 0 && safe < 0.1) {
		const minutes = Math.max(1, Math.round(safe * 60));
		return `${minutes}m work`;
	}
	return `${formatDecimalHours(safe)} hrs work`;
}

export function formatHoursLeftLabel(hours: number): string {
	return `${formatDecimalHours(Math.max(0, hours))} hrs left`;
}

export function formatTaskDeadlineLabel(deadline: string | null | undefined): string | null {
	if (!deadline) return null;
	const date = new Date(deadline);
	if (Number.isNaN(date.getTime())) return null;
	return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
