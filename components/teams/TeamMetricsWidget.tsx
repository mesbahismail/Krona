'use client';

import * as React from 'react';
import { Box, Typography } from '@mui/joy';
import { BarChart3 } from 'lucide-react';
import DashboardWidgetEmpty from '@/components/dashboard/DashboardWidgetEmpty';
import {
	TeamWidgetHeader,
	TeamWidgetShell,
} from '@/components/teams/TeamWidgetChrome';
import { useKronaLayoutMode } from '@/components/KronaLayoutModeProvider';
import type { TeamPerformanceSummary } from '@/lib/teams/dashboard';
import {
	kronaWidgetMetricUnitSx,
	kronaWidgetMetricValueSx,
} from '@/lib/kronaStyles';

/** Compact right-column widget — mirrors individual “My performance”. */
export default function TeamMetricsWidget({
	summary,
	loading,
}: {
	summary: TeamPerformanceSummary | null;
	loading?: boolean;
}) {
	const { isDesktopDashboard } = useKronaLayoutMode();
	const hasData =
		summary != null && (summary.tasksDone > 0 || summary.tasksPending > 0);

	return (
		<TeamWidgetShell
			sx={{
				height: isDesktopDashboard ? '100%' : 'auto',
			}}
		>
			<TeamWidgetHeader
				title="Team performance"
				href="/team/performance"
				navHint="All performance"
			/>
			<Box
				sx={{
					flex: 1,
					minHeight: 0,
					display: 'flex',
					flexDirection: 'column',
					justifyContent: 'center',
					alignItems: 'center',
					textAlign: 'center',
				}}
			>
				{loading && !summary ? (
					<Typography level="body-sm" sx={{ color: 'var(--krona-text-muted)' }}>
						Loading…
					</Typography>
				) : hasData && summary ? (
					<Box
						sx={{
							display: 'flex',
							flexDirection: 'column',
							alignItems: 'center',
							gap: 1,
						}}
					>
						<Typography
							level="h2"
							sx={{
								...kronaWidgetMetricValueSx,
								whiteSpace: 'nowrap',
							}}
						>
							{summary.completionRate}
							<Typography component="span" sx={kronaWidgetMetricUnitSx}>
								%
							</Typography>
						</Typography>
						<Typography level="body-sm" sx={{ color: 'var(--krona-text-muted)' }}>
							Task completion · {summary.tasksDone} done /{' '}
							{summary.tasksPending} open
						</Typography>
					</Box>
				) : (
					<DashboardWidgetEmpty icon={BarChart3}>
						Assign tasks to see team completion.
					</DashboardWidgetEmpty>
				)}
			</Box>
		</TeamWidgetShell>
	);
}
