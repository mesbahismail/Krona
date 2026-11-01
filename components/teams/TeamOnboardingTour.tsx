'use client';

import DashboardOnboardingTour from '@/components/dashboard/DashboardOnboardingTour';
import {
	markTeamOnboardingDone,
	shouldLaunchTeamOnboarding,
	TEAM_ONBOARDING_STEPS,
} from '@/lib/onboarding';

/** Get-started guide for Team Mode after team setup or join. */
export default function TeamOnboardingTour() {
	return (
		<DashboardOnboardingTour
			steps={TEAM_ONBOARDING_STEPS}
			shouldLaunch={shouldLaunchTeamOnboarding}
			onMarkDone={markTeamOnboardingDone}
		/>
	);
}
