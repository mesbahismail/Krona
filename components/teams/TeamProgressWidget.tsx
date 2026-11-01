'use client';

import * as React from 'react';
import { Box, Typography } from '@mui/joy';
import {
	TeamWidgetHeader,
	TeamWidgetShell,
} from '@/components/teams/TeamWidgetChrome';
import { useKronaLayoutMode } from '@/components/KronaLayoutModeProvider';
import type { TeamTodayProgress } from '@/lib/teams/dashboard';
import {
	kronaWidgetMetricUnitSx,
	kronaWidgetMetricValueCompactSx,
} from '@/lib/kronaStyles';

function Stat({
	label,
	value,
	unit,
}: {
	label: string;
	value: string;
	unit?: string;
}) {
	return (
		<Box
			sx={{
				flex: 1,
				minWidth: 0,
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				justifyContent: 'center',
				gap: 0.75,
				textAlign: 'center',
			}}
		>
			<Typography
				level="h2"
				sx={{
					...kronaWidgetMetricValueCompactSx,
					whiteSpace: 'nowrap',
				}}
			>
				{value}
				{unit ? (
					<Typography component="span" sx={kronaWidgetMetricUnitSx}>
						{' '}
						{unit}
					</Typography>
				) : null}
			</Typography>
			<Typography level="body-sm" sx={{ color: 'var(--krona-text-muted)' }}>
				{label}
			</Typography>
		</Box>
	);
}

function Divider() {
	return (
		<Box
			sx={{
				width: '1px',
				height: 40,
				alignSelf: 'center',
				flexShrink: 0,
				bgcolor: 'var(--krona-surface-border)',
			}}
		/>
	);
}

export default function TeamProgressWidget({
	progress,
	loading,
}: {
	progress: TeamTodayProgress | null;
	loading?: boolean;
}) {
	const { isDesktopDashboard } = useKronaLayoutMode();

	return (
		<TeamWidgetShell
			sx={{
				height: isDesktopDashboard ? '100%' : 'auto',
				justifyContent: 'center',
			}}
		>
			<TeamWidgetHeader
				title="Today's progress"
				href="/team/performance"
				navHint="View performance"
			/>
			{!progress ? (
				<Typography level="body-sm" sx={{ color: 'var(--krona-text-muted)' }}>
					Loading…
				</Typography>
			) : (
				<Box
					sx={{
						flex: 1,
						display: 'flex',
						alignItems: 'center',
						gap: { xs: 1, md: 1.5 },
						minHeight: 0,
					}}
				>
					<Stat label="Time worked" value={progress.workHoursLabel} unit="hrs" />
					<Divider />
					<Stat label="Hours rested" value={progress.restHoursLabel} unit="hrs" />
					<Divider />
					<Stat
						label="Tasks finished"
						value={String(progress.tasksFinished)}
					/>
				</Box>
			)}
		</TeamWidgetShell>
	);
}
