'use client';

import dayjs from 'dayjs';
import { localData } from '@/lib/localData';
import { type DailyChallenge } from '@/lib/challenges';
import {
	computeAvgDailyWorkHours,
	computeWorkTrendVsPreviousDay,
	type WorkTrendDirection,
} from '@/lib/performanceMetrics';
import { formatDecimalHours, secondsToDisplayHours } from '@/lib/taskTime';
import { fetchOrgMembers } from '@/lib/teams/org';
import { compareTeamUndefinedProjectLast } from '@/lib/teams/undefinedTeamProject';
import {
	fetchTimerPresenceByUserIds,
	type TeamTimerPresenceMode,
} from '@/lib/teams/timerPresence';
import type { OrganizationMember } from '@/lib/teams/types';

export type TeamTaskRow = {
	id: string;
	name: string;
	status: string;
	assignee_user_id: string | null;
	created_by?: string | null;
	project_id?: string | null;
	deadline: string | null;
	completed_at: string | null;
	created_at: string;
	estimated_hours?: number | null;
	worked_seconds?: number;
	prioritized?: boolean;
};

export type TeamProjectRow = {
	id: string;
	name: string;
	status: string;
	deadline: string | null;
	is_unassigned_folder: boolean;
	assignee_user_id: string | null;
	/** Employees (and others) assigned to this project. */
	member_user_ids: string[];
	created_by?: string | null;
	created_at: string;
};

export type TeamProjectOption = {
	id: string;
	name: string;
};

export type MemberChallengeProgress = {
	member: OrganizationMember;
	percent: number;
	label: string;
	challengeCount: number;
	challenges: DailyChallenge[];
	timerStatus: TeamTimerPresenceMode | null;
};

export type TeamTodayProgress = {
	workHoursLabel: string;
	restHoursLabel: string;
	tasksFinished: number;
};

function localDayBoundsIso(day = dayjs()) {
	const start = day.startOf('day').toISOString();
	const end = day.endOf('day').toISOString();
	const dateKey = day.format('YYYY-MM-DD');
	return { start, end, dateKey };
}

function challengeFromRow(
	row: Record<string, unknown>,
	dateKey: string,
): DailyChallenge {
	const challengeType = String(
		row.challenge_type,
	) as DailyChallenge['challenge_type'];
	const taskIds = Array.isArray(row.task_ids) ? (row.task_ids as string[]) : [];
	const targetRaw = Number(row.target_value ?? 0);
	const target =
		challengeType === 'tasks' && taskIds.length > 0
			? taskIds.length
			: Math.max(1, targetRaw);
	return {
		id: String(row.id ?? ''),
		user_id: String(row.user_id),
		title: String(row.title ?? ''),
		challenge_type: challengeType,
		target_value: target,
		progress_value: Number(row.progress_value ?? 0),
		task_ids: taskIds,
		gift_key: String(row.gift_key ?? ''),
		challenge_date: dateKey,
		status: (row.status as DailyChallenge['status']) ?? 'active',
		completed_at: row.completed_at ? String(row.completed_at) : null,
		repeat_daily: Boolean(row.repeat_daily),
		created_at: String(row.created_at ?? ''),
		updated_at: String(row.updated_at ?? ''),
	};
}

export async function fetchTeamTasks(
	organizationId: string,
	options?: { assigneeUserId?: string | null; assignedOnly?: boolean },
): Promise<TeamTaskRow[]> {
	let q = localData
		.from('team_tasks')
		.select(
			'id, name, status, assignee_user_id, created_by, project_id, deadline, completed_at, created_at, estimated_hours, prioritized',
		)
		.eq('organization_id', organizationId)
		.order('created_at', { ascending: false });

	if (options?.assigneeUserId) {
		q = q.eq('assignee_user_id', options.assigneeUserId);
	} else if (options?.assignedOnly) {
		q = q.not('assignee_user_id', 'is', null);
	}

	const { data } = await q;
	return withTeamTaskWorkedSeconds(((data as TeamTaskRow[]) ?? []).map((row) => ({
		...row,
		worked_seconds: 0,
	})));
}

