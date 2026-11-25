'use client';

import { KRONA_TITLE_FONT_WEIGHT } from '@/lib/kronaTypography';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Typography, Table, LinearProgress } from '@mui/joy';
import { buildAnalyticsSummary } from '@/lib/analyticsSummary';
import type {
	PerformanceMetrics,
	PerformancePeriodKey,
	TeamPerformanceChartMember,
} from '@/lib/performanceData';
import { kronaWidgetCardSx, kronaPerformanceWidgetPaddingSx } from '@/lib/kronaStyles';
import { formatDecimalHours } from '@/lib/taskTime';

const card = [
	kronaWidgetCardSx,
	kronaPerformanceWidgetPaddingSx,
	{ minWidth: 0 },
] as SxProps;
const muted = { color: 'var(--krona-text-muted)' };
const title = {
	color: 'var(--krona-text)',
	fontSize: 14,
	fontWeight: KRONA_TITLE_FONT_WEIGHT,
	mb: 1,
};
const tableStyle = {
	'--TableCell-headBackground': 'transparent',
	'--TableCell-borderColor': 'var(--krona-surface-border)',
	color: 'var(--krona-text)',
	'& th': { color: 'var(--krona-text-muted)', fontWeight: 500 },
	'& td, & th': { px: 1, py: 1.5, fontSize: 11, overflowWrap: 'anywhere' },
	'& td:first-child, & th:first-child': { pl: 0 },
	'& td:last-child, & th:last-child': { pr: 0 },
	'& td:not(:first-child), & th:not(:first-child)': { textAlign: 'right' },
};

