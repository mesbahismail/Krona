'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { fetchPrimaryOrganization } from '@/lib/teams/org';
import type { Organization, TeamMemberRole } from '@/lib/teams/types';
import {
	FULL_TEAM_MEMBER_PERMISSIONS,
	type TeamEmployeePermissions,
} from '@/lib/teams/employeePermissions';
import {
	loadUserAppSettings,
	saveUserAppSettings,
	type WorkspaceModeSetting,
} from '@/lib/userAppSettings';
import { localData } from '@/lib/localData';

/** Compatibility for the sample team screens; no billing service is contacted. */
export function isTeamBillingActive(
	org: Pick<Organization, 'billingStatus'> | null | undefined,
): boolean {
	return org?.billingStatus === 'active' || org?.billingStatus === 'trialing';
}

type TeamModeState = {
	loading: boolean;
	hasTeam: boolean;
	organization: Organization | null;
	role: TeamMemberRole | null;
	isManager: boolean;
	isOwner: boolean;
	canCreateEditProjects: boolean;
	canCreateEditTasks: boolean;
	canCreateEditReminders: boolean;
	canUseAi: boolean;
	employeePermissions: TeamEmployeePermissions;
	canUseIndividualMode: boolean;
	memberOnboardingCompleted: boolean;
	mode: WorkspaceModeSetting;
	setMode: (next: WorkspaceModeSetting) => Promise<void>;
	refresh: () => Promise<void>;
};

const TeamModeContext = React.createContext<TeamModeState | null>(null);

/** Local template preview switch. It changes the UI, not an authenticated role. */
export function TeamModeProvider({ children }: { children: React.ReactNode }) {
	const router = useRouter();
	const pathname = usePathname();
	const [loading, setLoading] = React.useState(true);
	const [organization, setOrganization] = React.useState<Organization | null>(
		null,
	);
	const [mode, setModeState] =
		React.useState<WorkspaceModeSetting>('individual');
	const refresh = React.useCallback(async () => {
		try {
			const {
				data: { user },
			} = await localData.auth.getUser();
			const [org, settings] = await Promise.all([
				fetchPrimaryOrganization(),
				loadUserAppSettings(user.id),
			]);
			setOrganization(org);
			setModeState(settings.workspaceMode === 'team' ? 'team' : 'individual');
		} finally {
			setLoading(false);
		}
	}, []);
	React.useEffect(() => {
		void refresh();
	}, [refresh]);

	const setMode = React.useCallback(
		async (next: WorkspaceModeSetting) => {
			const {
				data: { user },
			} = await localData.auth.getUser();
			const saved = await saveUserAppSettings(user.id, { workspaceMode: next });
			if (!saved)
				throw new Error('Could not save the workspace on this device.');
			setModeState(next);
			if (next === 'team') router.push('/team');
			else if (pathname === '/team' || pathname.startsWith('/team/'))
				router.push('/');
		},
		[pathname, router],
	);

	const manager = mode === 'team';
	const value = React.useMemo<TeamModeState>(
		() => ({
			loading,
			organization,
			hasTeam: Boolean(organization),
			mode,
			setMode,
			refresh,
			role: manager ? 'owner' : 'member',
			isManager: manager,
			isOwner: manager,
			canCreateEditProjects: true,
			canCreateEditTasks: true,
			canCreateEditReminders: true,
			canUseAi: false,
			employeePermissions: FULL_TEAM_MEMBER_PERMISSIONS,
			canUseIndividualMode: true,
			memberOnboardingCompleted: true,
		}),
		[loading, organization, mode, setMode, refresh, manager],
	);
	return (
		<TeamModeContext.Provider value={value}>
			{children}
		</TeamModeContext.Provider>
	);
}

export function useTeamMode(): TeamModeState {
	const context = React.useContext(TeamModeContext);
	if (!context)
		throw new Error('useTeamMode must be used within TeamModeProvider');
	return context;
}