/** Tasks assigned to the user, plus tasks on projects they belong to. */
export async function fetchMyAssignedTeamTasks(
	organizationId: string,
	userId: string,
	assignedProjects?: TeamProjectRow[],
): Promise<TeamTaskRow[]> {
	const projects =
		assignedProjects ??
		(await fetchTeamProjects(organizationId, { assigneeUserId: userId }));
	const projectIds = projects.map((project) => project.id);
	const orFilter = projectIds.length
		? `assignee_user_id.eq.${userId},created_by.eq.${userId},project_id.in.(${projectIds.join(',')})`
		: `assignee_user_id.eq.${userId},created_by.eq.${userId}`;

	const { data } = await localData
		.from('team_tasks')
		.select(
			'id, name, status, assignee_user_id, created_by, project_id, deadline, completed_at, created_at, estimated_hours, prioritized',
		)
		.eq('organization_id', organizationId)
		.or(orFilter)
		.order('created_at', { ascending: false });

	return withTeamTaskWorkedSeconds(((data as TeamTaskRow[]) ?? []).map((row) => ({
		...row,
		worked_seconds: 0,
	})));
}

async function withTeamTaskWorkedSeconds(
	rows: TeamTaskRow[],
): Promise<TeamTaskRow[]> {
	if (!rows.length) return rows;

	const taskIds = rows.map((row) => row.id);
	const secondsByTask = new Map<string, number>();

	const { data: sessions } = await localData
		.from('sessions')
		.select('team_task_id, duration_seconds')
		.in('team_task_id', taskIds)
		.eq('session_kind', 'work');
	for (const session of sessions ?? []) {
		if (!session.team_task_id) continue;
		const id = String(session.team_task_id);
		secondsByTask.set(
			id,
			(secondsByTask.get(id) ?? 0) + Number(session.duration_seconds ?? 0),
		);
	}

	// Local Pomodoro history stores team task ids on `taskId`. Use it so the
	// assigned-tasks UI updates immediately (and survives a delayed DB write).
	if (typeof window !== 'undefined') {
		try {
			const raw = window.localStorage.getItem('pomodoro_sessions');
			const local = raw
				? (JSON.parse(raw) as Array<{
						taskId?: string | null;
						duration?: number;
				  }>)
				: [];
			const idSet = new Set(taskIds);
			const localByTask = new Map<string, number>();
			for (const entry of local) {
				const tid = entry.taskId?.trim();
				if (!tid || !idSet.has(tid)) continue;
				localByTask.set(
					tid,
					(localByTask.get(tid) ?? 0) + Number(entry.duration ?? 0),
				);
			}
			for (const [tid, localSeconds] of localByTask) {
				const dbSeconds = secondsByTask.get(tid) ?? 0;
				secondsByTask.set(tid, Math.max(dbSeconds, localSeconds));
			}
		} catch {
			/* ignore */
		}
	}

	return rows.map((row) => ({
		...row,
		worked_seconds: secondsByTask.get(row.id) ?? 0,
	}));
}

