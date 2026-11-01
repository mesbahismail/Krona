'use client';

import { localService } from '@/lib/localService';

import { localData } from '@/lib/localData';
import { isDeadlineInPast, localDateKey } from '@/lib/localDate';
import {
	notifyChallengesSyncNow,
	notifyTasksUpdated,
} from '@/lib/kronaDataEvents';
import {
	mapOrganizationRow,
	type Organization,
	type OrganizationMember,
	type TeamMemberRole,
	type TeamNotification,
	type TeamNotificationKind,
} from '@/lib/teams/types';
import {
	canCreateEditTeamProjects,
	canCreateEditTeamReminders,
	canCreateEditTeamTasks,
	DEFAULT_TEAM_EMPLOYEE_PERMISSIONS,
	FULL_TEAM_MEMBER_PERMISSIONS,
	parseTeamEmployeePermissions,
} from '@/lib/teams/employeePermissions';
import {
	ensureTeamUndefinedProject,
	isTeamUndefinedProject,
} from '@/lib/teams/undefinedTeamProject';

async function orgMemberAccess(organizationId: string) {
	const membership = await fetchMyMembership(organizationId);
	return {
		role: membership?.role ?? null,
		perms:
			membership?.accessPermissions ?? DEFAULT_TEAM_EMPLOYEE_PERMISSIONS,
	};
}

export async function fetchMyOrganizations(): Promise<Organization[]> {
	const { data: memberships, error } = await localData
		.from('organization_members')
		.select('organization_id')
		.eq('status', 'active');
	if (error || !memberships?.length) return [];

	const ids = memberships.map((m) => m.organization_id as string);
	const { data: orgs } = await localData
		.from('organizations')
		.select('*')
		.in('id', ids)
		.order('created_at', { ascending: true });
	return (orgs ?? []).map((row) => mapOrganizationRow(row as Record<string, unknown>));
}

export async function fetchPrimaryOrganization(): Promise<Organization | null> {
	const orgs = await fetchMyOrganizations();
	return orgs[0] ?? null;
}

/** Load a specific org the user owns or belongs to (RLS: member or owner_user_id). */
export async function fetchOrganizationById(
	organizationId: string,
): Promise<Organization | null> {
	const { data, error } = await localData
		.from('organizations')
		.select('*')
		.eq('id', organizationId)
		.maybeSingle();
	if (error || !data) return null;
	return mapOrganizationRow(data as Record<string, unknown>);
}

export async function fetchMyMembership(
	organizationId: string,
): Promise<OrganizationMember | null> {
	const { data: userRes } = await localData.auth.getUser();
	const userId = userRes.user?.id;
	if (!userId) return null;
	const { data } = await localData
		.from('organization_members')
		.select(
			'id, organization_id, user_id, role, status, job_title, onboarding_completed, joined_at, access_permissions',
		)
		.eq('organization_id', organizationId)
		.eq('user_id', userId)
		.maybeSingle();
	if (!data) return null;
	return {
		id: data.id,
		organizationId: data.organization_id,
		userId: data.user_id,
		role: data.role as TeamMemberRole,
		status: data.status,
		jobTitle: data.job_title ?? null,
		onboardingCompleted: data.onboarding_completed !== false,
		joinedAt: data.joined_at ? String(data.joined_at) : null,
		accessPermissions: parseTeamEmployeePermissions(data.access_permissions),
	};
}

export async function createOrganization(input: {
	name: string;
	seatCount: number;
	ownerUserId: string;
}): Promise<Organization | null> {
	const { data: org, error } = await localData
		.from('organizations')
		.insert({
			name: input.name.trim() || 'My team',
			seat_count: input.seatCount,
			owner_user_id: input.ownerUserId,
			billing_status: 'trialing',
			trial_ends_at: new Date(
				Date.now() + 14 * 24 * 60 * 60 * 1000,
			).toISOString(),
		})
		.select('*')
		.single();
	if (error || !org) {
		console.warn('[teams] create org failed', error?.message);
		return null;
	}

	const { error: memberError } = await localData.from('organization_members').insert({
		organization_id: org.id,
		user_id: input.ownerUserId,
		role: 'owner',
		status: 'active',
		onboarding_completed: true,
		access_permissions: FULL_TEAM_MEMBER_PERMISSIONS,
	});
	if (memberError) {
		console.warn('[teams] create owner membership failed', memberError.message);
	}

	return mapOrganizationRow(org as Record<string, unknown>);
}

export async function updateOrganization(
	organizationId: string,
	patch: {
		name?: string;
		logoUrl?: string | null;
		seatCount?: number;
		onboardingCompleted?: boolean;
		employeePermissions?: import('@/lib/teams/employeePermissions').TeamEmployeePermissions;
		roleNotes?: string;
		workflowNotes?: string;
		setupNotes?: string;
	},
): Promise<boolean> {
	const row: Record<string, unknown> = {};
	if (patch.name != null) row.name = patch.name;
	if (patch.logoUrl !== undefined) row.logo_url = patch.logoUrl;
	if (patch.seatCount != null) row.seat_count = patch.seatCount;
	if (patch.roleNotes != null) row.role_notes = patch.roleNotes;
	if (patch.workflowNotes != null) row.workflow_notes = patch.workflowNotes;
	if (patch.setupNotes != null) row.setup_notes = patch.setupNotes;
	if (patch.onboardingCompleted != null) {
		row.onboarding_completed = patch.onboardingCompleted;
	}
	if (patch.employeePermissions != null) {
		row.employee_permissions = patch.employeePermissions;
	}
	const { error } = await localData
		.from('organizations')
		.update(row)
		.eq('id', organizationId);
	return !error;
}

