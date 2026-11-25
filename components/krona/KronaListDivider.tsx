'use client';

import { Box, Typography } from '@mui/joy';

/** Labeled horizontal rule (dashboard tasks “Done”, projects pending/done sections). */
export default function KronaListDivider({
	label,
	compact = false,
}: {
	label: string;
	compact?: boolean;
}) {
	return (
		<Box
			sx={{
				display: 'flex',
				alignItems: 'center',
				gap: 1.5,
				py: compact ? 1.25 : 1.75,
				flexShrink: 0,
			}}
		>
			<Box
				sx={{
					flex: 1,
					height: '1px',
					background: 'var(--krona-divider-horizontal)',
				}}
			/>
			<Typography
				level="body-xs"
				sx={{
					color: 'var(--krona-text-muted)',
					fontWeight: 600,
					flexShrink: 0,
					textTransform: 'uppercase',
					letterSpacing: '0.06em',
				}}
			>
				{label}
			</Typography>
			<Box
				sx={{
					flex: 1,
					height: '1px',
					background: 'var(--krona-divider-horizontal)',
				}}
			/>
		</Box>
	);
}
