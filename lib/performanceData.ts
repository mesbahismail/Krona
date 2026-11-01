import dayjs from 'dayjs';
import { countTasksFinishedInRange } from '@/lib/performanceMetrics';
import { formatDecimalHours } from '@/lib/taskTime';
import { localData } from '@/lib/localData';
import {
	applyInProgressWorkToDayTotals,
	buildSessionDayTotals,
	buildTopTasksFromSessionRows,
	fetchMergedSessionsInRange,
	fetchSessionsForUsersInRange,
	fetchUserSessionTotalsInRange,
	localSessionsInRange,
	readInProgressWorkSeconds,
	type SessionDayTotals,
	type SessionRow,
} from '@/lib/sessionSync';

export type PerformancePeriodKey = 'today' | 'week' | 'month' | 'quarter' | 'year';

export type TeamPerformanceChartMember = {
	userId: string;
	label: string;
};

export type PerformanceChartDay = {
	label: string;
	workHours: number;
	restHours: number;
};

export type PerformanceActivityBucket = {
	label: string;
	workHours: number;
	restHours: number;
};

export type PerformanceTaskWorker = {
	userId: string;
	name: string;
	hours: number;
};

export type PerformanceTaskBreakdown = {
	taskId: string;
	name: string;
	projectName: string | null;
	hours: number;
	workers?: PerformanceTaskWorker[];
};

export type PerformanceMetrics = {
	totalWorkHours: number;
	totalRestHours: number;
	tasksFinished: number;
	avgDailyWorkHours: number;
	avgDailyRestHours: number;
	bestFocusPeriod: string;
	trendWork: number | null;
	trendRest: number | null;
	trendAvgDaily: number | null;
	trendAvgDailyRest: number | null;
	chartDays: PerformanceChartDay[];
	activityByHour: PerformanceActivityBucket[];
	taskBreakdown: PerformanceTaskBreakdown[] | null;
	/** False while tasks finished / focus / top tasks are still loading. */
	extendedReady: boolean;
};

export type PomodoroDaySnapshot = {
	key: string;
	work: number;
	rest: number;
};

/** Minimum interval before performance metrics refetch (event-driven or revisit). */
export const PERFORMANCE_DATA_STALE_MS = 15 * 60 * 1000;

/** Bump when trend/period math changes so stale in-memory cache is dropped. */
const PERFORMANCE_CACHE_VERSION = 13;

type PerformanceCacheEntry = {
	userId: string;
	metrics: PerformanceMetrics;
	fetchedAt: number;
	version: number;
};

const performanceMetricsCache = new Map<PerformancePeriodKey, PerformanceCacheEntry>();
let performanceCacheUserId: string | null = null;
let performanceDataDirty = false;

function markPerformanceDataDirty(): void {
	performanceDataDirty = true;
}

if (typeof window !== 'undefined') {
	window.addEventListener('krona:sessions-updated', markPerformanceDataDirty);
	window.addEventListener('krona:tasks-updated', markPerformanceDataDirty);
}

export function isPerformanceDataDirty(): boolean {
	return performanceDataDirty;
}

function clearPerformanceCacheForUserChange(userId: string): void {
	if (performanceCacheUserId && performanceCacheUserId !== userId) {
		performanceMetricsCache.clear();
	}
	performanceCacheUserId = userId;
}

function isCacheEntryFresh(entry: PerformanceCacheEntry): boolean {
	return (
		entry.version === PERFORMANCE_CACHE_VERSION &&
		Date.now() - entry.fetchedAt < PERFORMANCE_DATA_STALE_MS &&
		entry.metrics.extendedReady
	);
}

export function readPerformanceCache(
	period: PerformancePeriodKey,
	userId?: string | null,
): PerformanceMetrics | null {
	const entry = performanceMetricsCache.get(period);
	if (!entry || !userId || entry.userId !== userId) return null;
	if (!isCacheEntryFresh(entry)) return null;
	return entry.metrics;
}

export function isPerformanceCacheFresh(
	period: PerformancePeriodKey,
	userId?: string | null,
): boolean {
	if (performanceDataDirty) return false;
	return readPerformanceCache(period, userId) !== null;
}

export function writePerformanceCache(
	period: PerformancePeriodKey,
	metrics: PerformanceMetrics,
	userId: string,
): void {
	clearPerformanceCacheForUserChange(userId);
	performanceMetricsCache.set(period, {
		userId,
		metrics,
		fetchedAt: Date.now(),
		version: PERFORMANCE_CACHE_VERSION,
	});
	performanceDataDirty = false;
}

export function snapshotPerformanceCache(
	userId?: string | null,
): Partial<Record<PerformancePeriodKey, PerformanceMetrics>> {
	if (!userId || performanceDataDirty) return {};
	const snapshot: Partial<Record<PerformancePeriodKey, PerformanceMetrics>> = {};
	for (const [period, entry] of performanceMetricsCache) {
		if (entry.userId === userId && isCacheEntryFresh(entry)) {
			snapshot[period] = entry.metrics;
		}
	}
	return snapshot;
}

export function invalidatePerformanceCache(period?: PerformancePeriodKey): void {
	if (period) {
		performanceMetricsCache.delete(period);
		return;
	}
	performanceMetricsCache.clear();
	performanceCacheUserId = null;
	performanceDataDirty = true;
}

const MAX_TRACKED_SECONDS_PER_DAY = 24 * 60 * 60;

let cachedUserId: { id: string | null; at: number } | null = null;
const USER_ID_TTL_MS = 60_000;

