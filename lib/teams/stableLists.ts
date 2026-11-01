import type {
	MemberChallengeProgress,
	MemberInsights,
	TeamPerformanceSummary,
	TeamProjectOption,
	TeamProjectRow,
	TeamReminderRow,
	TeamTaskRow,
	TeamTodayProgress,
} from '@/lib/teams/dashboard';
import type { TeamEmployeePermissions } from '@/lib/teams/employeePermissions';
import type { PendingOrgInvite } from '@/lib/teams/org';
import type { OrganizationMember } from '@/lib/teams/types';
import type { TeamTimerPresenceMode } from '@/lib/teams/timerPresence';

function mergeByKey<T>(
	prev: T[],
	next: T[],
	keyOf: (row: T) => string,
	equal: (a: T, b: T) => boolean,
): T[] {
	if (prev === next) return prev;
	if (
		prev.length === next.length &&
		prev.every((row, index) => {
			const other = next[index];
			return other != null && keyOf(row) === keyOf(other) && equal(row, other);
		})
	) {
		return prev;
	}
	const prevByKey = new Map(prev.map((row) => [keyOf(row), row] as const));
	let reused = 0;
	const merged = next.map((row) => {
		const old = prevByKey.get(keyOf(row));
		if (old && equal(old, row)) {
			reused += 1;
			return old;
		}
		return row;
	});
	if (reused === prev.length && reused === next.length) return prev;
	return merged;
}

export function sameEmployeePermissions(
	a: TeamEmployeePermissions,
	b: TeamEmployeePermissions,
): boolean {
	return (
		a.canCreateEditProjects === b.canCreateEditProjects &&
		a.canCreateEditTasks === b.canCreateEditTasks &&
		a.canCreateEditReminders === b.canCreateEditReminders &&
		a.canUseAi === b.canUseAi
	);
}

export function sameMember(
	a: OrganizationMember,
	b: OrganizationMember,
): boolean {
	return (
		a.id === b.id &&
		a.userId === b.userId &&
		a.role === b.role &&
		a.status === b.status &&
		a.displayName === b.displayName &&
		a.email === b.email &&
		a.avatarUrl === b.avatarUrl &&
		a.jobTitle === b.jobTitle &&
		a.onboardingCompleted === b.onboardingCompleted &&
		a.hourlyRate === b.hourlyRate &&
		a.birthday === b.birthday &&
		a.dailyChallengeHours === b.dailyChallengeHours &&
		sameEmployeePermissions(a.accessPermissions, b.accessPermissions)
	);
}

function memberHasIdentity(member: OrganizationMember): boolean {
	return Boolean(member.displayName || member.email || member.avatarUrl);
}

export function mergeMembers(
	prev: OrganizationMember[],
	next: OrganizationMember[],
): OrganizationMember[] {
	const nextHasIdentity = next.some(memberHasIdentity);
	const prevHasIdentity = prev.some(memberHasIdentity);
	const rows =
		nextHasIdentity || !prevHasIdentity
			? next
			: next.map((member) => {
					const old = prev.find((row) => row.userId === member.userId);
					if (!old) return member;
					return {
						...member,
						displayName: member.displayName || old.displayName,
						email: member.email || old.email,
						avatarUrl: member.avatarUrl || old.avatarUrl,
						birthday: member.birthday ?? old.birthday,
						dailyChallengeHours:
							member.dailyChallengeHours ?? old.dailyChallengeHours,
					};
				});
	return mergeByKey(prev, rows, (row) => row.userId, sameMember);
}

export function sameTeamTask(a: TeamTaskRow, b: TeamTaskRow): boolean {
	return (
		a.id === b.id &&
		a.name === b.name &&
		a.status === b.status &&
		a.prioritized === b.prioritized &&
		a.deadline === b.deadline &&
		a.project_id === b.project_id &&
		a.assignee_user_id === b.assignee_user_id &&
		a.worked_seconds === b.worked_seconds &&
		a.estimated_hours === b.estimated_hours &&
		a.completed_at === b.completed_at
	);
}

export function mergeTeamTasks(
	prev: TeamTaskRow[],
	next: TeamTaskRow[],
): TeamTaskRow[] {
	return mergeByKey(prev, next, (row) => row.id, sameTeamTask);
}

