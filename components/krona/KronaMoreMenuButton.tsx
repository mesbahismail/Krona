'use client';

import * as React from 'react';
import { IconButton } from '@mui/joy';
import type { SxProps } from '@mui/joy/styles/types';
import { MoreHorizontal } from 'lucide-react';
import { kronaMoreIconButtonSx } from '@/lib/kronaStyles';

/** Universal overflow (⋯) control — 64% default, 100% on hover. */
const KronaMoreMenuButton = React.forwardRef<
	HTMLButtonElement,
	React.ComponentProps<typeof IconButton> & { iconSize?: number }
>(function KronaMoreMenuButton({ iconSize = 18, sx, ...props }, ref) {
	const mergedSx: SxProps = [
		kronaMoreIconButtonSx,
		...(sx ? (Array.isArray(sx) ? sx : [sx]) : []),
	];

	return (
		<IconButton ref={ref} size="sm" variant="plain" sx={mergedSx} {...props}>
			<MoreHorizontal size={iconSize} aria-hidden />
		</IconButton>
	);
});

export default KronaMoreMenuButton;
