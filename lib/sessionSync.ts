import { notifySessionsUpdated } from '@/lib/kronaDataEvents';
import { isVacationModeActive } from '@/lib/vacationMode';
import { localDateKey } from '@/lib/localDate';
import { SELECTED_TASK_ID_KEY } from '@/lib/selectedTimerTask';
import { recordDailyWorkRest, adjustDailyWorkRest, adjustTaskWorkedSeconds } from '@/lib/taskTimeSync';
import { formatDecimalHours } from '@/lib/taskTime';
import { localData } from '@/lib/localData';

export type LocalSessionEntry = {
	timestamp: number;
	duration: number;
	taskId?: string | null;
};

export const POMODORO_SESSIONS_KEY = 'pomodoro_sessions';
export const POMODORO_REST_SESSIONS_KEY = 'pomodoro_rest_sessions';
const MAX_SESSION_DURATION_SECONDS = 24 * 60 * 60;

export type SessionRow = {
	duration_seconds: number;
	session_kind: 'work' | 'rest';
	started_at: string;
	task_id?: string | null;
	team_task_id?: string | null;
	user_id?: string | null;
	created_at?: string;
};

export function readLocalSessions(key: string): LocalSessionEntry[] {
	if (typeof window === 'undefined') return [];
	try {
		const raw = window.localStorage.getItem(key);
		return raw ? (JSON.parse(raw) as LocalSessionEntry[]) : [];
	} catch {
		return [];
	}
}

function sessionStartedAt(entry: LocalSessionEntry): string {
	return new Date(entry.timestamp - entry.duration * 1000).toISOString();
}

/** Local entries store completion time (see PomodoroContext). */
function localSessionCompletedAtMs(entry: LocalSessionEntry): number {
	return entry.timestamp;
}

function sessionCompletedAfterMs(completedMs: number, startMs: number): boolean {
	return completedMs >= startMs;
}

function sessionStartedAtMs(startedAt: string): number {
	const ms = new Date(startedAt).getTime();
	return Number.isFinite(ms) ? ms : 0;
}

function sessionDedupeKey(
	kind: 'work' | 'rest',
	startedAt: string,
	durationSeconds: number,
): string {
	return `${kind}:${sessionStartedAtMs(startedAt)}:${durationSeconds}`;
}

export async function resolveValidTaskId(
	userId: string,
	taskId: string | null | undefined,
): Promise<string | null> {
	if (!taskId) return null;
	const { data } = await localData
		.from('tasks')
		.select('id')
		.eq('id', taskId)
		.eq('user_id', userId)
		.maybeSingle();
	return data?.id ?? null;
}

async function resolveTaskTarget(
	userId: string,
	taskId: string | null | undefined,
): Promise<{ taskId: string | null; teamTaskId: string | null }> {
	if (!taskId) return { taskId: null, teamTaskId: null };
	const personalTaskId = await resolveValidTaskId(userId, taskId);
	if (personalTaskId) return { taskId: personalTaskId, teamTaskId: null };

	const { data: teamTask } = await localData
		.from('team_tasks')
		.select('id')
		.eq('id', taskId)
		.maybeSingle();
	if (teamTask?.id) {
		return { taskId: null, teamTaskId: String(teamTask.id) };
	}

	// RLS can hide the row from SELECT even when the timer is on that task.
	// Attach the id; insert retries without it if the FK rejects it.
	return { taskId: null, teamTaskId: taskId };
}

