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
					background: 'linear-gradient(90deg, transparent 0%, color-mix(in srgb, var(--krona-text) 22%, transparent) 35%, color-mix(in srgb, var(--krona-text) 22%, transparent) 65%, transparent 100%)',
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
					background: 'linear-gradient(90deg, transparent 0%, color-mix(in srgb, var(--krona-text) 22%, transparent) 35%, color-mix(in srgb, var(--krona-text) 22%, transparent) 65%, transparent 100%)',
				}}
			/>
		</Box>
	);
}
