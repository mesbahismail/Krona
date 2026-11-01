import type { LocalDataClient } from '@/lib/localData';
import dayjs from 'dayjs';
import { notifyChallengesUpdated } from '@/lib/kronaDataEvents';
import { isVacationModeActive } from '@/lib/vacationMode';
import type { ChallengeGift } from '@/lib/challengeGifts';
import { getChallengeGift, PENDING_CHALLENGE_GIFT_KEY } from '@/lib/challengeGifts';
import {
	fetchMergedSessionsInRange,
	readInProgressRestSeconds,
	readInProgressWorkSeconds,
	sessionCompletionDateKey,
} from '@/lib/sessionSync';
import { localData } from '@/lib/localData';

export const DAILY_CHALLENGES_NAME = 'Daily Challenges';

/** Display title for the Daily Challenges feature across the app. */
export const DAILY_CHALLENGE_TITLE = DAILY_CHALLENGES_NAME;

export const DAILY_CHALLENGE_DESCRIPTION =
	'Complete your daily goals. Small wins today create bigger achievements tomorrow.';

export const MAX_DAILY_CHALLENGES = 3;
export const MAX_FOCUS_CHALLENGES_PER_DAY = 1;
export const MAX_REST_CHALLENGES_PER_DAY = 1;
export const MAX_TASKS_CHALLENGES_PER_DAY = 1;

export const FOCUS_CHALLENGE_LIMIT_ERROR =
	'You can only have one work time goal per day.';

export const REST_CHALLENGE_LIMIT_ERROR =
	'You can only have one rest time goal per day.';

export const TASKS_CHALLENGE_LIMIT_ERROR =
	'You can only have one tasks goal per day.';

export type ChallengeType = 'tasks' | 'focus_minutes' | 'rest_minutes';
export type ChallengeStatus = 'active' | 'completed' | 'archived';

export type DailyChallenge = {
	id: string;
	user_id: string;
	title: string;
	challenge_type: ChallengeType;
	target_value: number;
	progress_value: number;
	task_ids: string[];
	gift_key: string;
	challenge_date: string;
	status: ChallengeStatus;
	completed_at: string | null;
	repeat_daily: boolean;
	created_at: string;
	updated_at: string;
};

export type ChallengeInput = {
	challenge_type: ChallengeType;
	target_value: number;
	task_ids?: string[];
	gift_key?: string;
	challenge_date?: string;
	repeat_daily?: boolean;
};

function mapRow(row: Record<string, unknown>): DailyChallenge {
	return {
		id: String(row.id),
		user_id: String(row.user_id),
		title: String(row.title ?? ''),
		challenge_type: row.challenge_type as ChallengeType,
		target_value: Number(row.target_value ?? 0),
		progress_value: Number(row.progress_value ?? 0),
		task_ids: Array.isArray(row.task_ids) ? (row.task_ids as string[]) : [],
		gift_key: String(row.gift_key ?? ''),
		challenge_date: String(row.challenge_date ?? dayjs().format('YYYY-MM-DD')),
		status: (row.status as ChallengeStatus) ?? 'active',
		completed_at: row.completed_at ? String(row.completed_at) : null,
		repeat_daily: Boolean(row.repeat_daily),
		created_at: String(row.created_at ?? ''),
		updated_at: String(row.updated_at ?? ''),
	};
}

export function challengeProgressPercent(challenge: DailyChallenge): number {
	const target = challengeTasksTarget(challenge);
	if (target <= 0) return 0;
	return Math.min(100, Math.round((challenge.progress_value / target) * 100));
}

export function challengeProgressLabel(challenge: DailyChallenge): string {
	if (challenge.challenge_type === 'tasks') {
		const target = challengeTasksTarget(challenge);
		return `${Math.min(challenge.progress_value, target)}/${target} tasks`;
	}
	const done = Math.min(challenge.progress_value, challenge.target_value);
	const target = challenge.target_value;
	if (target >= 60 && target % 60 === 0) {
		const formatHours = (minutes: number) => {
			const hours = minutes / 60;
			return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
		};
		return `${formatHours(done)}/${formatHours(target)} hrs`;
	}
	return `${done}/${target} min`;
}

/** How many tasks this goal requires (selected tasks win over a stale target_value). */
export function challengeTasksTarget(challenge: DailyChallenge): number {
	if (challenge.challenge_type !== 'tasks') return Math.max(1, challenge.target_value);
	if (challenge.task_ids.length > 0) return challenge.task_ids.length;
	return Math.max(1, challenge.target_value);
}

export function challengeGoalTitle(challenge: DailyChallenge): string {
	if (challenge.challenge_type === 'tasks') {
		const n = challengeTasksTarget(challenge);
		if (n === 1) return 'Finish this task';
		return `Finish ${n} tasks`;
	}
	if (challenge.challenge_type === 'rest_minutes') {
		if (challenge.target_value % 60 === 0 && challenge.target_value >= 60) {
			const hours = challenge.target_value / 60;
			return `Rest ${hours} hour${hours === 1 ? '' : 's'}`;
		}
		return `Rest ${challenge.target_value} minutes`;
	}
	if (challenge.target_value % 60 === 0 && challenge.target_value >= 60) {
		const hours = challenge.target_value / 60;
		return `Work ${hours} hour${hours === 1 ? '' : 's'}`;
	}
	return `Focus ${challenge.target_value} minutes`;
}

export function challengeGoalStatusLabel(challenge: DailyChallenge): string {
	if (challenge.status === 'completed') return 'Finished!';
	if (challenge.challenge_type === 'tasks') {
		const target = challengeTasksTarget(challenge);
		const done = Math.min(challenge.progress_value, target);
		return `${done}/${target} Finished`;
	}
	const remaining = Math.max(0, challenge.target_value - challenge.progress_value);
	if (remaining >= 60) {
		const hours = Math.ceil(remaining / 60);
		return `${hours} Hour${hours === 1 ? '' : 's'} left`;
	}
	return `${remaining} min left`;
}

