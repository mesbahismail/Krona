'use client';

import * as React from 'react';
import { Box, Typography, IconButton } from '@mui/joy';
import { Clock, Play, SkipForward, RotateCcw } from 'lucide-react';
import {
	usePomodoroStats,
	usePomodoroTimer,
} from '@/components/PomodoroContext';
import { useChallengesSyncOptional } from '@/components/challenges/ChallengesSyncContext';
import { logEventSync } from '@/lib/telemetry';
import {
	kronaActiveTaskChipSx,
	kronaTabBarSx,
	kronaTabButtonSx,
	kronaTimerCounterSx,
	kronaTimerPlayButtonSx,
	kronaTimerSecondaryControlSx,
} from '@/lib/kronaStyles';
import { useSelectedTimerTask } from '@/lib/selectedTimerTask';

const TIMER_RING_SIZE = 240;
const TIMER_RING_STROKE = 6;
const TIMER_RING_RADIUS = (TIMER_RING_SIZE - TIMER_RING_STROKE) / 2;
const TIMER_RING_CIRCUMFERENCE = 2 * Math.PI * TIMER_RING_RADIUS;
const WORK_FREE_DEFAULT_RING_SECONDS = 12 * 60 * 60;

const TimerRingLayoutContext = React.createContext<{
	ringPx: number;
	compact: boolean;
	tight: boolean;
}>({ ringPx: 0, compact: false, tight: false });

function useTimerRingLayout() {
	return React.useContext(TimerRingLayoutContext);
}

