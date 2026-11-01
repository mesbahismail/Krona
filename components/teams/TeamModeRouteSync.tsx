'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTeamMode } from '@/components/teams/TeamModeContext';
import { hasTeamTourPending, readTeamOnboardingDone } from '@/lib/onboarding';

/**
 * Employees remain in Individual view. Owners/managers may switch workspaces.
 */
export default function TeamModeRouteSync() {
	const { loading, hasTeam, isManager, mode } = useTeamMode();
	const pathname = usePathname();
	const router = useRouter();

	React.useEffect(() => {
		if (loading || !hasTeam) return;

		const onTeamRoute =
			pathname === '/team' || pathname.startsWith('/team/');
		const onPersonalHome = pathname === '/';

		if (!isManager) {
			if (onTeamRoute) router.replace('/');
			return;
		}

		if (mode === 'individual') {
			if (onTeamRoute) {
				router.replace('/');
			}
			return;
		}

		// Team Mode: personal home → team shell.
		if (!onTeamRoute && onPersonalHome) {
			const keepOnboarding =
				typeof window !== 'undefined' &&
				new URLSearchParams(window.location.search).get('onboarding') === '1' &&
				!readTeamOnboardingDone() &&
				hasTeamTourPending();
			router.replace(keepOnboarding ? '/team?onboarding=1' : '/team');
		}
	}, [
		loading,
		hasTeam,
		isManager,
		mode,
		pathname,
		router,
	]);

	return null;
}
