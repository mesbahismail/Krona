'use client';

import * as React from 'react';
import Box from '@mui/joy/Box';
import Typography from '@mui/joy/Typography';
import Sheet from '@mui/joy/Sheet';
import Skeleton from '@mui/joy/Skeleton';
import Tooltip from '@mui/joy/Tooltip';
import Button from '@mui/joy/Button';
import NextLink from 'next/link';
import DashboardWidgetScrollArea from '@/components/dashboard/DashboardWidgetScrollArea';
import {
	kronaSkeletonSx,
	kronaTabBarSx,
	kronaTabButtonSx,
	kronaWidgetCardSx,
	kronaWidgetListScrollSx,
	kronaWidgetMetricValueSx,
	kronaPrimaryButtonSx,
} from '@/lib/kronaStyles';
import dayjs from 'dayjs';
import {
	ArrowDown,
	ArrowUp,
	Lightbulb,
	ListTodo,
} from 'lucide-react';
import {
	buildChartDaysFromTotals,
	chartBarCount,
	performancePeriodLabel,
	type PerformanceChartDay,
	type PerformanceActivityBucket,
	type PerformanceMetrics,
	type PerformancePeriodKey,
} from '@/lib/performanceData';
import { formatDecimalHours } from '@/lib/taskTime';

const performanceWidgetPaddingSx = {
	pt: '16px',
	px: { xs: '12px', md: '24px' },
	pb: '24px',
	boxSizing: 'border-box',
} as const;

type PeriodKey = PerformancePeriodKey;

const PERIOD_TABS: { key: PeriodKey; label: string }[] = [
	{ key: 'today', label: 'Today' },
	{ key: 'week', label: 'Week' },
	{ key: 'month', label: 'Month' },
	{ key: 'quarter', label: 'Quarterly' },
	{ key: 'year', label: 'Yearly' },
];

const DEFAULT_PERIODS: PeriodKey[] = ['week', 'month', 'quarter', 'year'];

function periodTabLabel(period: PeriodKey): string {
	return performancePeriodLabel(period);
}

function PerformanceWidgetTitle({
	children,
	endDecorator,
	contentGap = '24px',
}: {
	children: React.ReactNode;
	endDecorator?: React.ReactNode;
	contentGap?: string | number;
}) {
	return (
		<Box
			sx={{
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'space-between',
				gap: 1,
				mb: contentGap,
				minWidth: 0,
				flexShrink: 0,
			}}
		>
			<Typography
				level="title-md"
				sx={{
					color: 'var(--krona-text)',
					fontFamily: 'Poppins, sans-serif',
					fontSize: '16px',
					fontWeight: 600,
					lineHeight: 1.2,
					minWidth: 0,
				}}
			>
				{children}
			</Typography>
			{endDecorator}
		</Box>
	);
}

