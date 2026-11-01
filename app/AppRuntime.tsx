'use client';

import type { ReactNode } from 'react';
import AppNavigationShell from '@/components/AppNavigationShell';
import { PomodoroProvider } from '@/components/PomodoroContext';
import { VacationModeProvider } from '@/components/VacationModeContext';
import MotivationalWins from '@/components/MotivationalWins';
import DocumentTitleTimer from '@/components/DocumentTitleTimer';
import NotificationAlerts from '@/components/NotificationAlerts';
import KronaThemeSync from '@/components/KronaThemeSync';
import { ChallengesSyncProvider } from '@/components/challenges/ChallengesSyncContext';
import { TeamModeProvider } from '@/components/teams/TeamModeContext';
import { TeamActivityProvider } from '@/components/teams/TeamActivityProvider';
import TeamActivityScanner from '@/components/teams/TeamActivityScanner';
import TeamModeRouteSync from '@/components/teams/TeamModeRouteSync';
import TeamTimerPresenceSync from '@/components/teams/TeamTimerPresenceSync';

/** App-wide providers and side-effect hosts (timer, team mode, activity). */
export default function AppRuntime({ children }: { children: ReactNode }) {
	return (
		<VacationModeProvider>
			<PomodoroProvider>
				<DocumentTitleTimer />
				<KronaThemeSync />
				<ChallengesSyncProvider>
					<TeamModeProvider>
						<TeamActivityProvider>
							<NotificationAlerts />
							<TeamActivityScanner />
							<TeamModeRouteSync />
							<TeamTimerPresenceSync />
							<AppNavigationShell>{children}</AppNavigationShell>
							<MotivationalWins />
						</TeamActivityProvider>
					</TeamModeProvider>
				</ChallengesSyncProvider>
			</PomodoroProvider>
		</VacationModeProvider>
	);
}