export function getTodayChallenges(
	challenges: DailyChallenge[],
	dateKey: string = todayDateKey(),
): DailyChallenge[] {
	const sorted = challenges
		.filter(
			(c) =>
				c.challenge_date === dateKey && c.challenge_type !== 'tasks',
		)
		.sort((a, b) => a.created_at.localeCompare(b.created_at));

	let focusIncluded = false;
	let restIncluded = false;
	return sorted.filter((challenge) => {
		if (challenge.challenge_type === 'focus_minutes') {
			if (focusIncluded) return false;
			focusIncluded = true;
			return true;
		}
		if (challenge.challenge_type === 'rest_minutes') {
			if (restIncluded) return false;
			restIncluded = true;
			return true;
		}
		return false;
	});
}

export function isFocusTimeChallenge(challenge: DailyChallenge): boolean {
	return challenge.challenge_type === 'focus_minutes';
}

export function isRestTimeChallenge(challenge: DailyChallenge): boolean {
	return challenge.challenge_type === 'rest_minutes';
}

export function isTasksChallenge(challenge: DailyChallenge): boolean {
	return challenge.challenge_type === 'tasks';
}

export function isTimeChallenge(challenge: DailyChallenge): boolean {
	return isFocusTimeChallenge(challenge) || isRestTimeChallenge(challenge);
}

export function getTodayFocusChallenges(
	challenges: DailyChallenge[],
	dateKey: string = todayDateKey(),
): DailyChallenge[] {
	return getTodayChallenges(challenges, dateKey).filter(isFocusTimeChallenge);
}

export function getTodayRestChallenges(
	challenges: DailyChallenge[],
	dateKey: string = todayDateKey(),
): DailyChallenge[] {
	return getTodayChallenges(challenges, dateKey).filter(isRestTimeChallenge);
}

export function getTodayTasksChallenges(
	challenges: DailyChallenge[],
	dateKey: string = todayDateKey(),
): DailyChallenge[] {
	return getTodayChallenges(challenges, dateKey).filter(isTasksChallenge);
}

export function hasFocusChallengeToday(
	challenges: DailyChallenge[],
	dateKey: string = todayDateKey(),
	excludeId?: string,
): boolean {
	return getTodayFocusChallenges(challenges, dateKey).some(
		(challenge) => challenge.status !== 'archived' && challenge.id !== excludeId,
	);
}

export function hasRestChallengeToday(
	challenges: DailyChallenge[],
	dateKey: string = todayDateKey(),
	excludeId?: string,
): boolean {
	return getTodayRestChallenges(challenges, dateKey).some(
		(challenge) => challenge.status !== 'archived' && challenge.id !== excludeId,
	);
}

export function hasTasksChallengeToday(
	challenges: DailyChallenge[],
	dateKey: string = todayDateKey(),
	excludeId?: string,
): boolean {
	return getTodayTasksChallenges(challenges, dateKey).some(
		(challenge) => challenge.status !== 'archived' && challenge.id !== excludeId,
	);
}

/** Goal types still free for today (one work + one rest + one tasks). */
export function getAvailableChallengeTypes(
	challenges: DailyChallenge[],
	dateKey: string = todayDateKey(),
	excludeId?: string,
): ChallengeType[] {
	const available: ChallengeType[] = [];
	if (!hasFocusChallengeToday(challenges, dateKey, excludeId)) {
		available.push('focus_minutes');
	}
	if (!hasRestChallengeToday(challenges, dateKey, excludeId)) {
		available.push('rest_minutes');
	}
	if (!hasTasksChallengeToday(challenges, dateKey, excludeId)) {
		available.push('tasks');
	}
	return available;
}

export function challengeTypeLabel(type: ChallengeType, repeatDaily = false): string {
	if (type === 'tasks') return 'Complete tasks';
	if (type === 'rest_minutes') {
		return repeatDaily ? 'Daily rest time' : 'Rest time';
	}
	return repeatDaily ? 'Daily focus time' : 'Focus time';
}

export function getTodayChallenge(
	challenges: DailyChallenge[],
	dateKey: string = todayDateKey(),
): DailyChallenge | null {
	return getTodayChallenges(challenges, dateKey)[0] ?? null;
}

export function canAddChallengeToday(
	challenges: DailyChallenge[],
	dateKey: string = todayDateKey(),
): boolean {
	if (getTodayChallenges(challenges, dateKey).length >= MAX_DAILY_CHALLENGES) {
		return false;
	}
	return getAvailableChallengeTypes(challenges, dateKey).length > 0;
}

/** @deprecated Use canAddChallengeToday */
export function canCreateChallengeToday(
	challenges: DailyChallenge[],
	dateKey: string = todayDateKey(),
): boolean {
	return canAddChallengeToday(challenges, dateKey);
}

export function todayRewardGiftKey(
	challenges: DailyChallenge[],
	dateKey: string = todayDateKey(),
): string | null {
	const key = getTodayChallenges(challenges, dateKey)[0]?.gift_key ?? null;
	if (!key || key === PENDING_CHALLENGE_GIFT_KEY) return null;
	return key;
}

export function allTodayGoalsCompleted(
	challenges: DailyChallenge[],
	dateKey: string = todayDateKey(),
): boolean {
	const today = getTodayChallenges(challenges, dateKey);
	return today.length > 0 && today.every((c) => c.status === 'completed');
}

export type TodayChallengeDropdownState =
	| 'empty'
	| 'ready'
	| 'in_progress'
	| 'finished';