/** Persist one completed work/rest session to local storage. */
export async function persistSessionToDb(
	userId: string,
	input: {
		timestamp: number;
		duration: number;
		sessionKind: 'work' | 'rest';
		taskId?: string | null;
	},
): Promise<boolean> {
	if (isVacationModeActive()) return false;
	if (input.duration <= 0) return false;

	let taskId: string | null = null;
	let teamTaskId: string | null = null;
	if (input.sessionKind === 'work') {
		// `null` explicitly means unassigned. Only omitted values may fall back
		// to the currently selected task.
		const rawTaskId =
			input.taskId === undefined ? readSelectedTaskId() : input.taskId;
		const target = await resolveTaskTarget(userId, rawTaskId);
		taskId = target.taskId;
		teamTaskId = target.teamTaskId;
	}

	const startedAt = sessionStartedAt({
		timestamp: input.timestamp,
		duration: input.duration,
	});

	const existing = await localData
		.from('sessions')
		.select('id')
		.eq('user_id', userId)
		.eq('started_at', startedAt)
		.eq('duration_seconds', input.duration)
		.eq('session_kind', input.sessionKind)
		.limit(1)
		.maybeSingle();
	if (existing.data?.id) return true;

	const payload: Record<string, unknown> = {
		user_id: userId,
		started_at: startedAt,
		duration_seconds: input.duration,
		session_kind: input.sessionKind,
		task_id: taskId,
		team_task_id: teamTaskId,
	};
	let { error } = await localData.from('sessions').insert(payload);
	if (
		error &&
		teamTaskId &&
		(error.code === 'PGRST204' ||
			error.code === '42703' ||
			/schema cache|does not exist/i.test(error.message))
	) {
		// Column missing from API cache — still save the session without the link.
		console.warn(
			'[sessionSync] team_task_id unsupported on insert; saving unlinked session:',
			error.message,
		);
		payload.team_task_id = null;
		({ error } = await localData.from('sessions').insert(payload));
	} else if (error && teamTaskId && error.code === '23503') {
		// FK rejected — task may have been deleted; keep the work session.
		console.warn(
			'[sessionSync] team_task_id FK failed; saving unlinked session:',
			error.message,
		);
		payload.team_task_id = null;
		({ error } = await localData.from('sessions').insert(payload));
	}
	if (error) {
		if (error.code === '23505') {
			notifySessionsUpdated();
			return true;
		}
		console.warn('[sessionSync] session insert failed:', error.message);
		return false;
	}

	await recordDailyWorkRest(
		userId,
		input.sessionKind,
		input.duration,
		input.timestamp,
	);
	// Fire after DB write so team task worked_seconds reloads see team_task_id.
	notifySessionsUpdated();
	return true;
}

function readSelectedTaskId(): string | null {
	try {
		return window.localStorage.getItem(SELECTED_TASK_ID_KEY);
	} catch {
		return null;
	}
}

/** Keep backfill light — year-scale pulls were saturating small compute. */
export const SESSION_BACKFILL_LOOKBACK_DAYS = 30;
/** Don't re-scan sessions on every focus / performance refresh. */
const BACKFILL_COOLDOWN_MS = 6 * 60 * 60 * 1000;
const BACKFILL_COOLDOWN_KEY = 'krona_sessions_backfill_at';

let inFlightBackfill: { userId: string; promise: Promise<void> } | null = null;
const lastBackfillAtByUser = new Map<string, number>();

function readBackfillCooldownAt(userId: string): number {
	const mem = lastBackfillAtByUser.get(userId);
	if (typeof mem === 'number') return mem;
	if (typeof window === 'undefined') return 0;
	try {
		const raw = window.localStorage.getItem(`${BACKFILL_COOLDOWN_KEY}:${userId}`);
		const parsed = raw ? Number(raw) : 0;
		return Number.isFinite(parsed) ? parsed : 0;
	} catch {
		return 0;
	}
}

function writeBackfillCooldownAt(userId: string, at: number): void {
	lastBackfillAtByUser.set(userId, at);
	if (typeof window === 'undefined') return;
	try {
		window.localStorage.setItem(`${BACKFILL_COOLDOWN_KEY}:${userId}`, String(at));
	} catch {
		/* ignore */
	}
}

function isBackfillCoolingDown(userId: string): boolean {
	return Date.now() - readBackfillCooldownAt(userId) < BACKFILL_COOLDOWN_MS;
}