export async function resolvePerformanceUserId(): Promise<string | null> {
	if (cachedUserId && Date.now() - cachedUserId.at < USER_ID_TTL_MS) {
		return cachedUserId.id;
	}
	const { data } = await localData.auth.getUser();
	const id = data.user?.id ?? null;
	cachedUserId = { id, at: Date.now() };
	return id;
}

export function periodStart(now: dayjs.Dayjs, period: PerformancePeriodKey): dayjs.Dayjs {
	if (period === 'today') return now.startOf('day');
	if (period === 'month') return now.subtract(1, 'month');
	// Longer views include the current calendar month and preceding months.
	if (period === 'quarter') return now.startOf('month').subtract(2, 'month');
	if (period === 'year') return now.startOf('month').subtract(11, 'month');
	// Match Pomodoro `last7Days`: today + previous 6 calendar days.
	return now.startOf('day').subtract(6, 'day');
}

export function performancePeriodLabel(period: PerformancePeriodKey): string {
	if (period === 'today') return 'Today';
	if (period === 'month') return 'Month';
	if (period === 'quarter') return 'Quarterly';
	if (period === 'year') return 'Yearly';
	return 'Week';
}

export function previousPeriodBounds(
	currentStart: dayjs.Dayjs,
	currentEnd: dayjs.Dayjs,
): { start: dayjs.Dayjs; end: dayjs.Dayjs } {
	const durationMs = currentEnd.valueOf() - currentStart.valueOf();
	return {
		start: dayjs(currentStart.valueOf() - durationMs),
		end: currentStart,
	};
}

/** Equal-length previous window ending when the current window starts. */
export function previousEqualPeriodBounds(
	currentStart: dayjs.Dayjs,
	dayCount: number,
): { start: dayjs.Dayjs; end: dayjs.Dayjs } {
	const end = currentStart.startOf('day');
	return {
		start: end.subtract(dayCount, 'day'),
		end,
	};
}

export function chartBarCount(period: PerformancePeriodKey): number {
	if (period === 'today') return 1;
	if (period === 'quarter') return 3;
	if (period === 'year') return 12;
	return period === 'week' ? 7 : 30;
}

function periodWindowDayCount(
	period: PerformancePeriodKey,
	start: dayjs.Dayjs,
	now: dayjs.Dayjs,
): number {
	if (period === 'today') return 1;
	if (period === 'week') return 7;
	if (period === 'quarter' || period === 'year') {
		return now.startOf('day').diff(start.startOf('day'), 'day') + 1;
	}
	return Math.max(1, Math.round(periodDayCount(start, now)));
}

function periodDayCount(start: dayjs.Dayjs, end: dayjs.Dayjs): number {
	return Math.max(1, end.diff(start, 'day', true));
}

/** Percent change vs previous period: ((current - previous) / previous) * 100. */
function pctDeltaVsPrevious(current: number, previous: number): number | null {
	if (!(previous > 0) || !Number.isFinite(previous) || !Number.isFinite(current)) {
		return null;
	}
	return ((current - previous) / previous) * 100;
}

type WorkRow = {
	work_date: string;
	hours_worked_daily: number | null;
	hours_rested_daily: number | null;
};

function workRowsToTotals(rows: WorkRow[]): Map<string, SessionDayTotals> {
	const byDate = new Map<string, SessionDayTotals>();
	for (const row of rows) {
		const existing = byDate.get(row.work_date) ?? {
			workSeconds: 0,
			restSeconds: 0,
		};
		existing.workSeconds += Number(row.hours_worked_daily || 0) * 3600;
		existing.restSeconds += Number(row.hours_rested_daily || 0) * 3600;
		byDate.set(row.work_date, existing);
	}
	return byDate;
}

function clampImpossibleDayTotals(
	byDate: Map<string, SessionDayTotals>,
): Map<string, SessionDayTotals> {
	const clamped = new Map<string, SessionDayTotals>();
	byDate.forEach((totals, key) => {
		let workSeconds = Math.max(0, totals.workSeconds);
		let restSeconds = Math.max(0, totals.restSeconds);

		// Work-table rows often hit the 24h DB cap on BOTH columns (runaway
		// increments). Proportional scaling then becomes the bogus 12h/12h bars.
		const workHours = workSeconds / 3600;
		const restHours = restSeconds / 3600;
		if (workHours >= 20 && restHours >= 20) {
			clamped.set(key, { workSeconds: 0, restSeconds: 0 });
			return;
		}

		workSeconds = Math.min(workSeconds, MAX_TRACKED_SECONDS_PER_DAY);
		restSeconds = Math.min(restSeconds, MAX_TRACKED_SECONDS_PER_DAY);
		const totalSeconds = workSeconds + restSeconds;

		if (totalSeconds <= MAX_TRACKED_SECONDS_PER_DAY) {
			clamped.set(key, { workSeconds, restSeconds });
			return;
		}

		// Prefer keeping real work time when the day is only slightly over 24h.
		if (workSeconds >= MAX_TRACKED_SECONDS_PER_DAY) {
			clamped.set(key, {
				workSeconds: MAX_TRACKED_SECONDS_PER_DAY,
				restSeconds: 0,
			});
			return;
		}

		clamped.set(key, {
			workSeconds,
			restSeconds: Math.max(0, MAX_TRACKED_SECONDS_PER_DAY - workSeconds),
		});
	});
	return clamped;
}

function totalSecondsFromTotals(
	byDate: Map<string, SessionDayTotals>,
	key: keyof SessionDayTotals,
): number {
	return [...byDate.values()].reduce((sum, day) => sum + day[key], 0);
}