/** Four states shown in the top-bar Daily Challenges dropdown. */
export function todayChallengeDropdownState(
	challenges: DailyChallenge[],
	dateKey: string = todayDateKey(),
): TodayChallengeDropdownState {
	const today = getTodayChallenges(challenges, dateKey);
	if (today.length === 0) return 'empty';
	if (allTodayGoalsCompleted(challenges, dateKey)) return 'finished';
	const started = today.some(
		(challenge) =>
			challenge.status === 'completed' || challenge.progress_value > 0,
	);
	return started ? 'in_progress' : 'ready';
}

export function challengeGift(challenge: DailyChallenge): ChallengeGift | undefined {
	return getChallengeGift(challenge.gift_key);
}

export function todayDateKey(): string {
	return dayjs().format('YYYY-MM-DD');
}

function isSameLocalDay(iso: string, dateKey: string): boolean {
	return dayjs(iso).format('YYYY-MM-DD') === dateKey;
}

function computeTaskProgressFromTasks(
	tasks: Array<{ id: string; status: string | null; updated_at: string | null }>,
	taskIds: string[],
	dateKey: string,
): number {
	const scoped =
		taskIds.length > 0
			? tasks.filter((task) => taskIds.includes(task.id))
			: tasks;

	const doneCount = scoped.filter((task) => {
		if (task.status !== 'done') return false;
		// Specific tasks: any completion counts. Open goals: only tasks finished today.
		if (taskIds.length > 0) return true;
		return Boolean(task.updated_at && isSameLocalDay(task.updated_at, dateKey));
	}).length;

	return doneCount;
}

async function fetchTodaySessionRows(userId: string, dateKey: string) {
	const startIso = dayjs(dateKey).startOf('day').toISOString();
	const endIso = dayjs(dateKey).endOf('day').toISOString();
	return fetchMergedSessionsInRange(userId, startIso, {
		awaitBackfill: false,
		endIso,
		includeLocal: true,
		// Prefetch so segments that started yesterday but finished today still count.
		prefetchHours: 24,
		skipBackfill: true,
	});
}

async function computeTimeProgressFromRows(
	rows: Awaited<ReturnType<typeof fetchMergedSessionsInRange>>,
	dateKey: string,
	kind: 'work' | 'rest',
): Promise<number> {
	let totalSeconds = 0;
	for (const row of rows) {
		if (row.session_kind !== kind) continue;
		if (sessionCompletionDateKey(row) !== dateKey) continue;
		totalSeconds += Number(row.duration_seconds ?? 0);
	}
	totalSeconds +=
		kind === 'work' ? readInProgressWorkSeconds() : readInProgressRestSeconds();
	return Math.floor(totalSeconds / 60);
}

export async function fetchDailyChallenges(options?: {
	dateKey?: string;
	includeArchived?: boolean;
	userId?: string;
	localData?: LocalDataClient;
}): Promise<DailyChallenge[]> {
	const dateKey = options?.dateKey ?? todayDateKey();
	const db = options?.localData ?? localData;
	let userId = options?.userId;
	if (!userId) {
		const { data: userRes } = await db.auth.getUser();
		if (!userRes.user) return [];
		userId = userRes.user.id;
	}

	let query = db
		.from('daily_challenges')
		.select('*')
		.eq('user_id', userId)
		.eq('challenge_date', dateKey)
		.order('created_at', { ascending: true });

	if (!options?.includeArchived) {
		query = query.neq('status', 'archived');
	}

	const { data, error } = await query;
	if (error) {
		console.warn('[challenges] fetch failed', error.message);
		return [];
	}
	return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
}

export async function fetchAllChallenges(): Promise<DailyChallenge[]> {
	const { data: userRes } = await localData.auth.getUser();
	const user = userRes.user;
	if (!user) return [];

	const { data, error } = await localData
		.from('daily_challenges')
		.select('*')
		.eq('user_id', user.id)
		.order('challenge_date', { ascending: false })
		.order('created_at', { ascending: false })
		.limit(60);

	if (error) {
		console.warn('[challenges] fetch all failed', error.message);
		return [];
	}
	return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
}

/**
 * Seed a repeating focus goal from personal daily work hours when the user
 * has none today (e.g. manager set hours on a team invite).
 */
export async function ensureWorkHoursFocusChallenge(options?: {
	userId?: string;
	hours?: number;
	localData?: LocalDataClient;
}): Promise<void> {
	const db = options?.localData ?? localData;
	let userId = options?.userId;
	if (!userId) {
		const { data: userRes } = await db.auth.getUser();
		if (!userRes.user) return;
		userId = userRes.user.id;
	}

	const dateKey = todayDateKey();
	const { data: existingFocusToday } = await db
		.from('daily_challenges')
		.select('id')
		.eq('user_id', userId)
		.eq('challenge_date', dateKey)
		.eq('challenge_type', 'focus_minutes')
		.neq('status', 'archived')
		.limit(1);

	if ((existingFocusToday?.length ?? 0) > 0) return;

	let hours = options?.hours;
	if (hours == null || !Number.isFinite(hours) || hours <= 0) {
		const { data: personal } = await db
			.from('personal')
			.select('work_hours_target_daily')
			.eq('user_id', userId)
			.maybeSingle();
		hours = Number(personal?.work_hours_target_daily ?? 0);
	}
	if (!Number.isFinite(hours) || hours <= 0) return;

	const { data: existingToday } = await db
		.from('daily_challenges')
		.select('id')
		.eq('user_id', userId)
		.eq('challenge_date', dateKey);

	if ((existingToday?.length ?? 0) >= MAX_DAILY_CHALLENGES) return;

	const targetMinutes = Math.max(1, Math.round(hours * 60));
	const payload = {
		user_id: userId,
		title: DAILY_CHALLENGE_TITLE,
		challenge_type: 'focus_minutes' as const,
		target_value: targetMinutes,
		task_ids: [] as string[],
		gift_key: PENDING_CHALLENGE_GIFT_KEY,
		challenge_date: dateKey,
		status: 'active' as const,
		progress_value: 0,
		repeat_daily: true,
	};

	let { error } = await db.from('daily_challenges').insert(payload);
	if (error?.message?.includes('repeat_daily')) {
		const { repeat_daily: _repeatDaily, ...withoutRepeatDaily } = payload;
		({ error } = await db.from('daily_challenges').insert(withoutRepeatDaily));
	}
	if (error) {
		console.warn('[challenges] work-hours focus seed failed', error.message);
	}
}