function TimerProgressRing({
	value,
	total,
	disabled = false,
	label,
	children,
}: {
	value: number;
	total: number;
	disabled?: boolean;
	label: string;
	children: React.ReactNode;
}) {
	const gradientId = React.useId().replace(/:/g, '');
	const hostRef = React.useRef<HTMLDivElement>(null);
	const [ringPx, setRingPx] = React.useState(0);
	const progressFraction =
		!disabled && total > 0
			? Math.min(1, Math.max(0, value / total))
			: 0;
	const dashOffset = TIMER_RING_CIRCUMFERENCE * (1 - progressFraction);
	const compact = ringPx > 0 && ringPx < 300;
	const tight = ringPx > 0 && ringPx < 240;

	React.useEffect(() => {
		const host = hostRef.current;
		if (!host) return;
		const update = () => {
			const { width, height } = host.getBoundingClientRect();
			// 10% smaller than tabs width, capped by available height so the
			// ring cannot expand the dashboard grid / crush other columns.
			const byWidth = width * 0.9;
			const next = Math.max(
				0,
				Math.floor(
					height > 8
						? Math.min(byWidth, height)
						: // Content-sized parents (below desktop) may not give flex height yet.
							Math.min(byWidth, 280),
				),
			);
			setRingPx((prev) => (prev === next ? prev : next));
		};
		update();
		const observer = new ResizeObserver(update);
		observer.observe(host);
		return () => observer.disconnect();
	}, []);

	return (
		<Box
			ref={hostRef}
			sx={{
				flex: 1,
				width: '100%',
				minWidth: 0,
				minHeight: 0,
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				// Do not let intrinsic aspect-ratio size the grid column.
				overflow: 'hidden',
			}}
		>
			<Box
				role="progressbar"
				aria-label={label}
				aria-valuemin={0}
				aria-valuemax={total}
				aria-valuenow={Math.round(Math.max(0, value))}
				aria-disabled={disabled || undefined}
				sx={{
					position: 'relative',
					width: ringPx > 0 ? ringPx : '90%',
					// Explicit px size only — never leave aspect-ratio to size the grid.
					height: ringPx > 0 ? ringPx : 0,
					maxWidth: '90%',
					maxHeight: '100%',
					flexShrink: 0,
					minWidth: 0,
					minHeight: 0,
					visibility: ringPx > 0 ? 'visible' : 'hidden',
				}}
			>
				<Box
					component="svg"
					viewBox={`0 0 ${TIMER_RING_SIZE} ${TIMER_RING_SIZE}`}
					aria-hidden
					sx={{
						position: 'absolute',
						inset: 0,
						width: '100%',
						height: '100%',
						overflow: 'hidden',
						// Unwind clockwise from the top as remaining time drops.
						transform: 'rotate(-90deg) scaleX(-1)',
						pointerEvents: 'none',
					}}
				>
					<defs>
						<linearGradient
							id={gradientId}
							x1="0%"
							y1="0%"
							x2="100%"
							y2="100%"
						>
							<stop offset="0%" stopColor="var(--krona-accent-stop-0)" />
							<stop offset="34%" stopColor="var(--krona-accent-stop-34)" />
							<stop offset="68%" stopColor="var(--krona-accent-stop-68)" />
							<stop offset="100%" stopColor="var(--krona-accent-stop-100)" />
						</linearGradient>
					</defs>
					<circle
						cx={TIMER_RING_SIZE / 2}
						cy={TIMER_RING_SIZE / 2}
						r={TIMER_RING_RADIUS}
						fill="none"
						stroke="rgba(255, 255, 255, 0.12)"
						strokeWidth={TIMER_RING_STROKE}
					/>
					<circle
						cx={TIMER_RING_SIZE / 2}
						cy={TIMER_RING_SIZE / 2}
						r={TIMER_RING_RADIUS}
						fill="none"
						stroke={`url(#${gradientId})`}
						strokeWidth={TIMER_RING_STROKE}
						strokeLinecap="round"
						strokeDasharray={TIMER_RING_CIRCUMFERENCE}
						strokeDashoffset={dashOffset}
						opacity={disabled ? 0 : 1}
						style={{
							transition:
								'stroke-dashoffset 0.35s linear, opacity 0.2s ease',
						}}
					/>
				</Box>
				<TimerRingLayoutContext.Provider value={{ ringPx, compact, tight }}>
					<Box
						sx={{
							position: 'absolute',
							// Keep content clear of the stroke on small rings.
							inset: tight ? '20%' : compact ? '16%' : '12%',
							display: 'flex',
							flexDirection: 'column',
							alignItems: 'center',
							justifyContent: 'center',
							gap: tight ? '4px' : compact ? '6px' : 'clamp(8px, 1.6vh, 16px)',
							minWidth: 0,
							width: 'auto',
							maxWidth: '100%',
							overflow: 'hidden',
							textAlign: 'center',
							boxSizing: 'border-box',
							px: tight ? 0.5 : 1,
						}}
					>
						{children}
					</Box>
				</TimerRingLayoutContext.Provider>
			</Box>
		</Box>
	);
}

function TimerStatusLine({ children }: { children: React.ReactNode }) {
	const { compact, tight } = useTimerRingLayout();
	if (tight) return null;
	return (
		<Typography
			sx={{
				fontSize: compact ? '0.95rem' : { xs: '1.1rem', sm: '1.2rem' },
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				gap: 0.75,
				color: 'var(--krona-text)',
				opacity: 0.92,
				fontWeight: 500,
				flexShrink: 0,
				lineHeight: 1.2,
				maxWidth: '100%',
			}}
		>
			{children}
		</Typography>
	);
}

function TimerDigits({
	value,
	compactFallback,
}: {
	value: string;
	compactFallback: boolean;
}) {
	const { compact, tight } = useTimerRingLayout();
	return (
		<Typography
			level="h1"
			sx={{
				...kronaTimerCounterSx,
				flexShrink: 0,
				lineHeight: 1.05,
				fontSize: tight
					? '36px'
					: compact
						? '44px'
						: compactFallback
							? { xs: '48px', sm: '56px', md: '64px' }
							: undefined,
			}}
		>
			{value}
		</Typography>
	);
}