function TrendBadge({ delta }: { delta: number | null }) {
	if (delta === null || !Number.isFinite(delta) || delta === 0) return null;
	const up = delta > 0;
	return (
		<Box
			component="span"
			sx={{
				display: 'inline-flex',
				alignItems: 'center',
				gap: 0.25,
				ml: 0.75,
				color: up ? '#4ade80' : '#f87171',
				fontSize: 13,
				fontWeight: 600,
			}}
		>
			{up ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
			{Math.abs(delta).toFixed(1)}%
		</Box>
	);
}

function PerformanceChartSkeleton({ barCount }: { barCount: number }) {
	return (
		<Box
			sx={{
				...kronaWidgetCardSx,
				...performanceWidgetPaddingSx,
				flex: 1,
				minHeight: 300,
				height: '100%',
				display: 'flex',
				flexDirection: 'column',
			}}
		>
			<Skeleton
				variant="rectangular"
				sx={{
					...kronaSkeletonSx,
					width: '38%',
					maxWidth: 220,
					height: 20,
					mb: 2,
					borderRadius: 12,
				}}
			/>
			<Box
				sx={{
					display: 'flex',
					alignItems: 'flex-end',
					gap: { xs: 0.5, sm: 1 },
					flex: 1,
					minHeight: 0,
				}}
			>
				{Array.from({ length: barCount }, (_, i) => (
					<Box
						key={i}
						sx={{
							flex: 1,
							minWidth: 0,
							height: '100%',
							display: 'flex',
							flexDirection: 'column',
							alignItems: 'center',
							justifyContent: 'flex-end',
							gap: 0.75,
						}}
					>
						<Skeleton
							variant="rectangular"
							sx={{
								...kronaSkeletonSx,
								width: '100%',
								maxWidth: 48,
								height: `${24 + (i % 5) * 12}%`,
								maxHeight: '88%',
								borderRadius: '12px',
							}}
						/>
						<Skeleton
							variant="rectangular"
							sx={{
								...kronaSkeletonSx,
								width: 16,
								height: 10,
								borderRadius: 8,
							}}
						/>
					</Box>
				))}
			</Box>
		</Box>
	);
}

function PerformanceMetricSkeleton() {
	return (
		<Sheet
			sx={{
				...kronaWidgetCardSx,
				...performanceWidgetPaddingSx,
				height: '100%',
				minHeight: 138,
			}}
		>
			<Skeleton
				variant="rectangular"
				sx={{ ...kronaSkeletonSx, width: '62%', height: 14, borderRadius: 10 }}
			/>
			<Skeleton
				variant="rectangular"
				sx={{
					...kronaSkeletonSx,
					width: '42%',
					height: 34,
					mt: 1.25,
					borderRadius: 12,
				}}
			/>
		</Sheet>
	);
}

function PerformanceFeatureSkeleton() {
	return (
		<Sheet
			sx={{
				...kronaWidgetCardSx,
				...performanceWidgetPaddingSx,
				minHeight: 300,
				height: '100%',
				display: 'flex',
				flexDirection: 'column',
			}}
		>
			<Skeleton
				variant="rectangular"
				sx={{ ...kronaSkeletonSx, width: '40%', height: 16, borderRadius: 10 }}
			/>
			<Skeleton
				variant="rectangular"
				sx={{ ...kronaSkeletonSx, flex: 1, mt: 3, borderRadius: 12 }}
			/>
		</Sheet>
	);
}

function WorkHoursChart({
	days,
	periodLabel,
}: {
	days: PerformanceChartDay[];
	periodLabel: string;
}) {
	const max = Math.max(...days.map((d) => d.workHours + d.restHours), 0.25);
	return (
		<Box
			sx={{
				...kronaWidgetCardSx,
				...performanceWidgetPaddingSx,
				flex: 1,
				minHeight: 300,
				height: '100%',
				display: 'flex',
				flexDirection: 'column',
			}}
		>
			<PerformanceWidgetTitle contentGap="20px">
				Focus time · {periodLabel}
			</PerformanceWidgetTitle>
			<Box
				sx={{
					display: 'flex',
					alignItems: 'flex-end',
					gap: { xs: 0.5, sm: days.length > 8 ? 0.5 : 1 },
					flex: 1,
					minHeight: 0,
					overflowX: days.length > 10 ? 'auto' : 'visible',
				}}
			>
				{days.map((d, i) => {
					const totalHours = d.workHours + d.restHours;
					const totalBarPercent =
						totalHours > 0 ? Math.max(8, (totalHours / max) * 100) : 4;
					const workHeight =
						totalHours > 0
							? Math.max(
									d.workHours > 0 ? 3 : 0,
									(d.workHours / totalHours) * 100,
								)
							: 0;
					const restHeight =
						totalHours > 0
							? Math.max(
									d.restHours > 0 ? 3 : 0,
									(d.restHours / totalHours) * 100,
								)
							: 0;
					const tooltipTitle =
						totalHours > 0
							? `${d.label} · Worked: ${formatDecimalHours(d.workHours)}h · Rested: ${formatDecimalHours(d.restHours)}h`
							: `${d.label} · No focus or rest time`;

					return (
						<Box
							key={`${d.label}-${i}`}
							sx={{
								flex: days.length > 8 ? '0 0 40px' : 1,
								minWidth: days.length > 8 ? 36 : 0,
								height: '100%',
								display: 'flex',
								flexDirection: 'column',
								alignItems: 'center',
								justifyContent: 'flex-end',
								gap: 0.75,
							}}
						>
							<Tooltip title={tooltipTitle} placement="top" variant="soft">
								<Box
									className="perf-bar-column"
									sx={{
										width: '100%',
										maxWidth: 48,
										height: `${totalBarPercent}%`,
										maxHeight: 'calc(100% - 28px)',
										minHeight: totalHours > 0 ? 8 : 4,
										display: 'flex',
										flexDirection: 'column',
										justifyContent: 'flex-end',
										cursor: 'default',
										transition: 'transform 0.15s ease, filter 0.15s ease',
										'&:hover': {
											transform: 'translateY(-2px)',
											filter: 'brightness(1.1)',
										},
									}}
								>
									{restHeight > 0 ? (
										<Box
											sx={{
												width: '100%',
												height: `${restHeight}%`,
												background: 'var(--krona-accent-gradient)',
												opacity: 0.48,
												borderRadius: workHeight > 0 ? '8px 8px 0 0' : '8px',
											}}
										/>
									) : null}
									{workHeight > 0 ? (
										<Box
											sx={{
												width: '100%',
												height: `${workHeight}%`,
												borderRadius: restHeight > 0 ? '0 0 8px 8px' : '8px',
												background: 'var(--krona-accent-gradient)',
											}}
										/>
									) : null}
									{totalHours === 0 ? (
										<Box
											sx={{
												width: '100%',
												height: 4,
												borderRadius: '12px',
												background: 'var(--krona-accent-gradient)',
												opacity: 0.3,
											}}
										/>
									) : null}
								</Box>
							</Tooltip>
							<Typography
								level="body-xs"
								title={d.label}
								sx={{
									color: 'var(--krona-text-muted)',
									fontSize: 11,
									lineHeight: 1.2,
									textAlign: 'center',
									width: '100%',
									overflow: 'hidden',
									textOverflow: 'ellipsis',
									whiteSpace: 'nowrap',
								}}
							>
								{d.label}
							</Typography>
						</Box>
					);
				})}
			</Box>
		</Box>
	);
}

function PerformanceMetricCard({
	label,
	value,
	trend,
}: {
	label: string;
	value: string;
	trend: number | null;
}) {
	return (
		<Sheet
			sx={{
				...kronaWidgetCardSx,
				...performanceWidgetPaddingSx,
				minHeight: 0,
				height: '100%',
			}}
		>
			<PerformanceWidgetTitle contentGap="16px">{label}</PerformanceWidgetTitle>
			<Box sx={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap' }}>
				<Typography
					component="span"
					sx={{
						...kronaWidgetMetricValueSx,
						fontSize: { xs: 26, md: 32 },
					}}
				>
					{value}
				</Typography>
				<TrendBadge delta={trend} />
			</Box>
		</Sheet>
	);
}

function PerformanceMetricPair({ children }: { children: React.ReactNode }) {
	return (
		<Box
			sx={{
				display: 'grid',
				gridTemplateColumns: {
					xs: '1fr',
					sm: 'repeat(2, minmax(0, 1fr))',
					lg: '1fr',
				},
				gridTemplateRows: { lg: 'repeat(2, minmax(0, 1fr))' },
				gap: '24px',
				minWidth: 0,
				height: '100%',
			}}
		>
			{children}
		</Box>
	);
}

function PerformanceFeatureRow({
	metrics,
	feature,
	featureOnLeft = false,
}: {
	metrics: React.ReactNode;
	feature: React.ReactNode;
	featureOnLeft?: boolean;
}) {
	return (
		<Box
			sx={{
				display: 'grid',
				gridTemplateColumns: {
					xs: '1fr',
					lg: featureOnLeft
						? 'minmax(0, 2fr) minmax(0, 1fr)'
						: 'minmax(0, 1fr) minmax(0, 2fr)',
				},
				gap: '24px',
				alignItems: 'stretch',
				minWidth: 0,
				minHeight: 300,
				height: { lg: 300 },
			}}
		>
			<Box
				sx={{
					minWidth: 0,
					minHeight: 0,
					height: '100%',
					gridColumn: { lg: featureOnLeft ? 2 : 1 },
				}}
			>
				{metrics}
			</Box>
			<Box
				sx={{
					minWidth: 0,
					minHeight: 0,
					height: '100%',
					display: 'flex',
					flexDirection: 'column',
					gridColumn: { lg: featureOnLeft ? 1 : 2 },
					gridRow: { lg: 1 },
				}}
			>
				{feature}
			</Box>
		</Box>
	);
}

function ActivityOverDay({
	buckets,
	loading,
}: {
	buckets: PerformanceActivityBucket[];
	loading: boolean;
}) {
	const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);
	const max = Math.max(
		...buckets.flatMap((bucket) => [bucket.workHours, bucket.restHours]),
		0.25,
	);
	const hasActivity = buckets.some(
		(bucket) => bucket.workHours > 0 || bucket.restHours > 0,
	);
	const graphBottom = 42;
	const graphTop = 4;
	const pointCoords = (value: number, index: number) => {
		const x = buckets.length <= 1 ? 50 : (index / (buckets.length - 1)) * 100;
		const y = graphBottom - (value / max) * (graphBottom - graphTop);
		return { x, y };
	};
	const pointFor = (value: number, index: number) => {
		const { x, y } = pointCoords(value, index);
		return `${x},${y}`;
	};
	const workPoints = buckets
		.map((bucket, index) => pointFor(bucket.workHours, index))
		.join(' ');
	const restPoints = buckets
		.map((bucket, index) => pointFor(bucket.restHours, index))
		.join(' ');
	const hoveredBucket =
		hoveredIndex != null ? buckets[hoveredIndex] ?? null : null;
	const hoveredWork =
		hoveredIndex != null
			? pointCoords(buckets[hoveredIndex]?.workHours ?? 0, hoveredIndex)
			: null;

	return (
		<Sheet
			sx={{
				...kronaWidgetCardSx,
				...performanceWidgetPaddingSx,
				minHeight: 300,
				height: '100%',
			}}
		>
			<PerformanceWidgetTitle>
				Average activity over the day
			</PerformanceWidgetTitle>
			{loading ? (
				<Skeleton
					variant="rectangular"
					sx={{ ...kronaSkeletonSx, flex: 1, minHeight: 170, borderRadius: 12 }}
				/>
			) : !hasActivity ? (
				<Box
					sx={{
						flex: 1,
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						textAlign: 'center',
					}}
				>
					<Typography level="body-sm" sx={{ color: 'var(--krona-text-muted)' }}>
						Track work and rest sessions to see your daily rhythm.
					</Typography>
				</Box>
			) : (
				<Box
					sx={{
						flex: 1,
						minHeight: 0,
						display: 'flex',
						flexDirection: 'column',
						gap: 1,
					}}
				>
					<Box
						sx={{ flex: 1, minHeight: 160, position: 'relative' }}
						onMouseLeave={() => setHoveredIndex(null)}
					>
						<Box
							component="svg"
							viewBox="0 0 100 48"
							preserveAspectRatio="none"
							role="img"
							aria-label="Average work and rest activity by time of day"
							sx={{ width: '100%', height: '100%', overflow: 'visible' }}
						>
							<defs>
								<linearGradient
									id="performanceActivityGradient"
									x1="0"
									y1="0"
									x2="1"
									y2="0"
								>
									<stop offset="0%" stopColor="var(--krona-accent-stop-0)" />
									<stop offset="34%" stopColor="var(--krona-accent-stop-34)" />
									<stop offset="68%" stopColor="var(--krona-accent-stop-68)" />
									<stop
										offset="100%"
										stopColor="var(--krona-accent-stop-100)"
									/>
								</linearGradient>
							</defs>
							{[graphTop, 23, graphBottom].map((y) => (
								<line
									key={y}
									x1="0"
									x2="100"
									y1={y}
									y2={y}
									stroke="var(--krona-surface-border)"
									strokeWidth="0.35"
									vectorEffect="non-scaling-stroke"
								/>
							))}
							<polyline
								points={restPoints}
								fill="none"
								stroke="url(#performanceActivityGradient)"
								strokeWidth="4"
								strokeLinecap="round"
								strokeLinejoin="round"
								opacity="0.48"
								vectorEffect="non-scaling-stroke"
							/>
							<polyline
								points={workPoints}
								fill="none"
								stroke="url(#performanceActivityGradient)"
								strokeWidth="4"
								strokeLinecap="round"
								strokeLinejoin="round"
								vectorEffect="non-scaling-stroke"
							/>
							{hoveredIndex != null && hoveredWork ? (
								<line
									x1={hoveredWork.x}
									x2={hoveredWork.x}
									y1={graphTop}
									y2={graphBottom}
									stroke="var(--krona-text)"
									strokeOpacity="0.28"
									strokeWidth="1"
									vectorEffect="non-scaling-stroke"
								/>
							) : null}
						</Box>
						<Box
							sx={{
								position: 'absolute',
								inset: 0,
								display: 'flex',
							}}
						>
							{buckets.map((bucket, index) => {
								const tooltipTitle = `${bucket.label} — worked ${formatDecimalHours(bucket.workHours)}h · rested ${formatDecimalHours(bucket.restHours)}h`;
								return (
									<Tooltip
										key={bucket.label}
										title={tooltipTitle}
										placement="top"
										variant="soft"
										open={hoveredIndex === index}
									>
										<Box
											onMouseEnter={() => setHoveredIndex(index)}
											sx={{
												flex: 1,
												height: '100%',
												cursor: 'crosshair',
											}}
										/>
									</Tooltip>
								);
							})}
						</Box>
					</Box>
					<Box
						sx={{ display: 'flex', justifyContent: 'space-between', gap: 0.5 }}
					>
						{buckets.map((bucket, index) => (
							<Typography
								key={bucket.label}
								level="body-xs"
								sx={{
									color:
										hoveredIndex === index
											? 'var(--krona-text)'
											: 'var(--krona-text-muted)',
									fontSize: 9,
									flex: 1,
									textAlign:
										index === 0
											? 'left'
											: index === buckets.length - 1
												? 'right'
												: 'center',
									whiteSpace: 'nowrap',
									fontWeight: hoveredIndex === index ? 600 : 400,
								}}
							>
								{index % 2 === 0 || hoveredIndex === index ? bucket.label : ''}
							</Typography>
						))}
					</Box>
					<Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
						{[
							{ label: 'Work', opacity: 1 },
							{ label: 'Rest', opacity: 0.48 },
						].map((item) => (
							<Box
								key={item.label}
								sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}
							>
								<Box
									sx={{
										width: 18,
										height: 3,
										borderRadius: 99,
										background: 'var(--krona-accent-gradient)',
										opacity: item.opacity,
									}}
								/>
								<Typography
									level="body-xs"
									sx={{ color: 'var(--krona-text-muted)' }}
								>
									{item.label}
								</Typography>
							</Box>
						))}
						{hoveredBucket ? (
							<Typography
								level="body-xs"
								sx={{
									ml: 'auto',
									color: 'var(--krona-text)',
									fontWeight: 600,
								}}
							>
								{hoveredBucket.label}
							</Typography>
						) : null}
					</Box>
				</Box>
			)}
		</Sheet>
	);
}

