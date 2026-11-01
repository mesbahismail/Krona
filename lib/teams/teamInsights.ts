'use client';

import dayjs from 'dayjs';
import { periodStart, type PerformancePeriodKey } from '@/lib/performanceData';
import { formatDecimalHours } from '@/lib/taskTime';
import { isDeadlineInPast } from '@/lib/localDate';
import {
	fetchMemberChallengeProgress,
	fetchTeamProjects,
	fetchTeamTasks,
} from '@/lib/teams/dashboard';
import { organizationMemberLabel } from '@/lib/teams/org';
import type { OrganizationMember } from '@/lib/teams/types';
import { localData } from '@/lib/localData';

function hoursLabel(hours: number): string {
	return formatDecimalHours(hours);
}

function nameList(names: string[]): string {
	if (names.length === 0) return 'teammates';
	if (names.length === 1) return names[0];
	if (names.length === 2) return `${names[0]} and ${names[1]}`;
	return `${names[0]}, ${names[1]}, and ${names.length - 2} other${
		names.length - 2 === 1 ? '' : 's'
	}`;
}

type MemberLoad = {
	userId: string;
	name: string;
	pendingTasks: number;
	assignedHours: number;
	workHours: number;
	trackedTaskHours: number;
	challengePercent: number | null;
};

function assignedHoursForTask(hours: number | null | undefined): number {
	const n = Number(hours);
	return Number.isFinite(n) && n > 0 ? n : 0;
}