/** Create or retarget today's work-hours goal (manager invite / edit). */
export async function upsertWorkHoursFocusChallenge(options: {
	userId: string;
	hours: number;
	dateKey?: string;
	localData: LocalDataClient;
}): Promise<{ ok: boolean; error?: string }> {
	const hours = options.hours;
	if (!Number.isFinite(hours) || hours <= 0) return { ok: true };

	const dateKey =
		options.dateKey && /^\d{4}-\d{2}-\d{2}$/.test(options.dateKey)
			? options.dateKey
			: todayDateKey();
	const db = options.localData;
	const targetMinutes = Math.max(1, Math.round(hours * 60));

	const { data: existing } = await db
		.from('daily_challenges')
		.select('id')
		.eq('user_id', options.userId)
		.eq('challenge_date', dateKey)
		.eq('challenge_type', 'focus_minutes')
		.neq('status', 'archived')
		.limit(1)
		.maybeSingle();

	if (existing?.id) {
		const { error } = await db
			.from('daily_challenges')
			.update({
				target_value: targetMinutes,
				repeat_daily: true,
				status: 'active',
			})
			.eq('id', existing.id);
		if (error) return { ok: false, error: error.message };
		return { ok: true };
	}

	const payload = {
		user_id: options.userId,
		title: DAILY_CHALLENGE_TITLE,
		challenge_type: 'focus_minutes' as const,
		target_value: targetMinutes,
		task_ids: [] as string[],
		gift_key: PENDING_CHALLENGE_GIFT_KEY,
		challenge_date: dateKey,
		status: 'active' as const,
		progress_value: 0,
		repeat_daily: true,
	};

	let { error } = await db.from('daily_challenges').insert(payload);
	if (error?.message?.includes('repeat_daily')) {
		const { repeat_daily: _repeatDaily, ...withoutRepeatDaily } = payload;
		({ error } = await db.from('daily_challenges').insert(withoutRepeatDaily));
	}
	if (error) return { ok: false, error: error.message };
	return { ok: true };
}

export async function ensureRepeatDailyFocusChallenge(options?: {
	userId?: string;
}): Promise<void> {
	let userId = options?.userId;
	if (!userId) {
		const { data: userRes } = await localData.auth.getUser();
		if (!userRes.user) return;
		userId = userRes.user.id;
	}

	const dateKey = todayDateKey();
	const { data: existingFocusToday } = await localData
		.from('daily_challenges')
		.select('id')
		.eq('user_id', userId)
		.eq('challenge_date', dateKey)
		.eq('challenge_type', 'focus_minutes')
		.neq('status', 'archived')
		.limit(1);

	if ((existingFocusToday?.length ?? 0) > 0) return;

	const { data: existingToday } = await localData
		.from('daily_challenges')
		.select('id')
		.eq('user_id', userId)
		.eq('challenge_date', dateKey);

	if ((existingToday?.length ?? 0) >= MAX_DAILY_CHALLENGES) return;

	const { data: template, error: templateError } = await localData
		.from('daily_challenges')
		.select('*')
		.eq('user_id', userId)
		.eq('repeat_daily', true)
		.eq('challenge_type', 'focus_minutes')
		.order('challenge_date', { ascending: false })
		.limit(1)
		.maybeSingle();

	if (templateError?.message?.includes('repeat_daily')) return;

	if (!template || template.challenge_date === dateKey) return;

	const created = await createDailyChallenge({
		challenge_type: 'focus_minutes',
		target_value: Number(template.target_value),
		gift_key: String(template.gift_key),
		task_ids: [],
		challenge_date: dateKey,
		repeat_daily: true,
	});
	if (!created.ok) {
		console.warn('[challenges] repeat focus carry-over failed:', created.error);
	}
}

export async function ensureRepeatDailyRestChallenge(options?: {
	userId?: string;
}): Promise<void> {
	let userId = options?.userId;
	if (!userId) {
		const { data: userRes } = await localData.auth.getUser();
		if (!userRes.user) return;
		userId = userRes.user.id;
	}

	const dateKey = todayDateKey();
	const { data: existingRestToday } = await localData
		.from('daily_challenges')
		.select('id')
		.eq('user_id', userId)
		.eq('challenge_date', dateKey)
		.eq('challenge_type', 'rest_minutes')
		.neq('status', 'archived')
		.limit(1);

	if ((existingRestToday?.length ?? 0) > 0) return;

	const { data: existingToday } = await localData
		.from('daily_challenges')
		.select('id')
		.eq('user_id', userId)
		.eq('challenge_date', dateKey);

	if ((existingToday?.length ?? 0) >= MAX_DAILY_CHALLENGES) return;

	const { data: template, error: templateError } = await localData
		.from('daily_challenges')
		.select('*')
		.eq('user_id', userId)
		.eq('repeat_daily', true)
		.eq('challenge_type', 'rest_minutes')
		.order('challenge_date', { ascending: false })
		.limit(1)
		.maybeSingle();

	if (templateError?.message?.includes('repeat_daily')) return;

	if (!template || template.challenge_date === dateKey) return;

	const created = await createDailyChallenge({
		challenge_type: 'rest_minutes',
		target_value: Number(template.target_value),
		gift_key: String(template.gift_key),
		task_ids: [],
		challenge_date: dateKey,
		repeat_daily: true,
	});
	if (!created.ok) {
		console.warn('[challenges] repeat rest carry-over failed:', created.error);
	}
}

