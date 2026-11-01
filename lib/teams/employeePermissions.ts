export type TeamEmployeePermissions = {
	canCreateEditProjects: boolean;
	canCreateEditTasks: boolean;
	canCreateEditReminders: boolean;
	canUseAi: boolean;
};

export const DEFAULT_TEAM_EMPLOYEE_PERMISSIONS: TeamEmployeePermissions = {
	canCreateEditProjects: false,
	canCreateEditTasks: false,
	canCreateEditReminders: false,
	canUseAi: false,
};

export const FULL_TEAM_MEMBER_PERMISSIONS: TeamEmployeePermissions = {
	canCreateEditProjects: true,
	canCreateEditTasks: true,
	canCreateEditReminders: true,
	canUseAi: true,
};

export const TEAM_MEMBER_ACCESS_OPTIONS: {
	key: keyof TeamEmployeePermissions;
	label: string;
}[] = [
	{ key: 'canCreateEditProjects', label: 'Create, edit, and delete projects' },
	{ key: 'canCreateEditTasks', label: 'Create and edit tasks' },
	{ key: 'canCreateEditReminders', label: 'Create and edit reminders' },
	{ key: 'canUseAi', label: 'Use Krona AI' },
];

export function parseTeamEmployeePermissions(
	raw: unknown,
): TeamEmployeePermissions {
	const src =
		raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};

	if (
		typeof src.canCreateEditProjects === 'boolean' ||
		typeof src.canCreateEditTasks === 'boolean' ||
		typeof src.canCreateEditReminders === 'boolean' ||
		typeof src.canUseAi === 'boolean'
	) {
		return {
			canCreateEditProjects:
				typeof src.canCreateEditProjects === 'boolean'
					? src.canCreateEditProjects
					: DEFAULT_TEAM_EMPLOYEE_PERMISSIONS.canCreateEditProjects,
			canCreateEditTasks:
				typeof src.canCreateEditTasks === 'boolean'
					? src.canCreateEditTasks
					: DEFAULT_TEAM_EMPLOYEE_PERMISSIONS.canCreateEditTasks,
			canCreateEditReminders:
				typeof src.canCreateEditReminders === 'boolean'
					? src.canCreateEditReminders
					: DEFAULT_TEAM_EMPLOYEE_PERMISSIONS.canCreateEditReminders,
			canUseAi:
				typeof src.canUseAi === 'boolean'
					? src.canUseAi
					: DEFAULT_TEAM_EMPLOYEE_PERMISSIONS.canUseAi,
		};
	}

	// Legacy keys from earlier employee_permissions JSON.
	return {
		canCreateEditProjects: false,
		canCreateEditTasks: false,
		canCreateEditReminders:
			typeof src.canCreateReminders === 'boolean'
				? src.canCreateReminders
				: DEFAULT_TEAM_EMPLOYEE_PERMISSIONS.canCreateEditReminders,
		canUseAi: false,
	};
}

export function isTeamManagerRole(
	role: 'owner' | 'manager' | 'member' | null | undefined,
): boolean {
	return role === 'owner' || role === 'manager';
}

export function canCreateEditTeamProjects(
	role: 'owner' | 'manager' | 'member' | null | undefined,
	perms: TeamEmployeePermissions,
): boolean {
	// Owner always; everyone else only if the admin manager granted this access.
	return role === 'owner' || Boolean(perms.canCreateEditProjects);
}

export function canCreateEditTeamTasks(
	role: 'owner' | 'manager' | 'member' | null | undefined,
	perms: TeamEmployeePermissions,
): boolean {
	return role === 'owner' || Boolean(perms.canCreateEditTasks);
}

export function canCreateEditTeamReminders(
	role: 'owner' | 'manager' | 'member' | null | undefined,
	perms: TeamEmployeePermissions,
): boolean {
	return role === 'owner' || Boolean(perms.canCreateEditReminders);
}

export function canUseTeamAi(
	role: 'owner' | 'manager' | 'member' | null | undefined,
	perms: TeamEmployeePermissions,
): boolean {
	// Owners and managers always get Team AI; employees need the org grant.
	return role === 'owner' || role === 'manager' || Boolean(perms.canUseAi);
}

/** Personal accounts and managers keep the control; members need the grant. */
export function memberMayUseInterface(
	role: 'owner' | 'manager' | 'member' | null | undefined,
	granted: boolean,
): boolean {
	return role !== 'member' || Boolean(granted);
}

/** @deprecated Use canCreateEditTeamProjects / canCreateEditTeamTasks. */
export function canCreateTeamWork(
	role: 'owner' | 'manager' | 'member' | null | undefined,
): boolean {
	return isTeamManagerRole(role);
}