/** Team projects for list pages and assign pickers. */
export async function fetchTeamProjects(
	organizationId: string,
	options?: { assigneeUserId?: string | null },
): Promise<TeamProjectRow[]> {
	const { data, error } = await localData
		.from('team_projects')
		.select(
			'id, name, status, deadline, is_unassigned_folder, assignee_user_id, created_by, created_at',
		)
		.eq('organization_id', organizationId)
		.neq('status', 'archived')
		.order('created_at', { ascending: false });
	if (error) {
		console.warn('[teams] fetchTeamProjects failed', error.message);
		return [];
	}

	const rows = (data ?? []) as Array<{
		id: string;
		name: string;
		status: string;
		deadline: string | null;
		is_unassigned_folder?: boolean | null;
		assignee_user_id: string | null;
		created_by?: string | null;
		created_at: string;
	}>;
	if (!rows.length) return [];

	const projectIds = rows.map((r) => r.id);
	const { data: memberRows } = await localData
		.from('team_project_members')
		.select('project_id, user_id')
		.in('project_id', projectIds);

	const membersByProject = new Map<string, string[]>();
	for (const row of memberRows ?? []) {
		const pid = String(row.project_id);
		const uid = String(row.user_id);
		const list = membersByProject.get(pid) ?? [];
		list.push(uid);
		membersByProject.set(pid, list);
	}

	let mapped: TeamProjectRow[] = rows.map((row) => {
		const fromJoin = membersByProject.get(String(row.id)) ?? [];
		const memberIds =
			fromJoin.length > 0
				? fromJoin
				: row.assignee_user_id
					? [String(row.assignee_user_id)]
					: [];
		return {
			id: String(row.id),
			name: String(row.name ?? 'Project'),
			status: String(row.status ?? 'active'),
			deadline: row.deadline ? String(row.deadline) : null,
			is_unassigned_folder: Boolean(row.is_unassigned_folder),
			assignee_user_id: row.assignee_user_id
				? String(row.assignee_user_id)
				: null,
			member_user_ids: memberIds,
			created_by: row.created_by ? String(row.created_by) : null,
			created_at: String(row.created_at ?? ''),
		};
	});

	if (options?.assigneeUserId) {
		const uid = options.assigneeUserId;
		mapped = mapped.filter(
			(p) =>
				p.is_unassigned_folder ||
				p.member_user_ids.includes(uid) ||
				p.assignee_user_id === uid ||
				p.created_by === uid,
		);
	}

	return mapped.sort(compareTeamUndefinedProjectLast);
}

/** Project rows by id (names for assigned tasks the member is not on). */
export async function fetchTeamProjectsByIds(
	organizationId: string,
	ids: string[],
): Promise<TeamProjectRow[]> {
	const uniqueIds = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
	if (!uniqueIds.length) return [];

	const { data } = await localData
		.from('team_projects')
		.select(
			'id, name, status, deadline, is_unassigned_folder, assignee_user_id, created_by, created_at',
		)
		.eq('organization_id', organizationId)
		.in('id', uniqueIds)
		.neq('status', 'archived');

	return ((data ?? []) as Array<{
		id: string;
		name: string;
		status: string;
		deadline: string | null;
		is_unassigned_folder?: boolean | null;
		assignee_user_id: string | null;
		created_by?: string | null;
		created_at: string;
	}>).map((row) => ({
		id: String(row.id),
		name: String(row.name ?? 'Project'),
		status: String(row.status ?? 'active'),
		deadline: row.deadline ? String(row.deadline) : null,
		is_unassigned_folder: Boolean(row.is_unassigned_folder),
		assignee_user_id: row.assignee_user_id
			? String(row.assignee_user_id)
			: null,
		member_user_ids: row.assignee_user_id
			? [String(row.assignee_user_id)]
			: [],
		created_by: row.created_by ? String(row.created_by) : null,
		created_at: String(row.created_at ?? ''),
	}));
}

/** Compact project options for assign-task selects. */
export async function fetchTeamProjectOptions(
	organizationId: string,
): Promise<TeamProjectOption[]> {
	const rows = await fetchTeamProjects(organizationId);
	return rows
		.filter((row) => row.status === 'active')
		.map((row) => ({ id: row.id, name: row.name }));
}