function mergeDayTotals(
	target: Map<string, SessionDayTotals>,
	source: Map<string, SessionDayTotals>,
): void {
	source.forEach((totals, key) => {
		const existing = target.get(key) ?? { workSeconds: 0, restSeconds: 0 };
		existing.workSeconds += totals.workSeconds;
		existing.restSeconds += totals.restSeconds;
		target.set(key, existing);
	});
}

export function buildChartDaysFromTotals(
	period: PerformancePeriodKey,
	byDate: Map<string, SessionDayTotals>,
	now: dayjs.Dayjs,
): PerformanceChartDay[] {
	if (period === 'quarter' || period === 'year') {
		const start = periodStart(now, period);
		const lastDay = now.format('YYYY-MM-DD');
		return Array.from({ length: chartBarCount(period) }, (_, index) => {
			const month = start.add(index, 'month');
			const firstDay = month.format('YYYY-MM-DD');
			const nextMonth = month.add(1, 'month').format('YYYY-MM-DD');
			let workSeconds = 0;
			let restSeconds = 0;
			for (const [date, totals] of byDate) {
				if (date >= firstDay && date < nextMonth && date <= lastDay) {
					workSeconds += totals.workSeconds;
					restSeconds += totals.restSeconds;
				}
			}
			return {
				label: month.format('MMM'),
				workHours: workSeconds / 3600,
				restHours: restSeconds / 3600,
			};
		});
	}
	if (period === 'today') {
		const key = now.format('YYYY-MM-DD');
		const entry = byDate.get(key);
		return [
			{
				label: 'Today',
				workHours: entry ? entry.workSeconds / 3600 : 0,
				restHours: entry ? entry.restSeconds / 3600 : 0,
			},
		];
	}
	const barCount = period === 'week' ? 7 : 30;
	return Array.from({ length: barCount }, (_, i) => {
		const d = now.subtract(barCount - 1 - i, 'day');
		const key = d.format('YYYY-MM-DD');
		const entry = byDate.get(key);
		return {
			label: period === 'week' ? d.format('ddd') : d.format('D'),
			workHours: entry ? entry.workSeconds / 3600 : 0,
			restHours: entry ? entry.restSeconds / 3600 : 0,
		};
	});
}

function pomodoroDaysToTotals(
	days: PomodoroDaySnapshot[],
): Map<string, SessionDayTotals> {
	const byDate = new Map<string, SessionDayTotals>();
	for (const day of days) {
		byDate.set(day.key, {
			workSeconds: day.work,
			restSeconds: day.rest,
		});
	}
	applyInProgressWorkToDayTotals(byDate);
	return clampImpossibleDayTotals(byDate);
}

async function fetchWorkDayTotalsInRange(
	userId: string,
	start: dayjs.Dayjs,
	end: dayjs.Dayjs,
): Promise<Map<string, SessionDayTotals>> {
	const { data, error } = await localData
		.from('work')
		.select('work_date, hours_worked_daily, hours_rested_daily')
		.eq('user_id', userId)
		.gte('work_date', start.format('YYYY-MM-DD'))
		.lte('work_date', end.format('YYYY-MM-DD'));

	if (error) {
		console.warn('[performance] work query failed:', error.message);
		return new Map();
	}

	return workRowsToTotals((data ?? []) as WorkRow[]);
}

async function fetchSessionDayTotalsInRange(
	userId: string,
	start: dayjs.Dayjs,
	endExclusive: dayjs.Dayjs,
): Promise<Map<string, SessionDayTotals>> {
	const rows = await fetchMergedSessionsInRange(
		userId,
		start.toISOString(),
		{
			endIso: endExclusive.toISOString(),
			includeLocal: true,
			skipBackfill: true,
			awaitBackfill: false,
		},
	);
	return clampImpossibleDayTotals(buildSessionDayTotals(rows));
}

/**
 * Prefer session totals for the whole window when any session data exists.
 * Fall back to the work table so trends still render when session history is missing.
 */
function mergeSessionAndWorkDayTotals(
	sessionTotals: Map<string, SessionDayTotals>,
	workTotals: Map<string, SessionDayTotals>,
): Map<string, SessionDayTotals> {
	const hasSessionData =
		totalSecondsFromTotals(sessionTotals, 'workSeconds') > 0 ||
		totalSecondsFromTotals(sessionTotals, 'restSeconds') > 0;
	if (hasSessionData) {
		return clampImpossibleDayTotals(sessionTotals);
	}
	return clampImpossibleDayTotals(workTotals);
}

async function fetchTrustedDayTotalsInRange(
	userId: string,
	start: dayjs.Dayjs,
	endExclusive: dayjs.Dayjs,
): Promise<Map<string, SessionDayTotals>> {
	// work table uses inclusive dates; endExclusive is the first day of the next window.
	const workEndInclusive = endExclusive.subtract(1, 'day');
	const [sessionTotals, workTotals] = await Promise.all([
		fetchSessionDayTotalsInRange(userId, start, endExclusive),
		fetchWorkDayTotalsInRange(userId, start, workEndInclusive),
	]);
	return mergeSessionAndWorkDayTotals(sessionTotals, workTotals);
}

