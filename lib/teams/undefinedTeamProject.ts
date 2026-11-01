'use client';

import { localData } from '@/lib/localData';
import type { TeamProjectRow } from '@/lib/teams/dashboard';

export const TEAM_UNDEFINED_PROJECT_NAME = 'Undefined';

export function isTeamUndefinedProject(
	project: Pick<TeamProjectRow, 'is_unassigned_folder'> | null | undefined,
): boolean {
	return Boolean(project?.is_unassigned_folder);
}

export function compareTeamUndefinedProjectLast(
	a: Pick<TeamProjectRow, 'is_unassigned_folder'>,
	b: Pick<TeamProjectRow, 'is_unassigned_folder'>,
): number {
	const aUndefined = isTeamUndefinedProject(a);
	const bUndefined = isTeamUndefinedProject(b);
	if (aUndefined === bUndefined) return 0;
	return aUndefined ? 1 : -1;
}

async function findTeamUndefinedProjectId(
	organizationId: string,
): Promise<string | null> {
	const { data, error } = await localData
		.from('team_projects')
		.select('id')
		.eq('organization_id', organizationId)
		.eq('is_unassigned_folder', true)
		.maybeSingle();
	if (error || !data?.id) return null;
	return String(data.id);
}

export async function ensureTeamUndefinedProject(input: {
	organizationId: string;
	createdBy: string;
}): Promise<string | null> {
	const existing = await findTeamUndefinedProjectId(input.organizationId);
	if (existing) return existing;

	const { data, error } = await localData
		.from('team_projects')
		.insert({
			organization_id: input.organizationId,
			name: TEAM_UNDEFINED_PROJECT_NAME,
			created_by: input.createdBy,
			assignee_user_id: null,
			is_unassigned_folder: true,
		})
		.select('id')
		.single();
	if (!error && data?.id) return String(data.id);
	if (error?.code === '23505') return findTeamUndefinedProjectId(input.organizationId);
	return null;
}
