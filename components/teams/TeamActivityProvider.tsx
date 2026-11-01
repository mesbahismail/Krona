'use client';

import * as React from 'react';
import { Box, IconButton, Typography } from '@mui/joy';
import {
	Activity,
	Bell,
	Cake,
	CalendarDays,
	ClipboardList,
	FolderKanban,
	Palmtree,
	Star,
	Timer,
	TrendingDown,
	Trophy,
	UserCheck,
	X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAppRuntimeActive } from '@/app/AppRuntimeActiveContext';
import { useTeamMode } from '@/components/teams/TeamModeContext';
import {
	fetchTodayTeamNotifications,
	markAllTeamNotificationsRead,
	markTeamNotificationRead,
} from '@/lib/teams/org';
import type { TeamNotification } from '@/lib/teams/types';
import {
	kronaIconTileSx,
	kronaSecondaryIconButtonSx,
	kronaWidgetListItemSx,
} from '@/lib/kronaStyles';
import { showKronaToast } from '@/lib/kronaToast';
import { localData } from '@/lib/localData';

function hrefForNotification(
	item: TeamNotification,
	inTeamMode: boolean,
): string | null {
	const kind = item.kind;
	const entity = item.entityType;

	if (kind === 'performance_alert' || entity === 'performance') {
		return inTeamMode ? '/team/performance' : '/performance';
	}
	if (entity === 'timer_rest' || entity === 'timer_runaway') {
		return inTeamMode ? '/team/performance' : '/performance';
	}
	if (
		kind === 'reminder_assigned' ||
		kind === 'reminder_created' ||
		kind === 'reminder_due' ||
		kind === 'vacation_notice' ||
		kind === 'vacation_added' ||
		kind === 'birthday' ||
		entity === 'team_reminder' ||
		entity === 'reminder' ||
		entity === 'vacation' ||
		entity === 'birthday'
	) {
		return inTeamMode ? '/team/reminders' : '/reminders';
	}
	if (
		kind === 'task_assigned' ||
		kind === 'task_completed' ||
		kind === 'task_prioritized' ||
		kind === 'task_overtime' ||
		kind === 'deadline_added' ||
		kind === 'deadline_approaching' ||
		kind === 'project_assigned' ||
		kind === 'project_created' ||
		kind === 'project_submitted' ||
		entity === 'team_task' ||
		entity === 'team_project'
	) {
		if (
			inTeamMode &&
			entity === 'team_project' &&
			item.entityId
		) {
			return `/team/projects?project=${encodeURIComponent(item.entityId)}`;
		}
		return inTeamMode ? '/team/projects' : '/projects';
	}
	if (
		entity === 'daily_challenge' ||
		kind === 'challenge_assigned' ||
		kind === 'challenge_completed'
	) {
		return inTeamMode ? '/team' : '/';
	}
	if (
		entity === 'organization_member' ||
		kind === 'member_onboarding_completed'
	) {
		return '/team/members';
	}
	return null;
}

type TeamActivityState = {
	open: boolean;
	unreadCount: number;
	toggle: () => void;
	close: () => void;
	refresh: () => Promise<void>;
};

const TeamActivityContext = React.createContext<TeamActivityState | null>(null);

export function useTeamActivity(): TeamActivityState {
	const ctx = React.useContext(TeamActivityContext);
	if (!ctx) {
		return {
			open: false,
			unreadCount: 0,
			toggle: () => {},
			close: () => {},
			refresh: async () => {},
		};
	}
	return ctx;
}

function iconForKind(kind: string, entityType?: string | null) {
	if (entityType === 'timer_rest' || entityType === 'timer_runaway') {
		return Timer;
	}
	switch (kind) {
		case 'task_assigned':
		case 'task_completed':
			return ClipboardList;
		case 'task_prioritized':
			return Star;
		case 'project_assigned':
		case 'project_submitted':
		case 'project_created':
		case 'deadline_added':
		case 'deadline_approaching':
			return FolderKanban;
		case 'reminder_assigned':
		case 'reminder_created':
		case 'reminder_due':
			return CalendarDays;
		case 'challenge_assigned':
		case 'challenge_completed':
			return Trophy;
		case 'vacation_notice':
		case 'vacation_added':
			return Palmtree;
		case 'performance_alert':
			return TrendingDown;
		case 'birthday':
			return Cake;
		case 'task_overtime':
			return Timer;
		case 'member_onboarding_completed':
			return UserCheck;
		default:
			return Activity;
	}
}

function activityToastText(item: TeamNotification): string {
	const title = item.title.trim();
	const body = item.body?.trim() ?? '';
	if (title && body) return `${title} — ${body}`;
	return title || body || 'New team activity';
}

function timeLabel(iso: string) {
	try {
		return new Date(iso).toLocaleTimeString([], {
			hour: 'numeric',
			minute: '2-digit',
		});
	} catch {
		return '';
	}
}

