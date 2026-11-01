'use client';

import dayjs from 'dayjs';
import { todayDateKey } from '@/lib/challenges';
import { formatDecimalHours, secondsToDisplayHours } from '@/lib/taskTime';
import {
	hasTeamNotificationToday,
	notifyAssignment,
	notifyOrgManagers,
	organizationMemberLabel,
} from '@/lib/teams/org';
import { localData } from '@/lib/localData';
import { fetchTimerPresenceDetails } from '@/lib/teams/timerPresence';
import type { OrganizationMember } from '@/lib/teams/types';

/** Continuous work without rest — remind them to pause or take a break. */
export const REST_NEEDED_SECONDS = 2 * 60 * 60;
/** Daily work while the timer is still running — inflates reports. */
export const RUNAWAY_WORK_SECONDS = 8 * 60 * 60;

type OvertimeTask = {
	id: string;
	name: string;
	workedSeconds: number;
	assignedHours: number;
};

export type TimerRunawayFinding = {
	userId: string;
	needsRest: boolean;
	exceedsEightHours: boolean;
	continuousWorkSeconds: number;
	todayWorkSeconds: number;
	overtimeTasks: OvertimeTask[];
};

function hoursLabel(seconds: number): string {
	return `${secondsToDisplayHours(seconds)}h`;
}

export async function evaluateMemberTimerRunaway(
	userId: string,
): Promise<TimerRunawayFinding> {
	const now = Date.now();
	const start = dayjs().startOf('day').toISOString();
	const end = dayjs().endOf('day').toISOString();

	const [presenceMap, { data: sessions }] = await Promise.all([
		fetchTimerPresenceDetails([userId]),
		localData
			.from('sessions')
			.select('session_kind, duration_seconds, started_at, team_task_id')
			.eq('user_id', userId)
			.gte('started_at', start)
			.lte('started_at', end),
	]);

	const presence = presenceMap.get(userId);
	const timerRunningWork = presence?.mode === 'work';
	const liveElapsed =
		timerRunningWork && presence
			? Math.max(
					0,
					Math.round((now - new Date(presence.startedAt).getTime()) / 1000),
				)
			: 0;

	let workSec = 0;
	let lastRestEnd = 0;
	for (const session of sessions ?? []) {
		const dur = Number(session.duration_seconds ?? 0);
		if (!Number.isFinite(dur) || dur <= 0) continue;
		const started = new Date(String(session.started_at)).getTime();
		if (session.session_kind === 'work') {
			workSec += dur;
		} else if (session.session_kind === 'rest') {
			lastRestEnd = Math.max(
				lastRestEnd,
				Number.isFinite(started) ? started + dur * 1000 : 0,
			);
		}
	}

	let workSinceRest = liveElapsed;
	for (const session of sessions ?? []) {
		if (session.session_kind !== 'work') continue;
		const dur = Number(session.duration_seconds ?? 0);
		if (!Number.isFinite(dur) || dur <= 0) continue;
		const started = new Date(String(session.started_at)).getTime();
		if (!Number.isFinite(started)) continue;
		if (lastRestEnd > 0 && started < lastRestEnd) continue;
		workSinceRest += dur;
	}

	const todayWorkSeconds = workSec + liveElapsed;
	const needsRest =
		Boolean(timerRunningWork) && workSinceRest >= REST_NEEDED_SECONDS;
	const exceedsEightHours =
		Boolean(timerRunningWork) && todayWorkSeconds >= RUNAWAY_WORK_SECONDS;

	return {
		userId,
		needsRest,
		exceedsEightHours,
		continuousWorkSeconds: workSinceRest,
		todayWorkSeconds,
		overtimeTasks: [],
	};
}

async function fetchAssignedTaskOvertime(
	organizationId: string,
	userId: string,
): Promise<OvertimeTask[]> {
	const { data: timedTasks } = await localData
		.from('team_tasks')
		.select('id, name, estimated_hours')
		.eq('organization_id', organizationId)
		.eq('assignee_user_id', userId)
		.eq('status', 'pending')
		.not('estimated_hours', 'is', null);
	const rows = (timedTasks ?? []).filter((task) => {
		const hours = Number(task.estimated_hours);
		return Number.isFinite(hours) && hours > 0;
	});
	if (!rows.length) return [];

	const ids = rows.map((task) => String(task.id));
	const { data: sessions } = await localData
		.from('sessions')
		.select('team_task_id, duration_seconds')
		.in('team_task_id', ids)
		.eq('user_id', userId)
		.eq('session_kind', 'work');

	const secondsByTask = new Map<string, number>();
	for (const session of sessions ?? []) {
		if (!session.team_task_id) continue;
		const id = String(session.team_task_id);
		secondsByTask.set(
			id,
			(secondsByTask.get(id) ?? 0) + Number(session.duration_seconds ?? 0),
		);
	}

	const overtime: OvertimeTask[] = [];
	for (const task of rows) {
		const assignedHours = Number(task.estimated_hours);
		const workedSeconds = secondsByTask.get(String(task.id)) ?? 0;
		if (workedSeconds / 3600 <= assignedHours) continue;
		overtime.push({
			id: String(task.id),
			name: String(task.name ?? 'Task'),
			workedSeconds,
			assignedHours,
		});
	}
	return overtime;
}

