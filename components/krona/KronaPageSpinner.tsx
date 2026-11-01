'use client';

import { Box, CircularProgress } from '@mui/joy';

/** Full-viewport centered spinner, independent of sidebars or AI dock padding. */
export default function KronaPageSpinner() {
	return (
		<Box
			role="status"
			aria-label="Loading"
			sx={{
				position: 'fixed',
				inset: 0,
				display: 'grid',
				placeItems: 'center',
				pointerEvents: 'none',
				zIndex: 20,
			}}
		>
			<CircularProgress />
		</Box>
	);
}
