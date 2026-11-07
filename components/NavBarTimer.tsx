'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { usePomodoroTimer } from '@/components/PomodoroContext';
import { Box, Typography, IconButton, Tooltip } from '@mui/joy';
import { Clock, Play, Pause, SkipForward, RotateCcw } from 'lucide-react';
import { kronaNavTimerControlSx, kronaNavTimerTaskBadgeSx, kronaNavBarTimeTextSx } from '@/lib/kronaStyles';
import { projectsDeepLink, taskDeepLink } from '@/lib/reminderSync';
import { useSelectedTimerTask } from '@/lib/selectedTimerTask';
import { localData } from '@/lib/localData';

function modeLabel(
	mode: 'work' | 'break' | 'longBreak',
	workFree = false,
) {
	if (mode === 'work') return '💪 Work';
	if (mode === 'break') return workFree ? '🔋 Rest' : '🔋 Short Break';
	return '☕ Long Break';
}

function TimerTaskBadge({
	taskId,
	taskName,
	projectId,
	sx,
}: {
	taskId: string;
	taskName: string;
	projectId: string | null;
	sx?: React.ComponentProps<typeof Box>['sx'];
}) {
	const router = useRouter();
	const [navigating, setNavigating] = React.useState(false);

	const openTask = React.useCallback(
		async (event: React.MouseEvent | React.KeyboardEvent) => {
			event.preventDefault();
			event.stopPropagation();
			if (navigating) return;

			const knownHref = taskDeepLink(projectId, taskId);
			if (knownHref) {
				router.push(knownHref);
				return;
			}

			setNavigating(true);
			try {
				const { data } = await localData
					.from('tasks')
					.select('project_id')
					.eq('id', taskId)
					.maybeSingle();
				const resolvedProjectId = data?.project_id ?? null;
				if (resolvedProjectId) {
					router.push(projectsDeepLink(resolvedProjectId, taskId));
					return;
				}
				router.push('/');
			} finally {
				setNavigating(false);
			}
		},
		[navigating, projectId, router, taskId],
	);

	return (
		<Box
			component="button"
			type="button"
			onClick={(event) => {
				void openTask(event);
			}}
			onKeyDown={(event) => {
				if (event.key === 'Enter' || event.key === ' ') {
					void openTask(event);
				}
			}}
			disabled={navigating}
			sx={[
				kronaNavTimerTaskBadgeSx,
				{
					cursor: 'pointer',
					appearance: 'none',
					font: 'inherit',
					textAlign: 'left',
					transition: 'background-color 0.15s ease, border-color 0.15s ease',
					'&:hover': {
						filter: 'brightness(1.12)',
					},
					'&:focus-visible': {
						outline: '2px solid var(--krona-text-36)',
						outlineOffset: 2,
					},
				},
				...(sx ? (Array.isArray(sx) ? sx : [sx]) : []),
			]}
			title={`Open task: ${taskName}`}
			aria-label={`Open task: ${taskName}`}
		>
			<Clock size={16} strokeWidth={2.25} color="var(--krona-text)" aria-hidden />
			<Typography
				level="body-sm"
				sx={{
					fontWeight: 600,
					fontSize: 13,
					lineHeight: 1.25,
					color: 'var(--krona-text)',
					overflow: 'hidden',
					textOverflow: 'ellipsis',
					whiteSpace: 'nowrap',
					minWidth: 0,
				}}
			>
				{taskName}
			</Typography>
		</Box>
	);
}

