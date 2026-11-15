'use client';

import { KRONA_TITLE_FONT_WEIGHT } from '@/lib/kronaTypography';

import * as React from 'react';
import type { SxProps } from '@mui/joy/styles/types';
import NextLink from 'next/link';
import { Box, Skeleton, Typography } from '@mui/joy';
import {
	Area,
	AreaChart,
	CartesianGrid,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from 'recharts';
import { useKronaLayoutMode } from '@/components/KronaLayoutModeProvider';
import { useDashboardData } from './DashboardDataProvider';
import { useTeamMode } from '@/components/teams/TeamModeContext';
import {
	fetchPerformanceExtendedMetrics,
	type PerformanceActivityBucket,
} from '@/lib/performanceData';
import {
	kronaWidgetCardSx,
	kronaWidgetPaddingSx,
	kronaWidgetHeaderInsetSx,
} from '@/lib/kronaStyles';

/** Timer activity is a proxy for intensity, not a measurement of productivity. */
export default function DashboardPeakWorkWidget() {
	const { userId } = useDashboardData();
	const { isDesktopDashboard, isTabletDashboard } = useKronaLayoutMode();
	const { mode } = useTeamMode();
	const [buckets, setBuckets] = React.useState<PerformanceActivityBucket[]>([]);
	const [loading, setLoading] = React.useState(true);
	const [error, setError] = React.useState(false);
	const gradientId = React.useId().replace(/:/g, '');

	React.useEffect(() => {
		if (!userId || mode !== 'individual') return;
		let cancelled = false;
		let request = 0;
		setLoading(true);
		const refresh = async () => {
			const current = ++request;
			try {
				const result = await fetchPerformanceExtendedMetrics('week', userId);
				if (cancelled || current !== request) return;
				setBuckets(result.activityByHour);
				setError(false);
			} catch {
				if (!cancelled && current === request) setError(true);
			} finally {
				if (!cancelled && current === request) setLoading(false);
			}
		};
		void refresh();
		window.addEventListener('krona:sessions-updated', refresh);
		window.addEventListener('focus', refresh);
		const interval = window.setInterval(refresh, 60000);
		return () => {
			cancelled = true;
			window.clearInterval(interval);
			window.removeEventListener('krona:sessions-updated', refresh);
			window.removeEventListener('focus', refresh);
		};
	}, [userId, mode]);

	if (mode !== 'individual') return null;
	const data = buckets.map((bucket) => ({
		time: bucket.label,
		minutes: Math.round(bucket.workHours * 60 * 10) / 10,
	}));
	const peak = data.reduce<(typeof data)[number] | null>(
		(best, point) => (point.minutes > (best?.minutes ?? 0) ? point : best),
		null,
	);
	const peakEnd = peak
		? `${String((Number(peak.time.slice(0, 2)) + 2) % 24).padStart(2, '0')}:00`
		: '';
	return (
		<Box
			component="section"
			className="krona-dashboard-widget"
			aria-label="Peak work"
			sx={
				[
					kronaWidgetCardSx,
					kronaWidgetPaddingSx,
					{
						gridColumn: isDesktopDashboard
							? '1 / 3'
							: isTabletDashboard
								? '1 / -1'
								: '1',
						gridRow: isDesktopDashboard ? '3' : 'auto',
						order: isDesktopDashboard ? 'unset' : 2.5,
						minWidth: 0,
						minHeight: 0,
						height: isDesktopDashboard ? '100%' : 240,
						display: 'flex',
						flexDirection: 'column',
					},
				] as SxProps
			}
		>
			<Box
				sx={{
					...kronaWidgetHeaderInsetSx,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
					gap: 1,
					mb: 1,
					flexShrink: 0,
				}}
			>
				<Box
					component={NextLink}
					href="/performance"
					aria-label="View weekly performance"
					sx={{
						display: 'inline-flex',
						alignItems: 'center',
						gap: 0.75,
						color: 'var(--krona-text)',
						textDecoration: 'none',
						borderRadius: '14px',
						px: 0.5,
						mx: -0.5,
						'&:hover': { background: 'var(--krona-secondary-bg)' },
						minWidth: 0,
					}}
				>
					<Typography
						level="title-md"
						sx={{
							color: 'inherit',
							fontSize: 14,
							fontWeight: KRONA_TITLE_FONT_WEIGHT,
							whiteSpace: 'nowrap',
						}}
					>
						Peak work
					</Typography>
				</Box>
			</Box>
			{loading ? (
				<Skeleton
					variant="rectangular"
					sx={{ flex: 1, minHeight: 0, borderRadius: 12 }}
				/>
			) : error ? (
				<Typography role="status" level="body-sm" sx={{ my: 'auto' }}>
					Could not load activity. Retrying automatically.
				</Typography>
			) : (
				<Box
					role="img"
					aria-label={
						peak
							? `Tracked work by time of day. Peak ${peak.time} to ${peakEnd}, ${peak.minutes} minutes per day on average over the last seven days.`
							: 'No tracked work in this period.'
					}
					sx={{ flex: 1, minHeight: 0, minWidth: 0 }}
				>
					<ResponsiveContainer width="100%" height="100%">
						<AreaChart
							data={data}
							margin={{ top: 12, right: 12, bottom: 0, left: -15 }}
							accessibilityLayer
						>
							<defs>
								<linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
									<stop
										offset="0%"
										stopColor="var(--krona-accent)"
										stopOpacity={0.5}
									/>
									<stop
										offset="100%"
										stopColor="var(--krona-accent)"
										stopOpacity={0.02}
									/>
								</linearGradient>
							</defs>
							<CartesianGrid
								vertical={false}
								stroke="var(--krona-surface-border)"
								strokeDasharray="4 6"
							/>
							<XAxis
								dataKey="time"
								tick={{ fill: 'var(--krona-text-muted)', fontSize: 11 }}
								axisLine={false}
								tickLine={false}
								minTickGap={28}
							/>
							<YAxis
								tick={{ fill: 'var(--krona-text-muted)', fontSize: 10 }}
								tickFormatter={(value) => `${value}m`}
								axisLine={false}
								tickLine={false}
								domain={[
									0,
									(max: number) => Math.max(30, Math.ceil(max / 30) * 30),
								]}
							/>
							<Tooltip
								contentStyle={{
									background: 'var(--krona-surface-bg)',
									border: '1px solid var(--krona-surface-border)',
									borderRadius: 14,
									color: 'var(--krona-text)',
									fontSize: 11,
								}}
								formatter={(value: number) => [
									`${value} min`,
									'Daily average (last 7 days)',
								]}
							/>
							<Area
								type="monotone"
								dataKey="minutes"
								stroke="var(--krona-accent)"
								strokeWidth={3}
								fill={`url(#${gradientId})`}
								isAnimationActive={false}
							/>
						</AreaChart>
					</ResponsiveContainer>
				</Box>
			)}
		</Box>
	);
}
