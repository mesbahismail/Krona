'use client';

import * as React from 'react';
import { useKronaLayoutMode } from '@/components/KronaLayoutModeProvider';
import {
	Box,
	Button,
	Dropdown,
	IconButton,
	Input,
	Menu,
	MenuButton,
	MenuItem,
	Tooltip,
	Typography,
} from '@mui/joy';
import {
	ChevronLeft,
	ChevronRight,
	Bell,
	Check,
	Edit,
	ListFilter,
	Plus,
	Search,
	Trash2,
	User,
} from 'lucide-react';
import dayjs from 'dayjs';
import TeamAppShell from '@/components/teams/TeamAppShell';
import KronaMoreMenuButton from '@/components/krona/KronaMoreMenuButton';
import KronaResizableSplitLayout from '@/components/krona/KronaResizableSplitLayout';
import TeamReminderCreateModal from '@/components/teams/TeamReminderCreateModal';
import ReminderTypeIcon from '@/components/ReminderTypeIcon';
import { RemindersPageSkeleton } from '@/components/krona/KronaPageSkeletons';
import { useTeamMode } from '@/components/teams/TeamModeContext';
import {
	fetchTeamReminders,
	type TeamReminderRow,
} from '@/lib/teams/dashboard';
import {
	deleteTeamReminder,
	fetchOrgMembers,
	organizationMemberLabel,
} from '@/lib/teams/org';
import type { OrganizationMember } from '@/lib/teams/types';
import { localData } from '@/lib/localData';
import { mergeMembers, mergeReminders } from '@/lib/teams/stableLists';
import { formatReminderDateTime } from '@/lib/reminderOrder';
import { kronaPlaceholders } from '@/lib/kronaPlaceholders';
import { showKronaError, showKronaSuccess } from '@/lib/kronaToast';
import {
	kronaDeleteMenuItemProps,
	kronaListTopFadeMask,
	kronaMenuItemSx,
	kronaMenuSx,
	kronaPrimaryIconButtonSx,
	kronaSearchInputSx,
	kronaSecondaryButtonSx,
	kronaSecondaryIconButtonSx,
	kronaSelectedMenuItemProps,
	kronaSideListToolbarRowSx,
	kronaTabBarSx,
	kronaTabButtonSx,
	kronaToggleIconButtonSx,
	kronaWidgetListItemSx,
} from '@/lib/kronaStyles';

type RemindersViewTab = 'list' | 'calendar';
type ReminderDateAddedSort = 'due' | 'newest' | 'oldest';

const ASSIGNEE_TAG_SX = {
	bgcolor: 'color-mix(in srgb, #c2a86f 18%, transparent)',
	border: '1px solid color-mix(in srgb, #c2a86f 42%, transparent)',
	color: 'color-mix(in srgb, #c2a86f 68%, var(--krona-text))',
	'& svg': { color: 'currentColor' },
};

function memberLabel(
	userId: string | null,
	membersById: Map<string, OrganizationMember>,
) {
	if (!userId) return 'Unassigned';
	return organizationMemberLabel(membersById.get(userId));
}

function getDurationLeft(date: string) {
	const now = new Date();
	const due = new Date(date);
	if (Number.isNaN(due.getTime())) return 'Overdue';
	const startOfToday = new Date(now);
	startOfToday.setHours(0, 0, 0, 0);
	const startOfDue = new Date(due);
	startOfDue.setHours(0, 0, 0, 0);
	const days = Math.round(
		(startOfDue.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24),
	);
	if (days < 0) return 'Overdue';
	if (days === 0) return 'Today';
	if (days === 1) return '1 day';
	return `${days} days`;
}

function getMonthMatrix(year: number, month: number) {
	const first = dayjs(new Date(year, month, 1));
	let day = first.startOf('week');
	const matrix: dayjs.Dayjs[][] = [];
	let week: dayjs.Dayjs[] = [];
	for (let i = 0; i < 42; i += 1) {
		week.push(day);
		day = day.add(1, 'day');
		if (week.length === 7) {
			matrix.push(week);
			week = [];
		}
	}
	return matrix;
}