/** Per-member daily challenge progress for Team Effort / Challenges. */
export async function fetchMemberChallengeProgress(
	organizationId: string,
): Promise<MemberChallengeProgress[]> {
	const members = await fetchOrgMembers(organizationId);
	if (!members.length) return [];

	const { dateKey, start, end } = localDayBoundsIso();
	const userIds = members.map((m) => m.userId);
	const [{ data }, { data: sessionRows }, presence] = await Promise.all([
		localData
			.from('daily_challenges')
			.select('*')
			.in('user_id', userIds)
			.eq('challenge_date', dateKey)
			.in('status', ['active', 'completed']),
		localData
			.from('sessions')
			.select('user_id, session_kind, duration_seconds')
			.in('user_id', userIds)
			.eq('session_kind', 'work')
			.gte('started_at', start)
			.lte('started_at', end),
		fetchTimerPresenceByUserIds(userIds),
	]);

	const byUser = new Map<string, DailyChallenge[]>();
	for (const row of data ?? []) {
		const challenge = challengeFromRow(row as Record<string, unknown>, dateKey);
		const list = byUser.get(challenge.user_id) ?? [];
		list.push(challenge);
		byUser.set(challenge.user_id, list);
	}

	const workSecByUser = new Map<string, number>();
	for (const row of sessionRows ?? []) {
		const uid = String(row.user_id ?? '');
		if (!uid) continue;
		workSecByUser.set(
			uid,
			(workSecByUser.get(uid) ?? 0) + Number(row.duration_seconds ?? 0),
		);
	}

	return members.map((member) => {
		const timerStatus = presence.get(member.userId) ?? null;
		const challenges = (byUser.get(member.userId) ?? []).filter(
			(challenge) => challenge.challenge_type === 'focus_minutes',
		);
		const focusChallenge = challenges[0] ?? null;
		const fallbackHours = Number(member.dailyChallengeHours ?? 0);
		const targetHours = focusChallenge
			? focusChallenge.target_value / 60
			: Number.isFinite(fallbackHours) && fallbackHours > 0
				? fallbackHours
				: 0;
		if (targetHours <= 0) {
			return {
				member,
				percent: 0,
				label: 'No challenge today',
				challengeCount: 0,
				challenges: [],
				timerStatus,
			};
		}
		const view = applyWorkHoursChallengeView(
			targetHours,
			workSecByUser.get(member.userId) ?? 0,
		);
		return {
			member,
			percent: view.challengePercent,
			label: view.challengeLabel,
			challengeCount: 1,
			challenges: focusChallenge ? [focusChallenge] : [],
			timerStatus,
		};
	});
}

export type TeamReminderRow = {
	id: string;
	name: string;
	status: string;
	due_at: string | null;
	assignee_user_id: string | null;
	created_by?: string | null;
	created_at?: string;
	email_notify?: boolean;
};

export async function fetchTeamReminders(
	organizationId: string,
	options?: {
		/** Restrict to reminders assigned to this user. */
		assigneeUserId?: string | null;
		/**
		 * Restrict to reminders assigned to or created by this user.
		 * Used for members without full reminder access.
		 */
		visibleToUserId?: string | null;
		includeDone?: boolean;
		limit?: number;
	},
): Promise<TeamReminderRow[]> {
	const limit = Math.max(1, Math.min(options?.limit ?? 100, 500));
	const scopeFilter = options?.assigneeUserId
		? ({ kind: 'assignee' as const, userId: options.assigneeUserId })
		: options?.visibleToUserId
			? ({ kind: 'visible' as const, userId: options.visibleToUserId })
			: null;

	let q = localData
		.from('team_reminders')
		.select(
			'id, name, status, due_at, assignee_user_id, created_by, created_at, email_notify',
		)
		.eq('organization_id', organizationId)
		.order('due_at', { ascending: true, nullsFirst: false });
	if (!options?.includeDone) {
		q = q.neq('status', 'done');
	}
	if (scopeFilter?.kind === 'assignee') {
		q = q.eq('assignee_user_id', scopeFilter.userId);
	} else if (scopeFilter?.kind === 'visible') {
		q = q.or(
			`assignee_user_id.eq.${scopeFilter.userId},created_by.eq.${scopeFilter.userId}`,
		);
	}

	const { data, error } = await q.limit(limit);
	if (
		error &&
		/email_notify|schema cache|does not exist|created_by/i.test(error.message)
	) {
		let fallback = localData
			.from('team_reminders')
			.select('id, name, status, due_at, assignee_user_id, created_at')
			.eq('organization_id', organizationId)
			.order('due_at', { ascending: true, nullsFirst: false });
		if (!options?.includeDone) {
			fallback = fallback.neq('status', 'done');
		}
		if (scopeFilter?.kind === 'assignee') {
			fallback = fallback.eq('assignee_user_id', scopeFilter.userId);
		} else if (scopeFilter?.kind === 'visible') {
			fallback = fallback.or(
				`assignee_user_id.eq.${scopeFilter.userId},created_by.eq.${scopeFilter.userId}`,
			);
		}
		const retry = await fallback.limit(limit);
		return (retry.data as unknown as TeamReminderRow[] | null) ?? [];
	}
	return (data as unknown as TeamReminderRow[] | null) ?? [];
}

