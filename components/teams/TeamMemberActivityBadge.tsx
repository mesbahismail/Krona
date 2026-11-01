'use client';

import { Box } from '@mui/joy';
import { BriefcaseBusiness, Coffee } from 'lucide-react';
import type { TeamTimerPresenceMode } from '@/lib/teams/timerPresence';

export default function TeamMemberActivityBadge({
	mode,
}: {
	mode: TeamTimerPresenceMode | null | undefined;
}) {
	if (mode !== 'work' && mode !== 'rest') return null;
	const resting = mode === 'rest';
	return (
		<Box
			component="span"
			sx={{
				display: 'inline-flex',
				alignItems: 'center',
				gap: 0.4,
				flexShrink: 0,
				borderRadius: '999px',
				px: 0.85,
				py: 0.2,
				fontSize: 11,
				fontWeight: 600,
				lineHeight: 1.2,
				color: 'var(--krona-text)',
				border: resting
					? '1px solid var(--krona-surface-border)'
					: '1px solid color-mix(in srgb, var(--krona-accent) 40%, transparent)',
				bgcolor: resting
					? 'var(--krona-secondary-bg)'
					: 'color-mix(in srgb, var(--krona-accent) 16%, var(--krona-secondary-bg))',
			}}
		>
			{resting ? (
				<Coffee size={11} aria-hidden />
			) : (
				<BriefcaseBusiness size={11} aria-hidden />
			)}
			{resting ? 'Resting' : 'Working'}
		</Box>
	);
}