function performanceInsights(metrics: PerformanceMetrics): string[] {
	if (metrics.totalWorkHours <= 0) {
		return [
			'No focus pattern is available yet. Track two or three work sessions with a selected task to establish a useful baseline.',
		];
	}

	const candidates: Array<{ score: number; text: string }> = [];
	const restRatio =
		metrics.totalWorkHours > 0
			? metrics.totalRestHours / metrics.totalWorkHours
			: 0;
	const busiestBucket =
		metrics.activityByHour.reduce<PerformanceActivityBucket | null>(
			(best, bucket) => {
				if (!best || bucket.workHours > best.workHours) return bucket;
				return best;
			},
			null,
		);
	const trackedTaskHours =
		metrics.taskBreakdown?.reduce((sum, task) => sum + task.hours, 0) ?? 0;
	const topTask = metrics.taskBreakdown?.[0] ?? null;
	const topTaskShare =
		topTask && trackedTaskHours > 0 ? topTask.hours / trackedTaskHours : 0;

	if (metrics.avgDailyWorkHours >= 8) {
		candidates.push({
			score: 100,
			text: `Your average focus load is ${formatDecimalHours(metrics.avgDailyWorkHours)}h per day. Protect a firm stop time and move lower-value work out of your peak window.`,
		});
	} else if (metrics.avgDailyWorkHours >= 5) {
		candidates.push({
			score: 72,
			text: `You average ${formatDecimalHours(metrics.avgDailyWorkHours)}h of focused work per day. Keep the final block lighter to preserve next-day consistency.`,
		});
	}

	if (restRatio < 0.12) {
		candidates.push({
			score: 96,
			text: `Only ${Math.round(restRatio * 100)}% of your tracked focus time is recovery. Add a short break after each concentrated block instead of waiting for fatigue.`,
		});
	} else if (restRatio > 0.45) {
		candidates.push({
			score: 64,
			text: `Rest equals ${Math.round(restRatio * 100)}% of focus time. Check whether interruptions are being logged as rest and consolidate fragmented blocks where possible.`,
		});
	}

	if (
		metrics.trendWork != null &&
		metrics.trendWork >= 15 &&
		(metrics.trendRest == null || metrics.trendRest < metrics.trendWork / 2)
	) {
		candidates.push({
			score: 88,
			text: `Focus time rose ${Math.round(metrics.trendWork)}%, faster than recovery time. Hold output steady before adding more hours.`,
		});
	} else if (metrics.trendWork != null && metrics.trendWork <= -15) {
		candidates.push({
			score: 86,
			text: `Focus time fell ${Math.abs(Math.round(metrics.trendWork))}% versus the prior period. Schedule one protected block during ${metrics.bestFocusPeriod !== '--' ? metrics.bestFocusPeriod : 'your strongest time of day'}.`,
		});
	}

	if (busiestBucket && busiestBucket.workHours > 0) {
		candidates.push({
			score: 70,
			text: `Your activity peaks around ${busiestBucket.label}. Reserve that window for the task requiring the most concentration, not routine admin.`,
		});
	}

	if (topTask && topTaskShare >= 0.55) {
		candidates.push({
			score: 82,
			text: `${topTask.name} received ${Math.round(topTaskShare * 100)}% of task-linked focus time. Confirm that this concentration matches your current priority.`,
		});
	} else if ((metrics.taskBreakdown?.length ?? 0) >= 5 && topTaskShare < 0.35) {
		candidates.push({
			score: 76,
			text: `Your tracked time is spread across ${metrics.taskBreakdown?.length ?? 0} tasks. Reduce switching by batching similar tasks into one block.`,
		});
	}

	if (metrics.tasksFinished === 0 && trackedTaskHours > 0) {
		candidates.push({
			score: 84,
			text: `You logged ${formatDecimalHours(trackedTaskHours)}h against tasks without finishing one. Narrow the next block to a concrete deliverable.`,
		});
	} else if (metrics.tasksFinished > 0 && metrics.totalWorkHours > 0) {
		const hoursPerTask = metrics.totalWorkHours / metrics.tasksFinished;
		candidates.push({
			score: 52,
			text: `You completed ${metrics.tasksFinished} tasks at roughly ${formatDecimalHours(hoursPerTask)} focused hours per completion. Use that pace when planning the next period.`,
		});
	}

	return candidates
		.sort((a, b) => b.score - a.score)
		.slice(0, 3)
		.map((candidate) => candidate.text);
}