function TimerTaskChip({
	label,
}: {
	label: string;
}) {
	const { ringPx, compact, tight } = useTimerRingLayout();
	const insideRing = ringPx > 0;
	return (
		<Box
			sx={{
				...kronaActiveTaskChipSx,
				mx: 'auto',
				// Hug the label; never stretch to the ring / widget width.
				width: 'fit-content',
				maxWidth: '100%',
				minWidth: 0,
				boxSizing: 'border-box',
				...(insideRing
					? {
							mt: tight || compact ? 0 : '4px',
							mb: 0,
						}
					: {
							mt: 'calc(20px - clamp(8px, 1.6vh, 16px))',
							mb: 'calc(20px - clamp(8px, 1.6vh, 16px))',
						}),
				opacity: 1,
				py: tight ? 0.25 : 0.5,
				px: tight ? 0.75 : 1,
				flexShrink: 1,
			}}
			title={label}
		>
			<Clock
				size={tight ? 12 : 14}
				strokeWidth={2.25}
				color="var(--krona-text)"
				aria-hidden
			/>
			<Typography
				level="body-sm"
				sx={{
					fontWeight: 600,
					fontSize: tight ? 11 : 12,
					lineHeight: 1.2,
					color: 'var(--krona-text)',
					overflow: 'hidden',
					textOverflow: 'ellipsis',
					whiteSpace: 'nowrap',
					minWidth: 0,
				}}
			>
				{label}
			</Typography>
		</Box>
	);
}

function WorkTodayStats({
	workLabel,
	restLabel,
	compact,
}: {
	workLabel: string;
	restLabel: string;
	compact: boolean;
}) {
	const { compact: ringCompact, tight } = useTimerRingLayout();
	if (tight) return null;
	return (
		<Box
			sx={{
				display: 'flex',
				gap: compact || ringCompact ? 1.25 : 2,
				justifyContent: 'center',
				flexWrap: 'wrap',
				width: '100%',
				maxWidth: '100%',
				flexShrink: 0,
				px: 0.5,
				boxSizing: 'border-box',
			}}
		>
			<Typography
				level="body-sm"
				sx={{
					color: 'var(--krona-text-muted)',
					fontWeight: 600,
					lineHeight: 1.2,
					fontSize: ringCompact ? 12 : undefined,
				}}
			>
				Work today{' '}
				<Box component="span" sx={{ color: 'var(--krona-text)' }}>
					{workLabel}
				</Box>
			</Typography>
			<Typography
				level="body-sm"
				sx={{
					color: 'var(--krona-text-muted)',
					fontWeight: 600,
					lineHeight: 1.2,
					fontSize: ringCompact ? 12 : undefined,
				}}
			>
				Rest today{' '}
				<Box component="span" sx={{ color: 'var(--krona-text)' }}>
					{restLabel}
				</Box>
			</Typography>
		</Box>
	);
}

function ChallengeProgressStats({
	spentLabel,
	leftLabel,
}: {
	spentLabel: string;
	leftLabel: string;
}) {
	const { compact, tight } = useTimerRingLayout();
	if (tight) return null;

	return (
		<Typography
			level="body-sm"
			sx={{
				color: 'var(--krona-text-muted)',
				fontWeight: 600,
				lineHeight: 1.2,
				fontSize: compact ? 12 : undefined,
				whiteSpace: 'nowrap',
				flexShrink: 0,
			}}
		>
			Spent{' '}
			<Box component="span" sx={{ color: 'var(--krona-text)' }}>
				{spentLabel}
			</Box>
			{' · '}Left{' '}
			<Box component="span" sx={{ color: 'var(--krona-text)' }}>
				{leftLabel}
			</Box>
		</Typography>
	);
}

