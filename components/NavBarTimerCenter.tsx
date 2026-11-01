'use client';

import * as React from 'react';
import { Box } from '@mui/joy';
import type { SxProps } from '@mui/joy/styles/types';

type NavBarTimerCenterProps = {
	children: React.ReactNode;
	sx?: SxProps;
	'data-tour'?: string;
};

/**
 * Centers the timer cluster in the middle column of the top bar grid.
 */
export default function NavBarTimerCenter({
	children,
	sx,
	'data-tour': dataTour,
}: NavBarTimerCenterProps) {
	return (
		<Box
			data-tour={dataTour}
			sx={{
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				minWidth: 0,
				/* Let clicks pass through empty center chrome so left/right
				   controls (especially Back) are never blocked. */
				pointerEvents: 'none',
				zIndex: 1,
				...sx,
				'& > *': {
					pointerEvents: 'auto',
				},
			}}
		>
			{children}
		</Box>
	);
}