function PerformanceTips({
	metrics,
	tipsUnlocked = true,
	tipsTitle,
	tipsOverride,
}: {
	metrics: PerformanceMetrics;
	tipsUnlocked?: boolean;
	tipsTitle?: string;
	tipsOverride?: string[] | null;
}) {
	const unlocked = tipsUnlocked !== false;
	const tips = tipsOverride ?? performanceInsights(metrics);
	return (
		<Sheet
			sx={{
				...kronaWidgetCardSx,
				...performanceWidgetPaddingSx,
				minHeight: 300,
				height: '100%',
			}}
		>
			<PerformanceWidgetTitle>
				{tipsTitle ?? 'Krona insights'}
			</PerformanceWidgetTitle>
			{unlocked ? (
				<Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
					{tips.map((tip) => (
						<Box
							key={tip}
							sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}
						>
							<Lightbulb
								size={15}
								color="var(--krona-text-muted)"
								style={{ marginTop: 2, flexShrink: 0 }}
								aria-hidden
							/>
							<Typography
								level="body-sm"
								sx={{ color: 'var(--krona-text)', lineHeight: 1.45 }}
							>
								{tip}
							</Typography>
						</Box>
					))}
				</Box>
			) : (
				<Box
					sx={{
						flex: 1,
						display: 'flex',
						flexDirection: 'column',
						justifyContent: 'center',
						alignItems: 'flex-start',
						gap: 1.5,
					}}
				>
					<Typography level="body-sm" sx={{ color: 'var(--krona-text-muted)' }}>
						Unlock personalized guidance based on your focus, rest, and task
						patterns.
					</Typography>
					<Button
						component={NextLink}
						href="/subscribe?feature=performance"
						size="sm"
						sx={{ ...kronaPrimaryButtonSx, minHeight: 32, height: 32, px: 2 }}
					>
						Upgrade
					</Button>
				</Box>
			)}
		</Sheet>
	);
}