function applyLocalSessionFallback(
	current: Map<string, SessionDayTotals>,
	start: dayjs.Dayjs,
	end: dayjs.Dayjs,
): Map<string, SessionDayTotals> {
	if (totalSecondsFromTotals(current, 'workSeconds') > 0) {
		applyInProgressWorkToDayTotals(current);
		return clampImpossibleDayTotals(current);
	}

	const localTotals = buildSessionDayTotals(
		localSessionsInRange(start.toISOString(), end.toISOString()),
	);
	if (localTotals.size === 0) {
		applyInProgressWorkToDayTotals(current);
		return clampImpossibleDayTotals(current);
	}

	const merged = new Map(current);
	mergeDayTotals(merged, localTotals);
	applyInProgressWorkToDayTotals(merged);
	return clampImpossibleDayTotals(merged);
}

function buildMetricsFromDayTotals(
	period: PerformancePeriodKey,
	currentByDate: Map<string, SessionDayTotals>,
	previousByDate: Map<string, SessionDayTotals>,
	start: dayjs.Dayjs,
	now: dayjs.Dayjs,
	dayCount: number,
	partial?: Partial<PerformanceMetrics>,
): PerformanceMetrics {
	const totalWorkSeconds = totalSecondsFromTotals(currentByDate, 'workSeconds');
	const totalRestSeconds = totalSecondsFromTotals(currentByDate, 'restSeconds');
	const totalWorkHours = Number(formatDecimalHours(totalWorkSeconds / 3600));
	const totalRestHours = Number(formatDecimalHours(totalRestSeconds / 3600));
	const avgDailyWorkHours = totalWorkHours / dayCount;
	const avgDailyRestHours = totalRestHours / dayCount;
	const previousTotalWorkSeconds = totalSecondsFromTotals(
		previousByDate,
		'workSeconds',
	);
	const previousTotalRestSeconds = totalSecondsFromTotals(
		previousByDate,
		'restSeconds',
	);
	const previousTotalWorkHours = Number(
		formatDecimalHours(previousTotalWorkSeconds / 3600),
	);
	const previousTotalRestHours = Number(
		formatDecimalHours(previousTotalRestSeconds / 3600),
	);
	const previousAvgDailyWorkHours = previousTotalWorkHours / dayCount;
	const previousAvgDailyRestHours = previousTotalRestHours / dayCount;

	return {
		totalWorkHours,
		totalRestHours,
		tasksFinished: partial?.tasksFinished ?? 0,
		avgDailyWorkHours,
		avgDailyRestHours,
		bestFocusPeriod: partial?.bestFocusPeriod ?? '--',
		trendWork: pctDeltaVsPrevious(totalWorkSeconds, previousTotalWorkSeconds),
		trendRest: pctDeltaVsPrevious(totalRestSeconds, previousTotalRestSeconds),
		trendAvgDaily: pctDeltaVsPrevious(
			avgDailyWorkHours,
			previousAvgDailyWorkHours,
		),
		trendAvgDailyRest: pctDeltaVsPrevious(
			avgDailyRestHours,
			previousAvgDailyRestHours,
		),
		chartDays: buildChartDaysFromTotals(period, currentByDate, now),
		activityByHour: partial?.activityByHour ?? [],
		taskBreakdown: partial?.taskBreakdown ?? null,
		extendedReady: partial?.extendedReady ?? false,
	};
}

export function emptyMetricsForPeriod(period: PerformancePeriodKey): PerformanceMetrics {
	return {
		totalWorkHours: 0,
		totalRestHours: 0,
		tasksFinished: 0,
		avgDailyWorkHours: 0,
		avgDailyRestHours: 0,
		bestFocusPeriod: '--',
		trendWork: 0,
		trendRest: 0,
		trendAvgDaily: 0,
		trendAvgDailyRest: 0,
		chartDays: buildChartDaysFromTotals(period, new Map(), dayjs()),
		activityByHour: [],
		taskBreakdown: [],
		extendedReady: true,
	};
}

/** Instant week chart from in-memory Pomodoro stats (no network). */
export function buildWeekCoreFromPomodoro(
	last7Days: PomodoroDaySnapshot[],
): PerformanceMetrics | null {
	if (last7Days.length !== 7) return null;
	const now = dayjs();
	const start = periodStart(now, 'week');
	const currentByDate = pomodoroDaysToTotals(last7Days);
	const previousByDate = new Map<string, SessionDayTotals>();
	return buildMetricsFromDayTotals(
		'week',
		currentByDate,
		previousByDate,
		start,
		now,
		7,
	);
}

function bestFocusPeriodFromSessions(sessionRows: SessionRow[]): string {
	const focusBuckets = Array.from({ length: 24 }, () => 0);

	const addWorkInterval = (startMs: number, endMs: number) => {
		let cursorMs = startMs;
		while (cursorMs < endMs) {
			const cursor = dayjs(cursorMs);
			const nextHourMs = cursor.startOf('hour').add(1, 'hour').valueOf();
			const segmentEndMs = Math.min(endMs, nextHourMs);
			focusBuckets[cursor.hour()] += (segmentEndMs - cursorMs) / 1000;
			cursorMs = segmentEndMs;
		}
	};

	sessionRows.forEach((row) => {
		if (row.session_kind !== 'work') return;
		const startedAtMs = dayjs(row.started_at).valueOf();
		const durationSeconds = Number(row.duration_seconds || 0);
		if (!Number.isFinite(startedAtMs) || durationSeconds <= 0) return;
		addWorkInterval(startedAtMs, startedAtMs + durationSeconds * 1000);
	});

	const inProgressWork = readInProgressWorkSeconds();
	if (inProgressWork > 0) {
		const nowMs = Date.now();
		addWorkInterval(nowMs - inProgressWork * 1000, nowMs);
	}

	const hasFocusData = focusBuckets.some((seconds) => seconds > 0);
	if (!hasFocusData) return '--';

	const windowHours = 3;
	let bestStartHour = 0;
	let bestWindowSeconds = -1;
	for (let startHour = 0; startHour < 24; startHour += 1) {
		let windowSeconds = 0;
		for (let offset = 0; offset < windowHours; offset += 1) {
			windowSeconds += focusBuckets[(startHour + offset) % 24];
		}
		if (windowSeconds > bestWindowSeconds) {
			bestStartHour = startHour;
			bestWindowSeconds = windowSeconds;
		}
	}

	return `${String(bestStartHour).padStart(2, '0')}:00 to ${String(
		(bestStartHour + windowHours) % 24,
	).padStart(2, '0')}:00`;
}