async function backfillLocalSessionsToDbImpl(userId: string): Promise<void> {
	const workLocal = readLocalSessions(POMODORO_SESSIONS_KEY);
	const restLocal = readLocalSessions(POMODORO_REST_SESSIONS_KEY);
	if (workLocal.length === 0 && restLocal.length === 0) {
		writeBackfillCooldownAt(userId, Date.now());
		return;
	}

	const since = new Date();
	since.setDate(since.getDate() - SESSION_BACKFILL_LOOKBACK_DAYS);
	const existing: Array<{
		started_at: string;
		duration_seconds: number;
		session_kind: string;
	}> = [];
	const pageSize = 1000;
	for (let offset = 0; ; offset += pageSize) {
		const { data, error } = await localData
			.from('sessions')
			.select('started_at,duration_seconds,session_kind')
			.eq('user_id', userId)
			.gte('started_at', since.toISOString())
			.order('created_at', { ascending: true })
			.range(offset, offset + pageSize - 1);
		if (error || !data?.length) break;
		existing.push(...data);
		if (data.length < pageSize) break;
	}

	const existingKeys = new Set(
		existing.map((row) =>
			sessionDedupeKey(
				row.session_kind as 'work' | 'rest',
				row.started_at,
				Number(row.duration_seconds || 0),
			),
		),
	);

	let inserted = false;
	for (const entry of workLocal) {
		if (entry.duration <= 0) continue;
		const startedAt = sessionStartedAt(entry);
		const key = sessionDedupeKey('work', startedAt, entry.duration);
		if (existingKeys.has(key)) continue;
		const ok = await persistSessionToDb(userId, {
			timestamp: entry.timestamp,
			duration: entry.duration,
			sessionKind: 'work',
			taskId: entry.taskId ?? null,
		});
		if (ok) {
			existingKeys.add(key);
			inserted = true;
		}
	}

	for (const entry of restLocal) {
		if (entry.duration <= 0) continue;
		const startedAt = sessionStartedAt(entry);
		const key = sessionDedupeKey('rest', startedAt, entry.duration);
		if (existingKeys.has(key)) continue;
		const ok = await persistSessionToDb(userId, {
			timestamp: entry.timestamp,
			duration: entry.duration,
			sessionKind: 'rest',
		});
		if (ok) {
			existingKeys.add(key);
			inserted = true;
		}
	}

	if (inserted) {
		notifySessionsUpdated();
	}
	writeBackfillCooldownAt(userId, Date.now());
}

/**
 * Deduped backfill — concurrent callers share one in-flight run per user.
 * Skips when a successful run happened within the cooldown (unless `force`).
 */
export function scheduleBackfillLocalSessionsToDb(
	userId: string,
	options?: { force?: boolean },
): Promise<void> {
	if (!options?.force && isBackfillCoolingDown(userId)) {
		return Promise.resolve();
	}
	if (inFlightBackfill?.userId === userId) {
		return inFlightBackfill.promise;
	}
	const promise = backfillLocalSessionsToDbImpl(userId).finally(() => {
		if (inFlightBackfill?.promise === promise) {
			inFlightBackfill = null;
		}
	});
	inFlightBackfill = { userId, promise };
	return promise;
}

/** @see scheduleBackfillLocalSessionsToDb */
export const backfillLocalSessionsToDb = scheduleBackfillLocalSessionsToDb;

export type SessionDayTotals = {
	workSeconds: number;
	restSeconds: number;
};

/**
 * Merge local + DB session rows. The first row for a key within each source is
 * authoritative; a later source replaces it (so DB still wins over local).
 */
export function mergeSessionRows(...sources: SessionRow[][]): SessionRow[] {
	const map = new Map<string, SessionRow>();
	for (const rows of sources) {
		const sourceRows = new Map<string, SessionRow>();
		for (const row of rows) {
			const duration = Number(row.duration_seconds || 0);
			if (duration <= 0 || duration > MAX_SESSION_DURATION_SECONDS) continue;
			const kind = row.session_kind;
			const key = sessionDedupeKey(kind, row.started_at, duration);
			if (sourceRows.has(key)) continue;
			sourceRows.set(key, {
				duration_seconds: duration,
				session_kind: kind,
				started_at: row.started_at,
				task_id: row.task_id ?? null,
				created_at: row.created_at,
			});
		}
		for (const [key, row] of sourceRows) {
			map.set(key, row);
		}
	}
	return [...map.values()];
}

/** Work seconds currently on the clock (matches homepage in-progress timer). */
export function readInProgressWorkSeconds(): number {
	if (typeof window === 'undefined') return 0;
	try {
		const stateRaw = window.localStorage.getItem('pomodoro_state');
		if (!stateRaw) return 0;
		const state = JSON.parse(stateRaw) as {
			running?: boolean;
			mode?: string;
			remaining?: number;
			periodEndAt?: number | null;
			workStartedAt?: number | null;
			segmentStartedAt?: number | null;
			style?: string;
		};
		if (!state.running || state.mode !== 'work') return 0;

		const segmentStartedAt =
			typeof state.segmentStartedAt === 'number' &&
			Number.isFinite(state.segmentStartedAt)
				? state.segmentStartedAt
				: typeof state.workStartedAt === 'number' &&
					  Number.isFinite(state.workStartedAt)
					? state.workStartedAt
					: null;

		// Current segment only — flushed pauses already live in session storage.
		if (segmentStartedAt != null) {
			return Math.max(0, Math.floor((Date.now() - segmentStartedAt) / 1000));
		}

		// Work Free is count-up; never treat `remaining` as a Pomodoro countdown.
		if (state.style === 'workFree') return 0;

		const configRaw = window.localStorage.getItem('krona:pomodoro-config');
		const config = configRaw
			? (JSON.parse(configRaw) as { work?: number })
			: null;
		const workPeriodSeconds =
			Number.isFinite(Number(config?.work)) && Number(config?.work) >= 60
				? Number(config!.work)
				: 25 * 60;

		if (typeof state.periodEndAt === 'number' && Number.isFinite(state.periodEndAt)) {
			const remaining = Math.max(
				0,
				Math.ceil((state.periodEndAt - Date.now()) / 1000),
			);
			return Math.max(0, workPeriodSeconds - remaining);
		}
		if (typeof state.remaining === 'number' && Number.isFinite(state.remaining)) {
			return Math.max(0, workPeriodSeconds - state.remaining);
		}
	} catch {
		/* ignore */
	}
	return 0;
}