export async function fetchOrgMembers(
	organizationId: string,
): Promise<OrganizationMember[]> {
	const { data } = await localData
		.from('organization_members')
		.select(
			'id, organization_id, user_id, role, status, job_title, onboarding_completed, joined_at, hourly_rate, access_permissions',
		)
		.eq('organization_id', organizationId)
		.eq('status', 'active');
	if (!data?.length) return [];

	const directory = await fetchOrgMemberDirectory(organizationId);
	const seenUsers = new Set<string>();

	return data.flatMap((m) => {
		const userId = String(m.user_id);
		if (seenUsers.has(userId)) return [];
		seenUsers.add(userId);
		const identity = directory.get(String(m.user_id));
		const joinedAt = (m as typeof m & { joined_at?: string | null })
			.joined_at;
		const hourlyRaw = Number(
			(m as typeof m & { hourly_rate?: number | null }).hourly_rate,
		);
		return [
			{
				id: m.id,
				organizationId: m.organization_id,
				userId: m.user_id,
				role: m.role as TeamMemberRole,
				status: m.status,
				displayName: identity?.displayName ?? null,
				email: identity?.email ?? null,
				avatarUrl: identity?.avatarUrl ?? null,
				jobTitle: (m.job_title as string | null) ?? null,
				onboardingCompleted: m.onboarding_completed !== false,
				joinedAt: joinedAt ? String(joinedAt) : null,
				hourlyRate:
					Number.isFinite(hourlyRaw) && hourlyRaw > 0 ? hourlyRaw : null,
				birthday: identity?.birthday ?? null,
				dailyChallengeHours: identity?.dailyChallengeHours ?? null,
				accessPermissions: parseTeamEmployeePermissions(m.access_permissions),
			},
		];
	});
}

type OrgMemberDirectoryRow = {
	user_id: string;
	display_name: string | null;
	email: string | null;
	avatar_url: string | null;
	birthday?: string | null;
	work_hours_target_daily?: number | null;
};

async function fetchOrgMemberDirectory(
	organizationId: string,
): Promise<
	Map<
		string,
		{
			displayName: string | null;
			email: string | null;
			avatarUrl: string | null;
			birthday: string | null;
			dailyChallengeHours: number | null;
		}
	>
> {
	const { data, error } = await localData.rpc('org_member_directory', {
		p_organization_id: organizationId,
	});
	if (error) {
		console.warn('[teams] org_member_directory failed', error.message);
		return new Map();
	}

	return new Map(
		((data as OrgMemberDirectoryRow[]) ?? []).map((row) => {
			const hours = Number(row.work_hours_target_daily ?? 0);
			return [
				String(row.user_id),
				{
					displayName: row.display_name?.trim() || null,
					email: row.email?.trim() || null,
					avatarUrl: row.avatar_url?.trim() || null,
					birthday: row.birthday ? String(row.birthday).slice(0, 10) : null,
					dailyChallengeHours:
						Number.isFinite(hours) && hours > 0 ? hours : null,
				},
			] as const;
		}),
	);
}

export type PendingOrgInvite = {
	id: string;
	email: string;
	role: TeamMemberRole;
	createdAt: string;
	token: string;
	deliveryStatus: 'queued' | 'sending' | 'sent' | 'failed';
	deliveryAttempts: number;
	deliveryLastError: string | null;
	deliverySentAt: string | null;
	accessPermissions: import('@/lib/teams/employeePermissions').TeamEmployeePermissions;
};

export async function fetchPendingOrgInvites(
	organizationId: string,
): Promise<PendingOrgInvite[]> {
	const { data } = await localData
		.from('organization_invites')
		.select(
			'id, organization_id, email, role, created_at, token, expires_at, delivery_status, delivery_attempts, delivery_last_error, delivery_sent_at, access_permissions',
		)
		.eq('organization_id', organizationId)
		.eq('status', 'pending')
		.order('created_at', { ascending: false });
	const now = Date.now();
	return (data ?? [])
		.filter((row) => {
			if (String(row.organization_id) !== organizationId) return false;
			const expiresAt = row.expires_at
				? new Date(String(row.expires_at)).getTime()
				: 0;
			return !expiresAt || expiresAt > now;
		})
		.map((row) => ({
		id: row.id as string,
		email: String(row.email),
		role: (row.role === 'manager' ? 'manager' : 'member') as TeamMemberRole,
		createdAt: String(row.created_at),
		token: String(row.token),
		deliveryStatus:
			row.delivery_status === 'sent' ||
			row.delivery_status === 'sending' ||
			row.delivery_status === 'failed'
				? row.delivery_status
				: 'queued',
		deliveryAttempts: Number(row.delivery_attempts ?? 0),
		deliveryLastError: row.delivery_last_error
			? String(row.delivery_last_error)
			: null,
		deliverySentAt: row.delivery_sent_at ? String(row.delivery_sent_at) : null,
		accessPermissions: parseTeamEmployeePermissions(row.access_permissions),
	}));
}