function activityByHourFromSessions(
	sessionRows: SessionRow[],
	dayCount: number,
): PerformanceActivityBucket[] {
	const bucketHours = 2;
	const bucketCount = 24 / bucketHours;
	const workSeconds = Array.from({ length: bucketCount }, () => 0);
	const restSeconds = Array.from({ length: bucketCount }, () => 0);

	const addInterval = (
		kind: SessionRow['session_kind'],
		startMs: number,
		endMs: number,
	) => {
		let cursorMs = startMs;
		while (cursorMs < endMs) {
			const cursor = dayjs(cursorMs);
			const bucketIndex = Math.floor(cursor.hour() / bucketHours);
			const nextBucketMs = cursor
				.startOf('day')
				.add((bucketIndex + 1) * bucketHours, 'hour')
				.valueOf();
			const segmentEndMs = Math.min(endMs, nextBucketMs);
			const target = kind === 'work' ? workSeconds : restSeconds;
			target[bucketIndex] += (segmentEndMs - cursorMs) / 1000;
			cursorMs = segmentEndMs;
		}
	};

	for (const row of sessionRows) {
		const startedAtMs = dayjs(row.started_at).valueOf();
		const durationSeconds = Number(row.duration_seconds || 0);
		if (!Number.isFinite(startedAtMs) || durationSeconds <= 0) continue;
		addInterval(
			row.session_kind,
			startedAtMs,
			startedAtMs + durationSeconds * 1000,
		);
	}

	const inProgressWork = readInProgressWorkSeconds();
	if (inProgressWork > 0) {
		const nowMs = Date.now();
		addInterval('work', nowMs - inProgressWork * 1000, nowMs);
	}

	const divisor = Math.max(1, dayCount) * 3600;
	return Array.from({ length: bucketCount }, (_, index) => {
		const startHour = index * bucketHours;
		return {
			label: `${String(startHour).padStart(2, '0')}:00`,
			workHours: workSeconds[index] / divisor,
			restHours: restSeconds[index] / divisor,
		};
	});
}

/** Fast path: daily aggregates + trends. */
export async function fetchPerformanceCoreMetrics(
	period: PerformancePeriodKey,
	options: {
		userId: string;
		pomodoroLast7Days?: PomodoroDaySnapshot[];
	},
): Promise<PerformanceMetrics> {
	const now = dayjs();
	const start = periodStart(now, period);
	const dayCount = periodWindowDayCount(period, start, now);
	const prevBounds =
		period === 'today' || period === 'week'
			? previousEqualPeriodBounds(start, dayCount)
			: previousPeriodBounds(start, now);

	// Week: Pomodoro for current totals; trusted previous for %-change.
	if (period === 'week' && options.pomodoroLast7Days?.length === 7) {
		const currentByDate = pomodoroDaysToTotals(options.pomodoroLast7Days);
		const previousByDate = await fetchTrustedDayTotalsInRange(
			options.userId,
			prevBounds.start,
			prevBounds.end,
		);
		return buildMetricsFromDayTotals(
			period,
			currentByDate,
			previousByDate,
			start,
			now,
			dayCount,
		);
	}

	// Longer periods: build each bar from real sessions (work table is often capped at
	// 24h/24h and produces fake 12h/12h splits after clamping).
	const [sessionCurrent, sessionPrevious] = await Promise.all([
		fetchSessionDayTotalsInRange(options.userId, start, now),
		fetchSessionDayTotalsInRange(
			options.userId,
			prevBounds.start,
			prevBounds.end,
		),
	]);

	let currentByDate = sessionCurrent;
	let previousByDate = sessionPrevious;

	const currentHasSessions =
		totalSecondsFromTotals(currentByDate, 'workSeconds') > 0 ||
		totalSecondsFromTotals(currentByDate, 'restSeconds') > 0;
	if (!currentHasSessions) {
		const workCurrent = await fetchWorkDayTotalsInRange(
			options.userId,
			start,
			now,
		);
		currentByDate = applyLocalSessionFallback(workCurrent, start, now);
	} else {
		applyInProgressWorkToDayTotals(currentByDate);
		currentByDate = clampImpossibleDayTotals(currentByDate);
	}

	const previousHasSessions =
		totalSecondsFromTotals(previousByDate, 'workSeconds') > 0 ||
		totalSecondsFromTotals(previousByDate, 'restSeconds') > 0;
	if (!previousHasSessions) {
		previousByDate = clampImpossibleDayTotals(
			await fetchWorkDayTotalsInRange(
				options.userId,
				prevBounds.start,
				prevBounds.end.subtract(1, 'day'),
			),
		);
	}

	return buildMetricsFromDayTotals(
		period,
		currentByDate,
		previousByDate,
		start,
		now,
		dayCount,
	);
}