export async function ensureRepeatDailyTasksChallenge(options?: {
	userId?: string;
}): Promise<void> {
	let userId = options?.userId;
	if (!userId) {
		const { data: userRes } = await localData.auth.getUser();
		if (!userRes.user) return;
		userId = userRes.user.id;
	}

	const dateKey = todayDateKey();
	const { data: existingTasksToday } = await localData
		.from('daily_challenges')
		.select('id')
		.eq('user_id', userId)
		.eq('challenge_date', dateKey)
		.eq('challenge_type', 'tasks')
		.neq('status', 'archived')
		.limit(1);

	if ((existingTasksToday?.length ?? 0) > 0) return;

	const { data: existingToday } = await localData
		.from('daily_challenges')
		.select('id')
		.eq('user_id', userId)
		.eq('challenge_date', dateKey);

	if ((existingToday?.length ?? 0) >= MAX_DAILY_CHALLENGES) return;

	const { data: template, error: templateError } = await localData
		.from('daily_challenges')
		.select('*')
		.eq('user_id', userId)
		.eq('repeat_daily', true)
		.eq('challenge_type', 'tasks')
		.order('challenge_date', { ascending: false })
		.limit(1)
		.maybeSingle();

	if (templateError?.message?.includes('repeat_daily')) return;

	if (!template || template.challenge_date === dateKey) return;

	const taskIds = Array.isArray(template.task_ids)
		? (template.task_ids as string[]).filter(
				(id): id is string => typeof id === 'string' && id.length > 0,
			)
		: [];
	if (taskIds.length === 0) return;

	const created = await createDailyChallenge({
		challenge_type: 'tasks',
		target_value: taskIds.length,
		gift_key: String(template.gift_key),
		task_ids: taskIds,
		challenge_date: dateKey,
		repeat_daily: true,
	});
	if (!created.ok) {
		console.warn('[challenges] repeat tasks carry-over failed:', created.error);
	}
}

export type ChallengeSaveResult =
	| { ok: true; challenge: DailyChallenge }
	| { ok: false; error: string };

function challengeSaveErrorMessage(error: { message?: string } | null): string {
	const message = error?.message?.trim();
	if (!message) {
		return 'Could not save your goal on this device. Please check available browser storage.';
	}
	if (message.includes('repeat_daily')) {
		return 'Could not save the repeat setting on this device.';
	}
	if (message.includes('challenge_type')) {
		return 'Could not save the rest goal on this device.';
	}
	if (message.includes('daily_challenges')) {
		return 'Could not save the daily challenge on this device.';
	}
	return message;
}

export async function createDailyChallenge(
	input: ChallengeInput,
): Promise<ChallengeSaveResult> {
	try {
		const { data: userRes } = await localData.auth.getUser();
		const user = userRes.user;
		if (!user) {
			return { ok: false, error: 'Sign in to create a daily challenge.' };
		}

		if (input.challenge_type === 'tasks') {
			return {
				ok: false,
				error: 'Daily challenges are work-hours goals only.',
			};
		}

		const challengeDate = input.challenge_date ?? todayDateKey();
		const { data: existing, error: existingError } = await localData
			.from('daily_challenges')
			.select('id, gift_key')
			.eq('user_id', user.id)
			.eq('challenge_date', challengeDate)
			.order('created_at', { ascending: true });

		if (existingError) {
			console.warn('[challenges] existing lookup failed', existingError.message);
			return { ok: false, error: challengeSaveErrorMessage(existingError) };
		}

		if ((existing?.length ?? 0) >= MAX_DAILY_CHALLENGES) {
			console.warn('[challenges] max daily goals reached');
			return {
				ok: false,
				error: `You can add up to ${MAX_DAILY_CHALLENGES} goals per day.`,
			};
		}

		if (input.challenge_type === 'focus_minutes') {
			const { data: existingFocus, error: focusError } = await localData
				.from('daily_challenges')
				.select('id')
				.eq('user_id', user.id)
				.eq('challenge_date', challengeDate)
				.eq('challenge_type', 'focus_minutes')
				.neq('status', 'archived')
				.limit(1);

			if (focusError) {
				console.warn('[challenges] focus lookup failed', focusError.message);
				return { ok: false, error: challengeSaveErrorMessage(focusError) };
			}

			if ((existingFocus?.length ?? 0) > 0) {
				return { ok: false, error: FOCUS_CHALLENGE_LIMIT_ERROR };
			}
		}

		if (input.challenge_type === 'rest_minutes') {
			const { data: existingRest, error: restError } = await localData
				.from('daily_challenges')
				.select('id')
				.eq('user_id', user.id)
				.eq('challenge_date', challengeDate)
				.eq('challenge_type', 'rest_minutes')
				.neq('status', 'archived')
				.limit(1);

			if (restError) {
				console.warn('[challenges] rest lookup failed', restError.message);
				return { ok: false, error: challengeSaveErrorMessage(restError) };
			}

			if ((existingRest?.length ?? 0) > 0) {
				return { ok: false, error: REST_CHALLENGE_LIMIT_ERROR };
			}
		}

		const inheritedGift = existing?.[0]?.gift_key;
		const giftKey =
			input.gift_key ||
			(inheritedGift && inheritedGift !== PENDING_CHALLENGE_GIFT_KEY
				? inheritedGift
				: PENDING_CHALLENGE_GIFT_KEY);

		const payload = {
			user_id: user.id,
			title: DAILY_CHALLENGE_TITLE,
			challenge_type: input.challenge_type,
			target_value: Math.max(1, Math.round(input.target_value)),
			task_ids: [] as string[],
			gift_key: giftKey,
			challenge_date: challengeDate,
			status: 'active' as const,
			progress_value: 0,
			repeat_daily: Boolean(input.repeat_daily),
		};

		let { data, error } = await localData
			.from('daily_challenges')
			.insert(payload)
			.select('*')
			.single();

		if (error?.message?.includes('repeat_daily')) {
			const { repeat_daily: _repeatDaily, ...withoutRepeatDaily } = payload;
			({ data, error } = await localData
				.from('daily_challenges')
				.insert(withoutRepeatDaily)
				.select('*')
				.single());
		}

		if (error) {
			console.warn('[challenges] create failed', error.message);
			return { ok: false, error: challengeSaveErrorMessage(error) };
		}
		if (!data) {
			return { ok: false, error: 'Could not create your goal. Please try again.' };
		}
		return { ok: true, challenge: mapRow(data as Record<string, unknown>) };
	} catch (error) {
		console.warn('[challenges] create threw', error);
		return {
			ok: false,
			error:
				error instanceof Error
					? error.message
					: 'Could not create your goal. Please try again.',
		};
	}
}