const PROJECT_PIE_COLORS = [
	'#7c5cff',
	'#18bdf2',
	'#ff6b9d',
	'#f6b94a',
	'#4dd4ac',
	'#b46cff',
	'#ff835c',
	'#63a4ff',
] as const;

function TimeByProjectCard({
	metrics,
	loading,
}: {
	metrics: PerformanceMetrics;
	loading: boolean;
}) {
	const projects = React.useMemo(() => {
		const totals = new Map<string, number>();
		for (const task of metrics.taskBreakdown ?? []) {
			const name = task.projectName || 'Undefined';
			totals.set(name, (totals.get(name) ?? 0) + task.hours);
		}
		return [...totals.entries()]
			.map(([name, hours]) => ({ name, hours }))
			.filter((project) => project.hours > 0)
			.sort((a, b) => b.hours - a.hours);
	}, [metrics.taskBreakdown]);
	const totalHours = projects.reduce((sum, project) => sum + project.hours, 0);
	const slices = projects.reduce<
		Array<{
			name: string;
			hours: number;
			color: string;
			start: number;
			end: number;
		}>
	>((result, project, index) => {
		const priorHours = result.reduce((sum, slice) => sum + slice.hours, 0);
		return [
			...result,
			{
				...project,
				color:
					PROJECT_PIE_COLORS[index] ??
					`hsl(${Math.round((index * 137.508) % 360)} 75% 62%)`,
				start: totalHours > 0 ? (priorHours / totalHours) * 100 : 0,
				end:
					totalHours > 0
						? ((priorHours + project.hours) / totalHours) * 100
						: 0,
			},
		];
	}, []);
	const pieBackground =
		slices.length > 0
			? `conic-gradient(${slices
					.map((slice) => `${slice.color} ${slice.start}% ${slice.end}%`)
					.join(', ')})`
			: 'var(--krona-secondary-bg)';

	return (
		<Sheet
			sx={{
				...kronaWidgetCardSx,
				...performanceWidgetPaddingSx,
				minHeight: 300,
				height: '100%',
			}}
		>
			<PerformanceWidgetTitle>Time by project</PerformanceWidgetTitle>
			{loading || metrics.taskBreakdown === null ? (
				<Skeleton
					variant="rectangular"
					sx={{ ...kronaSkeletonSx, flex: 1, minHeight: 170, borderRadius: 12 }}
				/>
			) : slices.length === 0 ? (
				<Box
					sx={{
						flex: 1,
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						textAlign: 'center',
					}}
				>
					<Typography level="body-sm" sx={{ color: 'var(--krona-text-muted)' }}>
						Track time with tasks assigned to projects to see the breakdown.
					</Typography>
				</Box>
			) : (
				<Box
					sx={{
						flex: 1,
						minHeight: 0,
						display: 'grid',
						gridTemplateColumns: { xs: '1fr', sm: 'minmax(150px, 0.8fr) 1fr' },
						alignItems: 'center',
						gap: { xs: 2, sm: 3 },
					}}
				>
					<Box
						sx={{
							position: 'relative',
							width: 'min(170px, 100%)',
							aspectRatio: '1',
							borderRadius: '50%',
							background: pieBackground,
							mx: 'auto',
							boxShadow: 'inset 0 0 0 1px var(--krona-surface-border)',
						}}
					>
						<Box
							sx={{
								position: 'absolute',
								inset: '28%',
								borderRadius: '50%',
								bgcolor: 'var(--krona-widget-bg)',
								backdropFilter:
									'blur(var(--krona-widget-blur)) saturate(var(--krona-widget-saturate))',
								display: 'flex',
								flexDirection: 'column',
								alignItems: 'center',
								justifyContent: 'center',
								textAlign: 'center',
							}}
						>
							<Typography
								level="title-lg"
								sx={{ color: 'var(--krona-text)', fontWeight: 600, lineHeight: 1 }}
							>
								{slices.length}
							</Typography>
							<Typography
								level="body-xs"
								sx={{ color: 'var(--krona-text-muted)', mt: 0.5 }}
							>
								{slices.length === 1 ? 'project' : 'projects'}
							</Typography>
						</Box>
					</Box>
					<DashboardWidgetScrollArea
						sx={{
							flex: 1,
							minHeight: 0,
							maxHeight: '100%',
							overflowY: 'auto',
						}}
					>
						{slices.map((slice) => (
							<Box
								key={slice.name}
								sx={{
									display: 'flex',
									alignItems: 'center',
									gap: 1,
									py: 0.65,
								}}
							>
								<Box
									sx={{
										width: 10,
										height: 10,
										borderRadius: '50%',
										bgcolor: slice.color,
										flexShrink: 0,
									}}
								/>
								<Typography
									level="body-sm"
									sx={{
										color: 'var(--krona-text)',
										flex: 1,
										minWidth: 0,
										overflow: 'hidden',
										textOverflow: 'ellipsis',
										whiteSpace: 'nowrap',
									}}
								>
									{slice.name}
								</Typography>
								<Typography
									level="body-xs"
									sx={{ color: 'var(--krona-text-muted)', flexShrink: 0 }}
								>
									{formatDecimalHours(slice.hours)}h ·{' '}
									{Math.round((slice.hours / totalHours) * 100)}%
								</Typography>
							</Box>
						))}
					</DashboardWidgetScrollArea>
				</Box>
			)}
		</Sheet>
	);
}