/** Deferred: task completion, focus window, ranked tasks (work sessions only). */
export async function fetchPerformanceExtendedMetrics(
	period: PerformancePeriodKey,
	userId: string,
): Promise<Pick<
	PerformanceMetrics,
	| 'tasksFinished'
	| 'bestFocusPeriod'
	| 'activityByHour'
	| 'taskBreakdown'
	| 'extendedReady'
>> {
	const now = dayjs();
	const start = periodStart(now, period);
	const dayCount = periodWindowDayCount(period, start, now);
	const startMs = start.valueOf();
	const endMs = now.valueOf();

	const [taskRes, sessions] = await Promise.all([
		localData
			.from('tasks')
			.select('status, time_assigned_minutes, total_time_worked_minutes, updated_at, completed_at')
			.eq('user_id', userId)
			.gte('updated_at', start.toISOString())
			.lte('updated_at', now.toISOString()),
		fetchMergedSessionsInRange(userId, start.toISOString(), {
			awaitBackfill: false,
			endIso: now.toISOString(),
			includeLocal: true,
			prefetchHours: 24,
			skipBackfill: true,
		}),
	]);

	const topTasks = await buildTopTasksFromSessionRows(userId, sessions);

	return {
		tasksFinished: countTasksFinishedInRange(taskRes.data ?? [], startMs, endMs),
		bestFocusPeriod: bestFocusPeriodFromSessions(sessions),
		activityByHour: activityByHourFromSessions(sessions, dayCount),
		taskBreakdown: topTasks.map((entry) => ({
			taskId: entry.taskId,
			name: entry.name,
			projectName: entry.projectName,
			hours: Number(formatDecimalHours(entry.seconds / 3600)),
		})),
		extendedReady: true,
	};
}

export function mergePerformanceMetrics(
	core: PerformanceMetrics,
	extended: Pick<
		PerformanceMetrics,
		| 'tasksFinished'
		| 'bestFocusPeriod'
		| 'activityByHour'
		| 'taskBreakdown'
		| 'extendedReady'
	>,
): PerformanceMetrics {
	return { ...core, ...extended };
}

/**
 * Team Performance: aggregate sessions for many members (no Pomodoro / local).
 * Day totals are not clamped to 24h — the team can exceed a single-person day.
 */
export function emptyTeamMetricsForPeriod(
	period: PerformancePeriodKey,
	chartMembers?: TeamPerformanceChartMember[],
): PerformanceMetrics {
	const empty = emptyMetricsForPeriod(period);
	if (period === 'today' && chartMembers?.length) {
		return {
			...empty,
			chartDays: chartMembers.map((member) => ({
				label: member.label,
				workHours: 0,
				restHours: 0,
			})),
		};
	}
	return empty;
}

function applyTodayMemberChartDays(
	metrics: PerformanceMetrics,
	chartMembers: TeamPerformanceChartMember[] | undefined,
	byUser: Map<string, SessionDayTotals>,
): PerformanceMetrics {
	if (!chartMembers?.length) return metrics;
	return {
		...metrics,
		chartDays: chartMembers.map((member) => {
			const totals = byUser.get(member.userId);
			return {
				label: member.label,
				workHours: totals ? totals.workSeconds / 3600 : 0,
				restHours: totals ? totals.restSeconds / 3600 : 0,
			};
		}),
	};
}

export async function fetchTeamPerformanceCoreMetrics(
	period: PerformancePeriodKey,
	userIds: string[],
	options?: { chartMembers?: TeamPerformanceChartMember[] },
): Promise<PerformanceMetrics> {
	const ids = [...new Set(userIds.filter(Boolean))];
	const now = dayjs();
	const start = periodStart(now, period);
	const dayCount = periodWindowDayCount(period, start, now);
	const prevBounds =
		period === 'today' || period === 'week'
			? previousEqualPeriodBounds(start, dayCount)
			: previousPeriodBounds(start, now);
	const chartMembers = options?.chartMembers;

	if (!ids.length) {
		return emptyTeamMetricsForPeriod(period, chartMembers);
	}

	if (period === 'today') {
		const [currentByUser, previousByUser] = await Promise.all([
			fetchUserSessionTotalsInRange(ids, start.toISOString(), {
				endIso: now.toISOString(),
				prefetchHours: 24,
			}),
			fetchUserSessionTotalsInRange(ids, prevBounds.start.toISOString(), {
				endIso: prevBounds.end.toISOString(),
				prefetchHours: 24,
			}),
		]);
		const todayKey = now.format('YYYY-MM-DD');
		const previousKey = prevBounds.start.format('YYYY-MM-DD');
		const currentByDate = new Map<string, SessionDayTotals>();
		const previousByDate = new Map<string, SessionDayTotals>();
		let currentWork = 0;
		let currentRest = 0;
		let previousWork = 0;
		let previousRest = 0;
		for (const totals of currentByUser.values()) {
			currentWork += totals.workSeconds;
			currentRest += totals.restSeconds;
		}
		for (const totals of previousByUser.values()) {
			previousWork += totals.workSeconds;
			previousRest += totals.restSeconds;
		}
		currentByDate.set(todayKey, {
			workSeconds: currentWork,
			restSeconds: currentRest,
		});
		previousByDate.set(previousKey, {
			workSeconds: previousWork,
			restSeconds: previousRest,
		});
		return applyTodayMemberChartDays(
			buildMetricsFromDayTotals(
				period,
				currentByDate,
				previousByDate,
				start,
				now,
				dayCount,
			),
			chartMembers,
			currentByUser,
		);
	}

	const [currentRows, previousRows] = await Promise.all([
		fetchSessionsForUsersInRange(ids, start.toISOString(), {
			endIso: now.toISOString(),
			prefetchHours: 24,
		}),
		fetchSessionsForUsersInRange(ids, prevBounds.start.toISOString(), {
			endIso: prevBounds.end.toISOString(),
			prefetchHours: 24,
		}),
	]);

	const currentByDate = buildSessionDayTotals(currentRows);
	const previousByDate = buildSessionDayTotals(previousRows);

	return buildMetricsFromDayTotals(
		period,
		currentByDate,
		previousByDate,
		start,
		now,
		dayCount,
	);
}