/** Rest seconds currently on the clock (Work Free rest or Pomodoro break). */
export function readInProgressRestSeconds(): number {
	if (typeof window === 'undefined') return 0;
	try {
		const stateRaw = window.localStorage.getItem('pomodoro_state');
		if (!stateRaw) return 0;
		const state = JSON.parse(stateRaw) as {
			running?: boolean;
			mode?: string;
			remaining?: number;
			periodEndAt?: number | null;
			segmentStartedAt?: number | null;
			style?: string;
		};
		if (!state.running) return 0;
		if (state.mode !== 'break' && state.mode !== 'longBreak') return 0;

		const segmentStartedAt =
			typeof state.segmentStartedAt === 'number' &&
			Number.isFinite(state.segmentStartedAt)
				? state.segmentStartedAt
				: null;

		if (state.style === 'workFree') {
			if (segmentStartedAt == null) return 0;
			return Math.max(0, Math.floor((Date.now() - segmentStartedAt) / 1000));
		}

		const configRaw = window.localStorage.getItem('krona:pomodoro-config');
		const config = configRaw
			? (JSON.parse(configRaw) as { break?: number; longBreak?: number })
			: null;
		const breakSeconds =
			state.mode === 'longBreak'
				? Number.isFinite(Number(config?.longBreak)) && Number(config?.longBreak) >= 60
					? Number(config!.longBreak)
					: 15 * 60
				: Number.isFinite(Number(config?.break)) && Number(config?.break) >= 60
					? Number(config!.break)
					: 5 * 60;

		if (segmentStartedAt != null) {
			return Math.max(0, Math.floor((Date.now() - segmentStartedAt) / 1000));
		}
		if (typeof state.periodEndAt === 'number' && Number.isFinite(state.periodEndAt)) {
			const remaining = Math.max(
				0,
				Math.ceil((state.periodEndAt - Date.now()) / 1000),
			);
			return Math.max(0, breakSeconds - remaining);
		}
		if (typeof state.remaining === 'number' && Number.isFinite(state.remaining)) {
			return Math.max(0, breakSeconds - state.remaining);
		}
	} catch {
		/* ignore */
	}
	return 0;
}

/** Calendar day when a session finished (matches homepage widget bucketing). */
export function sessionCompletionDateKey(row: SessionRow): string {
	const startedMs = new Date(row.started_at).getTime();
	const durationMs = Number(row.duration_seconds || 0) * 1000;
	return localDateKey(new Date(startedMs + durationMs));
}

export function sessionCompletedAt(row: SessionRow): Date {
	const startedMs = new Date(row.started_at).getTime();
	const durationMs = Number(row.duration_seconds || 0) * 1000;
	return new Date(startedMs + durationMs);
}

export function buildSessionDayTotals(
	sessionRows: SessionRow[],
): Map<string, SessionDayTotals> {
	const byDate = new Map<string, SessionDayTotals>();
	for (const row of sessionRows) {
		const key = sessionCompletionDateKey(row);
		if (!byDate.has(key)) {
			byDate.set(key, { workSeconds: 0, restSeconds: 0 });
		}
		const entry = byDate.get(key)!;
		const duration = Number(row.duration_seconds || 0);
		if (row.session_kind === 'work') entry.workSeconds += duration;
		else entry.restSeconds += duration;
	}
	return byDate;
}