function TeamActivityPanel({
	open,
	items,
	onClose,
	onOpenItem,
	emptyMessage,
}: {
	open: boolean;
	items: TeamNotification[];
	onClose: () => void;
	onOpenItem: (item: TeamNotification) => void;
	emptyMessage: string;
}) {
	const [entered, setEntered] = React.useState(false);

	React.useEffect(() => {
		if (!open) {
			setEntered(false);
			return;
		}
		const id = requestAnimationFrame(() => setEntered(true));
		return () => cancelAnimationFrame(id);
	}, [open]);

	if (!open) return null;

	return (
		<Box
			component="aside"
			aria-label="Team activity"
			sx={{
				position: 'fixed',
				top: 'var(--krona-ai-vv-top, 0px)',
				right: 0,
				width: { xs: '100%', md: 'min(380px, 92vw)' },
				height: 'var(--krona-ai-vvh, 100dvh)',
				maxHeight: 'var(--krona-ai-vvh, 100dvh)',
				zIndex: 1450,
				display: 'flex',
				flexDirection: 'column',
				backgroundImage: 'var(--krona-bg-gradient)',
				backgroundSize: '100vw 100vh',
				backgroundPosition: 'right top',
				backgroundRepeat: 'no-repeat',
				borderLeft: '1px solid var(--krona-surface-border)',
				transform: entered ? 'none' : 'translateX(100%)',
				transition: 'transform 0.36s cubic-bezier(0.22, 1, 0.36, 1)',
				willChange: 'transform',
				'@media (prefers-reduced-motion: reduce)': {
					transition: 'none',
				},
			}}
		>
			<Box
				sx={{
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
					gap: 1,
					px: 2,
					py: 1.5,
					minHeight: 'var(--krona-top-height, 60px)',
					borderBottom: '1px solid var(--krona-surface-border)',
					flexShrink: 0,
				}}
			>
				<Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
					<Bell size={18} color="var(--krona-text)" />
					<Typography
						level="title-md"
						sx={{ color: 'var(--krona-text)', fontWeight: 600 }}
					>
						Activity today
					</Typography>
				</Box>
				<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
					<IconButton
						size="sm"
						aria-label="Close activity"
						onClick={onClose}
						sx={kronaSecondaryIconButtonSx}
					>
						<X size={18} />
					</IconButton>
				</Box>
			</Box>

			<Box
				sx={{
					flex: 1,
					minHeight: 0,
					overflowY: 'auto',
					px: 1.5,
					py: 1.5,
					display: 'flex',
					flexDirection: 'column',
					gap: 1,
				}}
			>
				{items.length === 0 ? (
					<Box
						sx={{
							flex: 1,
							display: 'grid',
							placeItems: 'center',
							textAlign: 'center',
							px: 2,
						}}
					>
						<Box>
							<Bell
								size={36}
								strokeWidth={1.25}
								color="var(--krona-text)"
								style={{ opacity: 0.4 }}
							/>
							<Typography
								level="body-sm"
								sx={{ color: 'var(--krona-text-muted)', mt: 1.5 }}
							>
								{emptyMessage}
							</Typography>
						</Box>
					</Box>
				) : (
					items.map((item) => {
						const Icon = iconForKind(item.kind, item.entityType);
						const unread = !item.readAt;
						return (
							<Box
								key={item.id}
								role="button"
								tabIndex={0}
								onClick={() => onOpenItem(item)}
								onKeyDown={(e) => {
									if (e.key === 'Enter' || e.key === ' ') {
										e.preventDefault();
										onOpenItem(item);
									}
								}}
								sx={{
									...kronaWidgetListItemSx,
									display: 'flex',
									gap: 1.25,
									alignItems: 'flex-start',
									p: 1.25,
									borderRadius: '18px',
									cursor: 'pointer',
									textAlign: 'left',
									outline: 'none',
									'&:active': {
										borderColor: 'var(--krona-widget-border-hover)',
									},
									'&:active::before': {
										bgcolor: 'var(--krona-widget-list-item-hover)',
									},
								}}
							>
								<Box sx={{ ...kronaIconTileSx, zIndex: 1 }}>
									<Icon size={16} />
								</Box>
								<Box sx={{ minWidth: 0, flex: 1, zIndex: 1 }}>
									<Box
										sx={{
											display: 'flex',
											justifyContent: 'space-between',
											gap: 1,
											alignItems: 'baseline',
										}}
									>
										<Box
											sx={{
												display: 'flex',
												alignItems: 'center',
												gap: 0.75,
												minWidth: 0,
											}}
										>
											{unread ? (
												<Box
													aria-hidden
													sx={{
														width: 7,
														height: 7,
														borderRadius: '999px',
														bgcolor: 'var(--krona-accent)',
														flexShrink: 0,
													}}
												/>
											) : null}
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
												{item.title}
											</Typography>
										</Box>
										<Typography
											level="body-xs"
											sx={{ color: 'var(--krona-text-muted)', flexShrink: 0 }}
										>
											{timeLabel(item.createdAt)}
										</Typography>
									</Box>
									{item.body ? (
										<Typography
											level="body-xs"
											sx={{
												color: 'var(--krona-text-muted)',
												mt: 0.35,
												display: '-webkit-box',
												WebkitLineClamp: 2,
												WebkitBoxOrient: 'vertical',
												overflow: 'hidden',
											}}
										>
											{item.body}
										</Typography>
									) : null}
								</Box>
							</Box>
						);
					})
				)}
			</Box>
		</Box>
	);
}