export function sameReminder(a: TeamReminderRow, b: TeamReminderRow): boolean {
	return (
		a.id === b.id &&
		a.name === b.name &&
		a.status === b.status &&
		a.due_at === b.due_at &&
		a.assignee_user_id === b.assignee_user_id &&
		a.email_notify === b.email_notify
	);
}

export function mergeReminders(
	prev: TeamReminderRow[],
	next: TeamReminderRow[],
): TeamReminderRow[] {
	return mergeByKey(prev, next, (row) => row.id, sameReminder);
}

export function mergeProjectOptions(
	prev: TeamProjectOption[],
	next: TeamProjectOption[],
): TeamProjectOption[] {
	return mergeByKey(
		prev,
		next,
		(row) => row.id,
		(a, b) => a.id === b.id && a.name === b.name,
	);
}

export function mergeTeamProjects(
	prev: TeamProjectRow[],
	next: TeamProjectRow[],
): TeamProjectRow[] {
	return mergeByKey(
		prev,
		next,
		(row) => row.id,
		(a, b) =>
			a.id === b.id &&
			a.name === b.name &&
			a.status === b.status &&
			a.deadline === b.deadline &&
			a.is_unassigned_folder === b.is_unassigned_folder &&
			a.assignee_user_id === b.assignee_user_id &&
			a.created_by === b.created_by &&
			a.member_user_ids.length === b.member_user_ids.length &&
			a.member_user_ids.every((id, index) => id === b.member_user_ids[index]),
	);
}

export function mergeInvites(
	prev: PendingOrgInvite[],
	next: PendingOrgInvite[],
): PendingOrgInvite[] {
	return mergeByKey(
		prev,
		next,
		(row) => row.id,
		(a, b) =>
			a.id === b.id &&
			a.email === b.email &&
			a.role === b.role &&
			a.deliveryStatus === b.deliveryStatus &&
			a.token === b.token,
	);
}

export function mergeChallengeRows(
	prev: MemberChallengeProgress[],
	next: MemberChallengeProgress[],
): MemberChallengeProgress[] {
	return mergeByKey(
		prev,
		next,
		(row) => row.member.userId,
		(a, b) =>
			a.percent === b.percent &&
			a.label === b.label &&
			a.challengeCount === b.challengeCount &&
			a.timerStatus === b.timerStatus &&
			sameMember(a.member, b.member),
	);
}

export function samePresence(
	a: Map<string, TeamTimerPresenceMode>,
	b: Map<string, TeamTimerPresenceMode>,
): boolean {
	if (a === b) return true;
	if (a.size !== b.size) return false;
	for (const [userId, mode] of a) {
		if (b.get(userId) !== mode) return false;
	}
	return true;
}

export function sameTodayProgress(
	a: TeamTodayProgress | null,
	b: TeamTodayProgress | null,
): boolean {
	if (a === b) return true;
	if (!a || !b) return false;
	return (
		a.workHoursLabel === b.workHoursLabel &&
		a.restHoursLabel === b.restHoursLabel &&
		a.tasksFinished === b.tasksFinished
	);
}

export function sameMetrics(
	a: TeamPerformanceSummary | null,
	b: TeamPerformanceSummary | null,
): boolean {
	if (a === b) return true;
	if (!a || !b) return false;
	return (
		a.completionRate === b.completionRate &&
		a.tasksDone === b.tasksDone &&
		a.tasksPending === b.tasksPending
	);
}

export function sameMemberInsights(
	a: MemberInsights | null,
	b: MemberInsights | null,
): boolean {
	if (a === b) return true;
	if (!a || !b) return false;
	return (
		a.challengePercent === b.challengePercent &&
		a.challengeLabel === b.challengeLabel &&
		a.challengeCount === b.challengeCount &&
		a.challengeTargetLabel === b.challengeTargetLabel &&
		a.challengeRemainingLabel === b.challengeRemainingLabel &&
		a.tasksPending === b.tasksPending &&
		a.tasksDone === b.tasksDone &&
		a.workHoursLabel === b.workHoursLabel &&
		a.restHoursLabel === b.restHoursLabel &&
		a.tasksFinishedToday === b.tasksFinishedToday &&
		a.avgWorkHoursLabel === b.avgWorkHoursLabel &&
		a.workTrend === b.workTrend &&
		a.timerStatus === b.timerStatus &&
		mergeTeamTasks(a.tasks, b.tasks) === a.tasks &&
		b.tasks.length === a.tasks.length
	);
}