export function applyInProgressWorkToDayTotals(
	byDate: Map<string, SessionDayTotals>,
): void {
	const inProgress = readInProgressWorkSeconds();
	if (inProgress <= 0) return;
	const today = localDateKey();
	if (!byDate.has(today)) {
		byDate.set(today, { workSeconds: 0, restSeconds: 0 });
	}
	byDate.get(today)!.workSeconds += inProgress;
}

export function dailyWorkRowsFromSessionTotals(
	userId: string,
	byDate: Map<string, SessionDayTotals>,
) {
	return [...byDate.entries()].map(([work_date, totals]) => ({
		user_id: userId,
		work_date,
		hours_worked_daily: Number(formatDecimalHours(totals.workSeconds / 3600)),
		hours_rested_daily: Number(formatDecimalHours(totals.restSeconds / 3600)),
	}));
}

export type TaskBreakdownEntry = {
	taskId: string;
	name: string;
	projectName: string | null;
	seconds: number;
};

/** Aggregate work seconds per task for a range; paginates past the default row cap. */
export async function fetchTopTasksInRange(
	userId: string,
	startIso: string,
	limit = 3,
): Promise<TaskBreakdownEntry[]> {
	const startMs = new Date(startIso).getTime();
	const prefetchStartIso = new Date(startMs - 24 * 60 * 60 * 1000).toISOString();
	const pageSize = 1000;
	let offset = 0;
	const byTask = new Map<string, { name: string; seconds: number }>();

	while (true) {
		const { data, error } = await localData
			.from('sessions')
			.select('task_id, duration_seconds, started_at, tasks(name)')
			.eq('user_id', userId)
			.eq('session_kind', 'work')
			.not('task_id', 'is', null)
			.gte('started_at', prefetchStartIso)
			.range(offset, offset + pageSize - 1);

		if (error) {
			console.warn('[sessionSync] top tasks query failed:', error.message);
			break;
		}
		if (!data?.length) break;

		for (const row of data) {
			const taskId = row.task_id as string;
			if (!taskId) continue;
			const completedAt = sessionCompletedAt({
				started_at: row.started_at,
				duration_seconds: Number(row.duration_seconds || 0),
				session_kind: 'work',
			});
			if (!sessionCompletedAfterMs(completedAt.getTime(), startMs)) continue;

			const linked = row.tasks as { name?: string } | { name?: string }[] | null;
			const taskName = Array.isArray(linked) ? linked[0]?.name : linked?.name;
			const existing = byTask.get(taskId) ?? {
				name: taskName || 'Task',
				seconds: 0,
			};
			existing.seconds += Number(row.duration_seconds || 0);
			if (taskName) existing.name = taskName;
			byTask.set(taskId, existing);
		}

		if (data.length < pageSize) break;
		offset += pageSize;
	}

	return [...byTask.entries()]
		.map(([taskId, entry]) => ({
			taskId,
			name: entry.name,
			projectName: null,
			seconds: entry.seconds,
		}))
		.sort((a, b) => b.seconds - a.seconds)
		.slice(0, limit);
}

/** Top tasks for a period from the same session rows used for work/rest totals. */
export async function buildTopTasksFromSessionRows(
	userId: string,
	sessionRows: SessionRow[],
	limit?: number,
): Promise<TaskBreakdownEntry[]> {
	const byTask = new Map<string, number>();
	for (const row of sessionRows) {
		if (row.session_kind !== 'work' || !row.task_id) continue;
		const taskId = row.task_id;
		byTask.set(taskId, (byTask.get(taskId) ?? 0) + Number(row.duration_seconds || 0));
	}

	const ranked = [...byTask.entries()].sort((a, b) => b[1] - a[1]);
	const sorted =
		typeof limit === 'number' && Number.isFinite(limit)
			? ranked.slice(0, Math.max(0, limit))
			: ranked;
	if (sorted.length === 0) return [];

	const taskIds = sorted.map(([taskId]) => taskId);
	const { data: tasks } = await localData
		.from('tasks')
		.select('id, name, projects(name)')
		.eq('user_id', userId)
		.in('id', taskIds);

	const taskById = new Map(
		(tasks ?? []).map((task) => {
			const relation = task.projects as
				| { name?: string | null }
				| Array<{ name?: string | null }>
				| null;
			const project = Array.isArray(relation) ? relation[0] : relation;
			return [
				task.id as string,
				{
					name: task.name as string,
					projectName: project?.name ? String(project.name) : null,
				},
			] as const;
		}),
	);

	return sorted.map(([taskId, seconds]) => ({
		taskId,
		name: taskById.get(taskId)?.name || 'Task',
		projectName: taskById.get(taskId)?.projectName ?? null,
		seconds,
	}));
}