export async function updateDailyChallenge(
	id: string,
	patch: Partial<ChallengeInput> & { status?: ChallengeStatus },
): Promise<ChallengeSaveResult> {
	try {
		const { data: current, error: currentError } = await localData
			.from('daily_challenges')
			.select('*')
			.eq('id', id)
			.maybeSingle();

		if (currentError || !current) {
			return { ok: false, error: 'Could not find this goal to update.' };
		}

		const nextType = (patch.challenge_type ?? current.challenge_type) as ChallengeType;
		if (nextType === 'tasks') {
			return {
				ok: false,
				error: 'Daily challenges are work-hours goals only.',
			};
		}
		const nextDate = patch.challenge_date ?? String(current.challenge_date);

		if (nextType === 'focus_minutes') {
			const { data: existingFocus, error: focusError } = await localData
				.from('daily_challenges')
				.select('id')
				.eq('user_id', current.user_id)
				.eq('challenge_date', nextDate)
				.eq('challenge_type', 'focus_minutes')
				.neq('status', 'archived')
				.neq('id', id)
				.limit(1);

			if (focusError) {
				return { ok: false, error: challengeSaveErrorMessage(focusError) };
			}

			if ((existingFocus?.length ?? 0) > 0) {
				return { ok: false, error: FOCUS_CHALLENGE_LIMIT_ERROR };
			}
		}

		if (nextType === 'rest_minutes') {
			const { data: existingRest, error: restError } = await localData
				.from('daily_challenges')
				.select('id')
				.eq('user_id', current.user_id)
				.eq('challenge_date', nextDate)
				.eq('challenge_type', 'rest_minutes')
				.neq('status', 'archived')
				.neq('id', id)
				.limit(1);

			if (restError) {
				return { ok: false, error: challengeSaveErrorMessage(restError) };
			}

			if ((existingRest?.length ?? 0) > 0) {
				return { ok: false, error: REST_CHALLENGE_LIMIT_ERROR };
			}
		}

		const updates: Record<string, unknown> = {};
		if (patch.challenge_type !== undefined) updates.challenge_type = patch.challenge_type;
		if (patch.target_value !== undefined) {
			updates.target_value = Math.max(1, Math.round(patch.target_value));
		}
		if (patch.task_ids !== undefined) {
			updates.task_ids = [];
		}
		if (patch.gift_key !== undefined) updates.gift_key = patch.gift_key;
		if (patch.challenge_date !== undefined) updates.challenge_date = patch.challenge_date;
		if (patch.status !== undefined) updates.status = patch.status;
		if (patch.repeat_daily !== undefined) updates.repeat_daily = patch.repeat_daily;

		let { data, error } = await localData
			.from('daily_challenges')
			.update(updates)
			.eq('id', id)
			.select('*')
			.single();

		if (error?.message?.includes('repeat_daily') && 'repeat_daily' in updates) {
			const { repeat_daily: _repeatDaily, ...withoutRepeatDaily } = updates;
			({ data, error } = await localData
				.from('daily_challenges')
				.update(withoutRepeatDaily)
				.eq('id', id)
				.select('*')
				.single());
		}

		if (error) {
			console.warn('[challenges] update failed', error.message);
			return { ok: false, error: challengeSaveErrorMessage(error) };
		}
		if (!data) {
			return { ok: false, error: 'Could not update your goal. Please try again.' };
		}
		return { ok: true, challenge: mapRow(data as Record<string, unknown>) };
	} catch (error) {
		console.warn('[challenges] update threw', error);
		return {
			ok: false,
			error:
				error instanceof Error
					? error.message
					: 'Could not update your goal. Please try again.',
		};
	}
}

export async function updateTodayRewardGift(
	giftKey: string,
	dateKey: string = todayDateKey(),
): Promise<boolean> {
	const { data: userRes } = await localData.auth.getUser();
	const user = userRes.user;
	if (!user) return false;

	const { error } = await localData
		.from('daily_challenges')
		.update({ gift_key: giftKey })
		.eq('user_id', user.id)
		.eq('challenge_date', dateKey);

	if (error) {
		console.warn('[challenges] update reward failed', error.message);
		return false;
	}
	return true;
}

