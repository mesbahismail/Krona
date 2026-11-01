'use client';

import * as React from 'react';
import { Box } from '@mui/joy';
import { BarChart3, Palmtree } from 'lucide-react';
import {
	Bar,
	BarChart,
	CartesianGrid,
	ResponsiveContainer,
	XAxis,
	YAxis,
} from 'recharts';
import { useVacationMode } from '@/components/VacationModeContext';
import { VACATION_MODE_EMPTY_MESSAGE } from '@/lib/vacationMode';
import { usePomodoroStats } from '@/components/PomodoroContext';
import DashboardWidgetEmpty from '@/components/dashboard/DashboardWidgetEmpty';
import {
	DashboardWidgetHeader,
	DashboardWidgetShell,
} from '@/components/dashboard/DashboardWidgetChrome';
import { formatDecimalHours } from '@/lib/taskTime';
import { readInProgressWorkSeconds } from '@/lib/sessionSync';
import { useKronaLayoutMode } from '@/components/KronaLayoutModeProvider';

export default function DashboardPerformanceWidget() {
	const { isDesktopDashboard, isTabletDashboard } = useKronaLayoutMode();
	const { active: vacationActive } = useVacationMode();
	const { last7Days } = usePomodoroStats();
	const gradientId = `performance-${React.useId().replace(/:/g, '')}`;
	const data = React.useMemo(() => {
		const inProgress = readInProgressWorkSeconds();
		return (Array.isArray(last7Days) ? last7Days : [])
			.map((day, index) => ({
				key: day.key,
				day: day.date.toLocaleDateString('en-US', { weekday: 'short' }),
				hours: Math.max(0, (day.work + (index === 0 ? inProgress : 0)) / 3600),
			}))
			.sort((a, b) => a.key.localeCompare(b.key));
	}, [last7Days]);
	const hasData = data.some((day) => day.hours > 0);

	return (
		<DashboardWidgetShell
			id="performance"
			sx={{
				...(isTabletDashboard ? { gridColumn: '1 / -1' } : {}),
				minHeight: 0,
				height: isDesktopDashboard ? '100%' : 'auto',
				display: 'flex',
				flexDirection: 'column',
			}}
		>
			<DashboardWidgetHeader
				widgetId="performance"
				title="My performance"
				href="/performance"
			/>
			{vacationActive ? (
				<DashboardWidgetEmpty icon={Palmtree}>
					{VACATION_MODE_EMPTY_MESSAGE}
				</DashboardWidgetEmpty>
			) : hasData ? (
				<Box
					sx={{
						display: 'flex',
						flexDirection: 'column',
						flex: 1,
						minHeight: 0,
						width: '100%',
						gap: 0.5,
					}}
				>
					<Box
						role="img"
						aria-label="Daily focus hours over the last seven days"
						sx={{
							flex: 1,
							minHeight: isDesktopDashboard ? 80 : 150,
							width: '100%',
							minWidth: 0,
						}}
					>
						<ResponsiveContainer width="100%" height="100%" minHeight={80}>
							<BarChart
								data={data}
								margin={{ top: 12, right: 4, bottom: 0, left: 4 }}
								accessibilityLayer
							>
								<defs>
									<linearGradient
										id={`${gradientId}-fill`}
										x1="0%"
										y1="100%"
										x2="100%"
										y2="0%"
									>
										<stop offset="0%" stopColor="var(--krona-accent-stop-0)" />
										<stop
											offset="34%"
											stopColor="var(--krona-accent-stop-34)"
										/>
										<stop
											offset="68%"
											stopColor="var(--krona-accent-stop-68)"
										/>
										<stop
											offset="100%"
											stopColor="var(--krona-accent-stop-100)"
										/>
									</linearGradient>
								</defs>
								<CartesianGrid
									vertical={false}
									stroke="var(--krona-surface-border)"
									strokeDasharray="3 4"
								/>
								<XAxis
									dataKey="day"
									axisLine={false}
									tickLine={false}
									tick={{ fill: 'var(--krona-text-muted)', fontSize: 10 }}
									tickMargin={8}
									minTickGap={0}
									height={24}
								/>
								<YAxis
									domain={[0, 'auto']}
									axisLine={false}
									tickLine={false}
									tick={false}
									tickCount={3}
									width={0}
								/>
								<Bar
									dataKey="hours"
									fill={`url(#${gradientId}-fill)`}
									radius={[5, 5, 0, 0]}
									maxBarSize={26}
									isAnimationActive={false}
								/>
							</BarChart>
						</ResponsiveContainer>
					</Box>
					<table className="sr-only">
						<caption>Focus time in the last seven days</caption>
						<tbody>
							{data.map((day) => (
								<tr key={day.key}>
									<th scope="row">{day.key}</th>
									<td>{formatDecimalHours(day.hours)} hours</td>
								</tr>
							))}
						</tbody>
					</table>
				</Box>
			) : (
				<DashboardWidgetEmpty icon={BarChart3}>
					Track focus time to see your trends.
				</DashboardWidgetEmpty>
			)}
		</DashboardWidgetShell>
	);
}