/** Local timer history + local storage sessions for analytics (same source as homepage widgets). */
export async function fetchMergedSessionsInRange(
	userId: string,
	startIso: string,
	options?: {
		awaitBackfill?: boolean;
		endIso?: string;
		includeLocal?: boolean;
		prefetchHours?: number;
		sessionKind?: 'work' | 'rest';
		skipBackfill?: boolean;
	},
): Promise<SessionRow[]> {
	const shouldIncludeLocal = options?.includeLocal !== false;
	// Opt-in only. Default used to backfill on every range fetch and piled onto
	// focus/performance loads. Pomodoro hydrate owns the cooldown-gated sync.
	const shouldBackfill = shouldIncludeLocal && options?.skipBackfill === false;
	if (shouldBackfill) {
		const backfill = scheduleBackfillLocalSessionsToDb(userId);
		if (options?.awaitBackfill === true) {
			try {
				await Promise.race([
					backfill,
					new Promise<void>((_, reject) => {
						setTimeout(() => reject(new Error('backfill timeout')), 8_000);
					}),
				]);
			} catch {
				/* continue with local + DB rows already stored */
			}
		}
	}

	const startMs = new Date(startIso).getTime();
	const endMs = options?.endIso ? new Date(options.endIso).getTime() : Date.now();
	// Include sessions that may have started before the range but finished within it.
	const prefetchHours = options?.prefetchHours ?? 24;
	const prefetchStartIso = new Date(
		startMs - prefetchHours * 60 * 60 * 1000,
	).toISOString();
	const pageSize = 1000;
	let offset = 0;
	const dbRows: SessionRow[] = [];

	while (true) {
		let query = localData
			.from('sessions')
			.select('duration_seconds,session_kind,started_at,task_id,created_at')
			.eq('user_id', userId)
			.gte('started_at', prefetchStartIso)
			.order('created_at', { ascending: true })
			.range(offset, offset + pageSize - 1);
		if (options?.sessionKind) {
			query = query.eq('session_kind', options.sessionKind);
		}
		if (options?.endIso) {
			query = query.lt('started_at', options.endIso);
		}
		const { data: sessionRows, error } = await query;

		if (error) {
			console.warn('[sessionSync] sessions query failed:', error.message);
			break;
		}
		if (!sessionRows?.length) break;

		for (const row of sessionRows) {
			if (
				!sessionCompletedAfterMs(sessionCompletedAt(row).getTime(), startMs) ||
				sessionCompletedAt(row).getTime() >= endMs
			) {
				continue;
			}
			dbRows.push({
				duration_seconds: Number(row.duration_seconds || 0),
				session_kind: row.session_kind as 'work' | 'rest',
				started_at: row.started_at,
				task_id: row.task_id ?? null,
				created_at: row.created_at,
			});
		}

		if (sessionRows.length < pageSize) break;
		offset += pageSize;
	}

	const localRows = shouldIncludeLocal
		? localSessionsInRange(startIso, options?.endIso)
		: [];
	const filteredLocal =
		options?.sessionKind != null
			? localRows.filter((row) => row.session_kind === options.sessionKind)
			: localRows;

	return mergeSessionRows(filteredLocal, dbRows);
}

/**
 * DB sessions for many users (team performance). No local Pomodoro merge —
 * managers read teammate rows via org RLS.
 */