function TasksWorkedCard({
	metrics,
	loading,
	emptyCopy,
}: {
	metrics: PerformanceMetrics;
	loading: boolean;
	emptyCopy?: string;
}) {
	return (
		<Sheet
			sx={{
				...kronaWidgetCardSx,
				...performanceWidgetPaddingSx,
				minHeight: 300,
				height: '100%',
			}}
		>
			<PerformanceWidgetTitle>Tasks worked</PerformanceWidgetTitle>
			{loading || metrics.taskBreakdown === null ? (
				<Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
					{Array.from({ length: 5 }, (_, index) => (
						<Skeleton
							key={index}
							variant="rectangular"
							sx={{
								...kronaSkeletonSx,
								width: '100%',
								height: 14,
								borderRadius: 10,
							}}
						/>
					))}
				</Box>
			) : metrics.taskBreakdown.length === 0 ? (
				<Box
					sx={{
						flex: 1,
						display: 'flex',
						flexDirection: 'column',
						alignItems: 'center',
						justifyContent: 'center',
						gap: 1.25,
						textAlign: 'center',
					}}
				>
					<ListTodo
						size={32}
						strokeWidth={1.6}
						color="var(--krona-text-muted)"
						aria-hidden
					/>
					<Typography
						level="body-sm"
						sx={{ color: 'var(--krona-text-muted)', maxWidth: 280 }}
					>
						{emptyCopy ??
							'Select a task before starting the work timer to record its hours here.'}
					</Typography>
				</Box>
			) : (
				<DashboardWidgetScrollArea
					sx={{
						...kronaWidgetListScrollSx,
						mt: 0,
						gap: 0,
						flex: 1,
						minHeight: 0,
						overflowY: 'auto',
					}}
				>
					{metrics.taskBreakdown.map((task, index) => (
						<Box
							key={task.taskId}
							sx={{
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'space-between',
								gap: 1.5,
								py: 1.1,
								borderTop:
									index === 0
										? 'none'
										: '1px solid var(--krona-surface-border)',
							}}
						>
							<Box sx={{ minWidth: 0, flex: 1 }}>
								<Typography
									level="body-sm"
									sx={{
										color: 'var(--krona-text)',
										fontWeight: 500,
										overflow: 'hidden',
										textOverflow: 'ellipsis',
										whiteSpace: 'nowrap',
									}}
								>
									{task.name}
								</Typography>
								<Typography
									level="body-xs"
									sx={{
										color: 'var(--krona-text-muted)',
										mt: 0.25,
										overflow: 'hidden',
										textOverflow: 'ellipsis',
										whiteSpace: 'nowrap',
									}}
								>
									{task.projectName || 'Undefined'}
								</Typography>
								{task.workers?.length ? (
									<Typography
										level="body-xs"
										sx={{
											color: 'var(--krona-text-muted)',
											mt: 0.25,
											lineHeight: 1.4,
										}}
									>
										{task.workers
											.map(
												(worker) =>
													`${worker.name} ${formatDecimalHours(worker.hours)}h`,
											)
											.join(' · ')}
									</Typography>
								) : null}
							</Box>
							<Typography
								level="body-sm"
								sx={{ color: 'var(--krona-text-muted)', flexShrink: 0 }}
							>
								{formatDecimalHours(task.hours)}h
							</Typography>
						</Box>
					))}
				</DashboardWidgetScrollArea>
			)}
		</Sheet>
	);
}