export async function deleteDailyChallenge(
	challenge: Pick<DailyChallenge, 'id' | 'user_id' | 'repeat_daily'>,
): Promise<boolean> {
	// Cancelling a repeating focus goal must clear the template flag on all
	// historical rows, otherwise ensureRepeatDailyFocusChallenge recreates it.
	if (challenge.repeat_daily) {
		const { error: cancelError } = await localData
			.from('daily_challenges')
			.update({ repeat_daily: false })
			.eq('user_id', challenge.user_id)
			.eq('repeat_daily', true);
		if (cancelError) {
			console.warn(
				'[challenges] cancel repeat_daily failed',
				cancelError.message,
			);
			return false;
		}
	}

	const { error } = await localData
		.from('daily_challenges')
		.delete()
		.eq('id', challenge.id);
	if (error) {
		console.warn('[challenges] delete failed', error.message);
		return false;
	}
	return true;
}

/** Active today task-type challenges that explicitly include this task. */
export function getActiveTodayTaskChallengesContainingTask(
	challenges: DailyChallenge[],
	taskId: string,
	dateKey: string = todayDateKey(),
): DailyChallenge[] {
	return getTodayChallenges(challenges, dateKey).filter(
		(challenge) =>
			challenge.status === 'active' &&
			challenge.challenge_type === 'tasks' &&
			challenge.task_ids.includes(taskId),
	);
}

/** Task ids currently pinned on today's active task-type daily challenges. */
export function getTodayActiveTaskChallengeTaskIds(
	challenges: DailyChallenge[],
	dateKey: string = todayDateKey(),
): Set<string> {
	const ids = new Set<string>();
	for (const challenge of getTodayChallenges(challenges, dateKey)) {
		if (
			challenge.status !== 'active' ||
			challenge.challenge_type !== 'tasks'
		) {
			continue;
		}
		for (const taskId of challenge.task_ids) {
			if (taskId) ids.add(taskId);
		}
	}
	return ids;
}

export async function findActiveTodayChallengesContainingTask(
	taskId: string,
): Promise<DailyChallenge[]> {
	const challenges = await fetchDailyChallenges();
	return getActiveTodayTaskChallengesContainingTask(challenges, taskId);
}

/** Remove a task from today's active daily challenges and resync progress. */
export async function removeTaskFromTodayDailyChallenges(
	taskId: string,
): Promise<boolean> {
	return removeTasksFromTodayDailyChallenges([taskId]);
}

/** Remove many tasks from today's active daily challenges (e.g. project delete). */
export async function removeTasksFromTodayDailyChallenges(
	taskIds: string[],
): Promise<boolean> {
	const uniqueIds = [
		...new Set(taskIds.map((id) => id.trim()).filter(Boolean)),
	];
	if (uniqueIds.length === 0) return true;

	const removeSet = new Set(uniqueIds);
	const challenges = await fetchDailyChallenges();
	const dateKey = todayDateKey();
	const affected = getTodayChallenges(challenges, dateKey).filter(
		(challenge) =>
			challenge.status === 'active' &&
			challenge.challenge_type === 'tasks' &&
			challenge.task_ids.some((id) => removeSet.has(id)),
	);
	if (affected.length === 0) return true;

	let allOk = true;
	for (const challenge of affected) {
		const nextTaskIds = challenge.task_ids.filter((id) => !removeSet.has(id));
		const patch: Partial<ChallengeInput> = { task_ids: nextTaskIds };
		if (nextTaskIds.length > 0) {
			patch.target_value = nextTaskIds.length;
		}
		const result = await updateDailyChallenge(challenge.id, patch);
		if (!result.ok) allOk = false;
	}

	if (allOk) {
		await syncDailyChallengeProgress();
		if (typeof window !== 'undefined') {
			notifyChallengesUpdated();
		}
	}

	return allOk;
}

export type AddTaskToDailyChallengeResult =
	| { ok: true; alreadyPresent: boolean; created: boolean }
	| { ok: false; error: string };

/** Add a task to today's task challenge, or create one if needed. */
export async function addTaskToTodayDailyChallenges(
	taskId: string,
): Promise<AddTaskToDailyChallengeResult> {
	if (!taskId) {
		return { ok: false, error: 'Missing task.' };
	}

	try {
		const { data: userRes } = await localData.auth.getUser();
		const user = userRes.user;
		if (!user) {
			return { ok: false, error: 'Sign in to update daily challenges.' };
		}

		const challenges = await fetchDailyChallenges();
		const todayTaskChallenges = getTodayChallenges(challenges).filter(
			(challenge) =>
				challenge.status === 'active' && challenge.challenge_type === 'tasks',
		);

		if (todayTaskChallenges.some((challenge) => challenge.task_ids.includes(taskId))) {
			return { ok: true, alreadyPresent: true, created: false };
		}

		const existing = todayTaskChallenges[0];
		if (existing) {
			const nextTaskIds = [...existing.task_ids, taskId];
			const result = await updateDailyChallenge(existing.id, {
				task_ids: nextTaskIds,
				target_value: nextTaskIds.length,
			});
			if (!result.ok) {
				return { ok: false, error: result.error };
			}
			await syncDailyChallengeProgress();
			if (typeof window !== 'undefined') {
				notifyChallengesUpdated();
			}
			return { ok: true, alreadyPresent: false, created: false };
		}

		if (!canAddChallengeToday(challenges)) {
			return {
				ok: false,
				error: `You already have ${MAX_DAILY_CHALLENGES} goals today. Free a slot or open Challenges to manage them.`,
			};
		}

		const result = await createDailyChallenge({
			challenge_type: 'tasks',
			target_value: 1,
			task_ids: [taskId],
		});
		if (!result.ok) {
			return { ok: false, error: result.error };
		}

		await syncDailyChallengeProgress();
		if (typeof window !== 'undefined') {
			notifyChallengesUpdated();
		}
		return { ok: true, alreadyPresent: false, created: true };
	} catch (error) {
		console.warn('[challenges] add task to daily challenges failed', error);
		return {
			ok: false,
			error:
				error instanceof Error
					? error.message
					: 'Could not add this task to daily challenges.',
		};
	}
}