function TimerControls({
	workFree,
	displayRunning,
	onReset,
	onStart,
	onPause,
	onSkip,
}: {
	workFree: boolean;
	displayRunning: boolean;
	onReset: () => void;
	onStart: () => void;
	onPause: () => void;
	onSkip: () => void;
}) {
	const { compact, tight } = useTimerRingLayout();
	const playSize = tight ? 22 : compact ? 24 : 28;
	const secondarySize = tight ? 14 : 18;
	return (
		<Box
			sx={{
				display: 'flex',
				gap: tight ? 1 : 2,
				alignItems: 'center',
				justifyContent: 'center',
				flexShrink: 0,
				mt: tight ? 0.25 : 0,
			}}
		>
			{!workFree ? (
				<IconButton
					className="krona-timer-control"
					onClick={onReset}
					sx={{
						...kronaTimerSecondaryControlSx,
						...(tight
							? { width: 36, height: 36, minWidth: 36, minHeight: 36 }
							: null),
					}}
				>
					<RotateCcw size={secondarySize} />
				</IconButton>
			) : null}
			<IconButton
				className="krona-timer-control--primary"
				onClick={displayRunning ? onPause : onStart}
				sx={{
					...kronaTimerPlayButtonSx,
					...(tight
						? { width: 52, height: 52, minWidth: 52, minHeight: 52 }
						: compact
							? { width: 58, height: 58, minWidth: 58, minHeight: 58 }
							: null),
				}}
			>
				{!displayRunning ? (
					<Play size={playSize} fill="#fff" color="#fff" />
				) : (
					<svg width={playSize} height={playSize} viewBox="0 0 24 24" fill="#fff">
						<rect x="6" y="5" width="4" height="14" rx="1" />
						<rect x="14" y="5" width="4" height="14" rx="1" />
					</svg>
				)}
			</IconButton>
			{!workFree ? (
				<IconButton
					className="krona-timer-control"
					onClick={onSkip}
					sx={{
						...kronaTimerSecondaryControlSx,
						...(tight
							? { width: 36, height: 36, minWidth: 36, minHeight: 36 }
							: null),
					}}
					aria-label="Skip"
				>
					<SkipForward size={secondarySize} />
				</IconButton>
			) : null}
		</Box>
	);
}