/** Extended team metrics — focus/activity from sessions; tasks from team_tasks when org given. */
export async function fetchTeamPerformanceExtendedMetrics(
	period: PerformancePeriodKey,
	userIds: string[],
	options?: {
		organizationId?: string;
		memberLabels?: TeamPerformanceChartMember[];
	},
): Promise<
	Pick<
		PerformanceMetrics,
		| 'tasksFinished'
		| 'bestFocusPeriod'
		| 'activityByHour'
		| 'taskBreakdown'
		| 'extendedReady'
	>
> {
	const ids = [...new Set(userIds.filter(Boolean))];
	const now = dayjs();
	const start = periodStart(now, period);
	const dayCount = periodWindowDayCount(period, start, now);
	const startMs = start.valueOf();
	const endMs = now.valueOf();

	if (!ids.length) {
		return {
			tasksFinished: 0,
			bestFocusPeriod: '--',
			activityByHour: activityByHourFromSessions([], dayCount),
			taskBreakdown: [],
			extendedReady: true,
		};
	}

	const sessions = await fetchSessionsForUsersInRange(ids, start.toISOString(), {
		endIso: now.toISOString(),
		prefetchHours: 24,
	});

	let tasksFinished = 0;
	if (options?.organizationId) {
		const { data: teamTasks } = await localData
			.from('team_tasks')
			.select('status, completed_at')
			.eq('organization_id', options.organizationId)
			.eq('status', 'done')
			.gte('completed_at', start.toISOString())
			.lte('completed_at', now.toISOString());
		tasksFinished = (teamTasks ?? []).length;
	} else {
		const { data: personalTasks } = await localData
			.from('tasks')
			.select(
				'status, time_assigned_minutes, total_time_worked_minutes, updated_at, completed_at',
			)
			.in('user_id', ids)
			.gte('updated_at', start.toISOString())
			.lte('updated_at', now.toISOString());
		tasksFinished = countTasksFinishedInRange(
			personalTasks ?? [],
			startMs,
			endMs,
		);
	}

	const taskBreakdown = await buildTeamTaskBreakdown(
		sessions,
		options?.organizationId,
		options?.memberLabels,
	);

	// Team aggregate: omit in-progress viewer timer from focus/activity.
	const sessionsForFocus = sessions;
	const bestFocusPeriod = bestFocusPeriodFromSessionsTeam(sessionsForFocus);
	const activityByHour = activityByHourFromSessionsTeam(
		sessionsForFocus,
		dayCount,
	);

	return {
		tasksFinished,
		bestFocusPeriod,
		activityByHour,
		taskBreakdown,
		extendedReady: true,
	};
}

async function buildTeamTaskBreakdown(
	sessions: SessionRow[],
	organizationId: string | undefined,
	memberLabels: TeamPerformanceChartMember[] | undefined,
): Promise<PerformanceTaskBreakdown[]> {
	type TaskAgg = {
		seconds: number;
		teamTask: boolean;
		byUser: Map<string, number>;
	};
	const byTask = new Map<string, TaskAgg>();

	for (const row of sessions) {
		if (row.session_kind !== 'work') continue;
		const teamTaskId = row.team_task_id || null;
		const personalTaskId = row.task_id || null;
		const taskId = teamTaskId || personalTaskId;
		if (!taskId) continue;
		const duration = Number(row.duration_seconds || 0);
		if (!(duration > 0)) continue;
		const existing = byTask.get(taskId) ?? {
			seconds: 0,
			teamTask: Boolean(teamTaskId),
			byUser: new Map<string, number>(),
		};
		if (teamTaskId) existing.teamTask = true;
		existing.seconds += duration;
		if (row.user_id) {
			existing.byUser.set(
				row.user_id,
				(existing.byUser.get(row.user_id) ?? 0) + duration,
			);
		}
		byTask.set(taskId, existing);
	}

	const ranked = [...byTask.entries()].sort((a, b) => b[1].seconds - a[1].seconds);
	if (!ranked.length) return [];

	const teamTaskIds = ranked
		.filter(([, agg]) => agg.teamTask)
		.map(([id]) => id);
	const personalTaskIds = ranked
		.filter(([, agg]) => !agg.teamTask)
		.map(([id]) => id);

	const nameById = new Map<string, { name: string; projectName: string | null }>();

	if (teamTaskIds.length) {
		let teamQuery = localData
			.from('team_tasks')
			.select('id, name, project_id')
			.in('id', teamTaskIds);
		if (organizationId) {
			teamQuery = teamQuery.eq('organization_id', organizationId);
		}
		const { data: teamTasks } = await teamQuery;
		const projectIds = [
			...new Set(
				(teamTasks ?? [])
					.map((task) => (task.project_id ? String(task.project_id) : ''))
					.filter(Boolean),
			),
		];
		const projectNameById = new Map<string, string>();
		if (projectIds.length) {
			const { data: projects } = await localData
				.from('team_projects')
				.select('id, name')
				.in('id', projectIds);
			for (const project of projects ?? []) {
				projectNameById.set(String(project.id), String(project.name ?? ''));
			}
		}
		for (const task of teamTasks ?? []) {
			const projectId = task.project_id ? String(task.project_id) : '';
			const projectName = projectId ? projectNameById.get(projectId) : null;
			nameById.set(String(task.id), {
				name: String(task.name ?? 'Task'),
				projectName: projectName || null,
			});
		}
	}

	if (personalTaskIds.length) {
		const { data: tasks } = await localData
			.from('tasks')
			.select('id, name, projects(name)')
			.in('id', personalTaskIds);
		for (const task of tasks ?? []) {
			const relation = task.projects as
				| { name?: string | null }
				| Array<{ name?: string | null }>
				| null;
			const project = Array.isArray(relation) ? relation[0] : relation;
			nameById.set(String(task.id), {
				name: String(task.name ?? 'Task'),
				projectName: project?.name ? String(project.name) : null,
			});
		}
	}

	const labelByUser = new Map(
		(memberLabels ?? []).map((member) => [member.userId, member.label] as const),
	);

	return ranked.map(([taskId, agg]) => {
		const workers = [...agg.byUser.entries()]
			.sort((a, b) => b[1] - a[1])
			.map(([userId, seconds]) => ({
				userId,
				name: labelByUser.get(userId) || 'Teammate',
				hours: Number(formatDecimalHours(seconds / 3600)),
			}));
		return {
			taskId,
			name: nameById.get(taskId)?.name || 'Task',
			projectName: nameById.get(taskId)?.projectName ?? null,
			hours: Number(formatDecimalHours(agg.seconds / 3600)),
			workers,
		};
	});
}

