import { localData } from '@/lib/localData';

export const UNDEFINED_PROJECT_NAME = 'Undefined';

export type UndefinedProjectLike = {
	is_unassigned_folder?: boolean | null;
	isUnassignedFolder?: boolean | null;
};

export function isUndefinedProjectName(name: string | null | undefined): boolean {
	return String(name ?? '').trim().toLocaleLowerCase() === 'undefined';
}

/** Identity check that remains true when the user renames the folder. */
export function isUndefinedProject(
	project: UndefinedProjectLike | null | undefined,
): boolean {
	return (
		project?.is_unassigned_folder === true ||
		project?.isUnassignedFolder === true
	);
}

/** Keep the unassigned folder last, preserving the relative order of the rest. */
export function compareUndefinedProjectLast(
	a: UndefinedProjectLike,
	b: UndefinedProjectLike,
): number {
	const aUndefined = isUndefinedProject(a);
	const bUndefined = isUndefinedProject(b);
	if (aUndefined === bUndefined) return 0;
	return aUndefined ? 1 : -1;
}

async function findUndefinedProjectId(userId: string): Promise<string | null> {
	const { data, error } = await localData
		.from('projects')
		.select('id')
		.eq('user_id', userId)
		.eq('is_unassigned_folder', true)
		.maybeSingle();
	if (error) return null;
	return data?.id ? String(data.id) : null;
}

/**
 * Return the user's stable unassigned project, creating it when absent.
 * Its display name may be changed without affecting future task assignment.
 * The DB partial unique index prevents concurrent creates from making duplicates.
 */
export async function ensureUndefinedProject(
	userId: string,
): Promise<string | null> {
	const existingId = await findUndefinedProjectId(userId);
	if (existingId) return existingId;

	const { data, error } = await localData
		.from('projects')
		.insert({
			user_id: userId,
			name: UNDEFINED_PROJECT_NAME,
			is_unassigned_folder: true,
		})
		.select('id')
		.single();

	if (!error && data?.id) return String(data.id);

	// Another task creation may have won the race against the unique index.
	if (error?.code === '23505') {
		return findUndefinedProjectId(userId);
	}
	return null;
}