/** Pending invites that still hold a seat (not someone already on the roster). */
export function pendingInvitesReservingSeats(
	invites: PendingOrgInvite[],
	members: Array<{ email?: string | null }>,
): PendingOrgInvite[] {
	const memberEmails = new Set(
		members
			.map((member) => String(member.email ?? '').trim().toLowerCase())
			.filter(Boolean),
	);
	return invites.filter((invite) => {
		const email = invite.email.trim().toLowerCase();
		return Boolean(email) && !memberEmails.has(email);
	});
}

export function teamMemberRoleLabel(role: TeamMemberRole): string {
	if (role === 'owner') return 'Admin manager';
	if (role === 'manager') return 'Manager';
	return 'Employee';
}

/** Visible teammate name — never a user id. */
export function organizationMemberLabel(
	member:
		| Pick<OrganizationMember, 'displayName' | 'email'>
		| null
		| undefined,
): string {
	const name = member?.displayName?.trim();
	if (name) return name;
	const email = member?.email?.trim();
	if (email) return email;
	return 'Teammate';
}

/** Team creator — full seat/member admin. Cannot be removed. */
export function isOwnerRole(role: TeamMemberRole | null | undefined): boolean {
	return role === 'owner';
}

/** Owner or manager — can run team ops (assign work, view Team Effort). */
export function isManagerRole(role: TeamMemberRole | null | undefined): boolean {
	return role === 'owner' || role === 'manager';
}

/** Only the admin manager may invite, remove, buy seats, or change roles. */
export function canManageTeamRoster(
	role: TeamMemberRole | null | undefined,
): boolean {
	return role === 'owner';
}

export async function createTeamTask(input: {
	organizationId: string;
	name: string;
	assigneeUserId: string | null;
	createdBy: string;
	projectId?: string | null;
	deadline?: string | null;
	estimatedHours?: number | null;
}): Promise<string | null> {
	const { role, perms } = await orgMemberAccess(input.organizationId);
	if (!canCreateEditTeamTasks(role, perms)) return null;

	if (isDeadlineInPast(input.deadline)) return null;

	const hours =
		input.estimatedHours != null &&
		Number.isFinite(input.estimatedHours) &&
		input.estimatedHours > 0
			? input.estimatedHours
			: null;

	const projectId =
		input.projectId ?? (await ensureTeamUndefinedProject({
			organizationId: input.organizationId,
			createdBy: input.createdBy,
		}));
	if (!projectId) return null;

	const { data, error } = await localData
		.from('team_tasks')
		.insert({
			organization_id: input.organizationId,
			name: input.name.trim(),
			assignee_user_id: input.assigneeUserId,
			created_by: input.createdBy,
			project_id: projectId,
			deadline: input.deadline ?? null,
			estimated_hours: hours,
		})
		.select('id')
		.single();
	if (error || !data) return null;
	notifyTasksUpdated();
	if (input.assigneeUserId) {
		await notifyAssignment({
			organizationId: input.organizationId,
			userId: input.assigneeUserId,
			kind: 'task_assigned',
			title: 'New task assigned',
			body: input.name.trim(),
			entityType: 'team_task',
			entityId: data.id,
		});
	}
	if (input.deadline) {
		const deadlineLabel = `${input.name.trim()} · ${new Date(input.deadline).toLocaleDateString()}`;
		if (input.assigneeUserId) {
			await notifyAssignment({
				organizationId: input.organizationId,
				userId: input.assigneeUserId,
				kind: 'deadline_added',
				title: 'Deadline set',
				body: deadlineLabel,
				entityType: 'team_task',
				entityId: data.id,
			});
		}
		await notifyOrgManagers({
			organizationId: input.organizationId,
			actorUserId: input.createdBy,
			kind: 'deadline_added',
			title: 'Deadline set',
			body: deadlineLabel,
			entityType: 'team_task',
			entityId: data.id,
		});
	}
	return data.id;
}

