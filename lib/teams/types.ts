import type { TeamEmployeePermissions } from '@/lib/teams/employeePermissions';
import { parseTeamEmployeePermissions } from '@/lib/teams/employeePermissions';

export type TeamMemberRole = 'owner' | 'manager' | 'member';
export type WorkspaceMode = 'team' | 'individual';

export type Organization = {
	id: string;
	name: string;
	slug: string | null;
	logoUrl: string | null;
	seatCount: number;
	ownerUserId: string;
	onboardingCompleted: boolean;
	billingStatus: string;
	trialEndsAt: string | null;
	createdAt?: string | null;
	employeePermissions: TeamEmployeePermissions;
	roleNotes: string;
	workflowNotes: string;
	setupNotes: string;
};

export type OrganizationMember = {
	id: string;
	organizationId: string;
	userId: string;
	role: TeamMemberRole;
	status: string;
	displayName?: string | null;
	email?: string | null;
	avatarUrl?: string | null;
	jobTitle?: string | null;
	onboardingCompleted?: boolean;
	joinedAt?: string | null;
	hourlyRate?: number | null;
	birthday?: string | null;
	dailyChallengeHours?: number | null;
	accessPermissions: TeamEmployeePermissions;
};

export type TeamNotificationKind =
	| 'task_assigned'
	| 'task_prioritized'
	| 'project_assigned'
	| 'reminder_assigned'
	| 'reminder_created'
	| 'challenge_assigned'
	| 'vacation_notice'
	| 'invite_accepted'
	| 'team_announcement'
	| 'challenge_completed'
	| 'task_completed'
	| 'project_submitted'
	| 'project_created'
	| 'deadline_added'
	| 'deadline_approaching'
	| 'vacation_added'
	| 'performance_alert'
	| 'birthday'
	| 'reminder_due'
	| 'task_overtime'
	| 'member_onboarding_completed';

export type TeamNotification = {
	id: string;
	organizationId: string;
	kind: TeamNotificationKind | string;
	title: string;
	body: string | null;
	entityType: string | null;
	entityId: string | null;
	readAt: string | null;
	createdAt: string;
};

export function mapOrganizationRow(row: Record<string, unknown>): Organization {
	return {
		id: String(row.id),
		name: String(row.name ?? 'Team'),
		slug: row.slug ? String(row.slug) : null,
		logoUrl: row.logo_url ? String(row.logo_url) : null,
		seatCount: Number(row.seat_count ?? 0),
		ownerUserId: String(row.owner_user_id),
		onboardingCompleted: Boolean(row.onboarding_completed),
		billingStatus: String(row.billing_status ?? 'inactive'),
		trialEndsAt: row.trial_ends_at ? String(row.trial_ends_at) : null,
		createdAt: row.created_at ? String(row.created_at) : null,
		employeePermissions: parseTeamEmployeePermissions(row.employee_permissions),
		roleNotes: row.role_notes != null ? String(row.role_notes) : '',
		workflowNotes: row.workflow_notes != null ? String(row.workflow_notes) : '',
		setupNotes: row.setup_notes != null ? String(row.setup_notes) : '',
	};
}