/** Focus timer + controls shown in the center of the app nav bar on every page. */
export default function NavBarTimer({
	compact = false,
}: {
	compact?: boolean;
}) {
	const {
		running,
		start,
		pause,
		skip,
		reset,
		format,
		mode,
		viewMode,
		displayRemaining,
		timerStyle,
		durations,
	} = usePomodoroTimer();
	const workFree = timerStyle === 'workFree';
	const activeMode = workFree ? viewMode : mode;
	const { taskId, taskName, projectId } = useSelectedTimerTask();
	const showTaskBadge = Boolean(taskId && taskName) && activeMode === 'work';
	const startSeconds =
		activeMode === 'work'
			? durations.workMinutes * 60
			: activeMode === 'break'
				? durations.breakMinutes * 60
				: durations.longBreakMinutes * 60;
	/** Idle at full duration — nothing to restart. */
	const showReset = !workFree && (running || displayRemaining < startSeconds);

	if (compact) {
		return (
			<Box role="group" aria-label="Focus timer" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, width: 'max-content', flexShrink: 0 }}>
				<Typography component="span" aria-label={`Focus timer: ${format(displayRemaining)}`} sx={{ ...kronaNavBarTimeTextSx, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', textAlign: 'center', mr: 0.5 }}>
					{format(displayRemaining)}
				</Typography>
				<IconButton size="sm" aria-label={running ? 'Pause timer' : 'Start timer'} onClick={running ? pause : () => start()} sx={kronaNavTimerControlSx}>
					{running ? <Pause size={16} /> : <Play size={16} />}
				</IconButton>
				<IconButton size="sm" aria-label={workFree ? (activeMode === 'work' ? 'Switch to rest' : 'Switch to work') : 'Skip session'} onClick={skip} sx={kronaNavTimerControlSx}>
					<SkipForward size={16} />
				</IconButton>
				{showReset ? (
					<IconButton size="sm" aria-label="Reset timer" onClick={reset} sx={kronaNavTimerControlSx}>
						<RotateCcw size={16} />
					</IconButton>
				) : null}
			</Box>
		);
	}

	return (
		<Box
			role="group"
			aria-label="Focus timer"
			sx={{
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				gap: { xs: 0.5, sm: 1 },
				/* max-content — never stretch to fill the center slot (that spaces
				   Work / task / time apart). The wrapper centers this cluster
				   between the left menu and the date chip. */
				width: 'max-content',
				maxWidth: '100%',
				minWidth: 0,
			}}
		>
			<Typography
				level="body-md"
				component="span"
				sx={{
					fontFamily: 'Poppins, sans-serif',
					fontSize: { xs: 13, sm: 14 },
					fontWeight: 500,
					color: 'var(--krona-text)',
					whiteSpace: 'nowrap',
					flexShrink: 0,
				}}
			>
				{modeLabel(activeMode, workFree)}
			</Typography>
			{showTaskBadge && taskId && taskName ? (
				<TimerTaskBadge
					taskId={taskId}
					taskName={taskName}
					projectId={projectId}
					sx={{ ml: { xs: 0.5, sm: 1 } }}
				/>
			) : null}
			<Typography
				level="body-md"
				sx={{
					...kronaNavBarTimeTextSx,
					minWidth: { xs: 52, sm: 64 },
					textAlign: 'center',
					flexShrink: 0,
				}}
			>
				{format(displayRemaining)}
			</Typography>
			{running ? (
				<Tooltip title="Pause">
					<IconButton size="sm" variant="plain" onClick={pause} sx={kronaNavTimerControlSx}>
						<Pause size={18} />
					</IconButton>
				</Tooltip>
			) : (
				<Tooltip title="Start">
					<IconButton
						size="sm"
						variant="plain"
						onClick={() => start()}
						sx={kronaNavTimerControlSx}
					>
						<Play size={18} />
					</IconButton>
				</Tooltip>
			)}
			<Tooltip
				title={
					workFree
						? activeMode === 'work'
							? 'Switch to rest'
							: 'Switch to work'
						: 'Skip'
				}
			>
				<IconButton size="sm" variant="plain" onClick={skip} sx={kronaNavTimerControlSx}>
					<SkipForward size={18} />
				</IconButton>
			</Tooltip>
			{showReset ? (
				<Tooltip title="Reset">
					<IconButton size="sm" variant="plain" onClick={reset} sx={kronaNavTimerControlSx}>
						<RotateCcw size={18} />
					</IconButton>
				</Tooltip>
			) : null}
		</Box>
	);
}