export async function updateTeamTask(input: {
	organizationId: string;
	taskId: string;
	name?: string;
	assigneeUserId?: string | null;
	projectId?: string | null;
	deadline?: string | null;
	estimatedHours?: number | null;
}): Promise<boolean> {
	const { role, perms } = await orgMemberAccess(input.organizationId);
	if (!isManagerRole(role) && !canCreateEditTeamTasks(role, perms)) {
		return false;
	}
	const { data: userRes } = await localData.auth.getUser();
	const actorUserId = userRes.user?.id;
	if (!actorUserId) return false;

	const patch: Record<string, unknown> = {};
	if (input.name !== undefined) {
		const name = input.name.trim();
		if (!name) return false;
		patch.name = name;
	}
	if (input.assigneeUserId !== undefined) {
		patch.assignee_user_id = input.assigneeUserId;
	}
	if (input.projectId !== undefined) {
		const projectId =
			input.projectId ??
			(await ensureTeamUndefinedProject({
				organizationId: input.organizationId,
				createdBy: actorUserId,
			}));
		if (!projectId) return false;
		patch.project_id = projectId;
	}
	if (input.deadline !== undefined) {
		patch.deadline = input.deadline;
	}
	if (input.estimatedHours !== undefined) {
		patch.estimated_hours =
			input.estimatedHours != null &&
			Number.isFinite(input.estimatedHours) &&
			input.estimatedHours > 0
				? input.estimatedHours
				: null;
	}
	if (Object.keys(patch).length === 0) return true;

	const { data: previous } = await localData
		.from('team_tasks')
		.select('name, assignee_user_id, created_by')
		.eq('id', input.taskId)
		.eq('organization_id', input.organizationId)
		.maybeSingle();

	const { error } = await localData
		.from('team_tasks')
		.update(patch)
		.eq('id', input.taskId)
		.eq('organization_id', input.organizationId);
	if (error) return false;
	notifyTasksUpdated();

	const nextAssignee =
		input.assigneeUserId !== undefined
			? input.assigneeUserId
			: (previous?.assignee_user_id as string | null | undefined) ?? null;
	const prevAssignee = (previous?.assignee_user_id as string | null) ?? null;
	const taskName =
		(typeof patch.name === 'string' ? patch.name : null) ||
		String(previous?.name ?? '').trim();

	if (nextAssignee && nextAssignee !== prevAssignee && taskName) {
		await notifyAssignment({
			organizationId: input.organizationId,
			userId: nextAssignee,
			kind: 'task_assigned',
			title: 'New task assigned',
			body: taskName,
			entityType: 'team_task',
			entityId: input.taskId,
		});
	}
	return true;
}

export async function setTeamTaskPrioritized(input: {
	organizationId: string;
	taskId: string;
	name: string;
	prioritized: boolean;
	assigneeUserId?: string | null;
}): Promise<boolean> {
	const { role, perms } = await orgMemberAccess(input.organizationId);
	if (!isManagerRole(role) && !canCreateEditTeamTasks(role, perms)) {
		return false;
	}

	const { data: current } = await localData
		.from('team_tasks')
		.select('assignee_user_id, name')
		.eq('id', input.taskId)
		.eq('organization_id', input.organizationId)
		.maybeSingle();

	const { error } = await localData
		.from('team_tasks')
		.update({ prioritized: input.prioritized })
		.eq('id', input.taskId)
		.eq('organization_id', input.organizationId);
	if (error) return false;
	notifyTasksUpdated();

	const assigneeId =
		input.assigneeUserId !== undefined
			? input.assigneeUserId
			: (current?.assignee_user_id as string | null | undefined) ?? null;
	const taskName = input.name.trim() || String(current?.name ?? '').trim();
	if (input.prioritized && assigneeId && taskName) {
		await notifyAssignment({
			organizationId: input.organizationId,
			userId: assigneeId,
			kind: 'task_prioritized',
			title: 'Task prioritized',
			body: taskName,
			entityType: 'team_task',
			entityId: input.taskId,
		});
	}
	return true;
}

export async function deleteTeamTask(input: {
	organizationId: string;
	taskId: string;
}): Promise<boolean> {
	const { role, perms } = await orgMemberAccess(input.organizationId);
	if (!isManagerRole(role) && !canCreateEditTeamTasks(role, perms)) {
		return false;
	}
	const { error } = await localData
		.from('team_tasks')
		.delete()
		.eq('id', input.taskId)
		.eq('organization_id', input.organizationId);
	if (!error) notifyTasksUpdated();
	return !error;
}

export async function isTeamTaskInMemberDailyChallenge(
	userId: string,
	taskId: string,
): Promise<boolean> {
	const start = new Date();
	const dateKey = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
	const { data } = await localData
		.from('daily_challenges')
		.select('task_ids')
		.eq('user_id', userId)
		.eq('challenge_date', dateKey)
		.eq('challenge_type', 'tasks')
		.neq('status', 'archived');
	return (data ?? []).some((row) => {
		const ids = Array.isArray(row.task_ids) ? row.task_ids : [];
		return ids.some((id: unknown) => String(id) === taskId);
	});
}

export async function addTeamTaskToMemberDailyChallenge(input: {
	organizationId: string;
	taskId: string;
	userId: string;
	taskName: string;
}): Promise<{ ok: boolean; alreadyPresent?: boolean; error?: string }> {
	try {
		const res = await localService('teams/tasks/daily-challenge', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				organizationId: input.organizationId,
				taskId: input.taskId,
				userId: input.userId,
				taskName: input.taskName,
			}),
		});
		const payload = (await res.json().catch(() => ({}))) as {
			error?: string;
			alreadyPresent?: boolean;
		};
		if (!res.ok) {
			return {
				ok: false,
				error: payload.error || 'Could not add this task to Daily Challenges.',
			};
		}
		return { ok: true, alreadyPresent: Boolean(payload.alreadyPresent) };
	} catch {
		return { ok: false, error: 'Could not add this task to Daily Challenges.' };
	}
}