export async function fetchTeamInsightTips(input: {
	organizationId: string;
	period: PerformancePeriodKey;
	memberIds: string[];
	members: OrganizationMember[];
}): Promise<string[]> {
	const { organizationId, period, memberIds, members } = input;
	const ids = [...new Set(memberIds.filter(Boolean))];
	if (!ids.length) {
		return [
			'No teammates are in this view yet. Insights appear once people have assigned work and tracked time.',
		];
	}

	const now = dayjs();
	const start = periodStart(now, period);
	const membersById = new Map(members.map((m) => [m.userId, m] as const));
	const scoped = new Set(ids);

	const [tasks, projects, challenges, sessionsRes] = await Promise.all([
		fetchTeamTasks(organizationId),
		fetchTeamProjects(organizationId),
		fetchMemberChallengeProgress(organizationId),
		localData
			.from('sessions')
			.select('user_id, duration_seconds, team_task_id')
			.in('user_id', ids)
			.eq('session_kind', 'work')
			.gte('started_at', start.toISOString())
			.lte('started_at', now.toISOString()),
	]);

	const workSec = new Map<string, number>();
	const trackedSec = new Map<string, number>();
	for (const row of sessionsRes.data ?? []) {
		const uid = String(row.user_id ?? '');
		if (!uid) continue;
		const dur = Number(row.duration_seconds ?? 0);
		workSec.set(uid, (workSec.get(uid) ?? 0) + dur);
		if (row.team_task_id) {
			trackedSec.set(uid, (trackedSec.get(uid) ?? 0) + dur);
		}
	}

	const challengeByUser = new Map(
		challenges.map((row) => [row.member.userId, row] as const),
	);

	const loads: MemberLoad[] = members
		.filter((m) => scoped.has(m.userId))
		.map((member) => {
			const pending = tasks.filter(
				(task) =>
					task.assignee_user_id === member.userId &&
					task.status !== 'done',
			);
			const assignedHours = pending.reduce(
				(sum, task) => sum + assignedHoursForTask(task.estimated_hours),
				0,
			);
			const challenge = challengeByUser.get(member.userId);
			return {
				userId: member.userId,
				name: organizationMemberLabel(member),
				pendingTasks: pending.length,
				assignedHours,
				workHours: (workSec.get(member.userId) ?? 0) / 3600,
				trackedTaskHours: (trackedSec.get(member.userId) ?? 0) / 3600,
				challengePercent:
					challenge && challenge.challengeCount > 0
						? challenge.percent
						: null,
			};
		});

	const teamLoads: MemberLoad[] = members.map((member) => {
		const pending = tasks.filter(
			(task) =>
				task.assignee_user_id === member.userId && task.status !== 'done',
		);
		return {
			userId: member.userId,
			name: organizationMemberLabel(member),
			pendingTasks: pending.length,
			assignedHours: pending.reduce(
				(sum, task) => sum + assignedHoursForTask(task.estimated_hours),
				0,
			),
			workHours: 0,
			trackedTaskHours: 0,
			challengePercent: null,
		};
	});

	const missedTasks = tasks.filter(
		(task) =>
			task.status !== 'done' &&
			isDeadlineInPast(task.deadline) &&
			(!task.assignee_user_id || scoped.has(task.assignee_user_id)),
	);
	const missedProjects = projects.filter(
		(project) =>
			project.status !== 'archived' && isDeadlineInPast(project.deadline),
	);

	const tips: string[] = [];

	const notTracking = loads.filter((row) => {
		if (row.pendingTasks === 0) return false;
		if (row.workHours < 0.15) return false;
		return row.trackedTaskHours < Math.max(0.15, row.workHours * 0.4);
	});
	if (notTracking.length) {
		const names = nameList(notTracking.map((row) => row.name));
		const worked = notTracking.reduce((sum, row) => sum + row.workHours, 0);
		const tracked = notTracking.reduce(
			(sum, row) => sum + row.trackedTaskHours,
			0,
		);
		const assigned = notTracking.reduce((sum, row) => sum + row.assignedHours, 0);
		const assignedLabel =
			assigned > 0
				? `${hoursLabel(assigned)}h assigned`
				: `${notTracking.reduce((sum, row) => sum + row.pendingTasks, 0)} assigned task${
						notTracking.reduce((sum, row) => sum + row.pendingTasks, 0) === 1
							? ''
							: 's'
					}`;
		tips.push(
			`${names} ${notTracking.length === 1 ? 'has' : 'have'} ${assignedLabel} but tracked ${hoursLabel(tracked)}h of ${hoursLabel(worked)}h worked on those tasks. They are not tracking assigned tasks — ask them to select the team task on the timer so hours match the work they were given.`,
		);
	}

	const missedChallenge = loads.filter(
		(row) => row.challengePercent != null && row.challengePercent < 100,
	);
	if (missedChallenge.length) {
		const names = nameList(missedChallenge.map((row) => row.name));
		if (loads.length === 1 && missedChallenge[0]) {
			const row = missedChallenge[0];
			const remaining = Math.max(0, 100 - (row.challengePercent ?? 0));
			tips.push(
				`${row.name} is at ${row.challengePercent}% of today’s daily challenge (${remaining}% still open). Protect a work block before the day ends so the target is met.`,
			);
		} else {
			tips.push(
				`${missedChallenge.length} of ${loads.length} teammate${loads.length === 1 ? '' : 's'} ${missedChallenge.length === 1 ? 'has' : 'have'} not met today’s daily challenge, including ${names}. Check Team Effort and unblock people still below their work-hours target.`,
			);
		}
	}

	const pendingCounts = teamLoads.map((row) => row.pendingTasks);
	const avgPending =
		pendingCounts.reduce((sum, n) => sum + n, 0) /
		Math.max(1, pendingCounts.length);
	const maxLoad = teamLoads.reduce(
		(best, row) => (row.pendingTasks > best.pendingTasks ? row : best),
		teamLoads[0],
	);
	const idle = teamLoads.filter((row) => row.pendingTasks === 0);
	const busy = teamLoads.filter(
		(row) => row.pendingTasks >= Math.max(3, avgPending * 2),
	);
	const scopedMax = loads.reduce(
		(best, row) => (row.pendingTasks > best.pendingTasks ? row : best),
		loads[0],
	);

	if (maxLoad && busy.length && idle.length && avgPending >= 1) {
		if (ids.length === 1 && scopedMax) {
			if (scopedMax.pendingTasks >= Math.max(3, avgPending * 2)) {
				tips.push(
					`${scopedMax.name} is overloaded with ${scopedMax.pendingTasks} open task${scopedMax.pendingTasks === 1 ? '' : 's'} (${hoursLabel(scopedMax.assignedHours || scopedMax.pendingTasks)}h) while ${idle.length} teammate${idle.length === 1 ? '' : 's'} have none. Move one or two items off them so load matches the rest of the team.`,
				);
			} else if (scopedMax.pendingTasks === 0 && avgPending >= 2) {
				tips.push(
					`${scopedMax.name} has no open tasks while the team averages ${hoursLabel(avgPending)} each. Assign upcoming work so they are not underloaded.`,
				);
			}
		} else {
			tips.push(
				`${nameList(busy.map((row) => row.name))} ${busy.length === 1 ? 'is' : 'are'} overloaded (${maxLoad.pendingTasks} open tasks) while ${nameList(idle.map((row) => row.name))} ${idle.length === 1 ? 'has' : 'have'} none. Rebalance assignments so managers are not overloading some people and underloading others.`,
			);
		}
	} else if (maxLoad && maxLoad.pendingTasks >= 6 && ids.length > 1) {
		tips.push(
			`${maxLoad.name} has ${maxLoad.pendingTasks} open tasks. Spread new work to lighter teammates so one person is not carrying the queue.`,
		);
	}

	const missedCount = missedTasks.length + missedProjects.length;
	if (missedCount > 0) {
		const sample = missedTasks[0]?.name ?? missedProjects[0]?.name ?? 'work';
		const overdueByAssignee = new Map<string, number>();
		for (const task of missedTasks) {
			const uid = task.assignee_user_id;
			if (!uid) continue;
			overdueByAssignee.set(uid, (overdueByAssignee.get(uid) ?? 0) + 1);
		}
		const busiestOverdueId = [...overdueByAssignee.entries()].sort(
			(a, b) => b[1] - a[1],
		)[0]?.[0];
		const busiestOverdue = busiestOverdueId
			? organizationMemberLabel(membersById.get(busiestOverdueId))
			: null;
		const who = busiestOverdue ? ` Start with ${busiestOverdue}.` : '';
		tips.push(
			`${missedCount} deadline${missedCount === 1 ? '' : 's'} ${missedCount === 1 ? 'was' : 'were'} missed (including “${sample}”). Split the largest overdue item, move one task off the busiest assignee, and extend only dates that are no longer realistic.${who}`,
		);
	}

	if (!tips.length) {
		tips.push(
			'Assigned hours, daily challenges, and deadlines look balanced in this view. Keep people tracking time on the task they were given so the next period stays this clean.',
		);
	}

	return tips.slice(0, 4);
}
