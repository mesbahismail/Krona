import type { LocalDataClient } from '@/lib/localData';
import type { DashboardReminderRow } from '@/lib/reminders';

export type AssigneeTeamReminderRow = {
	id: string;
	name: string;
	due_at: string | null;
	created_at: string;
	status: string;
	team_task_id: string | null;
	organization_id: string;
};

async function resolveOrganizationId(
	db: LocalDataClient,
	userId: string,
): Promise<string | null> {
	const { data: membership } = await db
		.from('organization_members')
		.select('organization_id')
		.eq('user_id', userId)
		.eq('status', 'active')
		.limit(1)
		.maybeSingle();
	return membership?.organization_id
		? String(membership.organization_id)
		: null;
}

/** Pending team reminders assigned to this user (deadline sync + manual). */
export async function fetchAssigneeTeamReminders(
	db: LocalDataClient,
	userId: string,
): Promise<AssigneeTeamReminderRow[]> {
	const organizationId = await resolveOrganizationId(db, userId);
	if (!organizationId) return [];

	const { data, error } = await db
		.from('team_reminders')
		.select('id, name, due_at, created_at, status, team_task_id, organization_id')
		.eq('organization_id', organizationId)
		.eq('assignee_user_id', userId)
		.neq('status', 'done')
		.order('due_at', { ascending: true, nullsFirst: false })
		.limit(80);

	if (error) {
		console.warn('[teams] assignee reminders load failed', error.message);
		return [];
	}

	return ((data ?? []) as AssigneeTeamReminderRow[]).map((row) => ({
		id: String(row.id),
		name: String(row.name ?? 'Reminder'),
		due_at: row.due_at ? String(row.due_at) : null,
		created_at: String(row.created_at ?? new Date().toISOString()),
		status: String(row.status ?? 'pending'),
		team_task_id: row.team_task_id ? String(row.team_task_id) : null,
		organization_id: String(row.organization_id),
	}));
}

export function teamRemindersToDashboardRows(
	rows: AssigneeTeamReminderRow[],
): DashboardReminderRow[] {
	return rows.map((row) => ({
		id: `team:${row.id}`,
		name: row.name,
		type: 'Work',
		due_date: row.due_at,
		date_created: row.created_at,
	}));
}

export function mergeDashboardReminderRows(
	personal: DashboardReminderRow[],
	team: DashboardReminderRow[],
): DashboardReminderRow[] {
	const seen = new Set(personal.map((row) => row.id));
	const merged = [...personal];
	for (const row of team) {
		if (seen.has(row.id)) continue;
		seen.add(row.id);
		merged.push(row);
	}
	return merged;
}

export function mapTeamReminderToPersonalShape(
	row: AssigneeTeamReminderRow,
): {
	id: string;
	name: string;
	type: string;
	date: string;
	created: string;
	occurrence: string;
	emailNotify: boolean;
	taskId: string | null;
	projectId: string | null;
	sortOrder: number | null;
	source: 'team';
	teamReminderId: string;
} {
	return {
		id: `team:${row.id}`,
		name: row.name,
		type: 'Work',
		date: row.due_at ?? row.created_at,
		created: row.created_at,
		occurrence: 'One time',
		emailNotify: false,
		taskId: row.team_task_id,
		projectId: null,
		sortOrder: null,
		source: 'team',
		teamReminderId: row.id,
	};
}