export async function createTeamProject(input: {
	organizationId: string;
	name: string;
	assigneeUserId?: string | null;
	memberUserIds?: string[];
	createdBy: string;
	deadline?: string | null;
}): Promise<string | null> {
	const { role, perms } = await orgMemberAccess(input.organizationId);
	if (!canCreateEditTeamProjects(role, perms)) return null;
	if (input.name.trim().toLowerCase() === 'undefined') return null;
	if (isDeadlineInPast(input.deadline)) return null;

	const memberIds = Array.from(
		new Set((input.memberUserIds ?? []).map((id) => id.trim()).filter(Boolean)),
	);
	// Unassigned projects stay owner-only. Assigned members are the only
	// people the project is shared with besides the creator.
	const primaryAssignee =
		input.assigneeUserId?.trim() || memberIds[0] || null;

	const { data, error } = await localData
		.from('team_projects')
		.insert({
			organization_id: input.organizationId,
			name: input.name.trim(),
			assignee_user_id: primaryAssignee,
			created_by: input.createdBy,
			deadline: input.deadline ?? null,
			is_unassigned_folder: false,
		})
		.select('id')
		.single();
	if (error || !data) return null;

	if (memberIds.length) {
		const { error: membersError } = await localData
			.from('team_project_members')
			.insert(
				memberIds.map((userId) => ({
					project_id: data.id,
					user_id: userId,
				})),
			);
		if (membersError) {
			console.warn('[teams] project members insert failed', membersError.message);
		}
	}

	for (const userId of memberIds) {
		await notifyAssignment({
			organizationId: input.organizationId,
			userId,
			kind: 'project_assigned',
			title: 'New project assigned',
			body: input.name.trim(),
			entityType: 'team_project',
			entityId: data.id,
		});
	}

	await notifyOrgManagers({
		organizationId: input.organizationId,
		actorUserId: input.createdBy,
		kind: 'project_created',
		title: 'Project created',
		body: input.name.trim(),
		entityType: 'team_project',
		entityId: data.id,
	});

	if (input.deadline) {
		const deadlineLabel = `${input.name.trim()} · ${new Date(input.deadline).toLocaleDateString()}`;
		for (const userId of memberIds) {
			await notifyAssignment({
				organizationId: input.organizationId,
				userId,
				kind: 'deadline_added',
				title: 'Project deadline set',
				body: deadlineLabel,
				entityType: 'team_project',
				entityId: data.id,
			});
		}
		await notifyOrgManagers({
			organizationId: input.organizationId,
			actorUserId: input.createdBy,
			kind: 'deadline_added',
			title: 'Project deadline set',
			body: deadlineLabel,
			entityType: 'team_project',
			entityId: data.id,
		});
	}

	return data.id;
}

export async function setTeamProjectMembers(input: {
	organizationId: string;
	projectId: string;
	memberUserIds: string[];
}): Promise<boolean> {
	const { role, perms } = await orgMemberAccess(input.organizationId);
	if (!canCreateEditTeamProjects(role, perms)) return false;

	const memberIds = Array.from(
		new Set(input.memberUserIds.map((id) => id.trim()).filter(Boolean)),
	);

	await localData
		.from('team_project_members')
		.delete()
		.eq('project_id', input.projectId);

	if (memberIds.length) {
		const { error } = await localData.from('team_project_members').insert(
			memberIds.map((userId) => ({
				project_id: input.projectId,
				user_id: userId,
			})),
		);
		if (error) return false;
	}

	await localData
		.from('team_projects')
		.update({
			assignee_user_id: memberIds[0] ?? null,
			updated_at: new Date().toISOString(),
		})
		.eq('id', input.projectId);

	return true;
}

export async function updateTeamProject(input: {
	organizationId: string;
	projectId: string;
	name: string;
	deadline?: string | null;
	memberUserIds: string[];
}): Promise<boolean> {
	const { role, perms } = await orgMemberAccess(input.organizationId);
	if (!canCreateEditTeamProjects(role, perms) || !input.name.trim()) return false;
	if (input.name.trim().toLowerCase() === 'undefined') return false;
	const { data: target } = await localData
		.from('team_projects')
		.select('is_unassigned_folder')
		.eq('organization_id', input.organizationId)
		.eq('id', input.projectId)
		.maybeSingle();
	if (isTeamUndefinedProject(target as { is_unassigned_folder: boolean } | null)) {
		return false;
	}
	const { data: existingMembers } = await localData
		.from('team_project_members')
		.select('user_id')
		.eq('project_id', input.projectId);
	const previousIds = new Set(
		(existingMembers ?? []).map((row) => String(row.user_id)),
	);

	const { error } = await localData
		.from('team_projects')
		.update({
			name: input.name.trim(),
			deadline: input.deadline ?? null,
			updated_at: new Date().toISOString(),
		})
		.eq('organization_id', input.organizationId)
		.eq('id', input.projectId);
	if (error) return false;

	const membersUpdated = await setTeamProjectMembers({
		organizationId: input.organizationId,
		projectId: input.projectId,
		memberUserIds: input.memberUserIds,
	});
	if (!membersUpdated) return false;

	for (const userId of input.memberUserIds) {
		if (previousIds.has(userId)) continue;
		await notifyAssignment({
			organizationId: input.organizationId,
			userId,
			kind: 'project_assigned',
			title: 'Project assigned',
			body: input.name.trim(),
			entityType: 'team_project',
			entityId: input.projectId,
		});
	}
	return true;
}