export type PerformanceReportPeriod = PerformancePeriodKey;

export type PerformanceReportProps = {
	metrics: PerformanceMetrics | null | undefined;
	selectedPeriod: PerformancePeriodKey;
	onPeriodChange: (period: PerformancePeriodKey) => void;
	chartLoading: boolean;
	tipsUnlocked?: boolean;
	title?: string;
	emptyHints?: { tipsTitle?: string; tasksWorked?: string };
	/** When set, Team insights uses these instead of personal focus tips. */
	insightTips?: string[] | null;
	/** Defaults to Week / Month. Team Performance also includes Today. */
	periods?: readonly PeriodKey[];
	/** Renders on the far left of the toolbar (e.g. member filter). */
	toolbarStart?: React.ReactNode;
	/** Renders on the far right of the toolbar (e.g. export). */
	toolbarEnd?: React.ReactNode;
	/** Skeleton bar count for Today (member bars) before metrics arrive. */
	chartBarCountHint?: number;
	/** Renders between the period tabs and the metric rows (e.g. VacationModeBanner). */
	children?: React.ReactNode;
};

export function PerformanceReport({
	metrics,
	selectedPeriod,
	onPeriodChange,
	chartLoading,
	tipsUnlocked = true,
	emptyHints,
	insightTips,
	periods,
	toolbarStart,
	toolbarEnd,
	chartBarCountHint,
	children,
}: PerformanceReportProps) {
	const extendedLoading = metrics != null && !metrics.extendedReady;
	const visiblePeriods = periods ?? DEFAULT_PERIODS;
	const visibleTabs = PERIOD_TABS.filter((period) =>
		visiblePeriods.includes(period.key),
	);
	const hasToolbarChrome = Boolean(toolbarStart || toolbarEnd);
	const chartDays =
		metrics?.chartDays ??
		buildChartDaysFromTotals(selectedPeriod, new Map(), dayjs());
	const skeletonBarCount =
		chartBarCountHint ??
		(selectedPeriod === 'today'
			? Math.max(chartDays.length, 1)
			: chartBarCount(selectedPeriod));

	return (
		<>
			<Box
				sx={{
					display: 'flex',
					justifyContent: 'center',
					width: '100%',
					mb: 2,
					flexShrink: 0,
				}}
			>
				<Box
					sx={
						hasToolbarChrome
							? {
									display: 'grid',
									gridTemplateColumns: {
										xs: '1fr',
										lg: 'minmax(0, 1fr) auto minmax(0, 1fr)',
									},
									alignItems: 'center',
									gap: 1.5,
									width: '100%',
								}
							: {
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'center',
									width: '100%',
									maxWidth: 480,
								}
					}
				>
					{hasToolbarChrome ? (
						<Box
							sx={{
								justifySelf: { lg: 'start' },
								width: 'auto',
								maxWidth: '100%',
								minWidth: 0,
								display: 'flex',
								alignItems: 'center',
							}}
						>
							{toolbarStart}
						</Box>
					) : null}
					<Box
						sx={{
							...kronaTabBarSx,
							justifySelf: 'center',
							minWidth: 0,
							maxWidth: '100%',
							overflowX: 'auto',
							width: hasToolbarChrome
								? { xs: '100%', lg: visibleTabs.length > 3 ? 480 : 320 }
								: { xs: '100%', md: 480 },
						}}
					>
						{visibleTabs.map((period) => (
							<Box
								key={period.key}
								component="button"
								type="button"
								className="krona-timer-tab"
								data-active={selectedPeriod === period.key ? 'true' : 'false'}
								aria-pressed={selectedPeriod === period.key}
								onClick={() => onPeriodChange(period.key)}
								sx={{
									...kronaTabButtonSx(selectedPeriod === period.key),
									flexShrink: 0,
									minWidth: 'max-content',
									px: 1.5,
									fontSize: 13,
								}}
							>
								{period.label}
							</Box>
						))}
					</Box>
					{hasToolbarChrome ? (
						<Box
							sx={{
								justifySelf: { lg: 'end' },
								width: 'auto',
								maxWidth: '100%',
								minWidth: 0,
								display: 'flex',
								alignItems: 'center',
								justifyContent: { xs: 'flex-start', sm: 'flex-end' },
							}}
						>
							{toolbarEnd}
						</Box>
					) : null}
				</Box>
			</Box>

			<Box
				sx={{
					flex: 1,
					minHeight: 0,
					display: 'flex',
					flexDirection: 'column',
					gap: '24px',
					overflow: 'visible',
				}}
			>
				{children}
				<Box
					sx={{
						display: 'flex',
						flexDirection: 'column',
						gap: '24px',
						flex: '0 0 auto',
						minHeight: 0,
					}}
				>
				{chartLoading || !metrics ? (
					<>
						<PerformanceFeatureRow
							featureOnLeft
							metrics={
								<PerformanceMetricPair>
									<PerformanceMetricSkeleton />
									<PerformanceMetricSkeleton />
								</PerformanceMetricPair>
							}
							feature={
								<PerformanceChartSkeleton
									barCount={skeletonBarCount}
								/>
							}
						/>
						<PerformanceFeatureRow
							metrics={
								<PerformanceMetricPair>
									<PerformanceMetricSkeleton />
									<PerformanceMetricSkeleton />
								</PerformanceMetricPair>
							}
							feature={<PerformanceFeatureSkeleton />}
						/>
						<PerformanceFeatureRow
							featureOnLeft
							metrics={
								<PerformanceMetricPair>
									<PerformanceMetricSkeleton />
									<PerformanceMetricSkeleton />
								</PerformanceMetricPair>
							}
							feature={<PerformanceFeatureSkeleton />}
						/>
						<PerformanceFeatureRow
							metrics={<PerformanceFeatureSkeleton />}
							feature={<PerformanceFeatureSkeleton />}
						/>
					</>
				) : (
					<>
						<PerformanceFeatureRow
							featureOnLeft
							metrics={
								<PerformanceMetricPair>
									<PerformanceMetricCard
										label="Time worked"
										value={`${formatDecimalHours(metrics.totalWorkHours)}h`}
										trend={metrics.trendWork}
									/>
									<PerformanceMetricCard
										label="Time rested"
										value={`${formatDecimalHours(metrics.totalRestHours)}h`}
										trend={metrics.trendRest}
									/>
								</PerformanceMetricPair>
							}
							feature={
								<WorkHoursChart
									days={chartDays}
									periodLabel={periodTabLabel(selectedPeriod)}
								/>
							}
						/>
						<PerformanceFeatureRow
							metrics={
								<PerformanceMetricPair>
									<PerformanceMetricCard
										label="Average daily work hours"
										value={`${formatDecimalHours(metrics.avgDailyWorkHours)}h`}
										trend={metrics.trendAvgDaily}
									/>
									<PerformanceMetricCard
										label="Average daily rest hours"
										value={`${formatDecimalHours(metrics.avgDailyRestHours)}h`}
										trend={metrics.trendAvgDailyRest}
									/>
								</PerformanceMetricPair>
							}
							feature={
								<ActivityOverDay
									buckets={metrics.activityByHour}
									loading={extendedLoading}
								/>
							}
						/>
						<PerformanceFeatureRow
							featureOnLeft
							metrics={
								<PerformanceMetricPair>
									{extendedLoading ? (
										<PerformanceMetricSkeleton />
									) : (
										<PerformanceMetricCard
											label="Tasks finished"
											value={String(metrics.tasksFinished)}
											trend={null}
										/>
									)}
									{extendedLoading ? (
										<PerformanceMetricSkeleton />
									) : (
										<PerformanceMetricCard
											label="Best focus time"
											value={metrics.bestFocusPeriod}
											trend={null}
										/>
									)}
								</PerformanceMetricPair>
							}
							feature={
								<TasksWorkedCard
									metrics={metrics}
									loading={extendedLoading}
									emptyCopy={emptyHints?.tasksWorked}
								/>
							}
						/>
						<PerformanceFeatureRow
							metrics={
								<PerformanceTips
									metrics={metrics}
									tipsUnlocked={tipsUnlocked}
									tipsTitle={emptyHints?.tipsTitle}
									tipsOverride={insightTips}
								/>
							}
							feature={
								<TimeByProjectCard
									metrics={metrics}
									loading={extendedLoading}
								/>
							}
						/>
					</>
				)}
				</Box>
			</Box>
		</>
	);
}
