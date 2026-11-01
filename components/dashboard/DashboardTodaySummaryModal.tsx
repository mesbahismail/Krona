'use client';

import * as React from 'react';
import { Box, IconButton, Modal, ModalDialog, Typography } from '@mui/joy';
import { BriefcaseBusiness, Coffee, X } from 'lucide-react';
import { usePomodoroStats } from '@/components/PomodoroContext';
import {
	kronaModalCloseButtonSx,
	kronaModalDialogSx,
	kronaModalTitleSx,
	kronaWidgetListScrollSx,
} from '@/lib/kronaStyles';

type SummaryTask = {
	id: string;
	name: string;
};

type TodayLog = {
	key: string;
	kind: 'work' | 'rest';
	timestamp: number;
	duration: number;
	taskName: string | null;
};

function isToday(timestamp: number): boolean {
	const date = new Date(timestamp);
	const now = new Date();
	return (
		date.getFullYear() === now.getFullYear() &&
		date.getMonth() === now.getMonth() &&
		date.getDate() === now.getDate()
	);
}

function formatDuration(totalSeconds: number): string {
	const seconds = Math.max(0, Math.round(totalSeconds));
	if (seconds < 60) return `${seconds}s`;
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	if (hours === 0) return `${minutes}m`;
	return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

function formatTimeRange(timestamp: number, duration: number): string {
	const end = new Date(timestamp);
	const start = new Date(timestamp - duration * 1000);
	const format = (date: Date) =>
		date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	return `${format(start)} – ${format(end)}`;
}

export default function DashboardTodaySummaryModal({
	open,
	onClose,
	tasks,
}: {
	open: boolean;
	onClose: () => void;
	tasks: SummaryTask[];
}) {
	const { sessions, restSessions } = usePomodoroStats();
	const taskNames = React.useMemo(
		() => new Map(tasks.map((task) => [task.id, task.name])),
		[tasks],
	);
	const logs = React.useMemo<TodayLog[]>(() => {
		const workLogs = sessions
			.filter((session) => isToday(session.timestamp))
			.map((session) => ({
				key: `work-${session.timestamp}-${session.duration}-${session.taskId ?? ''}`,
				kind: 'work' as const,
				timestamp: session.timestamp,
				duration: session.duration,
				taskName: session.taskId
					? (taskNames.get(session.taskId) ?? null)
					: null,
			}));
		const restLogs = restSessions
			.filter((session) => isToday(session.timestamp))
			.map((session) => ({
				key: `rest-${session.timestamp}-${session.duration}`,
				kind: 'rest' as const,
				timestamp: session.timestamp,
				duration: session.duration,
				taskName: null,
			}));
		return [...workLogs, ...restLogs].sort((a, b) => b.timestamp - a.timestamp);
	}, [sessions, restSessions, taskNames]);

	return (
		<Modal open={open} onClose={onClose}>
			<ModalDialog
				sx={{
					...kronaModalDialogSx,
					width: 'min(520px, calc(100vw - 32px))',
					maxWidth: 520,
					maxHeight: 'min(720px, calc(100vh - 32px))',
					display: 'flex',
					flexDirection: 'column',
				}}
			>
				<IconButton
					aria-label="Close today summary"
					onClick={onClose}
					sx={kronaModalCloseButtonSx}
				>
					<X size={18} />
				</IconButton>
				<Typography level="h4" sx={kronaModalTitleSx}>
					Today summary
				</Typography>

				<Box
					className="krona-widget-scroll"
					sx={{
						...kronaWidgetListScrollSx,
						mt: 0,
						pt: 0,
						flex: 1,
						minHeight: 0,
						overflowY: 'auto',
					}}
				>
					{logs.length === 0 ? (
						<Box
							sx={{
								minHeight: 150,
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								textAlign: 'center',
							}}
						>
							<Typography
								level="body-sm"
								sx={{ color: 'var(--krona-text-muted)' }}
							>
								No work or rest time has been recorded today.
							</Typography>
						</Box>
					) : (
						logs.map((log, index) => {
							const Icon = log.kind === 'work' ? BriefcaseBusiness : Coffee;
							return (
								<Box
									key={log.key}
									sx={{
										display: 'flex',
										alignItems: 'center',
										gap: '12px',
										py: '12px',
										borderTop:
											index === 0
												? 'none'
												: '1px solid var(--krona-surface-border)',
									}}
								>
									<Box
										sx={{
											width: 34,
											height: 34,
											borderRadius: '12px',
											display: 'flex',
											alignItems: 'center',
											justifyContent: 'center',
											flexShrink: 0,
											bgcolor: 'var(--krona-secondary-bg)',
											color: 'var(--krona-text-muted)',
										}}
									>
										<Icon size={16} aria-hidden />
									</Box>
									<Box sx={{ minWidth: 0, flex: 1 }}>
										<Typography
											level="body-sm"
											sx={{
												color: 'var(--krona-text)',
												fontWeight: 600,
												overflow: 'hidden',
												textOverflow: 'ellipsis',
												whiteSpace: 'nowrap',
											}}
										>
											{log.kind === 'work'
												? log.taskName || 'Work session'
												: 'Rest session'}
										</Typography>
										<Typography
											level="body-xs"
											sx={{ mt: 0.25, color: 'var(--krona-text-muted)' }}
										>
											{formatTimeRange(log.timestamp, log.duration)}
										</Typography>
									</Box>
									<Typography
										level="body-sm"
										sx={{
											color: 'var(--krona-text-muted)',
											fontWeight: 600,
											flexShrink: 0,
										}}
									>
										{formatDuration(log.duration)}
									</Typography>
								</Box>
							);
						})
					)}
				</Box>
			</ModalDialog>
		</Modal>
	);
}