export async function deleteTeamProject(input: {
	organizationId: string;
	projectId: string;
}): Promise<boolean> {
	const { role, perms } = await orgMemberAccess(input.organizationId);
	if (!canCreateEditTeamProjects(role, perms)) return false;

	const { data: target } = await localData
		.from('team_projects')
		.select('is_unassigned_folder')
		.eq('organization_id', input.organizationId)
		.eq('id', input.projectId)
		.maybeSingle();
	if (!target) return false;
	if (isTeamUndefinedProject(target as { is_unassigned_folder: boolean })) {
		return false;
	}

	const { error: tasksError } = await localData
		.from('team_tasks')
		.delete()
		.eq('organization_id', input.organizationId)
		.eq('project_id', input.projectId);
	if (tasksError) return false;

	const { error } = await localData
		.from('team_projects')
		.delete()
		.eq('organization_id', input.organizationId)
		.eq('id', input.projectId);
	return !error;
}

export async function createTeamReminder(input: {
	organizationId: string;
	name: string;
	assigneeUserId: string | null;
	createdBy: string;
	dueAt?: string | null;
	emailNotify?: boolean;
}): Promise<string | null> {
	const { role, perms } = await orgMemberAccess(input.organizationId);
	if (!canCreateEditTeamReminders(role, perms)) return null;

	const payload: Record<string, unknown> = {
		organization_id: input.organizationId,
		name: input.name.trim(),
		assignee_user_id: input.assigneeUserId,
		created_by: input.createdBy,
		due_at: input.dueAt ?? null,
		email_notify: Boolean(input.emailNotify),
	};

	let { data, error } = await localData
		.from('team_reminders')
		.insert(payload)
		.select('id')
		.single();
	if (
		error &&
		/email_notify|schema cache|does not exist/i.test(error.message)
	) {
		delete payload.email_notify;
		({ data, error } = await localData
			.from('team_reminders')
			.insert(payload)
			.select('id')
			.single());
	}
	if (error || !data) return null;
	if (input.assigneeUserId) {
		await notifyAssignment({
			organizationId: input.organizationId,
			userId: input.assigneeUserId,
			kind: 'reminder_assigned',
			title: 'New reminder assigned',
			body: input.name.trim(),
			entityType: 'team_reminder',
			entityId: data.id,
		});
	}
	return data.id;
}

function teamReminderDueDay(iso: string | null | undefined): string | null {
	if (!iso) return null;
	const parsed = new Date(iso);
	if (Number.isNaN(parsed.getTime())) return iso;
	return localDateKey(parsed);
}

export async function updateTeamReminder(input: {
	organizationId: string;
	reminderId: string;
	name: string;
	assigneeUserId: string | null;
	dueAt: string | null;
	emailNotify?: boolean;
}): Promise<boolean> {
	const { role, perms } = await orgMemberAccess(input.organizationId);
	if (!canCreateEditTeamReminders(role, perms)) return false;

	const { data: current } = await localData
		.from('team_reminders')
		.select('due_at')
		.eq('organization_id', input.organizationId)
		.eq('id', input.reminderId)
		.maybeSingle();

	const dueDateChanged =
		teamReminderDueDay(current?.due_at) !== teamReminderDueDay(input.dueAt);

	const payload: Record<string, unknown> = {
		name: input.name.trim(),
		assignee_user_id: input.assigneeUserId,
		due_at: input.dueAt,
		email_notify: Boolean(input.emailNotify),
	};
	if (dueDateChanged && input.emailNotify) {
		payload.email_notified_at = null;
	}

	let { error } = await localData
		.from('team_reminders')
		.update(payload)
		.eq('organization_id', input.organizationId)
		.eq('id', input.reminderId);
	if (
		error &&
		/email_notify|email_notified_at|schema cache|does not exist/i.test(
			error.message,
		)
	) {
		delete payload.email_notify;
		delete payload.email_notified_at;
		({ error } = await localData
			.from('team_reminders')
			.update(payload)
			.eq('organization_id', input.organizationId)
			.eq('id', input.reminderId));
	}
	if (error) return false;
	return true;
}

export async function deleteTeamReminder(input: {
	organizationId: string;
	reminderId: string;
}): Promise<boolean> {
	const { role, perms } = await orgMemberAccess(input.organizationId);
	if (!canCreateEditTeamReminders(role, perms)) return false;
	const { error } = await localData
		.from('team_reminders')
		.delete()
		.eq('organization_id', input.organizationId)
		.eq('id', input.reminderId);
	return !error;
}

export async function renameTeamWorkItem(input: {
	organizationId: string;
	kind: 'project' | 'task' | 'reminder';
	id: string;
	name: string;
}): Promise<boolean> {
	const { role, perms } = await orgMemberAccess(input.organizationId);
	const allowed =
		input.kind === 'project'
			? canCreateEditTeamProjects(role, perms)
			: input.kind === 'task'
				? canCreateEditTeamTasks(role, perms)
				: canCreateEditTeamReminders(role, perms);
	if (!allowed || !input.name.trim()) return false;
	const table =
		input.kind === 'project'
			? 'team_projects'
			: input.kind === 'task'
				? 'team_tasks'
				: 'team_reminders';
	const { error } = await localData
		.from(table)
		.update({ name: input.name.trim() })
		.eq('organization_id', input.organizationId)
		.eq('id', input.id);
	return !error;
}

