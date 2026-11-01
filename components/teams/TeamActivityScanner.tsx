'use client';

import * as React from 'react';
import { useAppRuntimeActive } from '@/app/AppRuntimeActiveContext';
import { useTeamMode } from '@/components/teams/TeamModeContext';
import { useTeamActivity } from '@/components/teams/TeamActivityProvider';
import {
	scanTeamManagerActivity,
	scanTeamMemberActivity,
} from '@/lib/teams/activityScan';
import { localData } from '@/lib/localData';

/** Runs activity scans for managers (org-wide) and all members (personal). */
export default function TeamActivityScanner() {
	const runtimeActive = useAppRuntimeActive();
	const { organization, isManager, mode, hasTeam } = useTeamMode();
	const { refresh } = useTeamActivity();

	React.useEffect(() => {
		if (!runtimeActive || !hasTeam || !organization) {
			return;
		}

		let cancelled = false;
		const run = async () => {
			const { data } = await localData.auth.getUser();
			const uid = data.user?.id;
			if (!uid || cancelled) return;

			let n = await scanTeamMemberActivity({
				organizationId: organization.id,
				userId: uid,
			});
			if (isManager && mode === 'team') {
				n += await scanTeamManagerActivity({
					organizationId: organization.id,
					actorUserId: uid,
				});
			}
			if (!cancelled && n > 0) await refresh();
		};

		void run();
		const id = window.setInterval(() => void run(), 5 * 60_000);
		return () => {
			cancelled = true;
			window.clearInterval(id);
		};
	}, [runtimeActive, hasTeam, isManager, mode, organization, refresh]);

	return null;
}