export async function fetchSessionsForUsersInRange(
	userIds: string[],
	startIso: string,
	options?: {
		endIso?: string;
		prefetchHours?: number;
		sessionKind?: 'work' | 'rest';
	},
): Promise<SessionRow[]> {
	const ids = [...new Set(userIds.filter(Boolean))];
	if (!ids.length) return [];

	const startMs = new Date(startIso).getTime();
	const endMs = options?.endIso ? new Date(options.endIso).getTime() : Date.now();
	const prefetchHours = options?.prefetchHours ?? 24;
	const prefetchStartIso = new Date(
		startMs - prefetchHours * 60 * 60 * 1000,
	).toISOString();
	const pageSize = 1000;
	let offset = 0;
	const dbRows: SessionRow[] = [];

	while (true) {
		let query = localData
			.from('sessions')
			.select(
				'user_id,duration_seconds,session_kind,started_at,task_id,team_task_id,created_at',
			)
			.in('user_id', ids)
			.gte('started_at', prefetchStartIso)
			.order('created_at', { ascending: true })
			.range(offset, offset + pageSize - 1);
		if (options?.sessionKind) {
			query = query.eq('session_kind', options.sessionKind);
		}
		if (options?.endIso) {
			query = query.lt('started_at', options.endIso);
		}
		const { data: sessionRows, error } = await query;

		if (error) {
			console.warn('[sessionSync] team sessions query failed:', error.message);
			break;
		}
		if (!sessionRows?.length) break;

		for (const row of sessionRows) {
			if (
				!sessionCompletedAfterMs(sessionCompletedAt(row).getTime(), startMs) ||
				sessionCompletedAt(row).getTime() >= endMs
			) {
				continue;
			}
			dbRows.push({
				duration_seconds: Number(row.duration_seconds || 0),
				session_kind: row.session_kind as 'work' | 'rest',
				started_at: row.started_at,
				task_id: row.task_id ?? null,
				team_task_id: row.team_task_id ?? null,
				user_id: row.user_id ? String(row.user_id) : null,
				created_at: row.created_at,
			});
		}

		if (sessionRows.length < pageSize) break;
		offset += pageSize;
	}

	return dbRows;
}

/** Per-user work/rest totals in a range (team Today chart, etc.). */
export async function fetchUserSessionTotalsInRange(
	userIds: string[],
	startIso: string,
	options?: {
		endIso?: string;
		prefetchHours?: number;
		sessionKind?: 'work' | 'rest';
	},
): Promise<Map<string, SessionDayTotals>> {
	const ids = [...new Set(userIds.filter(Boolean))];
	const totals = new Map<string, SessionDayTotals>();
	for (const id of ids) {
		totals.set(id, { workSeconds: 0, restSeconds: 0 });
	}
	if (!ids.length) return totals;

	const startMs = new Date(startIso).getTime();
	const endMs = options?.endIso ? new Date(options.endIso).getTime() : Date.now();
	const prefetchHours = options?.prefetchHours ?? 24;
	const prefetchStartIso = new Date(
		startMs - prefetchHours * 60 * 60 * 1000,
	).toISOString();
	const pageSize = 1000;
	let offset = 0;

	while (true) {
		let query = localData
			.from('sessions')
			.select('user_id,duration_seconds,session_kind,started_at,created_at')
			.in('user_id', ids)
			.gte('started_at', prefetchStartIso)
			.order('created_at', { ascending: true })
			.range(offset, offset + pageSize - 1);
		if (options?.sessionKind) {
			query = query.eq('session_kind', options.sessionKind);
		}
		if (options?.endIso) {
			query = query.lt('started_at', options.endIso);
		}
		const { data: sessionRows, error } = await query;

		if (error) {
			console.warn('[sessionSync] user session totals query failed:', error.message);
			break;
		}
		if (!sessionRows?.length) break;

		for (const row of sessionRows) {
			const uid = String(row.user_id ?? '');
			const entry = totals.get(uid);
			if (!entry) continue;
			const completedMs = sessionCompletedAt({
				duration_seconds: Number(row.duration_seconds || 0),
				session_kind: row.session_kind as 'work' | 'rest',
				started_at: row.started_at,
				created_at: row.created_at,
			}).getTime();
			if (
				!sessionCompletedAfterMs(completedMs, startMs) ||
				completedMs >= endMs
			) {
				continue;
			}
			const duration = Number(row.duration_seconds || 0);
			if (row.session_kind === 'work') entry.workSeconds += duration;
			else entry.restSeconds += duration;
		}

		if (sessionRows.length < pageSize) break;
		offset += pageSize;
	}

	return totals;
}

/** Local-only sessions for performance fallback when DB is empty. */
export function localSessionsInRange(
	startIso: string,
	endIso?: string,
): SessionRow[] {
	const startMs = new Date(startIso).getTime();
	const endMs = endIso ? new Date(endIso).getTime() : Date.now();
	const rows: SessionRow[] = [];

	for (const entry of readLocalSessions(POMODORO_SESSIONS_KEY)) {
		if (entry.duration <= 0) continue;
		// Match widget bucketing: include when completion time is on/after range start.
			if (
				!sessionCompletedAfterMs(localSessionCompletedAtMs(entry), startMs) ||
				localSessionCompletedAtMs(entry) >= endMs
			) {
				continue;
			}
		rows.push({
			duration_seconds: entry.duration,
			session_kind: 'work',
			started_at: sessionStartedAt(entry),
			task_id: entry.taskId ?? null,
		});
	}

	for (const entry of readLocalSessions(POMODORO_REST_SESSIONS_KEY)) {
		if (entry.duration <= 0) continue;
			if (
				!sessionCompletedAfterMs(localSessionCompletedAtMs(entry), startMs) ||
				localSessionCompletedAtMs(entry) >= endMs
			) {
				continue;
			}
		rows.push({
			duration_seconds: entry.duration,
			session_kind: 'rest',
			started_at: sessionStartedAt(entry),
		});
	}

	return rows;
}