export function TeamActivityProvider({ children }: { children: React.ReactNode }) {
	const runtimeActive = useAppRuntimeActive();
	const router = useRouter();
	const { hasTeam, mode, role } = useTeamMode();
	const [open, setOpen] = React.useState(false);
	const [items, setItems] = React.useState<TeamNotification[]>([]);
	const [unreadCount, setUnreadCount] = React.useState(0);
	const openRef = React.useRef(false);
	const primedIdsRef = React.useRef<Set<string> | null>(null);

	React.useEffect(() => {
		openRef.current = open;
	}, [open]);

	const refresh = React.useCallback(async () => {
		if (!runtimeActive || !hasTeam) {
			setItems([]);
			setUnreadCount(0);
			primedIdsRef.current = null;
			return;
		}
		const today = await fetchTodayTeamNotifications();
		if (!primedIdsRef.current) {
			primedIdsRef.current = new Set(today.map((item) => item.id));
		} else {
			const fresh = today.filter((item) => !primedIdsRef.current!.has(item.id));
			for (const item of fresh.slice(0, 6)) {
				showKronaToast(activityToastText(item), { id: `activity:${item.id}` });
				primedIdsRef.current.add(item.id);
			}
			for (const item of fresh.slice(6)) {
				primedIdsRef.current.add(item.id);
			}
		}
		// Opening the panel means these are read. Don't let a stale poll
		// put the unread dot back on while Activity is open.
		if (openRef.current) {
			const readAt = new Date().toISOString();
			setItems(
				today.map((item) => (item.readAt ? item : { ...item, readAt })),
			);
			setUnreadCount(0);
			return;
		}
		setItems(today);
		setUnreadCount(today.filter((item) => !item.readAt).length);
	}, [runtimeActive, hasTeam]);

	React.useEffect(() => {
		void refresh();
		if (!runtimeActive || !hasTeam) return;
		const id = window.setInterval(() => void refresh(), 30_000);
		return () => window.clearInterval(id);
	}, [refresh, runtimeActive, hasTeam]);

	React.useEffect(() => {
		if (!runtimeActive || !hasTeam) return;
		let cancelled = false;
		let channel: ReturnType<typeof localData.channel> | null = null;
		void (async () => {
			const { data } = await localData.auth.getUser();
			const userId = data.user?.id;
			if (!userId || cancelled) return;
			channel = localData
				.channel(`team-activity:${userId}`)
				.on(
					'postgres_changes',
					{
						event: 'INSERT',
						schema: 'public',
						table: 'team_notifications',
						filter: `user_id=eq.${userId}`,
					},
					() => {
						void refresh();
					},
				)
				.subscribe();
		})();
		return () => {
			cancelled = true;
			if (channel) void localData.removeChannel(channel);
		};
	}, [refresh, runtimeActive, hasTeam]);

	React.useEffect(() => {
		if (!open) return;
		const readAt = new Date().toISOString();
		setItems((current) =>
			current.map((item) => (item.readAt ? item : { ...item, readAt })),
		);
		setUnreadCount(0);
		void markAllTeamNotificationsRead();
	}, [open]);

	const close = React.useCallback(() => setOpen(false), []);

	const toggle = React.useCallback(() => setOpen((prev) => !prev), []);

	const onOpenItem = async (item: TeamNotification) => {
		if (!item.readAt) {
			await markTeamNotificationRead(item.id);
			await refresh();
		}
		const href = hrefForNotification(item, mode === 'team');
		if (href) {
			setOpen(false);
			router.push(href);
		}
	};

	const value = React.useMemo(
		() => ({ open, unreadCount, toggle, close, refresh }),
		[open, unreadCount, toggle, close, refresh],
	);

	const showPanel = hasTeam;
	const emptyMessage =
		role === 'member'
			? 'No updates from your manager yet today.'
			: 'No team activity yet today.';

	return (
		<TeamActivityContext.Provider value={value}>
			{children}
			{showPanel ? (
				<TeamActivityPanel
					open={open}
					items={items}
					onClose={close}
					onOpenItem={(item) => void onOpenItem(item)}
					emptyMessage={emptyMessage}
				/>
			) : null}
		</TeamActivityContext.Provider>
	);
}
