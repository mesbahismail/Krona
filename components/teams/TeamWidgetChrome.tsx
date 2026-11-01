'use client';

import * as React from 'react';
import NextLink from 'next/link';
import { Box, Typography } from '@mui/joy';
import type { SxProps } from '@mui/joy/styles/types';
import { ArrowUpRight } from 'lucide-react';
import {
	kronaTitleSx,
	kronaWidgetCardSx,
	kronaWidgetNavHintRevealSx,
	kronaWidgetNavHintSx,
	kronaWidgetPaddingSx,
} from '@/lib/kronaStyles';

export function TeamWidgetShell({
	children,
	sx,
}: {
	children: React.ReactNode;
	sx?: SxProps;
}) {
	return (
		<Box
			className="krona-dashboard-widget"
			sx={
				[
					kronaWidgetCardSx,
					kronaWidgetPaddingSx,
					{
						minHeight: 0,
						height: '100%',
						display: 'flex',
						flexDirection: 'column',
						'&:hover .krona-widget-nav-hint, &:focus-within .krona-widget-nav-hint':
							kronaWidgetNavHintRevealSx,
					},
					...(sx ? [sx] : []),
				] as SxProps
			}
		>
			{children}
		</Box>
	);
}

export function TeamWidgetHeader({
	title,
	href,
	navHint = 'View all',
	actions,
}: {
	title: string;
	href?: string;
	navHint?: string;
	actions?: React.ReactNode;
}) {
	const titleNode = (
		<Typography
			level="title-md"
			component={href ? 'span' : 'div'}
			sx={{
				...kronaTitleSx,
				fontSize: '16px',
				color: 'var(--krona-text)',
				fontFamily: 'Poppins, sans-serif',
				lineHeight: 1.2,
				minWidth: 0,
				overflow: 'hidden',
				textOverflow: 'ellipsis',
				whiteSpace: 'nowrap',
				...(href
					? {
							cursor: 'pointer',
						}
					: {}),
			}}
		>
			{title}
		</Typography>
	);

	return (
		<Box
			sx={{
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'space-between',
				mb: 'calc(20px - (var(--krona-control-height, 32px) - 19.2px) / 2)',
				gap: 1,
				flexShrink: 0,
				minWidth: 0,
			}}
		>
			<Box sx={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
				{href ? (
					<Box
						component={NextLink}
						href={href}
						sx={{
							display: 'inline-flex',
							alignItems: 'center',
							gap: 0,
							minWidth: 0,
							maxWidth: '100%',
							textDecoration: 'none',
							color: 'inherit',
						}}
					>
						{titleNode}
						<Box className="krona-widget-nav-hint" sx={kronaWidgetNavHintSx}>
							<Typography level="body-xs" className="krona-widget-nav-hint-label">
								{navHint}
							</Typography>
							<ArrowUpRight
								className="krona-widget-nav-arrow"
								size={16}
								aria-hidden
							/>
						</Box>
					</Box>
				) : (
					titleNode
				)}
			</Box>
			{actions ? (
				<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
					{actions}
				</Box>
			) : null}
		</Box>
	);
}