export type TeamPerformanceSummary = {
	completionRate: number;
	tasksDone: number;
	tasksPending: number;
};

export async function fetchTeamPerformanceSummary(
	organizationId: string,
): Promise<TeamPerformanceSummary> {
	const { data: tasks } = await localData
		.from('team_tasks')
		.select('status')
		.eq('organization_id', organizationId);
	const done = (tasks ?? []).filter((t) => t.status === 'done').length;
	const pending = (tasks ?? []).filter((t) => t.status === 'pending').length;
	const total = done + pending;
	return {
		completionRate: total ? Math.round((done / total) * 100) : 0,
		tasksDone: done,
		tasksPending: pending,
	};
}

/** Aggregate today work/rest + team tasks finished (manager Team Progress). */
export async function fetchTeamTodayProgress(
	organizationId: string,
): Promise<TeamTodayProgress> {
	const members = await fetchOrgMembers(organizationId);
	const { start, end } = localDayBoundsIso();
	const userIds = members.map((m) => m.userId);

	let workSec = 0;
	let restSec = 0;
	if (userIds.length) {
		const { data: sessions } = await localData
			.from('sessions')
			.select('session_kind, duration_seconds')
			.in('user_id', userIds)
			.gte('started_at', start)
			.lte('started_at', end);
		for (const s of sessions ?? []) {
			const dur = Number(s.duration_seconds ?? 0);
			if (s.session_kind === 'work') workSec += dur;
			else if (s.session_kind === 'rest') restSec += dur;
		}
	}

	const { data: tasks } = await localData
		.from('team_tasks')
		.select('id, status, completed_at')
		.eq('organization_id', organizationId)
		.eq('status', 'done')
		.gte('completed_at', start)
		.lte('completed_at', end);

	return {
		workHoursLabel: secondsToDisplayHours(workSec),
		restHoursLabel: secondsToDisplayHours(restSec),
		tasksFinished: tasks?.length ?? 0,
	};
}

export type MemberInsights = {
	challengePercent: number;
	challengeLabel: string;
	challengeCount: number;
	challengeTargetLabel: string;
	challengeRemainingLabel: string;
	tasks: TeamTaskRow[];
	tasksPending: number;
	tasksDone: number;
	workHoursLabel: string;
	restHoursLabel: string;
	tasksFinishedToday: number;
	avgWorkHoursLabel: string;
	workTrend: WorkTrendDirection | null;
	timerStatus: TeamTimerPresenceMode | null;
};

function applyWorkHoursChallengeView(
	targetHours: number,
	workSec: number,
): Pick<
	MemberInsights,
	| 'challengePercent'
	| 'challengeLabel'
	| 'challengeCount'
	| 'challengeTargetLabel'
	| 'challengeRemainingLabel'
> {
	const targetMinutes = Math.max(1, Math.round(targetHours * 60));
	const workMinutes = Math.max(0, workSec / 60);
	const remainingHours = Math.max(0, (targetMinutes - workMinutes) / 60);
	const remainingDisplay = Number(remainingHours.toFixed(1));
	const finished = workMinutes >= targetMinutes;
	return {
		challengePercent: Math.min(
			100,
			Math.round((workMinutes / targetMinutes) * 100),
		),
		challengeLabel: finished
			? 'Day complete'
			: `${Number((workMinutes / 60).toFixed(1))} / ${Number(targetHours.toFixed(1))} hrs`,
		challengeCount: 1,
		challengeTargetLabel: `${Number(targetHours.toFixed(1))} work hours daily`,
		challengeRemainingLabel: finished
			? 'Day complete'
			: `${remainingDisplay === 0 && remainingHours > 0 ? 0.1 : remainingDisplay} hours left`,
	};
}