/** Recompute progress from tasks/sessions and mark completed when target is met. */
export async function syncDailyChallengeProgress(
	dateKey: string = todayDateKey(),
	options?: { userId?: string },
): Promise<DailyChallenge[]> {
	if (isVacationModeActive()) return [];

	let userId = options?.userId;
	if (!userId) {
		const { data: userRes } = await localData.auth.getUser();
		if (!userRes.user) return [];
		userId = userRes.user.id;
	}

	const { data: rows, error } = await localData
		.from('daily_challenges')
		.select('*')
		.eq('user_id', userId)
		.eq('challenge_date', dateKey)
		.eq('status', 'active');

	if (error || !rows?.length) return [];

	const challenges = rows.map((row) => mapRow(row as Record<string, unknown>));
	const needsTasks = challenges.some((c) => c.challenge_type === 'tasks');
	const needsFocus = challenges.some((c) => c.challenge_type === 'focus_minutes');
	const needsRest = challenges.some((c) => c.challenge_type === 'rest_minutes');
	const needsSessions = needsFocus || needsRest;

	const taskIdsForProgress = Array.from(
		new Set(
			challenges
				.filter((c) => c.challenge_type === 'tasks')
				.flatMap((c) => c.task_ids)
				.filter(Boolean),
		),
	);

	const [tasksResult, teamTasksResult, sessionRows] = await Promise.all([
		needsTasks
			? taskIdsForProgress.length > 0
				? localData
						.from('tasks')
						.select('id, status, updated_at')
						.eq('user_id', userId)
						.in('id', taskIdsForProgress)
				: localData
						.from('tasks')
						.select('id, status, updated_at')
						.eq('user_id', userId)
			: Promise.resolve({
					data: [] as Array<{
						id: string;
						status: string | null;
						updated_at: string | null;
					}>,
				}),
		needsTasks && taskIdsForProgress.length > 0
			? localData
					.from('team_tasks')
					.select('id, status, updated_at')
					.in('id', taskIdsForProgress)
			: Promise.resolve({
					data: [] as Array<{
						id: string;
						status: string | null;
						updated_at: string | null;
					}>,
				}),
		needsSessions
			? fetchTodaySessionRows(userId, dateKey)
			: Promise.resolve(
					[] as Awaited<ReturnType<typeof fetchMergedSessionsInRange>>,
				),
	]);

	const [focusMinutes, restMinutes] = await Promise.all([
		needsFocus
			? computeTimeProgressFromRows(sessionRows, dateKey, 'work')
			: Promise.resolve(0),
		needsRest
			? computeTimeProgressFromRows(sessionRows, dateKey, 'rest')
			: Promise.resolve(0),
	]);

	const personalTasks = tasksResult.data ?? [];
	const teamTasks = teamTasksResult.data ?? [];
	const seenTaskIds = new Set(personalTasks.map((task) => String(task.id)));
	const allTasks = [
		...personalTasks,
		...teamTasks.filter((task) => !seenTaskIds.has(String(task.id))),
	];
	const updated: DailyChallenge[] = [];

	await Promise.all(
		challenges.map(async (challenge) => {
			const progress =
				challenge.challenge_type === 'tasks'
					? computeTaskProgressFromTasks(allTasks, challenge.task_ids, dateKey)
					: challenge.challenge_type === 'rest_minutes'
						? restMinutes
						: focusMinutes;

			const target =
				challenge.challenge_type === 'tasks'
					? challengeTasksTarget(challenge)
					: challenge.target_value;
			const completed = progress >= target;
			const wasCompleted = challenge.status === 'completed';
			const targetNeedsSync =
				challenge.challenge_type === 'tasks' &&
				challenge.task_ids.length > 0 &&
				challenge.target_value !== target;

			if (
				progress === challenge.progress_value &&
				completed === wasCompleted &&
				!targetNeedsSync
			) {
				return;
			}

			const patch: Record<string, unknown> = { progress_value: progress };
			if (targetNeedsSync) {
				patch.target_value = target;
			}
			if (completed && !wasCompleted) {
				patch.status = 'completed';
				patch.completed_at = new Date().toISOString();
			}

			const { data: saved, error: saveError } = await localData
				.from('daily_challenges')
				.update(patch)
				.eq('id', challenge.id)
				.select('*')
				.single();

			if (!saveError && saved) {
				updated.push(mapRow(saved as Record<string, unknown>));
			}
		}),
	);

	if (updated.length > 0 && typeof window !== 'undefined') {
		notifyChallengesUpdated();
	}

	return updated;
}

export function pickPrimaryChallenge(challenges: DailyChallenge[]): DailyChallenge | null {
	const active = challenges.filter((c) => c.status === 'active');
	if (active.length === 0) {
		return challenges.find((c) => c.status === 'completed') ?? null;
	}
	return active[0];
}

export function aggregateProgressPercent(challenges: DailyChallenge[]): number {
	const active = challenges.filter((c) => c.status === 'active');
	if (active.length === 0) {
		const completed = challenges.filter((c) => c.status === 'completed');
		return completed.length > 0 ? 100 : 0;
	}
	const sum = active.reduce((acc, c) => acc + challengeProgressPercent(c), 0);
	return Math.round(sum / active.length);
}
