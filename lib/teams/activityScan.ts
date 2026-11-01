'use client';

import {
	createTeamReminder,
	fetchOrgMembers,
	hasTeamNotificationToday,
	notifyAssignment,
	notifyOrgManagers,
	organizationMemberLabel,
} from '@/lib/teams/org';
import { notifyTimerRunawayForMember } from '@/lib/teams/timerRunawayScan';
import { localData } from '@/lib/localData';
import { resolveBirthday } from '@/lib/profileBirthday';
import { fetchTeamPerformanceSummary } from '@/lib/teams/dashboard';
import type { TeamNotificationKind } from '@/lib/teams/types';
import {
	challengeGoalTitle,
	todayDateKey,
	type DailyChallenge,
} from '@/lib/challenges';

function monthDay(isoDate: string): string | null {
	const m = isoDate.match(/^\d{4}-(\d{2})-(\d{2})/);
	return m ? `${m[1]}-${m[2]}` : null;
}

function todayMonthDay(now = new Date()): string {
	return `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * Manager activity scanner — birthdays, due reminders, approaching deadlines,
 * overtime pending tasks, performance dips, and employees who left the work
 * timer running. Idempotent per day via hasTeamNotificationToday.
 */
export async function scanTeamManagerActivity(input: {
	organizationId: string;
	actorUserId: string;
}): Promise<number> {
	const { organizationId, actorUserId } = input;
	let created = 0;
	const now = new Date();
	const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

	const members = await fetchOrgMembers(organizationId);
	const nameById = new Map(
		members.map((m) => [
			m.userId,
			organizationMemberLabel(m),
		]),
	);

	const alertManagers = async (opts: {
		kind:
			| 'birthday'
			| 'reminder_due'
			| 'deadline_approaching'
			| 'task_overtime'
			| 'performance_alert';
		title: string;
		body: string;
		entityType: string;
		entityId: string;
		/** Exclude this user from recipients (e.g. birthday person). */
		excludeUserId?: string;
	}) => {
		const already = await hasTeamNotificationToday({
			userId: actorUserId,
			kind: opts.kind,
			entityId: opts.entityId,
		});
		if (already) return false;
		await notifyOrgManagers({
			organizationId,
			actorUserId: opts.excludeUserId ?? actorUserId,
			kind: opts.kind,
			title: opts.title,
			body: opts.body,
			entityType: opts.entityType,
			entityId: opts.entityId,
			includeActor: !opts.excludeUserId,
		});
		return true;
	};

	// 1) Birthdays → team reminders + activity
	const todayMd = todayMonthDay(now);
	const { data: personalRows } = await localData
		.from('personal')
		.select('user_id, birthday, full_name')
		.in(
			'user_id',
			members.map((m) => m.userId),
		);

	const dayStart = new Date(now);
	dayStart.setHours(0, 0, 0, 0);
	const dayEnd = new Date(now);
	dayEnd.setHours(23, 59, 59, 999);

	for (const row of personalRows ?? []) {
		const uid = String(row.user_id);
		const bday = resolveBirthday(
			row.birthday != null ? String(row.birthday) : null,
		);
		const md = bday ? monthDay(bday) : null;
		if (!md || md !== todayMd) continue;

		const label =
			(row.full_name ? String(row.full_name) : null) ||
			nameById.get(uid) ||
			'Teammate';
		const reminderName = `${label}'s birthday`;
		const entityId = `birthday-${uid}-${now.getFullYear()}`;

		const { data: existingReminder } = await localData
			.from('team_reminders')
			.select('id')
			.eq('organization_id', organizationId)
			.eq('name', reminderName)
			.gte('due_at', dayStart.toISOString())
			.lte('due_at', dayEnd.toISOString())
			.limit(1);

		if (!existingReminder?.length) {
			const dueAt = new Date(now);
			dueAt.setHours(9, 0, 0, 0);
			await createTeamReminder({
				organizationId,
				name: reminderName,
				dueAt: dueAt.toISOString(),
				assigneeUserId: null,
				createdBy: actorUserId,
			});
		}

		if (
			await alertManagers({
				kind: 'birthday',
				title: 'Birthday today',
				body: `${label}'s birthday — added to team reminders`,
				entityType: 'birthday',
				entityId,
				excludeUserId: uid,
			})
		) {
			created += 1;
		}
	}

	// 2) Reminders due within 24h
	const { data: reminders } = await localData
		.from('team_reminders')
		.select('id, name, due_at, status')
		.eq('organization_id', organizationId)
		.eq('status', 'pending')
		.not('due_at', 'is', null)
		.lte('due_at', in24h.toISOString());

	for (const rem of reminders ?? []) {
		const id = String(rem.id);
		if (
			await alertManagers({
				kind: 'reminder_due',
				title: 'Reminder due',
				body: String(rem.name),
				entityType: 'team_reminder',
				entityId: id,
			})
		) {
			created += 1;
		}
	}

	// 3) Task / project deadlines within 24h or overdue
	const { data: deadlineTasks } = await localData
		.from('team_tasks')
		.select('id, name, deadline, status')
		.eq('organization_id', organizationId)
		.eq('status', 'pending')
		.not('deadline', 'is', null)
		.lte('deadline', in24h.toISOString());

	for (const task of deadlineTasks ?? []) {
		const id = String(task.id);
		const due = task.deadline ? new Date(String(task.deadline)) : null;
		const overdue = due != null && due.getTime() < now.getTime();
		if (
			await alertManagers({
				kind: 'deadline_approaching',
				title: overdue ? 'Deadline missed' : 'Deadline approaching',
				body: String(task.name),
				entityType: 'team_task',
				entityId: id,
			})
		) {
			created += 1;
		}
	}

	const { data: deadlineProjects } = await localData
		.from('team_projects')
		.select('id, name, deadline, status')
		.eq('organization_id', organizationId)
		.neq('status', 'archived')
		.not('deadline', 'is', null)
		.lte('deadline', in24h.toISOString());

	for (const project of deadlineProjects ?? []) {
		const id = String(project.id);
		const due = project.deadline ? new Date(String(project.deadline)) : null;
		const overdue = due != null && due.getTime() < now.getTime();
		if (
			await alertManagers({
				kind: 'deadline_approaching',
				title: overdue
					? 'Project deadline missed'
					: 'Project deadline approaching',
				body: String(project.name),
				entityType: 'team_project',
				entityId: id,
			})
		) {
			created += 1;
		}
	}

	// 4) Pending tasks past estimated time
	const { data: timedTasks } = await localData
		.from('team_tasks')
		.select('id, name, estimated_hours, created_at, status')
		.eq('organization_id', organizationId)
		.eq('status', 'pending')
		.not('estimated_hours', 'is', null);

	for (const task of timedTasks ?? []) {
		const hours = Number(task.estimated_hours);
		if (!Number.isFinite(hours) || hours <= 0) continue;
		const createdAt = task.created_at ? new Date(String(task.created_at)) : null;
		if (!createdAt) continue;
		const elapsedHrs =
			(now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
		if (elapsedHrs <= hours) continue;
		const id = String(task.id);
		if (
			await alertManagers({
				kind: 'task_overtime',
				title: 'Task over assigned time',
				body: `${String(task.name)} · ${elapsedHrs.toFixed(1)}h / ${hours}h`,
				entityType: 'team_task',
				entityId: id,
			})
		) {
			created += 1;
		}
	}

	// 5) Performance skip / downfall
	const summary = await fetchTeamPerformanceSummary(organizationId);
	const totalTasks = summary.tasksDone + summary.tasksPending;
	const perfEntity = `perf-${now.toISOString().slice(0, 10)}`;
	if (totalTasks >= 3 && summary.completionRate < 35) {
		if (
			await alertManagers({
				kind: 'performance_alert',
				title: 'Performance downfall',
				body: `Team completion is at ${summary.completionRate}%`,
				entityType: 'performance',
				entityId: perfEntity,
			})
		) {
			created += 1;
		}
	} else if (totalTasks >= 1 && summary.tasksDone === 0) {
		const skipEntity = `skip-${now.toISOString().slice(0, 10)}`;
		if (
			await alertManagers({
				kind: 'performance_alert',
				title: 'Performance skip',
				body: 'No team tasks completed yet today',
				entityType: 'performance',
				entityId: skipEntity,
			})
		) {
			created += 1;
		}
	}

	// 6) Employees who left the work timer running (rest + 8h + assigned time)
	for (const member of members) {
		if (member.role !== 'member') continue;
		created += await notifyTimerRunawayForMember({
			organizationId,
			member,
			notifyManagers: true,
		});
	}

	return created;
}

