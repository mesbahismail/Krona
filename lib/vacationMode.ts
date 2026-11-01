import { localDateKey } from '@/lib/localDate';
import type { VacationSettings } from '@/lib/userAppSettings';

const ACTIVE_CACHE_KEY = 'krona:vacation-mode-active';
const DAYS_CACHE_KEY = 'krona:vacation-days';

export const VACATION_MODE_EMPTY_MESSAGE =
	"You're on vacation — tracking is paused.";

export function normalizeVacationSettings(
	raw?: Partial<VacationSettings> | null,
): VacationSettings {
	const days = Array.isArray(raw?.days)
		? [...new Set(raw.days.filter((day) => typeof day === 'string' && day.length > 0))]
		: [];
	const scheduledDays = Array.isArray(raw?.scheduledDays)
		? [
				...new Set(
					raw.scheduledDays.filter(
						(day) => typeof day === 'string' && day.length > 0,
					),
				),
			]
		: [];
	days.sort();
	scheduledDays.sort();
	return {
		active: Boolean(raw?.active),
		days,
		startedAt: typeof raw?.startedAt === 'string' ? raw.startedAt : undefined,
		scheduledDays,
		activatedBySchedule: Boolean(raw?.activatedBySchedule),
		suppressScheduledActivation: Boolean(raw?.suppressScheduledActivation),
	};
}

export function markTodayVacationIfActive(
	vacation: VacationSettings,
): VacationSettings {
	if (!vacation.active) return vacation;
	const today = localDateKey();
	if (vacation.days.includes(today)) return vacation;
	return { ...vacation, days: [...vacation.days, today].sort() };
}

export function syncVacationModeCache(active: boolean, days: string[]) {
	if (typeof window === 'undefined') return;
	try {
		localStorage.setItem(ACTIVE_CACHE_KEY, active ? '1' : '0');
		localStorage.setItem(DAYS_CACHE_KEY, JSON.stringify(days));
	} catch {
		/* ignore */
	}
}

export function isVacationModeActive(): boolean {
	if (typeof window === 'undefined') return false;
	try {
		return localStorage.getItem(ACTIVE_CACHE_KEY) === '1';
	} catch {
		return false;
	}
}

export function readVacationDays(): string[] {
	if (typeof window === 'undefined') return [];
	try {
		const raw = localStorage.getItem(DAYS_CACHE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw) as unknown;
		return Array.isArray(parsed)
			? parsed.filter((day): day is string => typeof day === 'string')
			: [];
	} catch {
		return [];
	}
}

export function isVacationDay(dateKey: string): boolean {
	return readVacationDays().includes(dateKey);
}

export function buildVacationSettingsForToggle(
	current: VacationSettings,
	active: boolean,
): VacationSettings {
	const today = localDateKey();
	const scheduledDays = current.scheduledDays ?? [];
	if (active) {
		const days = [...new Set([...current.days, today])].sort();
		return {
			active: true,
			days,
			startedAt: current.startedAt ?? today,
			scheduledDays,
			activatedBySchedule: false,
			// Manual on clears any prior “Back to work” suppression.
			suppressScheduledActivation: false,
		};
	}
	return {
		...current,
		active: false,
		startedAt: undefined,
		activatedBySchedule: false,
		scheduledDays,
		// Always suppress so a scheduled Vacation reminder cannot immediately
		// re-enable mode after “Back to work”. Cleared once the reminder range
		// no longer covers today.
		suppressScheduledActivation: true,
	};
}