function TeamRemindersCalendar({
	reminders,
	focusDate,
}: {
	reminders: TeamReminderRow[];
	focusDate?: dayjs.Dayjs | null;
}) {
	const [current, setCurrent] = React.useState(dayjs());

	React.useEffect(() => {
		if (focusDate) setCurrent(focusDate.startOf('month'));
	}, [focusDate]);

	const matrix = getMonthMatrix(current.year(), current.month());
	const remindersByDate = React.useMemo(() => {
		const map: Record<string, TeamReminderRow[]> = {};
		for (const reminder of reminders) {
			if (!reminder.due_at) continue;
			const key = dayjs(reminder.due_at).format('YYYY-MM-DD');
			if (!map[key]) map[key] = [];
			map[key].push(reminder);
		}
		return map;
	}, [reminders]);

	return (
		<Box
			sx={{
				width: '100%',
				height: '100%',
				minHeight: 0,
				display: 'flex',
				flexDirection: 'column',
			}}
		>
			<Box
				sx={{
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
					mb: 1.5,
					flexShrink: 0,
				}}
			>
				<Button variant="plain" size="sm" aria-label="Previous month" onClick={() => setCurrent(current.subtract(1, 'month'))} sx={{ ...kronaSecondaryButtonSx, minWidth: 32, width: 32, px: 0, flexShrink: 0 }}><ChevronLeft size={16} /></Button>
				<Typography
					level="title-lg"
					sx={{ color: 'var(--krona-text)', fontWeight: 600, fontSize: { xs: 14, md: 18 }, minWidth: 0, textAlign: 'center', mx: 1 }}
				>
					{current.format('MMMM YYYY')}
				</Typography>
				<Button variant="plain" size="sm" aria-label="Next month" onClick={() => setCurrent(current.add(1, 'month'))} sx={{ ...kronaSecondaryButtonSx, minWidth: 32, width: 32, px: 0, flexShrink: 0 }}><ChevronRight size={16} /></Button>
			</Box>
			<Box
				sx={{
					flex: 1,
					minHeight: 0,
					display: 'flex',
					flexDirection: 'column',
					borderRadius: '16px',
					border: '1px solid var(--krona-surface-border)',
					overflow: 'hidden',
				}}
			>
				<Box
					sx={{
						display: 'grid',
						gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
						flexShrink: 0,
						borderBottom: '1px solid var(--krona-overlay-active)',
					}}
				>
					{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label) => (
						<Typography
							key={label}
							level="body-xs"
							sx={{
								textAlign: 'center',
								fontWeight: 600,
								color: 'var(--krona-text)',
								py: 0.75,
							}}
						>
							{label}
						</Typography>
					))}
				</Box>
				<Box
					sx={{
						flex: 1,
						minHeight: 0,
						display: 'grid',
						gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
						gridTemplateRows: 'repeat(6, minmax(0, 1fr))',
					}}
				>
					{matrix.flat().map((day, idx) => {
						const isCurrentMonth = day.month() === current.month();
						const key = day.format('YYYY-MM-DD');
						const dayReminders = remindersByDate[key] || [];
						const isToday = key === dayjs().format('YYYY-MM-DD');
						return (
							<Box
								key={key + idx}
								sx={{
									minHeight: 0,
									borderRight:
										idx % 7 < 6
											? '1px solid var(--krona-overlay-hover)'
											: 'none',
									borderBottom:
										idx < 35
											? '1px solid var(--krona-overlay-hover)'
											: 'none',
									p: 0.75,
									opacity: isCurrentMonth ? 1 : 0.4,
									position: 'relative',
									overflow: 'hidden',
									display: 'flex',
									flexDirection: 'column',
									outline: isToday
										? '2px solid var(--krona-accent)'
										: 'none',
									outlineOffset: -2,
								}}
							>
								<Typography
									level="body-xs"
									sx={{
										fontWeight: 600,
										mb: 0.25,
										color: 'var(--krona-text)',
										flexShrink: 0,
										lineHeight: 1.2,
									}}
								>
									{day.date()}
								</Typography>
								<Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
									{dayReminders.slice(0, 3).map((reminder) => (
										<Box
											key={reminder.id}
											sx={{
												mt: 0.25,
												px: 0.75,
												py: 0.25,
												borderRadius: '999px',
												...ASSIGNEE_TAG_SX,
												fontSize: 10,
												lineHeight: 1.2,
												whiteSpace: 'nowrap',
												overflow: 'hidden',
												textOverflow: 'ellipsis',
												display: 'flex',
												alignItems: 'center',
												gap: 0.4,
											}}
											title={reminder.name}
										>
											<ReminderTypeIcon
												type="Work"
												size={12}
												className="shrink-0"
											/>
											{reminder.name}
										</Box>
									))}
									{dayReminders.length > 3 ? (
										<Typography
											level="body-xs"
											sx={{
												color: 'var(--krona-text-muted)',
												mt: 0.25,
												fontSize: 10,
											}}
										>
											+{dayReminders.length - 3} more
										</Typography>
									) : null}
								</Box>
							</Box>
						);
					})}
				</Box>
			</Box>
		</Box>
	);
}

