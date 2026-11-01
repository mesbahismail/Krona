'use client';

import * as React from 'react';
import TeamAppShell from '@/components/teams/TeamAppShell';
import TeamMembersPage from '@/components/teams/TeamMembersPage';
import { MembersPageSkeleton } from '@/components/krona/KronaPageSkeletons';

function MembersFallback() {
	return (
		<TeamAppShell title="Team Members" fillViewport>
			<MembersPageSkeleton />
		</TeamAppShell>
	);
}

export default function TeamMembersRoute() {
	return (
		<React.Suspense fallback={<MembersFallback />}>
			<TeamMembersPage />
		</React.Suspense>
	);
}