export default function DashboardTimerWidget({
	selectedTaskLabel,
}: {
	selectedTaskLabel?: string | null;
}) {
	const {
		viewMode,
		setMode,
		displayRemaining,
		displayRunning,
		start,
		pause,
		skip,
		reset,
		format,
		formatHours,
		timerStyle,
		durations,
	} = usePomodoroTimer();
	const selectedTimerTask = useSelectedTimerTask();
	const activeTaskLabel = selectedTaskLabel || selectedTimerTask.taskName;
	const { todayTotal } = usePomodoroStats();
	const challengesSync = useChallengesSyncOptional();
	const workFree = timerStyle === 'workFree';
	const canUseChallengeGoals = challengesSync != null;
	const workFreeGoalType =
		viewMode === 'work' ? 'focus_minutes' : 'rest_minutes';
	const workFreeGoal = canUseChallengeGoals
		? challengesSync.challenges.find(
				(challenge) =>
					challenge.challenge_type === workFreeGoalType &&
					challenge.status !== 'archived' &&
					challenge.target_value > 0,
			)
		: undefined;
	const workFreeGoalTargetSeconds =
		(workFreeGoal?.target_value ?? 0) * 60;
	const workFreeGoalProgressSeconds =
		viewMode === 'work' ? todayTotal.work : todayTotal.rest;
	const workFreeGoalConfigured = workFreeGoalTargetSeconds > 0;
	const pomodoroTotalSeconds =
		(viewMode === 'work'
			? durations.workMinutes
			: viewMode === 'break'
				? durations.breakMinutes
				: durations.longBreakMinutes) * 60;

	const onStart = () => {
		logEventSync('timer_start', { mode: viewMode, style: timerStyle });
		start();
	};
	const onPause = () => {
		logEventSync('timer_pause', {
			mode: viewMode,
			remaining: displayRemaining,
			style: timerStyle,
		});
		pause();
	};
	const onSkip = () => {
		logEventSync('timer_skip', {
			from: viewMode,
			remaining: displayRemaining,
			style: timerStyle,
		});
		skip();
	};
	const onReset = () => {
		logEventSync('timer_reset', { mode: viewMode, style: timerStyle });
		reset();
	};

	const modeTabs = workFree
		? (['work', 'break'] as const)
		: (['work', 'break', 'longBreak'] as const);

	const statusLine = (() => {
		if (workFree) {
			if (!displayRunning) {
				return viewMode === 'work' ? <>💪 Work · Paused</> : <>🔋 Rest · Paused</>;
			}
			return viewMode === 'work' ? <>💪 Work · Working</> : <>🔋 Rest · Resting</>;
		}
		switch (viewMode) {
			case 'work':
				return <>💪 Working hard!</>;
			case 'break':
				return <>🔋 Short break</>;
			case 'longBreak':
				return <>☕ Long break</>;
			default:
				return null;
		}
	})();

	const tabLabel = (m: 'work' | 'break' | 'longBreak') => {
		if (m === 'work') return 'Work';
		if (m === 'break') return workFree ? 'Rest' : 'Short break';
		return 'Long break';
	};

	const showTaskChip = Boolean(activeTaskLabel && viewMode === 'work');

	const statusTypography = (
		<TimerStatusLine>{statusLine}</TimerStatusLine>
	);

	const timerDigits = (
		// Sized off task selection, not the active tab, so digits never resize
		// when you move between Work / Short break / Long break.
		<TimerDigits
			value={format(displayRemaining)}
			compactFallback={Boolean(activeTaskLabel) || workFree}
		/>
	);

	const taskChip = showTaskChip ? (
		<TimerTaskChip label={activeTaskLabel!} />
	) : null;

	const timerControls = (
		<TimerControls
			workFree={workFree}
			displayRunning={displayRunning}
			onReset={onReset}
			onStart={onStart}
			onPause={onPause}
			onSkip={onSkip}
		/>
	);

	const workTodayStats = (
		<WorkTodayStats
			workLabel={formatHours(todayTotal.work)}
			restLabel={formatHours(todayTotal.rest)}
			compact={showTaskChip}
		/>
	);
	const challengeProgressStats = (
		<ChallengeProgressStats
			spentLabel={formatHours(workFreeGoalProgressSeconds)}
			leftLabel={formatHours(
				Math.max(
					workFreeGoalTargetSeconds - workFreeGoalProgressSeconds,
					0,
				),
			)}
		/>
	);

	return (
		<Box
			sx={{
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				width: '100%',
				minWidth: 0,
				minHeight: 0,
				flex: 1,
			}}
		>
			<Box sx={{ ...kronaTabBarSx, flexShrink: 0, width: '100%' }}>
				{modeTabs.map((m) => {
					const active = viewMode === m;
					return (
						<Box
							key={m}
							component="button"
							type="button"
							className="krona-timer-tab"
							data-active={active ? 'true' : 'false'}
							onClick={() => setMode(m)}
							sx={{
								...kronaTabButtonSx(active),
								flex: workFree ? '1 1 50%' : '1 1 33.333%',
							}}
						>
							{tabLabel(m)}
						</Box>
					);
				})}
			</Box>

			<Box
				sx={{
					flex: 1,
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
					justifyContent: 'center',
					// 8px–16px between status / clock / chip / controls.
					gap: 'clamp(8px, 1.6vh, 16px)',
					width: '100%',
					minHeight: 0,
					py: 1,
				}}
			>
				{workFree ? (
					<TimerProgressRing
						value={workFreeGoalProgressSeconds}
						total={
							workFreeGoalConfigured
								? workFreeGoalTargetSeconds
								: WORK_FREE_DEFAULT_RING_SECONDS
						}
						label={
							workFreeGoalConfigured
								? `Daily ${
										viewMode === 'work' ? 'work' : 'rest'
									} challenge progress`
								: `12-hour daily ${
										viewMode === 'work' ? 'work' : 'rest'
									} progress`
						}
					>
						{statusTypography}
						{timerDigits}
						{workFreeGoalConfigured
							? challengeProgressStats
							: workTodayStats}
						{taskChip}
						{timerControls}
					</TimerProgressRing>
				) : (
					<TimerProgressRing
						value={displayRemaining}
						total={pomodoroTotalSeconds}
						label="Pomodoro time remaining"
					>
						{statusTypography}
						{timerDigits}
						{taskChip}
						{timerControls}
					</TimerProgressRing>
				)}
			</Box>
		</Box>
	);
}