/**
 * Remind the employee (and managers, for employees) when a work timer was
 * left running, or assigned task time is already past the estimate.
 */
export async function notifyTimerRunawayForMember(input: {
	organizationId: string;
	member: OrganizationMember;
	notifyManagers: boolean;
}): Promise<number> {
	const { organizationId, member, notifyManagers } = input;
	const userId = member.userId;
	const label = organizationMemberLabel(member);
	const dateKey = todayDateKey();
	let created = 0;

	const finding = await evaluateMemberTimerRunaway(userId);
	finding.overtimeTasks = await fetchAssignedTaskOvertime(
		organizationId,
		userId,
	);

	const alertEmployeeAndManagers = async (opts: {
		kind: 'performance_alert' | 'task_overtime';
		titleEmployee: string;
		bodyEmployee: string;
		titleManager: string;
		bodyManager: string;
		entityType: string;
		entityId: string;
	}) => {
		const already = await hasTeamNotificationToday({
			userId,
			kind: opts.kind,
			entityId: opts.entityId,
		});
		if (!already) {
			await notifyAssignment({
				organizationId,
				userId,
				kind: opts.kind,
				title: opts.titleEmployee,
				body: opts.bodyEmployee,
				entityType: opts.entityType,
				entityId: opts.entityId,
			});
		}
		const managerCount = notifyManagers
			? await notifyOrgManagers({
					organizationId,
					actorUserId: userId,
					kind: opts.kind,
					title: opts.titleManager,
					body: opts.bodyManager,
					entityType: opts.entityType,
					entityId: opts.entityId,
					includeActor: false,
				})
			: 0;
		return (already ? 0 : 1) + managerCount;
	};

	if (finding.exceedsEightHours) {
		const hours = hoursLabel(finding.todayWorkSeconds);
		created += await alertEmployeeAndManagers({
			kind: 'performance_alert',
			titleEmployee: "Don't leave the timer running",
			bodyEmployee: `You've tracked over 8h today (${hours}). Leaving Krona running indefinitely inflates performance, task assignment, and time assignment. Pause the timer.`,
			titleManager: 'Timer running too long',
			bodyManager: `${label} has over 8h on the work timer (${hours}). Leaving it running inflates performance, assigned task time, and time reports. Ask them to pause.`,
			entityType: 'timer_runaway',
			entityId: `timer-8h-${userId}-${dateKey}`,
		});
	} else if (finding.needsRest) {
		const hours = hoursLabel(finding.continuousWorkSeconds);
		created += await alertEmployeeAndManagers({
			kind: 'performance_alert',
			titleEmployee: 'You need a rest',
			bodyEmployee: `Your work timer has been running for ${hours} without a break. Pause or start rest so time stays accurate.`,
			titleManager: 'Needs a rest',
			bodyManager: `${label}'s work timer has been running for ${hours} without a break. Remind them to pause or rest.`,
			entityType: 'timer_rest',
			entityId: `timer-rest-${userId}-${dateKey}`,
		});
	}

	for (const task of finding.overtimeTasks) {
		const tracked = hoursLabel(task.workedSeconds);
		const assigned = `${formatDecimalHours(task.assignedHours)}h`;
		created += await alertEmployeeAndManagers({
			kind: 'task_overtime',
			titleEmployee: 'Task over assigned time',
			bodyEmployee: `${task.name} · ${tracked} tracked / ${assigned} assigned. Pause if the timer was left running — it changes assignment and time reports.`,
			titleManager: 'Task over assigned time',
			bodyManager: `${label} · ${task.name} · ${tracked} tracked / ${assigned} assigned. A timer left running inflates assigned time.`,
			entityType: 'team_task',
			entityId: `task-tracked-${task.id}`,
		});
	}

	return created;
}
