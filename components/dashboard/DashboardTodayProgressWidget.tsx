'use client';

import * as React from 'react';
import { Box, IconButton, Tooltip, Typography } from '@mui/joy';
import { ClipboardList, Palmtree } from 'lucide-react';
import { usePomodoroStats } from '@/components/PomodoroContext';
import { useTodayTasksFinished } from '@/components/dashboard/useDashboardPerformance';
import { useDashboardData } from '@/components/dashboard/DashboardDataProvider';
import {
	DashboardWidgetHeader,
	DashboardWidgetShell,
} from '@/components/dashboard/DashboardWidgetChrome';
import DashboardTodaySummaryModal from '@/components/dashboard/DashboardTodaySummaryModal';
import DashboardWidgetEmpty from '@/components/dashboard/DashboardWidgetEmpty';
import {
	kronaSecondaryIconButtonSx,
	kronaWidgetMetricUnitSx,
	kronaWidgetMetricValueCompactSx,
} from '@/lib/kronaStyles';
import { TEMPLATE_TODAY_PROGRESS } from '@/lib/templateData';
import { secondsToDisplayHours } from '@/lib/taskTime';
import { useVacationMode } from '@/components/VacationModeContext';
import { VACATION_MODE_EMPTY_MESSAGE } from '@/lib/vacationMode';
import { useKronaLayoutMode } from '@/components/KronaLayoutModeProvider';
import { useMyTeamWork } from '@/hooks/useMyTeamWork';
import { useSelectedTimerTask } from '@/lib/selectedTimerTask';

function TodayProgressStat({
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
				gap: 1,
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

function TodayProgressDivider() {
	return (
		<Box
			sx={{
				width: '1px',
				height: 48,
				alignSelf: 'center',
				flexShrink: 0,
				background: 'var(--krona-divider-vertical)',
			}}
		/>
	);
}

export default function DashboardTodayProgressWidget() {
	const { isDesktopDashboard } = useKronaLayoutMode();
	const { active: vacationActive } = useVacationMode();
	const { todayTotal } = usePomodoroStats();
	const tasksFinished = useTodayTasksFinished();
	const { tasks } = useDashboardData();
	const teamWork = useMyTeamWork();
	const selectedTimerTask = useSelectedTimerTask();
	const [todaySummaryOpen, setTodaySummaryOpen] = React.useState(false);

	const safeToday =
		todayTotal && typeof todayTotal === 'object' && 'work' in todayTotal
			? todayTotal
			: { work: 0, rest: 0 };

	const showSample = safeToday.work === 0 && safeToday.rest === 0 && tasksFinished === 0;
	const displayProgress = showSample
		? TEMPLATE_TODAY_PROGRESS.employee
		: {
				workHoursLabel: secondsToDisplayHours(safeToday.work),
				restHoursLabel: secondsToDisplayHours(safeToday.rest),
				tasksFinished,
			};

	const summaryTasks = React.useMemo(() => {
		const names = new Map<string, string>();
		for (const task of tasks) names.set(task.id, task.name);
		for (const task of teamWork.tasks) names.set(task.id, task.name);
		if (selectedTimerTask.taskId && selectedTimerTask.taskName) {
			names.set(selectedTimerTask.taskId, selectedTimerTask.taskName);
		}
		return [...names.entries()].map(([id, name]) => ({ id, name }));
	}, [selectedTimerTask.taskId, selectedTimerTask.taskName, tasks, teamWork.tasks]);

	return (
		<>
			<DashboardWidgetShell
				id="work-hours"
				sx={{
					minHeight: 0,
					height: isDesktopDashboard ? '100%' : 'auto',
					display: 'flex',
					flexDirection: 'column',
					justifyContent: 'center',
					pb: '24px',
				}}
			>
				<DashboardWidgetHeader
					widgetId="work-hours"
					title="Today's Progress"
					actions={
						vacationActive ? null : showSample ? (
							<Typography level="body-xs" sx={{ color: 'var(--krona-text-muted)' }}>
								Sample
							</Typography>
						) : (
							<Tooltip title="Today summary">
								<IconButton
									size="sm"
									aria-label="Open today summary"
									onClick={() => setTodaySummaryOpen(true)}
									sx={kronaSecondaryIconButtonSx}
								>
									<ClipboardList size={18} />
								</IconButton>
							</Tooltip>
						)
					}
				/>

				{vacationActive ? (
					<DashboardWidgetEmpty icon={Palmtree}>
						{VACATION_MODE_EMPTY_MESSAGE}
					</DashboardWidgetEmpty>
				) : (
					<Box
						sx={{
							flex: 1,
							display: 'flex',
							alignItems: 'center',
							gap: { xs: 1.5, md: 2.5 },
							minHeight: 0,
						}}
					>
						<TodayProgressStat label="Time worked" value={displayProgress.workHoursLabel} unit="hrs" />
						<TodayProgressDivider />
						<TodayProgressStat label="Hours rested" value={displayProgress.restHoursLabel} unit="hrs" />
						<TodayProgressDivider />
						<TodayProgressStat
							label="Tasks finished"
							value={String(displayProgress.tasksFinished)}
						/>
					</Box>
				)}
			</DashboardWidgetShell>
			<DashboardTodaySummaryModal
				open={todaySummaryOpen}
				onClose={() => setTodaySummaryOpen(false)}
				tasks={summaryTasks}
			/>
		</>
	);
}