/** Stats + performance for one teammate (Team Members detail pane). */
export async function fetchMemberInsights(
	organizationId: string,
	userId: string,
	options?: { dailyChallengeHours?: number | null },
): Promise<MemberInsights> {
	const { dateKey, start, end } = localDayBoundsIso();
	const weekStart = localDayBoundsIso(dayjs().subtract(6, 'day')).start;

	const [
		{ data: challenges },
		{ data: taskRows },
		{ data: sessions },
		{ data: finishedToday },
		presence,
	] = await Promise.all([
		localData
			.from('daily_challenges')
			.select('*')
			.eq('user_id', userId)
			.eq('challenge_date', dateKey)
			.in('status', ['active', 'completed']),
		localData
			.from('team_tasks')
			.select(
				'id, name, status, assignee_user_id, created_by, project_id, deadline, completed_at, created_at, estimated_hours, prioritized',
			)
			.eq('organization_id', organizationId)
			.or(`assignee_user_id.eq.${userId},created_by.eq.${userId}`),
		localData
			.from('sessions')
			.select('session_kind, duration_seconds, started_at')
			.eq('user_id', userId)
			.gte('started_at', weekStart)
			.lte('started_at', end),
		localData
			.from('team_tasks')
			.select('id')
			.eq('organization_id', organizationId)
			.eq('assignee_user_id', userId)
			.eq('status', 'done')
			.gte('completed_at', start)
			.lte('completed_at', end),
		fetchTimerPresenceByUserIds([userId]),
	]);

	const mapped = (challenges ?? []).map((row) =>
		challengeFromRow(row as Record<string, unknown>, dateKey),
	);
	const focus = mapped.find(
		(challenge) => challenge.challenge_type === 'focus_minutes',
	);

	const last7Days = Array.from({ length: 7 }, (_, offset) => ({
		work: 0,
		rest: 0,
		dateKey: dayjs().startOf('day').subtract(offset, 'day').format('YYYY-MM-DD'),
	}));
	const workByDate = new Map(last7Days.map((day) => [day.dateKey, day]));
	for (const s of sessions ?? []) {
		const bucket = workByDate.get(dayjs(s.started_at).format('YYYY-MM-DD'));
		if (!bucket) continue;
		const dur = Number(s.duration_seconds ?? 0);
		if (s.session_kind === 'work') bucket.work += dur;
		else if (s.session_kind === 'rest') bucket.rest += dur;
	}
	const workSec = last7Days[0]?.work ?? 0;
	const restSec = last7Days[0]?.rest ?? 0;

	const fallbackHours = Number(options?.dailyChallengeHours ?? 0);
	const targetHours = focus
		? focus.target_value / 60
		: Number.isFinite(fallbackHours) && fallbackHours > 0
			? fallbackHours
			: 0;
	const challengeView =
		targetHours > 0
			? applyWorkHoursChallengeView(targetHours, workSec)
			: {
					challengePercent: 0,
					challengeLabel: 'No challenge today',
					challengeCount: 0,
					challengeTargetLabel: 'No daily target',
					challengeRemainingLabel: '',
				};
	const {
		challengePercent,
		challengeLabel,
		challengeCount,
		challengeTargetLabel,
		challengeRemainingLabel,
	} = challengeView;

	const tasksPending = (taskRows ?? []).filter((t) => t.status === 'pending')
		.length;
	const tasksDone = (taskRows ?? []).filter((t) => t.status === 'done').length;

	return {
		challengePercent,
		challengeLabel,
		challengeCount,
		challengeTargetLabel,
		challengeRemainingLabel,
		tasks: await withTeamTaskWorkedSeconds(
			((taskRows as TeamTaskRow[]) ?? []).map((row) => ({
				...row,
				worked_seconds: 0,
			})),
		),
		tasksPending,
		tasksDone,
		workHoursLabel: secondsToDisplayHours(workSec),
		restHoursLabel: secondsToDisplayHours(restSec),
		tasksFinishedToday: finishedToday?.length ?? 0,
		avgWorkHoursLabel: formatDecimalHours(computeAvgDailyWorkHours(last7Days)),
		workTrend: computeWorkTrendVsPreviousDay(last7Days),
		timerStatus: presence.get(userId) ?? null,
	};
}
