'use client';

import * as React from 'react';
import {
	KRONA_WIN,
	type KronaWinKind,
} from '@/lib/kronaDataEvents';
import { maybeShowMotivationalWin } from '@/lib/kronaMotivation';
import { useTeamMode } from '@/components/teams/TeamModeContext';

/**
 * Listens for user wins (task done, project created, routine saved)
 * and shows up to 2 motivational toasts per day.
 */
export default function MotivationalWins() {
	const { mode: workspaceMode } = useTeamMode();

	React.useEffect(() => {
		if (workspaceMode === 'team') return;
		const onWin = (event: Event) => {
			const detail = (event as CustomEvent<{ kind?: KronaWinKind }>).detail;
			const kind = detail?.kind;
			if (
				kind !== 'task_done' &&
				kind !== 'project_created' &&
				kind !== 'routine_saved'
			) {
				return;
			}
			maybeShowMotivationalWin(kind);
		};
		window.addEventListener(KRONA_WIN, onWin);
		return () => window.removeEventListener(KRONA_WIN, onWin);
	}, [workspaceMode]);

	return null;
}