export async function notifyAssignment(input: {
	organizationId: string;
	userId: string;
	kind: TeamNotificationKind;
	title: string;
	body: string;
	entityType: string;
	entityId: string;
}): Promise<void> {
	const already = await hasTeamNotificationToday({
		userId: input.userId,
		kind: input.kind,
		entityId: input.entityId,
	});
	if (already) return;
	await localData.from('team_notifications').insert({
		organization_id: input.organizationId,
		user_id: input.userId,
		kind: input.kind,
		title: input.title,
		body: input.body,
		entity_type: input.entityType,
		entity_id: input.entityId,
	});
}

function mapNotificationRow(row: Record<string, unknown>): TeamNotification {
	return {
		id: String(row.id),
		organizationId: String(row.organization_id),
		kind: String(row.kind),
		title: String(row.title),
		body: row.body != null ? String(row.body) : null,
		entityType: row.entity_type != null ? String(row.entity_type) : null,
		entityId: row.entity_id != null ? String(row.entity_id) : null,
		readAt: row.read_at != null ? String(row.read_at) : null,
		createdAt: String(row.created_at),
	};
}

/** Collapse same-day copies (scanner races or repeated challenge rows). */
export function dedupeTeamNotifications(
	items: TeamNotification[],
): TeamNotification[] {
	const seen = new Set<string>();
	const out: TeamNotification[] = [];
	for (const item of items) {
		const contentKey = `${item.kind}|${item.title}|${item.body ?? ''}`;
		const entityKey = item.entityId
			? `${item.kind}|${item.entityType ?? ''}|${item.entityId}`
			: contentKey;
		if (seen.has(contentKey) || seen.has(entityKey)) continue;
		seen.add(contentKey);
		seen.add(entityKey);
		out.push(item);
	}
	return out;
}

/** Today's team activity for the signed-in user (read + unread). */
export async function fetchTodayTeamNotifications(): Promise<TeamNotification[]> {
	const { data: userRes } = await localData.auth.getUser();
	const userId = userRes.user?.id;
	if (!userId) return [];
	const start = new Date();
	start.setHours(0, 0, 0, 0);
	const { data } = await localData
		.from('team_notifications')
		.select('*')
		.eq('user_id', userId)
		.gte('created_at', start.toISOString())
		.order('created_at', { ascending: false })
		.limit(50);
	return dedupeTeamNotifications(
		(data ?? []).map((row) => mapNotificationRow(row as Record<string, unknown>)),
	);
}

export async function fetchUnreadTeamNotifications(): Promise<TeamNotification[]> {
	const { data: userRes } = await localData.auth.getUser();
	const userId = userRes.user?.id;
	if (!userId) return [];
	const start = new Date();
	start.setHours(0, 0, 0, 0);
	const { data } = await localData
		.from('team_notifications')
		.select('*')
		.eq('user_id', userId)
		.is('read_at', null)
		.gte('created_at', start.toISOString())
		.order('created_at', { ascending: false })
		.limit(40);
	return dedupeTeamNotifications(
		(data ?? []).map((row) => mapNotificationRow(row as Record<string, unknown>)),
	);
}

export async function markTeamNotificationRead(id: string): Promise<void> {
	await localData
		.from('team_notifications')
		.update({ read_at: new Date().toISOString() })
		.eq('id', id);
}

export async function markAllTeamNotificationsRead(): Promise<void> {
	const { data: userRes } = await localData.auth.getUser();
	const userId = userRes.user?.id;
	if (!userId) return;
	await localData
		.from('team_notifications')
		.update({ read_at: new Date().toISOString() })
		.eq('user_id', userId)
		.is('read_at', null);
}

async function memberDisplayName(userId: string): Promise<string> {
	const { data } = await localData
		.from('personal')
		.select('first_name, full_name')
		.eq('user_id', userId)
		.maybeSingle();
	const full = String(data?.full_name ?? '').trim();
	if (full) return full;
	const first = String(data?.first_name ?? '').trim();
	return first || 'A teammate';
}

function calendarItemWhenLabel(
	dueAt?: string | null,
	vacationEndDate?: string | null,
): string | null {
	if (!dueAt) return null;
	const start = new Date(dueAt);
	if (Number.isNaN(start.getTime())) return null;
	const startLabel = start.toLocaleDateString();
	if (!vacationEndDate) return startLabel;
	const end = new Date(vacationEndDate);
	if (Number.isNaN(end.getTime())) return startLabel;
	return `${startLabel} – ${end.toLocaleDateString()}`;
}