export type SessionLogIdentity = {
	kind: 'work' | 'rest';
	timestamp: number;
	duration: number;
	taskId?: string | null;
};

export type SessionLogPatch = {
	kind: 'work' | 'rest';
	/** Completion time (ms). Keep stable unless intentionally moved. */
	timestamp: number;
	duration: number;
	taskId?: string | null;
};

function sameSessionIdentity(a: SessionLogIdentity, b: SessionLogIdentity): boolean {
	return (
		a.kind === b.kind &&
		a.timestamp === b.timestamp &&
		a.duration === b.duration &&
		(a.taskId ?? null) === (b.taskId ?? null)
	);
}

async function deleteSessionRowFromDb(
	userId: string,
	identity: SessionLogIdentity,
): Promise<boolean> {
	const startedAt = sessionStartedAt({
		timestamp: identity.timestamp,
		duration: identity.duration,
	});
	const { error } = await localData
		.from('sessions')
		.delete()
		.eq('user_id', userId)
		.eq('started_at', startedAt)
		.eq('duration_seconds', identity.duration)
		.eq('session_kind', identity.kind);
	if (error) {
		console.warn('[sessionSync] session delete failed:', error.message);
		return false;
	}
	return true;
}

async function insertSessionRowToDb(
	userId: string,
	entry: SessionLogPatch,
): Promise<boolean> {
	if (entry.duration <= 0) return false;
	let taskId: string | null = null;
	if (entry.kind === 'work') {
		taskId = await resolveValidTaskId(userId, entry.taskId ?? null);
	}
	const startedAt = sessionStartedAt({
		timestamp: entry.timestamp,
		duration: entry.duration,
	});
	const { error } = await localData.from('sessions').insert({
		user_id: userId,
		started_at: startedAt,
		duration_seconds: entry.duration,
		session_kind: entry.kind,
		task_id: taskId,
	});
	if (error) {
		if (error.code === '23505') return true;
		console.warn('[sessionSync] session insert failed:', error.message);
		return false;
	}
	return true;
}

async function reverseSessionSideEffects(
	userId: string,
	identity: SessionLogIdentity,
): Promise<void> {
	await adjustDailyWorkRest(
		userId,
		identity.kind,
		-identity.duration,
		identity.timestamp,
	);
	if (identity.kind === 'work' && identity.taskId) {
		await adjustTaskWorkedSeconds(userId, identity.taskId, -identity.duration);
	}
}

async function applySessionSideEffects(
	userId: string,
	entry: SessionLogPatch,
): Promise<void> {
	await adjustDailyWorkRest(userId, entry.kind, entry.duration, entry.timestamp);
	if (entry.kind === 'work' && entry.taskId) {
		await adjustTaskWorkedSeconds(userId, entry.taskId, entry.duration);
	}
}

/**
 * Correct or remove a recorded session in local storage + daily/task rollups.
 * Caller owns local React/localStorage session arrays.
 * Pass `next: null` to delete.
 */
export async function reviseSessionLog(
	userId: string,
	previous: SessionLogIdentity,
	next: SessionLogPatch | null,
): Promise<boolean> {
	if (previous.duration <= 0) return false;
	if (next && (next.duration <= 0 || next.duration > MAX_SESSION_DURATION_SECONDS)) {
		return false;
	}
	if (next && sameSessionIdentity(previous, { ...next, taskId: next.taskId ?? null })) {
		return true;
	}

	await deleteSessionRowFromDb(userId, previous);
	await reverseSessionSideEffects(userId, previous);

	if (!next) {
		notifySessionsUpdated();
		return true;
	}

	const taskId =
		next.kind === 'work'
			? await resolveValidTaskId(userId, next.taskId ?? null)
			: null;
	const inserted = await insertSessionRowToDb(userId, {
		...next,
		taskId,
	});
	if (inserted) {
		await applySessionSideEffects(userId, {
			...next,
			taskId,
		});
	}

	notifySessionsUpdated();
	return true;
}