export default function AnalyticsDetails({
	metrics,
	period,
	members,
}: {
	metrics: PerformanceMetrics;
	period: PerformancePeriodKey;
	members?: TeamPerformanceChartMember[];
}) {
	const summary = buildAnalyticsSummary(metrics, members);
	const team = members !== undefined;
	const bucketLabel = team && period === 'today' ? 'members'
		: period === 'quarter' || period === 'year' ? 'months' : 'days';
	const comparisons = [
		{ label: 'Work time', hours: metrics.totalWorkHours, change: metrics.trendWork },
		{ label: 'Break time', hours: metrics.totalRestHours, change: metrics.trendRest },
		{ label: 'Daily work average', hours: metrics.avgDailyWorkHours, change: metrics.trendAvgDaily },
		{ label: 'Daily break average', hours: metrics.avgDailyRestHours, change: metrics.trendAvgDailyRest },
	];
	const cards = [
		{
			label: 'Tracked time',
			value: `${formatDecimalHours(summary.trackedHours)}h`,
			detail: 'Work and breaks combined',
		},
		{
			label: 'Work / break balance',
			value: summary.trackedHours
				? `${summary.workShare}% / ${100 - summary.workShare}%`
				: '—',
			detail: 'Share of recorded timer activity',
		},
		{
			label: 'Projects worked on',
			value: String(summary.projectCount),
			detail: 'Projects with tracked task time',
		},
		{
			label: team ? 'Team tasks worked on' : 'Tasks worked on',
			value: String(summary.taskCount),
			detail: `${formatDecimalHours(summary.taskHours)}h assigned to tasks`,
		},
		{
			label: `Active ${bucketLabel}`,
			value: `${summary.activeBuckets} / ${summary.totalBuckets}`,
			detail: `${bucketLabel[0].toUpperCase() + bucketLabel.slice(1)} with recorded work`,
		},
		{
			label: 'Average time per task',
			value: summary.taskCount ? `${formatDecimalHours(summary.averageTaskHours)}h` : '—',
			detail: 'Across tasks with tracked time',
		},
		{
			label: team && period === 'today' ? 'Most recorded work' : 'Busiest period',
			value: summary.busiestBucket?.label ?? '—',
			detail: summary.busiestBucket ? `${formatDecimalHours(summary.busiestBucket.workHours)}h of work recorded` : 'No work recorded in this period',
		},
		{
			label: 'Breaks per work hour',
			value: summary.breakMinutesPerWorkHour === null ? '—' : `${Math.round(summary.breakMinutesPerWorkHour)}m`,
			detail: 'Recorded break minutes for each work hour',
		},
	];
	return (
		<Box sx={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
			<Box
				sx={{
					display: 'grid',
					gridTemplateColumns: {
						xs: '1fr',
						sm: 'repeat(2, minmax(0, 1fr))',
						lg: 'repeat(4, minmax(0, 1fr))',
					},
					gap: '24px',
				}}
			>
				{cards.map((item) => (
					<Box key={item.label} sx={card}>
						<Typography level="body-sm" sx={muted}>
							{item.label}
						</Typography>
						<Typography
							level="h3"
							sx={{
								color: 'var(--krona-text)',
								my: 1.5,
								fontSize: { xs: 22, lg: 25 },
								overflowWrap: 'anywhere',
							}}
						>
							{item.value}
						</Typography>
						<Typography level="body-xs" sx={muted}>
							{item.detail}
						</Typography>
					</Box>
				))}
			</Box>
			<Box
				sx={{
					display: 'grid',
					gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
					gap: '24px',
				}}
			>
				<Box
					component="section"
					aria-label={team ? 'Team task allocation' : 'Project breakdown'}
					sx={card}
				>
					<Typography level="title-md" sx={title}>
						{team ? 'Team task allocation' : 'Project breakdown'}
					</Typography>
					<Typography level="body-xs" sx={{ ...muted, mb: 2 }}>
						{team
							? 'Recorded task hours by member for the selected period.'
							: 'Where your task time went during this period.'}
					</Typography>
					{team ? (
						<Table aria-label="Team task allocation" sx={tableStyle}>
							<thead>
								<tr>
									<th style={{ width: '40%' }}>Member</th>
									<th>Tasks</th>
									<th>Hours</th>
									<th>Share</th>
								</tr>
							</thead>
							<tbody>
								{summary.contributors.map((person) => (
									<tr key={person.id}>
										<td style={{ overflowWrap: 'anywhere' }}>{person.name}</td>
										<td>{person.tasks}</td>
										<td>{formatDecimalHours(person.hours)}h</td>
										<td>{Math.round(person.share)}%</td>
									</tr>
								))}
							</tbody>
						</Table>
					) : (
						summary.projects.map(([name, hours]) => (
							<Box key={name} sx={{ mb: 2.5 }}>
								<Box
									sx={{
										display: 'flex',
										justifyContent: 'space-between',
										gap: 2,
										mb: 1,
									}}
								>
									<Typography
										level="body-sm"
										sx={{
											color: 'var(--krona-text)',
											overflowWrap: 'anywhere',
										}}
									>
										{name}
									</Typography>
									<Typography
										level="body-xs"
										sx={{ ...muted, whiteSpace: 'nowrap' }}
									>
										{formatDecimalHours(hours)}h ·{' '}
										{summary.taskHours
											? Math.round((hours / summary.taskHours) * 100)
											: 0}
										%
									</Typography>
								</Box>
								<LinearProgress
									determinate
									value={
										summary.taskHours ? (hours / summary.taskHours) * 100 : 0
									}
									sx={{
										'--LinearProgress-radius': '8px',
										'--LinearProgress-thickness': '7px',
										backgroundColor: 'var(--krona-secondary-bg)',
										'&::before': {
											background: 'linear-gradient(100deg, #633bff, #00b8d8)',
										},
									}}
								/>
							</Box>
						))
					)}
					{summary.taskCount === 0 && (
						<Typography level="body-sm" sx={{ ...muted, py: 3 }}>
							No task activity in this period. Select a task before starting
							your timer to see its breakdown here.
						</Typography>
					)}
					{team && (
						<Typography level="body-xs" sx={{ ...muted, mt: 2 }}>
							Task time only. Hours show recorded activity, not a productivity
							ranking.
						</Typography>
					)}
				</Box>
				<Box component="section" aria-label="Period breakdown" sx={card}>
					<Typography level="title-md" sx={title}>
						Period breakdown
					</Typography>
					<Typography level="body-xs" sx={{ ...muted, mb: 2 }}>
						{team && period === 'today'
							? 'Today’s recorded time for each selected member.'
							: 'Work, breaks and total recorded time at a glance.'}
					</Typography>
					<Box sx={{ maxHeight: 340, overflowY: 'auto' }}>
						<Table aria-label="Period work and break totals" sx={tableStyle}>
							<thead>
								<tr>
									<th style={{ width: '34%' }}>
										{team && period === 'today'
											? 'Member'
											: period === 'quarter' || period === 'year'
												? 'Month'
												: 'Day'}
									</th>
									<th>Work</th>
									<th>Breaks</th>
									<th>Total</th>
								</tr>
							</thead>
							<tbody>
								{metrics.chartDays.map((day, index) => (
									<tr key={`${day.label}-${index}`}>
										<td>{day.label}</td>
										<td>{formatDecimalHours(day.workHours)}h</td>
										<td>{formatDecimalHours(day.restHours)}h</td>
										<td>
											{formatDecimalHours(day.workHours + day.restHours)}h
										</td>
									</tr>
								))}
							</tbody>
						</Table>
					</Box>
				</Box>
			</Box>
			<Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' }, gap: '24px' }}>
				<Box component="section" aria-label="Time-of-day breakdown" sx={card}>
					<Typography level="title-md" sx={title}>Time-of-day breakdown</Typography>
					<Typography level="body-xs" sx={{ ...muted, mb: 2 }}>
						Daily averages for the selected period{team ? ', summed across selected members' : ''}.
					</Typography>
					<Table aria-label="Daily average work and breaks by time of day" sx={tableStyle}>
						<thead><tr><th style={{ width: '40%' }}>Time of day</th><th>Work</th><th>Breaks</th><th>Work share</th></tr></thead>
						<tbody>{summary.dayParts.map((part) => (
							<tr key={part.label}>
								<td>{part.label}<Typography level="body-xs" sx={muted}>{part.range}</Typography></td>
								<td>{formatDecimalHours(part.workHours)}h</td>
								<td>{formatDecimalHours(part.restHours)}h</td>
								<td>{Math.round(part.share)}%</td>
							</tr>
						))}</tbody>
					</Table>
				</Box>
				<Box component="section" aria-label="Period comparison" sx={card}>
					<Typography level="title-md" sx={title}>Period comparison</Typography>
					<Typography level="body-xs" sx={{ ...muted, mb: 2 }}>
						Change against the previous comparable period. A dash means no comparison is available.
					</Typography>
					<Table aria-label="Current metrics and change from previous period" sx={tableStyle}>
						<thead><tr><th style={{ width: '48%' }}>Metric</th><th>Current</th><th>Change</th></tr></thead>
						<tbody>{comparisons.map((item) => (
							<tr key={item.label}>
								<td>{item.label}</td>
								<td>{formatDecimalHours(item.hours)}h</td>
								<td>{item.change === null ? '—' : `${item.change > 0 ? '+' : ''}${Math.round(item.change)}%`}</td>
							</tr>
						))}</tbody>
					</Table>
				</Box>
			</Box>
		</Box>
	);
}