export default function TeamRemindersPage() {
	const { isDesktopDashboard } = useKronaLayoutMode();
	const stackedReminders = !isDesktopDashboard;
	const { organization, isManager, canCreateEditReminders } = useTeamMode();
	const [reminders, setReminders] = React.useState<TeamReminderRow[]>([]);
	const [members, setMembers] = React.useState<OrganizationMember[]>([]);
	const [search, setSearch] = React.useState('');
	const [dateAddedSort, setDateAddedSort] =
		React.useState<ReminderDateAddedSort>('due');
	const [memberFilter, setMemberFilter] = React.useState('all');
	const [viewTab, setViewTab] = React.useState<RemindersViewTab>('list');
	const [calendarFocus, setCalendarFocus] = React.useState<dayjs.Dayjs | null>(
		null,
	);
	const [loading, setLoading] = React.useState(true);
	const loadedOnceRef = React.useRef(false);
	const orgId = organization?.id ?? null;
	const [modalOpen, setModalOpen] = React.useState(false);
	const [editing, setEditing] = React.useState<TeamReminderRow | null>(null);

	const membersById = React.useMemo(
		() => new Map(members.map((member) => [member.userId, member] as const)),
		[members],
	);

	const load = React.useCallback(async () => {
		if (!orgId) return;
		const showSpinner = !loadedOnceRef.current;
		if (showSpinner) setLoading(true);
		try {
			const { data: userRes } = await localData.auth.getUser();
			const uid = userRes.user?.id;
			const canViewAllTeamReminders = isManager || canCreateEditReminders;
			const [rows, memberList] = await Promise.all([
				fetchTeamReminders(orgId, {
					// Managers/owners and members with reminder access see every
					// org reminder (including deadlines created by teammates).
					// Everyone else only sees reminders assigned to or created by them.
					visibleToUserId:
						!canViewAllTeamReminders && uid ? uid : undefined,
					limit: 300,
				}),
				fetchOrgMembers(orgId),
			]);
			setReminders((prev) => mergeReminders(prev, rows));
			setMembers((prev) => mergeMembers(prev, memberList));
			loadedOnceRef.current = true;
		} finally {
			if (showSpinner) setLoading(false);
		}
	}, [canCreateEditReminders, isManager, orgId]);

	React.useEffect(() => {
		void load();
	}, [load]);

	const displayReminders = React.useMemo(() => {
		const query = search.toLowerCase();
		let filtered = reminders.filter((reminder) =>
			reminder.name.toLowerCase().includes(query),
		);
		if ((isManager || canCreateEditReminders) && memberFilter !== 'all') {
			filtered = filtered.filter(
				(reminder) => reminder.assignee_user_id === memberFilter,
			);
		}
		if (dateAddedSort === 'newest') {
			return [...filtered].sort(
				(a, b) =>
					new Date(b.created_at ?? 0).getTime() -
					new Date(a.created_at ?? 0).getTime(),
			);
		}
		if (dateAddedSort === 'oldest') {
			return [...filtered].sort(
				(a, b) =>
					new Date(a.created_at ?? 0).getTime() -
					new Date(b.created_at ?? 0).getTime(),
			);
		}
		return [...filtered].sort((a, b) => {
			if (!a.due_at && !b.due_at) return 0;
			if (!a.due_at) return 1;
			if (!b.due_at) return -1;
			return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
		});
	}, [canCreateEditReminders, dateAddedSort, isManager, memberFilter, reminders, search]);

	const filterActive = dateAddedSort !== 'due';
	const canFilterByMember = isManager || canCreateEditReminders;
	const memberFilterActive = canFilterByMember && memberFilter !== 'all';

	const markDone = async (reminder: TeamReminderRow) => {
		if (reminder.status === 'done') return;
		const { error } = await localData
			.from('team_reminders')
			.update({ status: 'done' })
			.eq('id', reminder.id);
		if (error) {
			showKronaError('Could not mark reminder as done.');
			return;
		}
		showKronaSuccess('Reminder marked as done.');
		await load();
	};

	const removeReminder = async (reminder: TeamReminderRow) => {
		if (!organization) return;
		const ok = await deleteTeamReminder({
			organizationId: organization.id,
			reminderId: reminder.id,
		});
		if (!ok) {
			showKronaError('Could not delete reminder.');
			return;
		}
		showKronaSuccess('Reminder deleted.');
		await load();
	};

	const renderSortFilter = () => (
		<Dropdown>
			<MenuButton
				slots={{ root: IconButton }}
				slotProps={{
					root: {
						size: 'sm',
						'aria-label': 'Filter reminders',
						sx: {
							...kronaSecondaryIconButtonSx,
							...(filterActive
								? {
										background: 'var(--krona-accent-gradient)',
										bgcolor: 'transparent',
										borderColor: 'transparent',
										color: '#fff',
										'&:hover': {
											background: 'var(--krona-accent-gradient-hover)',
											bgcolor: 'transparent',
											opacity: 1,
										},
									}
								: {}),
						},
					},
				}}
			>
				<ListFilter size={16} />
			</MenuButton>
			<Menu
				placement="bottom-end"
				sx={{ ...kronaMenuSx, minWidth: 200, maxWidth: 260 }}
			>
				<MenuItem disabled sx={kronaMenuItemSx}>
					<Typography
						level="body-xs"
						sx={{ fontWeight: 700, color: 'var(--krona-text-muted)' }}
					>
						Date added
					</Typography>
				</MenuItem>
				<MenuItem
					{...kronaSelectedMenuItemProps(dateAddedSort === 'due')}
					onClick={() => setDateAddedSort('due')}
				>
					Due date order
				</MenuItem>
				<MenuItem
					{...kronaSelectedMenuItemProps(dateAddedSort === 'newest')}
					onClick={() => setDateAddedSort('newest')}
				>
					Newest first
				</MenuItem>
				<MenuItem
					{...kronaSelectedMenuItemProps(dateAddedSort === 'oldest')}
					onClick={() => setDateAddedSort('oldest')}
				>
					Oldest first
				</MenuItem>
			</Menu>
		</Dropdown>
	);

	const renderMemberFilter = () => {
		if (!canFilterByMember) return null;
		return (
			<Dropdown>
				<Tooltip title="Filter by teammate">
					<MenuButton
						slots={{ root: IconButton }}
						slotProps={{
							root: {
								size: 'sm',
								'aria-label': 'Filter by teammate',
								'aria-pressed': memberFilterActive,
								sx: kronaToggleIconButtonSx(memberFilterActive),
							},
						}}
					>
						<User size={16} />
					</MenuButton>
				</Tooltip>
				<Menu
					placement="bottom-end"
					sx={{
						...kronaMenuSx,
						minWidth: 220,
						maxHeight: 280,
						overflowY: 'auto',
					}}
				>
					<MenuItem
						{...kronaSelectedMenuItemProps(memberFilter === 'all')}
						onClick={() => setMemberFilter('all')}
					>
						All team
					</MenuItem>
					{members.map((member) => {
						const label = organizationMemberLabel(member);
						return (
							<MenuItem
								key={member.userId}
								{...kronaSelectedMenuItemProps(
									memberFilter === member.userId,
								)}
								onClick={() => setMemberFilter(member.userId)}
							>
								{label}
							</MenuItem>
						);
					})}
				</Menu>
			</Dropdown>
		);
	};

	const renderToolbar = () => (
		<Box sx={{ ...kronaSideListToolbarRowSx, pb: 0 }}>
			<Input
				startDecorator={<Search size={16} aria-hidden />}
				placeholder={kronaPlaceholders.search.reminders}
				slotProps={{
					input: {
						placeholder: kronaPlaceholders.search.reminders,
						'aria-label': kronaPlaceholders.search.reminders,
					},
				}}
				value={search}
				onChange={(e) => setSearch(e.target.value)}
				sx={{ ...kronaSearchInputSx, flex: 1, minWidth: 0 }}
			/>
			{renderSortFilter()}
			{renderMemberFilter()}
			{canCreateEditReminders ? (
				<IconButton
					size="sm"
					aria-label="Add reminder"
					onClick={() => {
						setEditing(null);
						setModalOpen(true);
					}}
					sx={kronaPrimaryIconButtonSx}
				>
					<Plus size={16} />
				</IconButton>
			) : null}
		</Box>
	);

	const renderRemindersList = () => (
		<Box
			role="tabpanel"
			aria-label="Reminders list"
			sx={{
				flex: 1,
				overflowY: 'auto',
				overflowX: 'hidden',
				pt: { xs: 0, md: '20px' },
				pb: 1,
				minHeight: 0,
				maskImage: { xs: 'none', md: kronaListTopFadeMask },
				WebkitMaskImage: { xs: 'none', md: kronaListTopFadeMask },
			}}
		>
			{displayReminders.length === 0 ? (
				<Box
					sx={{
						display: 'flex',
						flexDirection: 'column',
						alignItems: 'center',
						textAlign: 'center',
						gap: 1.5,
						px: 2,
						py: 4,
					}}
				>
					<Bell
						size={40}
						strokeWidth={1.25}
						color="var(--krona-text)"
						style={{ opacity: 0.48 }}
						aria-hidden
					/>
					<Typography
						level="title-sm"
						sx={{ color: 'var(--krona-text)', fontWeight: 600 }}
					>
						{search.trim() || memberFilterActive
							? 'No matching reminders'
							: 'No reminders yet'}
					</Typography>
					<Typography
						level="body-sm"
						sx={{ color: 'var(--krona-text-muted)', maxWidth: 240 }}
					>
						{search.trim() || memberFilterActive
							? 'Try a different search or filter.'
							: 'Add a reminder to see it here and on the calendar.'}
					</Typography>
				</Box>
			) : (
				<Box
					sx={{
						display: 'flex',
						flexDirection: 'column',
						gap: '12px',
					}}
				>
					{displayReminders.map((reminder) => {
						const due = reminder.due_at;
						const assignee = memberLabel(
							reminder.assignee_user_id,
							membersById,
						);
						return (
							<Box
								key={reminder.id}
								id={`reminder-${reminder.id}`}
								onClick={() => {
									if (due) setCalendarFocus(dayjs(due));
								}}
								sx={{
									display: 'block',
									width: '100%',
									textAlign: 'left',
									cursor: due ? 'pointer' : 'default',
									bgcolor: 'transparent',
									color: 'inherit',
								}}
							>
								<Box
									sx={{
										...kronaWidgetListItemSx,
										position: 'relative',
										display: 'flex',
										alignItems: 'flex-start',
										gap: 1.25,
										p: 2,
										borderRadius: '18px',
										boxShadow: 'var(--krona-widget-item-shadow)',
									}}
								>
									<Box
										sx={{
											flex: 1,
											minWidth: 0,
											position: 'relative',
											zIndex: 1,
											display: 'flex',
											flexDirection: 'column',
											gap: '8px',
										}}
									>
										<Typography
											level="title-sm"
											sx={{
												color: 'var(--krona-text)',
												fontWeight: 600,
												overflow: 'hidden',
												textOverflow: 'ellipsis',
												whiteSpace: 'nowrap',
											}}
										>
											{reminder.name}
										</Typography>
										<Typography
											level="body-xs"
											sx={{ color: 'var(--krona-text-muted)' }}
										>
											{due
												? `${formatReminderDateTime(due)} · ${getDurationLeft(due)}`
												: 'No due date'}
										</Typography>
										<Box
											sx={{
												display: 'flex',
												alignItems: 'center',
												gap: 0.75,
												minWidth: 0,
												flexWrap: 'wrap',
											}}
										>
											<Box
												aria-label={`Assigned to ${assignee}`}
												sx={{
													...ASSIGNEE_TAG_SX,
													display: 'inline-flex',
													alignItems: 'center',
													gap: 0.4,
													px: 0.75,
													py: 0.2,
													borderRadius: '999px',
													fontSize: 11,
													fontWeight: 600,
													lineHeight: 1.2,
													flexShrink: 0,
												}}
											>
												<User size={12} aria-hidden />
												{assignee}
											</Box>
										</Box>
									</Box>
									{canCreateEditReminders ? (
										<Box
											sx={{
												position: 'relative',
												zIndex: 1,
												flexShrink: 0,
											}}
										>
											<Dropdown>
												<MenuButton
													slots={{ root: KronaMoreMenuButton }}
													slotProps={{
														root: {
															onClick: (e: React.MouseEvent) =>
																e.stopPropagation(),
														},
													}}
												/>
												<Menu
													placement="bottom-end"
													sx={{ ...kronaMenuSx, zIndex: 1500 }}
												>
													<MenuItem
														onClick={(e) => {
															e.stopPropagation();
															setEditing(reminder);
															setModalOpen(true);
														}}
													>
														<Edit size={16} style={{ marginRight: 8 }} />
														Edit
													</MenuItem>
													{reminder.status !== 'done' ? (
														<MenuItem
															onClick={(e) => {
																e.stopPropagation();
																void markDone(reminder);
															}}
														>
															<Check size={16} style={{ marginRight: 8 }} />
															Mark as done
														</MenuItem>
													) : null}
													<MenuItem
														onClick={(e) => {
															e.stopPropagation();
															void removeReminder(reminder);
														}}
														{...kronaDeleteMenuItemProps}
													>
														<Trash2 size={16} style={{ marginRight: 8 }} />
														Delete
													</MenuItem>
												</Menu>
											</Dropdown>
										</Box>
									) : null}
								</Box>
							</Box>
						);
					})}
				</Box>
			)}
		</Box>
	);

	const renderCalendarPanel = () => (
		<Box
			role="tabpanel"
			aria-label="Reminders calendar"
			sx={{
				flex: 1,
				minHeight: 0,
				minWidth: 0,
				display: 'flex',
				flexDirection: 'column',
				overflow: 'hidden',
				pt: { xs: 0.5, md: 1.5 },
				pb: { xs: 0, md: 1.5 },
			}}
		>
			<TeamRemindersCalendar
				reminders={displayReminders}
				focusDate={calendarFocus}
			/>
		</Box>
	);

	return (
		<TeamAppShell title="Team Reminders" fillViewport>
			{loading ? (
				<RemindersPageSkeleton />
			) : (
				<>
					<Box
						sx={{
							display: stackedReminders ? 'flex' : 'none',
							flexDirection: 'column',
							flex: 1,
							minHeight: 0,
							minWidth: 0,
							overflow: 'hidden',
						}}
					>
						<Box
							sx={{
								position: 'relative',
								pt: 1.5,
								pb: 0,
								display: 'flex',
								alignItems: 'center',
								gap: 1,
								flexShrink: 0,
							}}
						>
							<Input
								startDecorator={<Search size={16} aria-hidden />}
								placeholder={kronaPlaceholders.search.reminders}
								slotProps={{
									input: {
										placeholder: kronaPlaceholders.search.reminders,
										'aria-label': kronaPlaceholders.search.reminders,
									},
								}}
								value={search}
								onChange={(e) => setSearch(e.target.value)}
								sx={{ ...kronaSearchInputSx, flex: 1, minWidth: 0 }}
							/>
							{renderSortFilter()}
							{renderMemberFilter()}
							{canCreateEditReminders ? (
								<IconButton
									size="sm"
									aria-label="Add reminder"
									onClick={() => {
										setEditing(null);
										setModalOpen(true);
									}}
									sx={kronaPrimaryIconButtonSx}
								>
									<Plus size={16} />
								</IconButton>
							) : null}
						</Box>
						<Box sx={{ mt: '20px', mb: '20px', flexShrink: 0 }}>
							<Box
								sx={kronaTabBarSx}
								role="tablist"
								aria-label="Reminders view"
							>
								<Box
									component="button"
									type="button"
									role="tab"
									aria-selected={viewTab === 'list'}
									onClick={() => setViewTab('list')}
									sx={{
										...kronaTabButtonSx(viewTab === 'list'),
										px: 1.5,
										fontSize: 13,
									}}
								>
									List
								</Box>
								<Box
									component="button"
									type="button"
									role="tab"
									aria-selected={viewTab === 'calendar'}
									onClick={() => setViewTab('calendar')}
									sx={{
										...kronaTabButtonSx(viewTab === 'calendar'),
										px: 1.5,
										fontSize: 13,
									}}
								>
									Calendar
								</Box>
							</Box>
						</Box>
						<Box
							sx={{
								flex: 1,
								minHeight: 0,
								minWidth: 0,
								display: 'flex',
								flexDirection: 'column',
								overflow: 'hidden',
							}}
						>
							{viewTab === 'list'
								? renderRemindersList()
								: renderCalendarPanel()}
						</Box>
					</Box>

					<KronaResizableSplitLayout
						dividerAriaLabel="Resize reminders list and calendar"
						detailSx={{ pl: { xs: 0, md: '28px' } }}
						containerSx={{
							flex: 1,
							minHeight: 0,
							display: stackedReminders ? 'none' : 'flex',
						}}
						sidebar={
							<>
								{renderToolbar()}
								{renderRemindersList()}
							</>
						}
						detail={renderCalendarPanel()}
					/>
				</>
			)}

			{organization && canCreateEditReminders ? (
				<TeamReminderCreateModal
					open={modalOpen}
					onClose={() => {
						setModalOpen(false);
						setEditing(null);
					}}
					organizationId={organization.id}
					members={members}
					initial={editing}
					onCreated={() => void load()}
				/>
			) : null}
		</TeamAppShell>
	);
}