/** Tell org managers when a teammate creates a reminder or vacation. */
export async function notifyManagersOfMemberCalendarItem(input: {
	actorUserId: string;
	reminderId: string;
	name: string;
	type?: string | null;
	dueAt?: string | null;
	vacationEndDate?: string | null;
	entityType?: string;
}): Promise<void> {
	try {
		const { data: memberships } = await localData
			.from('organization_members')
			.select('organization_id')
			.eq('user_id', input.actorUserId)
			.eq('status', 'active');
		if (!memberships?.length) return;

		const isVacation = (input.type ?? '').trim().toLowerCase() === 'vacation';
		const actor = await memberDisplayName(input.actorUserId);
		const when = calendarItemWhenLabel(input.dueAt, input.vacationEndDate);
		const name = input.name.trim() || (isVacation ? 'Vacation' : 'Reminder');
		const body = when ? `${actor} · ${name} · ${when}` : `${actor} · ${name}`;

		await Promise.all(
			memberships.map((row) =>
				notifyOrgManagers({
					organizationId: String(row.organization_id),
					actorUserId: input.actorUserId,
					kind: isVacation ? 'vacation_added' : 'reminder_created',
					title: isVacation ? 'Vacation added' : 'New reminder',
					body,
					entityType:
						input.entityType ?? (isVacation ? 'vacation' : 'reminder'),
					entityId: input.reminderId,
				}),
			),
		);
	} catch {
		// Activity is best-effort and must not block creating the reminder.
	}
}

/** Notify every org manager/owner (except actor unless includeActor). */
export async function notifyOrgManagers(input: {
	organizationId: string;
	actorUserId: string;
	kind: TeamNotificationKind;
	title: string;
	body: string;
	entityType: string;
	entityId: string;
	/** When true, the actor also receives the notification (scanner alerts). */
	includeActor?: boolean;
}): Promise<number> {
	const { data: managers } = await localData
		.from('organization_members')
		.select('user_id, role')
		.eq('organization_id', input.organizationId)
		.eq('status', 'active')
		.in('role', ['owner', 'manager']);
	const targets = (managers ?? [])
		.map((m) => m.user_id as string)
		.filter(
			(id) =>
				id && (input.includeActor || id !== input.actorUserId),
		);
	if (!targets.length) return 0;
	const alreadyByUser = await Promise.all(
		targets.map(async (userId) => ({
			userId,
			already: await hasTeamNotificationToday({
				userId,
				kind: input.kind,
				entityId: input.entityId,
			}),
		})),
	);
	const freshTargets = alreadyByUser
		.filter((row) => !row.already)
		.map((row) => row.userId);
	if (!freshTargets.length) return 0;
	await localData.from('team_notifications').insert(
		freshTargets.map((userId) => ({
			organization_id: input.organizationId,
			user_id: userId,
			kind: input.kind,
			title: input.title,
			body: input.body,
			entity_type: input.entityType,
			entity_id: input.entityId,
		})),
	);
	return freshTargets.length;
}

/** True if a same-kind notification for this entity already exists today for the user. */
export async function hasTeamNotificationToday(input: {
	userId: string;
	kind: TeamNotificationKind;
	entityId: string | string[];
}): Promise<boolean> {
	const entityIds = (Array.isArray(input.entityId) ? input.entityId : [input.entityId])
		.map((id) => id.trim())
		.filter(Boolean);
	if (!entityIds.length) return false;
	const start = new Date();
	start.setHours(0, 0, 0, 0);
	const { data } = await localData
		.from('team_notifications')
		.select('id')
		.eq('user_id', input.userId)
		.eq('kind', input.kind)
		.in('entity_id', entityIds)
		.gte('created_at', start.toISOString())
		.limit(1);
	return Boolean(data?.length);
}

/** Mark a team task done/pending and alert managers when completed. */
export async function setTeamTaskStatus(input: {
	organizationId: string;
	taskId: string;
	name: string;
	actorUserId: string;
	nextStatus: 'pending' | 'done';
	estimatedHours?: number | null;
	createdAt?: string | null;
}): Promise<boolean> {
	const completedAt =
		input.nextStatus === 'done' ? new Date().toISOString() : null;
	const { error } = await localData
		.from('team_tasks')
		.update({
			status: input.nextStatus,
			completed_at: completedAt,
		})
		.eq('id', input.taskId);
	if (error) return false;
	notifyTasksUpdated();
	notifyChallengesSyncNow();

	if (input.nextStatus === 'done') {
		await notifyOrgManagers({
			organizationId: input.organizationId,
			actorUserId: input.actorUserId,
			kind: 'task_completed',
			title: 'Task completed',
			body: input.name,
			entityType: 'team_task',
			entityId: input.taskId,
		});

		const hours = input.estimatedHours;
		if (hours != null && hours > 0 && input.createdAt && completedAt) {
			const elapsedHrs =
				(new Date(completedAt).getTime() -
					new Date(input.createdAt).getTime()) /
				(1000 * 60 * 60);
			if (elapsedHrs > hours) {
				await notifyOrgManagers({
					organizationId: input.organizationId,
					actorUserId: input.actorUserId,
					kind: 'task_overtime',
					title: 'Task took longer than assigned',
					body: `${input.name} · ${elapsedHrs.toFixed(1)}h / ${hours}h`,
					entityType: 'team_task',
					entityId: input.taskId,
				});
			}
		}
	}
	notifyChallengesSyncNow();
	return true;
}