/**
 * Employee-scoped activity — only their assignments, deadlines, overtime,
 * reminders, teammate birthdays, personal performance, and a leftover work
 * timer (rest / 8h). Managers of employees are notified from this scan too.
 */
export async function scanTeamMemberActivity(input: {
	organizationId: string;
	userId: string;
}): Promise<number> {
	const { organizationId, userId } = input;
	let created = 0;
	const now = new Date();
	const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

	const alertSelf = async (opts: {
		kind: TeamNotificationKind;
		title: string;
		body: string;
		entityType: string;
		entityId: string;
	}) => {
		const already = await hasTeamNotificationToday({
			userId,
			kind: opts.kind,
			entityId: opts.entityId,
		});
		if (already) return false;
		await notifyAssignment({
			organizationId,
			userId,
			kind: opts.kind,
			title: opts.title,
			body: opts.body,
			entityType: opts.entityType,
			entityId: opts.entityId,
		});
		return true;
	};

	const members = await fetchOrgMembers(organizationId);
	const nameById = new Map(
		members.map((m) => [
			m.userId,
			organizationMemberLabel(m),
		]),
	);

	// Teammate birthdays (not self)
	const todayMd = todayMonthDay(now);
	const { data: personalRows } = await localData
		.from('personal')
		.select('user_id, birthday, full_name')
		.in(
			'user_id',
			members.map((m) => m.userId),
		);

	for (const row of personalRows ?? []) {
		const uid = String(row.user_id);
		if (uid === userId) continue;
		const bday = resolveBirthday(
			row.birthday != null ? String(row.birthday) : null,
		);
		const md = bday ? monthDay(bday) : null;
		if (!md || md !== todayMd) continue;
		const label =
			(row.full_name ? String(row.full_name) : null) ||
			nameById.get(uid) ||
			'Teammate';
		const entityId = `birthday-${uid}-${now.getFullYear()}`;
		if (
			await alertSelf({
				kind: 'birthday',
				title: 'Teammate birthday',
				body: `${label}'s birthday today`,
				entityType: 'birthday',
				entityId,
			})
		) {
			created += 1;
		}
	}

	// Daily Challenges assigned for today (work hours / tasks)
	const { data: challengeRows } = await localData
		.from('daily_challenges')
		.select(
			'id, title, challenge_type, target_value, progress_value, task_ids, status',
		)
		.eq('user_id', userId)
		.eq('challenge_date', todayDateKey())
		.neq('status', 'archived');

	const dateKey = todayDateKey();
	const seenChallengeTypes = new Set<string>();
	for (const row of challengeRows ?? []) {
		const challengeType = String(row.challenge_type ?? '');
		if (!challengeType || seenChallengeTypes.has(challengeType)) continue;
		seenChallengeTypes.add(challengeType);
		const challenge = {
			id: String(row.id),
			title: String(row.title ?? ''),
			challenge_type: row.challenge_type,
			target_value: Number(row.target_value ?? 0),
			progress_value: Number(row.progress_value ?? 0),
			task_ids: Array.isArray(row.task_ids) ? row.task_ids : [],
			status: row.status,
		} as DailyChallenge;
		const syntheticId = `daily-challenge-${userId}-${dateKey}-${challengeType}`;
		const legacyIds = (challengeRows ?? [])
			.filter((entry) => String(entry.challenge_type ?? '') === challengeType)
			.map((entry) => String(entry.id));
		if (
			await hasTeamNotificationToday({
				userId,
				kind: 'challenge_assigned',
				entityId: [syntheticId, ...legacyIds],
			})
		) {
			continue;
		}
		if (
			await alertSelf({
				kind: 'challenge_assigned',
				title: 'Daily challenge assigned',
				body: challengeGoalTitle(challenge),
				entityType: 'daily_challenge',
				entityId: syntheticId,
			})
		) {
			created += 1;
		}
	}

	// Reminders assigned to them, due within 24h
	const { data: reminders } = await localData
		.from('team_reminders')
		.select('id, name, due_at, status')
		.eq('organization_id', organizationId)
		.eq('assignee_user_id', userId)
		.eq('status', 'pending')
		.not('due_at', 'is', null)
		.lte('due_at', in24h.toISOString());

	for (const rem of reminders ?? []) {
		const id = String(rem.id);
		if (
			await alertSelf({
				kind: 'reminder_due',
				title: 'Your reminder is due',
				body: String(rem.name),
				entityType: 'team_reminder',
				entityId: id,
			})
		) {
			created += 1;
		}
	}

	// Their pending task deadlines
	const { data: deadlineTasks } = await localData
		.from('team_tasks')
		.select('id, name, deadline, status')
		.eq('organization_id', organizationId)
		.eq('assignee_user_id', userId)
		.eq('status', 'pending')
		.not('deadline', 'is', null)
		.lte('deadline', in24h.toISOString());

	for (const task of deadlineTasks ?? []) {
		const id = String(task.id);
		const due = task.deadline ? new Date(String(task.deadline)) : null;
		const overdue = due != null && due.getTime() < now.getTime();
		if (
			await alertSelf({
				kind: 'deadline_approaching',
				title: overdue ? 'Your deadline was missed' : 'Your deadline is approaching',
				body: String(task.name),
				entityType: 'team_task',
				entityId: id,
			})
		) {
			created += 1;
		}
	}

	// Projects they belong to with approaching deadlines
	const { data: memberships } = await localData
		.from('team_project_members')
		.select('project_id')
		.eq('user_id', userId);
	const projectIds = (memberships ?? []).map((m) => String(m.project_id));
	if (projectIds.length) {
		const { data: deadlineProjects } = await localData
			.from('team_projects')
			.select('id, name, deadline, status')
			.in('id', projectIds)
			.neq('status', 'archived')
			.not('deadline', 'is', null)
			.lte('deadline', in24h.toISOString());

		for (const project of deadlineProjects ?? []) {
			const id = String(project.id);
			const due = project.deadline ? new Date(String(project.deadline)) : null;
			const overdue = due != null && due.getTime() < now.getTime();
			if (
				await alertSelf({
					kind: 'deadline_approaching',
					title: overdue
						? 'Project deadline missed'
						: 'Project deadline approaching',
					body: String(project.name),
					entityType: 'team_project',
					entityId: id,
				})
			) {
				created += 1;
			}
		}
	}

	// Their tasks over estimated time
	const { data: timedTasks } = await localData
		.from('team_tasks')
		.select('id, name, estimated_hours, created_at, status')
		.eq('organization_id', organizationId)
		.eq('assignee_user_id', userId)
		.eq('status', 'pending')
		.not('estimated_hours', 'is', null);

	for (const task of timedTasks ?? []) {
		const hours = Number(task.estimated_hours);
		if (!Number.isFinite(hours) || hours <= 0) continue;
		const createdAt = task.created_at
			? new Date(String(task.created_at))
			: null;
		if (!createdAt) continue;
		const elapsedHrs =
			(now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
		if (elapsedHrs <= hours) continue;
		const id = String(task.id);
		if (
			await alertSelf({
				kind: 'task_overtime',
				title: 'Task over assigned time',
				body: `${String(task.name)} · ${elapsedHrs.toFixed(1)}h / ${hours}h`,
				entityType: 'team_task',
				entityId: id,
			})
		) {
			created += 1;
		}
	}

	// Personal performance: assigned pending work but nothing completed today
	const dayStart = new Date(now);
	dayStart.setHours(0, 0, 0, 0);
	const { data: myTasks } = await localData
		.from('team_tasks')
		.select('id, status, completed_at')
		.eq('organization_id', organizationId)
		.eq('assignee_user_id', userId);

	const pending = (myTasks ?? []).filter((t) => t.status === 'pending').length;
	const doneToday = (myTasks ?? []).filter((t) => {
		if (t.status !== 'done' || !t.completed_at) return false;
		return new Date(String(t.completed_at)).getTime() >= dayStart.getTime();
	}).length;

	if (pending >= 1 && doneToday === 0) {
		const skipEntity = `member-skip-${userId}-${now.toISOString().slice(0, 10)}`;
		if (
			await alertSelf({
				kind: 'performance_alert',
				title: 'Performance skip',
				body: 'You still have assigned tasks with nothing completed today',
				entityType: 'performance',
				entityId: skipEntity,
			})
		) {
			created += 1;
		}
	}

	const me = members.find((member) => member.userId === userId);
	if (me) {
		created += await notifyTimerRunawayForMember({
			organizationId,
			member: me,
			notifyManagers: me.role === 'member',
		});
	}

	return created;
}