/** Best focus window from session rows only (no local in-progress). */
function bestFocusPeriodFromSessionsTeam(sessionRows: SessionRow[]): string {
	const focusBuckets = Array.from({ length: 24 }, () => 0);

	const addWorkInterval = (startMs: number, endMs: number) => {
		let cursorMs = startMs;
		while (cursorMs < endMs) {
			const cursor = dayjs(cursorMs);
			const nextHourMs = cursor.startOf('hour').add(1, 'hour').valueOf();
			const segmentEndMs = Math.min(endMs, nextHourMs);
			focusBuckets[cursor.hour()] += (segmentEndMs - cursorMs) / 1000;
			cursorMs = segmentEndMs;
		}
	};

	sessionRows.forEach((row) => {
		if (row.session_kind !== 'work') return;
		const startedAtMs = dayjs(row.started_at).valueOf();
		const durationSeconds = Number(row.duration_seconds || 0);
		if (!Number.isFinite(startedAtMs) || durationSeconds <= 0) return;
		addWorkInterval(startedAtMs, startedAtMs + durationSeconds * 1000);
	});

	const hasFocusData = focusBuckets.some((seconds) => seconds > 0);
	if (!hasFocusData) return '--';

	const windowHours = 3;
	let bestStartHour = 0;
	let bestWindowSeconds = -1;
	for (let startHour = 0; startHour < 24; startHour += 1) {
		let windowSeconds = 0;
		for (let offset = 0; offset < windowHours; offset += 1) {
			windowSeconds += focusBuckets[(startHour + offset) % 24];
		}
		if (windowSeconds > bestWindowSeconds) {
			bestStartHour = startHour;
			bestWindowSeconds = windowSeconds;
		}
	}

	return `${String(bestStartHour).padStart(2, '0')}:00 to ${String(
		(bestStartHour + windowHours) % 24,
	).padStart(2, '0')}:00`;
}

function activityByHourFromSessionsTeam(
	sessionRows: SessionRow[],
	dayCount: number,
): PerformanceActivityBucket[] {
	const bucketHours = 2;
	const bucketCount = 24 / bucketHours;
	const workSeconds = Array.from({ length: bucketCount }, () => 0);
	const restSeconds = Array.from({ length: bucketCount }, () => 0);

	const addInterval = (
		kind: SessionRow['session_kind'],
		startMs: number,
		endMs: number,
	) => {
		let cursorMs = startMs;
		while (cursorMs < endMs) {
			const cursor = dayjs(cursorMs);
			const bucketIndex = Math.floor(cursor.hour() / bucketHours);
			const nextBucketMs = cursor
				.startOf('day')
				.add((bucketIndex + 1) * bucketHours, 'hour')
				.valueOf();
			const segmentEndMs = Math.min(endMs, nextBucketMs);
			const target = kind === 'work' ? workSeconds : restSeconds;
			target[bucketIndex] += (segmentEndMs - cursorMs) / 1000;
			cursorMs = segmentEndMs;
		}
	};

	for (const row of sessionRows) {
		const startedAtMs = dayjs(row.started_at).valueOf();
		const durationSeconds = Number(row.duration_seconds || 0);
		if (!Number.isFinite(startedAtMs) || durationSeconds <= 0) continue;
		addInterval(
			row.session_kind,
			startedAtMs,
			startedAtMs + durationSeconds * 1000,
		);
	}

	const divisor = Math.max(1, dayCount) * 3600;
	return Array.from({ length: bucketCount }, (_, index) => {
		const startHour = index * bucketHours;
		return {
			label: `${String(startHour).padStart(2, '0')}:00`,
			workHours: workSeconds[index] / divisor,
			restHours: restSeconds[index] / divisor,
		};
	});
}
