'use client';

import * as React from 'react';
import { Box, Typography } from '@mui/joy';
import type { LucideIcon } from 'lucide-react';

export default function DashboardWidgetEmpty({
	icon: Icon,
	children,
}: {
	icon: LucideIcon;
	children: React.ReactNode;
}) {
	return (
		<Box
			sx={{
				flex: 1,
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				justifyContent: 'center',
				textAlign: 'center',
				gap: 1.5,
				py: 1,
				minHeight: 0,
			}}
		>
			{/* Short widgets must clip the copy, not squash the icon. */}
			<Box sx={{ display: 'flex', flexShrink: 0, lineHeight: 0 }}>
				<Icon
					size={40}
					strokeWidth={1.25}
					color="var(--krona-text)"
					style={{ opacity: 0.48 }}
					aria-hidden
				/>
			</Box>
			<Typography
				level="body-sm"
				sx={{
					color: 'var(--krona-text-muted)',
					maxWidth: 240,
					display: '-webkit-box',
					WebkitLineClamp: 2,
					WebkitBoxOrient: 'vertical',
					overflow: 'hidden',
				}}
			>
				{children}
			</Typography>
		</Box>
	);
}
