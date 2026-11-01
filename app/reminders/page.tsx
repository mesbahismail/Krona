'use client';

import * as React from 'react';
import {
	Box,
	Button,
	CssBaseline,
	CssVarsProvider,
	Typography,
	Dropdown,
	IconButton,
	MenuButton,
	Menu,
	MenuItem,
	Snackbar,
	extendTheme,
} from '@mui/joy';
import {
	Edit,
	Trash2,
	Undo2,
	Bell,
	ExternalLink,
	ListFilter,
} from 'lucide-react';
import Top from '@/components/Top';
import Background from '@/components/Background';
import KronaMoreMenuButton from '@/components/krona/KronaMoreMenuButton';
import KronaResizableSplitLayout from '@/components/krona/KronaResizableSplitLayout';
import KronaSearchCreateToolbar from '@/components/krona/KronaSearchCreateToolbar';
import {
	kronaSideListPanelSx,
	kronaSideListPanelBodySx,
	kronaSideListCardSx,
} from '@/lib/kronaStyles';
import AddEditReminderModal, {
	isLinkedReminder,
	linkedReminderLabel,
	normalizeReminderType,
	reminderTypeOptions,
	type Reminder,
} from '@/components/reminders/AddEditReminderModal';
import dayjs from 'dayjs';
import { useRouter } from 'next/navigation';
import { localData } from '@/lib/localData';
import { notifyRemindersUpdated } from '@/lib/kronaDataEvents';
import {
	fetchAssigneeTeamReminders,
	mapTeamReminderToPersonalShape,
} from '@/lib/teams/assigneeReminders';
import {
	deleteUserReminder,
	projectsDeepLink,
	restoreUserReminder,
	teamProjectsDeepLink,
	updateLinkedReminderFromRemindersPage,
} from '@/lib/reminderSync';
import {
	formatReminderDateTime,
	persistReminderOrder,
	sortRemindersForDisplay,
} from '@/lib/reminderOrder';
import { kronaPlaceholders } from '@/lib/kronaPlaceholders';
import { showKronaError } from '@/lib/kronaToast';
import {
	isMissingReminderColumnError,
	REMINDER_BASE_SELECT,
	REMINDER_EXTENDED_SELECT,
	REMINDER_SCHEMA_MIGRATION_HINT,
	reminderCreateErrorMessage,
	type ReminderSelectRow,
} from '@/lib/reminderSchema';
import {
	kronaDeleteMenuItemProps,
	kronaMenuItemSx,
	kronaMenuSx,
	kronaSelectedMenuItemProps,
	kronaSecondaryButtonSx,
	kronaSecondaryIconButtonSx,
	kronaTabBarSx,
	kronaTabButtonSx,
} from '@/lib/kronaStyles';
import { KRONA_JOY_PRIMARY } from '@/lib/kronaAccent';
import { RemindersPageSkeleton } from '@/components/krona/KronaPageSkeletons';
import ReminderTypeIcon from '@/components/ReminderTypeIcon';
import VacationModeBanner from '@/components/VacationModeBanner';
import { useVacationMode } from '@/components/VacationModeContext';
import { useTeamMode } from '@/components/teams/TeamModeContext';
import { notifyManagersOfMemberCalendarItem } from '@/lib/teams/org';

const theme = extendTheme({
	colorSchemes: {
		light: {
			palette: {
				primary: KRONA_JOY_PRIMARY,
				text: {
					primary: 'var(--krona-text)',
					secondary: 'var(--krona-text-muted)',
				},
			},
		},
		dark: {
			palette: {
				primary: KRONA_JOY_PRIMARY,
				text: {
					primary: 'var(--krona-text)',
					secondary: 'var(--krona-text-muted)',
				},
			},
		},
	},
	fontFamily: {
		display: 'Poppins, sans-serif',
		body: 'Poppins, sans-serif',
	},
});

type DeletedReminder = Reminder & { idx: number };

function mapReminderRow(row: {
	id: string;
	name: string;
	type: string;
	date_created: string;
	due_date: string | null;
	occurrence: string | null;
	subscription_value?: number | string | null;
	vacation_end_date?: string | null;
	activate_vacation_mode?: boolean | null;
	email_notify?: boolean | null;
	task_id?: string | null;
	project_id?: string | null;
	sort_order?: number | null;
	tasks?:
		| { project_id: string | null }
		| { project_id: string | null }[]
		| null;
}): Reminder {
	const taskProjectId = Array.isArray(row.tasks)
		? row.tasks[0]?.project_id
		: row.tasks?.project_id;
	const rawValue = row.subscription_value;
	const subscriptionValue =
		rawValue == null || rawValue === '' ? null : Number(rawValue);
	return {
		id: row.id,
		name: row.name,
		type: row.type,
		date: row.due_date ?? new Date(row.date_created).toISOString(),
		created: new Date(row.date_created).toISOString(),
		occurrence: fromDbOccurrence(row.occurrence),
		subscriptionValue:
			subscriptionValue != null && Number.isFinite(subscriptionValue)
				? subscriptionValue
				: null,
		vacationEndDate: row.vacation_end_date ?? null,
		activateVacationMode:
			row.type === 'Vacation' ? row.activate_vacation_mode !== false : false,
		emailNotify: Boolean(row.email_notify),
		taskId: row.task_id ?? null,
		projectId: row.project_id ?? taskProjectId ?? null,
		sortOrder: row.sort_order ?? null,
	};
}

const toDbOccurrence = (value: string) => {
	switch (value.toLowerCase()) {
		case 'weekly':
			return 'weekly';
		case 'monthly':
			return 'monthly';
		case 'yearly':
			return 'yearly';
		case 'quarterly':
			return 'custom';
		default:
			return 'none';
	}
};

const fromDbOccurrence = (value: string | null) => {
	switch (value) {
		case 'weekly':
			return 'Weekly';
		case 'monthly':
			return 'Monthly';
		case 'yearly':
			return 'Yearly';
		case 'custom':
			return 'Quarterly';
		default:
			return 'One time';
	}
};

// Helper to calculate days left (calendar days, local)
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

type ReminderTypeFilter = 'all' | (typeof reminderTypeOptions)[number];
type ReminderDateAddedSort = 'due' | 'newest' | 'oldest';


const REMINDER_TYPE_TAG_BASE = {
	Subscription: '#76a8d2',
	Personal: '#83ad96',
	Work: '#c2a86f',
	Vacation: '#c58a91',
} as const;

/**
 * Muted category colors: visually distinct tags without using semantic
 * success/warning/error styling.
 */
function reminderTypeTagSx(type: string | null | undefined) {
	const normalized = normalizeReminderType(type) as keyof typeof REMINDER_TYPE_TAG_BASE;
	const base = REMINDER_TYPE_TAG_BASE[normalized];
	return {
		bgcolor: `color-mix(in srgb, ${base} 18%, transparent)`,
		border: `1px solid color-mix(in srgb, ${base} 42%, transparent)`,
		color: `color-mix(in srgb, ${base} 68%, var(--krona-text))`,
		'& svg': { color: 'currentColor' },
	};
}

function formatSubscriptionValue(
	value: number | null | undefined,
): string | null {
	if (value == null || !Number.isFinite(value)) return null;
	return new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: 'USD',
		maximumFractionDigits: 2,
	}).format(value);
}

type RemindersViewTab = 'list' | 'calendar';

export default function RemindersPage() {
	const router = useRouter();
	const { role, canCreateEditReminders, isManager, mode } = useTeamMode();
	const canCreateReminder = role !== 'member' || canCreateEditReminders;
	const { days: vacationDays } = useVacationMode();
	const [viewTab, setViewTab] = React.useState<RemindersViewTab>('list');
	const [openAddModal, setOpenAddModal] = React.useState(false);
	const [editIdx, setEditIdx] = React.useState<number | null>(null);
	const [remindersList, setRemindersList] = React.useState<Reminder[]>([]);
	const [search, setSearch] = React.useState('');
	const [typeFilter, setTypeFilter] = React.useState<ReminderTypeFilter>('all');
	const [dateAddedSort, setDateAddedSort] =
		React.useState<ReminderDateAddedSort>('due');
	const [calendarFocus, setCalendarFocus] = React.useState<dayjs.Dayjs | null>(
		null,
	);
	const [deleted, setDeleted] = React.useState<DeletedReminder | null>(null);
	const [showUndo, setShowUndo] = React.useState(false);
	const [userId, setUserId] = React.useState<string | null>(null);
	const [remindersLoading, setRemindersLoading] = React.useState(true);
	const [highlightReminderId, setHighlightReminderId] = React.useState<
		string | null
	>(null);
	const remindersInitialLoadRef = React.useRef(true);
	const suppressRemindersReloadUntilRef = React.useRef(0);
	const remindersFocusAppliedRef = React.useRef(false);
	const remindersHighlightTimeoutRef = React.useRef<number | null>(null);

	const shouldSuppressRemindersReload = React.useCallback(() => {
		return Date.now() < suppressRemindersReloadUntilRef.current;
	}, []);

	const suppressRemindersReload = React.useCallback((ms = 2000) => {
		suppressRemindersReloadUntilRef.current = Date.now() + ms;
	}, []);

	const reloadReminders = React.useCallback(async () => {
		try {
			const { data: userRes } = await localData.auth.getUser();
			const user = userRes.user;
			if (!user) {
				setRemindersList([]);
				setUserId(null);
				return;
			}
			setUserId(user.id);
			const [{ data: extended, error: extendedError }, teamRows] =
				await Promise.all([
					localData
						.from('reminders')
						.select(REMINDER_EXTENDED_SELECT)
						.eq('user_id', user.id)
						.order('sort_order', { ascending: true, nullsFirst: false })
						.order('due_date', { ascending: true }),
					fetchAssigneeTeamReminders(localData, user.id),
				]);
			let data: ReminderSelectRow[] | null =
				(extended as ReminderSelectRow[] | null) ?? null;
			let error = extendedError;
			if (error && isMissingReminderColumnError(error)) {
				const base = await localData
					.from('reminders')
					.select(REMINDER_BASE_SELECT)
					.eq('user_id', user.id)
					.order('sort_order', { ascending: true, nullsFirst: false })
					.order('due_date', { ascending: true });
				data = (base.data as ReminderSelectRow[] | null) ?? null;
				error = base.error;
			}
			if (error || !data) {
				if (error) console.warn('[reminders] load failed', error.message);
				return;
			}
			const seen = new Set<string>();
			const uniqueRows = data.filter((row) => {
				if (seen.has(row.id)) return false;
				seen.add(row.id);
				return true;
			});
			const personal = uniqueRows.map((row) => mapReminderRow(row));
			const team = teamRows.map((row) => mapTeamReminderToPersonalShape(row));
			setRemindersList([...personal, ...team]);
		} finally {
			if (remindersInitialLoadRef.current) {
				remindersInitialLoadRef.current = false;
				setRemindersLoading(false);
			}
		}
	}, []);

	React.useEffect(() => {
		void reloadReminders();
		const onRefresh = () => {
			if (shouldSuppressRemindersReload()) return;
			void reloadReminders();
		};
		const onPageShow = (e: PageTransitionEvent) => {
			if (e.persisted && !shouldSuppressRemindersReload())
				void reloadReminders();
		};
		window.addEventListener('krona:reminders-updated', onRefresh);
		window.addEventListener('krona:tasks-updated', onRefresh);
		window.addEventListener('focus', onRefresh);
		window.addEventListener('pageshow', onPageShow);
		return () => {
			window.removeEventListener('krona:reminders-updated', onRefresh);
			window.removeEventListener('krona:tasks-updated', onRefresh);
			window.removeEventListener('focus', onRefresh);
			window.removeEventListener('pageshow', onPageShow);
		};
	}, [reloadReminders, shouldSuppressRemindersReload]);

	// Consume a `krona:reminders-focus` deep link from the AI chat (or
	// elsewhere) at most once per mount — read it, clear it immediately, and
	// never retry so a missing/stale id can't cause an infinite loop.
	React.useEffect(() => {
		if (remindersLoading || remindersFocusAppliedRef.current) return;

		let pending: { reminderId?: string } | null = null;
		try {
			const raw = sessionStorage.getItem('krona:reminders-focus');
			if (raw) {
				sessionStorage.removeItem('krona:reminders-focus');
				pending = JSON.parse(raw) as { reminderId?: string };
			}
		} catch {
			/* ignore */
		}

		remindersFocusAppliedRef.current = true;
		const reminderId = pending?.reminderId;
		if (!reminderId) return;

		const match = remindersList.find((r) => r.id === reminderId);
		if (!match) return;

		setViewTab('list');
		setCalendarFocus(dayjs(match.date));
		if (remindersHighlightTimeoutRef.current !== null) {
			window.clearTimeout(remindersHighlightTimeoutRef.current);
		}
		setHighlightReminderId(reminderId);
		remindersHighlightTimeoutRef.current = window.setTimeout(() => {
			setHighlightReminderId(null);
			remindersHighlightTimeoutRef.current = null;
		}, 4000);
		window.requestAnimationFrame(() => {
			document
				.getElementById(`reminder-${reminderId}`)
				?.scrollIntoView({ behavior: 'smooth', block: 'center' });
		});
	}, [remindersLoading, remindersList]);

	React.useEffect(
		() => () => {
			if (remindersHighlightTimeoutRef.current !== null) {
				window.clearTimeout(remindersHighlightTimeoutRef.current);
			}
		},
		[],
	);

	const openLinkedReminder = React.useCallback(
		(rem: Reminder) => {
			const navigateToProject = (projectId: string, taskId?: string | null) => {
				try {
					sessionStorage.setItem(
						'krona:projects-focus',
						JSON.stringify({ projectId, taskId: taskId ?? null }),
					);
				} catch {
					/* ignore */
				}
				router.push(projectsDeepLink(projectId, taskId));
			};

			if (rem.source === 'team' && rem.taskId) {
				void (async () => {
					if (isManager && mode === 'team') {
						const { data } = await localData
							.from('team_tasks')
							.select('project_id')
							.eq('id', rem.taskId!)
							.maybeSingle();
						if (data?.project_id) {
							router.push(teamProjectsDeepLink(data.project_id, rem.taskId));
							return;
						}
					}
					router.push('/');
				})();
				return;
			}

			if (rem.projectId) {
				navigateToProject(rem.projectId, rem.taskId);
				return;
			}

			if (rem.taskId) {
				void (async () => {
					const { data } = await localData
						.from('tasks')
						.select('project_id')
						.eq('id', rem.taskId!)
						.maybeSingle();
					if (data?.project_id) {
						navigateToProject(data.project_id, rem.taskId);
						return;
					}
					setCalendarFocus(dayjs(rem.date));
				})();
				return;
			}

			setCalendarFocus(dayjs(rem.date));
		},
		[isManager, mode, router],
	);

	const displayReminders = React.useMemo(() => {
		const query = search.toLowerCase();
		let filtered = remindersList.filter((rem) =>
			rem.name.toLowerCase().includes(query),
		);
		if (typeFilter !== 'all') {
			filtered = filtered.filter(
				(rem) => normalizeReminderType(rem.type) === typeFilter,
			);
		}
		if (dateAddedSort === 'newest') {
			return [...filtered].sort(
				(a, b) =>
					new Date(b.created).getTime() - new Date(a.created).getTime(),
			);
		}
		if (dateAddedSort === 'oldest') {
			return [...filtered].sort(
				(a, b) =>
					new Date(a.created).getTime() - new Date(b.created).getTime(),
			);
		}
		return sortRemindersForDisplay(filtered);
	}, [remindersList, search, typeFilter, dateAddedSort]);

	const filterActive = typeFilter !== 'all' || dateAddedSort !== 'due';

	const renderReminderFilterControl = () => (
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
				sx={{
					...kronaMenuSx,
					minWidth: 200,
					maxWidth: 260,
				}}
			>
				<MenuItem disabled sx={kronaMenuItemSx}>
					<Typography
						level="body-xs"
						sx={{ fontWeight: 700, color: 'var(--krona-text-muted)' }}
					>
						Reminder type
					</Typography>
				</MenuItem>
				<MenuItem
					{...kronaSelectedMenuItemProps(typeFilter === 'all')}
					onClick={() => setTypeFilter('all')}
				>
					All types
				</MenuItem>
				{reminderTypeOptions.map((type) => (
					<MenuItem
						key={type}
						{...kronaSelectedMenuItemProps(typeFilter === type)}
						onClick={() => setTypeFilter(type)}
					>
						{type}
					</MenuItem>
				))}
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

	// Handle edit
	const handleEdit = (idx: number) => {
		const rem = displayReminders[idx];
		if (rem?.source === 'team') {
			showKronaError('Team deadlines are managed from the assigned task.');
			return;
		}
		setEditIdx(idx);
	};

	// Handle delete
	const handleDelete = (idx: number) => {
		const toDelete = displayReminders[idx];
		if (!toDelete) return;

		setDeleted({ ...toDelete, idx });
		setRemindersList((list) =>
			toDelete.id
				? list.filter((r) => r.id !== toDelete.id)
				: list.filter((_, i) => i !== idx),
		);
		setShowUndo(true);

		if (toDelete.source === 'team' && toDelete.teamReminderId) {
			void (async () => {
				try {
					const { error } = await localData
						.from('team_reminders')
						.update({ status: 'done' })
						.eq('id', toDelete.teamReminderId!);
					if (error) throw error;
					notifyRemindersUpdated();
				} catch {
					void reloadReminders();
				}
			})();
			return;
		}

		if (toDelete.id && userId) {
			void (async () => {
				try {
					await deleteUserReminder(userId, {
						id: toDelete.id!,
						taskId: toDelete.taskId,
						projectId: toDelete.projectId,
					});
				} catch {
					void reloadReminders();
				}
			})();
		} else {
			notifyRemindersUpdated();
		}
	};

	// Undo delete
	const handleUndo = () => {
		if (!deleted) return;

		const snapshot = deleted;
		setDeleted(null);
		setShowUndo(false);

		void (async () => {
			if (snapshot.source === 'team' && snapshot.teamReminderId) {
				try {
					const { error } = await localData
						.from('team_reminders')
						.update({ status: 'pending' })
						.eq('id', snapshot.teamReminderId);
					if (error) throw error;
					notifyRemindersUpdated();
				} catch {
					void reloadReminders();
					return;
				}
				setRemindersList((list) => {
					const newList = [...list];
					newList.splice(snapshot.idx, 0, { ...snapshot });
					return newList;
				});
				return;
			}

			let restoredId = snapshot.id;
			if (userId) {
				try {
					restoredId = await restoreUserReminder(userId, {
						name: snapshot.name,
						type: snapshot.type,
						dateCreated: snapshot.created.slice(0, 10),
						dueDate: snapshot.date,
						occurrence: toDbOccurrence(snapshot.occurrence),
						subscriptionValue: snapshot.subscriptionValue ?? null,
						vacationEndDate: snapshot.vacationEndDate ?? null,
						activateVacationMode: snapshot.activateVacationMode ?? false,
						emailNotify: snapshot.emailNotify ?? false,
						taskId: snapshot.taskId,
						projectId: snapshot.projectId,
					});
				} catch {
					void reloadReminders();
					return;
				}
			} else {
				notifyRemindersUpdated();
			}
			setRemindersList((list) => {
				const newList = [...list];
				newList.splice(snapshot.idx, 0, { ...snapshot, id: restoredId });
				return newList;
			});
		})();
	};

	// Save edit or add
	const handleSaveReminder = (reminder: Reminder) => {
		if (editIdx !== null) {
			const existing = displayReminders[editIdx];
			if (!existing) {
				setEditIdx(null);
				return;
			}

			void (async () => {
				if (existing.id && userId) {
					try {
						if (isLinkedReminder(existing)) {
							await updateLinkedReminderFromRemindersPage(userId, {
								id: existing.id,
								name: reminder.name,
								dueDate: reminder.date,
								taskId: existing.taskId,
								projectId: existing.projectId,
							});
							const dueDateChanged = existing.date !== reminder.date;
							const emailPayload: Record<string, unknown> = {
								email_notify: Boolean(reminder.emailNotify),
							};
							if (dueDateChanged && reminder.emailNotify) {
								emailPayload.email_notified_at = null;
							}
							const { error: emailError } = await localData
								.from('reminders')
								.update(emailPayload)
								.eq('id', existing.id)
								.eq('user_id', userId);
							if (emailError && !isMissingReminderColumnError(emailError)) {
								throw emailError;
							}
							if (emailError && Boolean(reminder.emailNotify)) {
								showKronaError(REMINDER_SCHEMA_MIGRATION_HINT);
							}
						} else {
							const dueDateChanged = existing.date !== reminder.date;
							const payload: Record<string, unknown> = {
								name: reminder.name,
								type: reminder.type,
								date_created: reminder.created.slice(0, 10),
								due_date: reminder.date,
								occurrence: toDbOccurrence(reminder.occurrence),
								email_notify: Boolean(reminder.emailNotify),
							};
							if (dueDateChanged && reminder.emailNotify) {
								payload.email_notified_at = null;
							}
							if (reminder.type === 'Subscription') {
								payload.subscription_value = reminder.subscriptionValue ?? null;
							}
							if (reminder.type === 'Vacation') {
								payload.vacation_end_date = reminder.vacationEndDate ?? null;
								payload.activate_vacation_mode =
									reminder.activateVacationMode !== false;
							}
							let { error } = await localData
								.from('reminders')
								.update(payload)
								.eq('id', existing.id)
								.eq('user_id', userId);
							if (error && isMissingReminderColumnError(error)) {
								const needsExtended =
									reminder.type === 'Subscription' ||
									reminder.type === 'Vacation' ||
									Boolean(reminder.emailNotify);
								const basePayload = { ...payload };
								delete basePayload.subscription_value;
								delete basePayload.vacation_end_date;
								delete basePayload.activate_vacation_mode;
								delete basePayload.email_notify;
								delete basePayload.email_notified_at;
								({ error } = await localData
									.from('reminders')
									.update(basePayload)
									.eq('id', existing.id)
									.eq('user_id', userId));
								if (!error && needsExtended) {
									showKronaError(REMINDER_SCHEMA_MIGRATION_HINT);
								}
							}
							if (error) throw error;
							notifyRemindersUpdated();
						}
						await reloadReminders();
					} catch (err) {
						console.error('[reminders] save failed:', err);
						showKronaError('Could not save reminder changes.');
						void reloadReminders();
					}
				}

				setEditIdx(null);
			})();
			return;
		} else {
			const pendingId = `pending-${Date.now()}`;
			const newReminder: Reminder = {
				...reminder,
				id: pendingId,
				sortOrder: remindersList.length,
			};
			const withTimes = sortRemindersForDisplay([
				...remindersList,
				newReminder,
			]).map((item, index) => ({ ...item, sortOrder: index }));
			const created = withTimes.find((item) => item.id === pendingId);
			if (!created) return;

			suppressRemindersReload();
			setRemindersList(withTimes);

			if (userId) {
				void (async () => {
					try {
						const payload: Record<string, unknown> = {
							user_id: userId,
							name: created.name,
							type: created.type,
							date_created: created.created.slice(0, 10),
							due_date: created.date,
							occurrence: toDbOccurrence(created.occurrence),
							sort_order: created.sortOrder ?? withTimes.length - 1,
							email_notify: Boolean(created.emailNotify),
						};
						if (created.type === 'Subscription') {
							payload.subscription_value = created.subscriptionValue ?? null;
						}
						if (created.type === 'Vacation') {
							payload.vacation_end_date = created.vacationEndDate ?? null;
							payload.activate_vacation_mode =
								created.activateVacationMode !== false;
						}
						const needsExtended =
							created.type === 'Subscription' ||
							created.type === 'Vacation' ||
							Boolean(created.emailNotify);
						let { data, error } = await localData
							.from('reminders')
							.insert([payload])
							.select('id')
							.single();
						if (error && isMissingReminderColumnError(error)) {
							const basePayload = { ...payload };
							delete basePayload.subscription_value;
							delete basePayload.vacation_end_date;
							delete basePayload.activate_vacation_mode;
							delete basePayload.email_notify;
							({ data, error } = await localData
								.from('reminders')
								.insert([basePayload])
								.select('id')
								.single());
							if (!error && needsExtended) {
								showKronaError(REMINDER_SCHEMA_MIGRATION_HINT);
							}
						}
						if (error || !data?.id) throw error ?? new Error('Insert failed');
						const finalList = withTimes.map((item) =>
							item.id === pendingId ? { ...item, id: data.id } : item,
						);
						setRemindersList(finalList);
						suppressRemindersReload();
						await persistReminderOrder(userId, finalList, { notify: false });
						notifyRemindersUpdated();
						void notifyManagersOfMemberCalendarItem({
							actorUserId: userId,
							reminderId: String(data.id),
							name: created.name,
							type: created.type,
							dueAt: created.date,
							vacationEndDate: created.vacationEndDate,
						});
					} catch (err) {
						console.error('[reminders] create failed:', err);
						showKronaError(
							reminderCreateErrorMessage(
								err as { message?: string; code?: string } | null,
								created.type === 'Subscription' || created.type === 'Vacation',
							),
						);
						void reloadReminders();
					}
				})();
				return;
			}
		}
	};

	// Calendar grid helper
	function getMonthMatrix(year: number, month: number) {
		const start = dayjs(new Date(year, month, 1));
		const startDay = start.day();
		const matrix: dayjs.Dayjs[][] = [];
		let week: dayjs.Dayjs[] = [];
		let day = start.subtract(startDay, 'day');
		for (let i = 0; i < 42; i++) {
			week.push(day);
			day = day.add(1, 'day');
			if (week.length === 7) {
				matrix.push(week);
				week = [];
			}
		}
		return matrix;
	}

	function CalendarView({
		reminders,
		focusDate,
		vacationDays,
	}: {
		reminders: Reminder[];
		focusDate?: dayjs.Dayjs | null;
		vacationDays: string[];
	}) {
		const [current, setCurrent] = React.useState(dayjs());

		React.useEffect(() => {
			if (focusDate) {
				setCurrent(focusDate.startOf('month'));
			}
		}, [focusDate]);
		const matrix = getMonthMatrix(current.year(), current.month());

		const remindersByDate = React.useMemo(() => {
			const map: Record<string, Reminder[]> = {};
			reminders.forEach((rem) => {
				const dueDay = dayjs(rem.date).format('YYYY-MM-DD');
				if (!map[dueDay]) map[dueDay] = [];
				map[dueDay].push(rem);

				if (rem.occurrence && rem.occurrence !== 'One time') {
					const repeatStart = dayjs(rem.date);
					const repeatEnd = dayjs(current).endOf('month');
					let interval = 0;
					switch (rem.occurrence) {
						case 'Weekly':
							interval = 7;
							break;
						case 'Monthly':
							interval = 30;
							break;
						case 'Quarterly':
							interval = 91;
							break;
						case 'Yearly':
							interval = 365;
							break;
					}
					if (interval > 0) {
						let d = repeatStart.add(interval, 'day');
						while (d.isBefore(repeatEnd)) {
							const key = d.format('YYYY-MM-DD');
							if (!map[key]) map[key] = [];
							map[key].push(rem);
							d = d.add(interval, 'day');
						}
					}
				}
			});
			return map;
		}, [reminders, current]);

		const vacationReminderDays = React.useMemo(() => {
			const days = new Set<string>();
			for (const reminder of reminders) {
				if (reminder.type !== 'Vacation') continue;
				const start = dayjs(reminder.date).startOf('day');
				const end = dayjs(reminder.vacationEndDate ?? reminder.date).startOf(
					'day',
				);
				if (!start.isValid() || !end.isValid() || end.isBefore(start)) continue;
				const rangeDays = Math.min(730, end.diff(start, 'day'));
				for (let offset = 0; offset <= rangeDays; offset += 1) {
					days.add(start.add(offset, 'day').format('YYYY-MM-DD'));
				}
			}
			return days;
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
					<Button
						variant="plain"
						size="sm"
						onClick={() => setCurrent(current.subtract(1, 'month'))}
						sx={kronaSecondaryButtonSx}
					>
						Prev
					</Button>
					<Typography
						level="title-lg"
						sx={{ color: 'var(--krona-text)', fontWeight: 600 }}
					>
						{current.format('MMMM YYYY')}
					</Typography>
					<Button
						variant="plain"
						size="sm"
						onClick={() => setCurrent(current.add(1, 'month'))}
						sx={kronaSecondaryButtonSx}
					>
						Next
					</Button>
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
							gridTemplateColumns: 'repeat(7, 1fr)',
							flexShrink: 0,
							borderBottom: '1px solid var(--krona-overlay-active)',
						}}
					>
						{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
							<Typography
								key={d}
								level="body-xs"
								sx={{
									textAlign: 'center',
									fontWeight: 600,
									color: 'var(--krona-text)',
									py: 0.75,
								}}
							>
								{d}
							</Typography>
						))}
					</Box>
					<Box
						sx={{
							flex: 1,
							minHeight: 0,
							display: 'grid',
							gridTemplateColumns: 'repeat(7, 1fr)',
							gridTemplateRows: 'repeat(6, minmax(0, 1fr))',
						}}
					>
						{matrix.flat().map((day, idx) => {
							const isCurrentMonth = day.month() === current.month();
							const key = day.format('YYYY-MM-DD');
							const dayReminders = remindersByDate[key] || [];
							const isVacationDay =
								vacationReminderDays.has(key) || vacationDays.includes(key);
							const isToday =
								day.format('YYYY-MM-DD') === dayjs().format('YYYY-MM-DD');
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
										bgcolor: isVacationDay
											? 'var(--krona-vacation-day-bg)'
											: 'transparent',
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
										{isVacationDay ? (
											<Box
												sx={{
													mt: 0.25,
													px: 0.75,
													py: 0.25,
													borderRadius: '999px',
													bgcolor: 'var(--krona-vacation-label-bg)',
													border:
														'1px solid var(--krona-vacation-border)',
													color: 'var(--krona-vacation-text)',
													fontSize: 10,
													lineHeight: 1.2,
													fontWeight: 600,
												}}
											>
												Vacation
											</Box>
										) : null}
										{dayReminders.slice(0, 3).map((rem, i) => (
											<Box
												key={rem.name + i}
												sx={{
													mt: 0.25,
													px: 0.75,
													py: 0.25,
													borderRadius: '999px',
													...reminderTypeTagSx(rem.type),
													fontSize: 10,
													lineHeight: 1.2,
													whiteSpace: 'nowrap',
													overflow: 'hidden',
													textOverflow: 'ellipsis',
													display: 'flex',
													alignItems: 'center',
													gap: 0.4,
												}}
												title={rem.name}
											>
												<ReminderTypeIcon
													type={rem.type}
													size={12}
													className="shrink-0"
												/>
												{rem.name}
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

	const renderRemindersList = () => (
		<Box
			role="tabpanel"
			aria-label="Reminders list"
			sx={kronaSideListPanelBodySx}
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
						{search.trim() || typeFilter !== 'all'
							? 'No matching reminders'
							: 'No reminders yet'}
					</Typography>
					<Typography
						level="body-sm"
						sx={{ color: 'var(--krona-text-muted)', maxWidth: 240 }}
					>
						{search.trim() || typeFilter !== 'all'
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
				{displayReminders.map((rem, idx) => {
					const linked = isLinkedReminder(rem);
					const highlighted =
						Boolean(rem.id) && rem.id === highlightReminderId;
					return (
						<Box
							key={rem.id ?? `${rem.name}-${idx}`}
							id={rem.id ? `reminder-${rem.id}` : undefined}
							onClick={() => {
								setCalendarFocus(dayjs(rem.date));
							}}
							sx={{
								display: 'block',
								width: '100%',
								textAlign: 'left',
								cursor: 'pointer',
								bgcolor: 'transparent',
								color: 'inherit',
							}}
						>
							<Box
								sx={{
									...kronaSideListCardSx(highlighted),
									flexDirection: 'row',
									alignItems: 'flex-start',
									gap: 1.25,
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
										{rem.name}
									</Typography>
									<Typography
										level="body-xs"
										sx={{ color: 'var(--krona-text-muted)' }}
									>
										{formatReminderDateTime(rem.date)} ·{' '}
										{getDurationLeft(rem.date)}
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
											aria-label={`${normalizeReminderType(rem.type)} reminder`}
											sx={{
												...reminderTypeTagSx(rem.type),
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
											<ReminderTypeIcon
												type={rem.type}
												size={12}
												className="shrink-0"
											/>
											{normalizeReminderType(rem.type)}
										</Box>
										<Typography
											level="body-xs"
											sx={{
												color: 'var(--krona-text-muted)',
												minWidth: 0,
												overflow: 'hidden',
												textOverflow: 'ellipsis',
												whiteSpace: 'nowrap',
											}}
										>
											{linked
												? linkedReminderLabel(rem)
												: rem.type === 'Vacation' && rem.vacationEndDate
													? `Until ${formatReminderDateTime(rem.vacationEndDate)}`
													: rem.type === 'Subscription' &&
														  rem.subscriptionValue != null
														? `${rem.occurrence} · ${formatSubscriptionValue(rem.subscriptionValue)}`
														: rem.occurrence}
										</Typography>
									</Box>
								</Box>
								<Box sx={{ position: 'relative', zIndex: 1, flexShrink: 0 }}>
								<Dropdown>
									<MenuButton
										slots={{ root: KronaMoreMenuButton }}
										slotProps={{
											root: {
												onClick: (e: React.MouseEvent) => e.stopPropagation(),
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
												handleEdit(idx);
											}}
										>
											<Edit size={16} style={{ marginRight: 8 }} />
											Edit
										</MenuItem>
										{linked ? (
											<MenuItem
												onClick={(e) => {
													e.stopPropagation();
													openLinkedReminder(rem);
												}}
											>
												<ExternalLink size={16} style={{ marginRight: 8 }} />
												Open in Projects
											</MenuItem>
										) : null}
										<MenuItem
											onClick={(e) => {
												e.stopPropagation();
												handleDelete(idx);
											}}
											{...kronaDeleteMenuItemProps}
										>
											<Trash2 size={16} style={{ marginRight: 8 }} />
											Delete
										</MenuItem>
									</Menu>
								</Dropdown>
								</Box>
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
			<Box sx={{ display: { xs: 'none', md: 'block' }, flexShrink: 0 }}>
				<VacationModeBanner />
			</Box>
			<CalendarView
				reminders={displayReminders}
				focusDate={calendarFocus}
				vacationDays={vacationDays}
			/>
		</Box>
	);

	return (
		<CssVarsProvider theme={theme}>
			<CssBaseline />
			<Box
				sx={{
					display: 'flex',
					height: '100dvh',
					maxHeight: '100dvh',
					bgcolor: 'background.body',
					position: 'relative',
					overflow: 'hidden',
					color: 'var(--krona-text)',
					boxSizing: 'border-box',
				}}
			>
				<Background />
				<Box
					className="krona-main-content krona-reminders-page"
					sx={{
						flex: 1,
						display: 'flex',
						flexDirection: 'column',
						position: 'relative',
						zIndex: 1,
						minHeight: 0,
						overflow: 'hidden',
					}}
				>
					<Top title="Reminders" />
					<Box
						sx={{
							flex: 1,
							display: 'flex',
							flexDirection: 'column',
							minHeight: 0,
							minWidth: 0,
							overflow: 'hidden',
							px: { xs: 0, md: 0 },
						}}
					>
						{remindersLoading ? (
							<RemindersPageSkeleton />
						) : (
							<>
								<Box
									sx={{ display: { xs: 'block', md: 'none' }, flexShrink: 0 }}
								>
									<VacationModeBanner />
								</Box>

								{/* Tablet / mobile: search + tabs */}
								<Box
									sx={{
										...kronaSideListPanelSx,
										display: { xs: 'flex', md: 'none' },
										flexDirection: 'column',
										flex: 1,
										minHeight: 0,
										minWidth: 0,
										overflow: 'hidden',
									}}
								>
									<KronaSearchCreateToolbar
										searchPlaceholder={kronaPlaceholders.search.reminders}
										searchValue={search}
										onSearchChange={setSearch}
										beforeCreateSlot={renderReminderFilterControl()}
										createLabel="Add reminder"
										createIconOnly
										onCreate={canCreateReminder ? () => {
											setEditIdx(null);
											setOpenAddModal(true);
										} : undefined}
									/>

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

								{/* Desktop: split list + calendar (like Projects) */}
								<KronaResizableSplitLayout
									resizeAtSidebarEdge
									dividerAriaLabel="Resize reminders list and calendar"
									sidebarSx={kronaSideListPanelSx}
									containerSx={{
										flex: 1,
										minHeight: 0,
										display: { xs: 'none', md: 'flex' },
									}}
									sidebar={
										<>
											<KronaSearchCreateToolbar
												searchPlaceholder={kronaPlaceholders.search.reminders}
												searchValue={search}
												onSearchChange={setSearch}
												beforeCreateSlot={renderReminderFilterControl()}
												createLabel="Add reminder"
												createIconOnly
												onCreate={canCreateReminder ? () => { setEditIdx(null); setOpenAddModal(true); } : undefined}
												sx={{ mb: '20px' }}
											/>
											{renderRemindersList()}
										</>
									}
									detail={renderCalendarPanel()}
								/>
							</>
						)}
					</Box>

					<AddEditReminderModal
						open={(openAddModal && canCreateReminder) || editIdx !== null}
						onClose={() => {
							setOpenAddModal(false);
							setEditIdx(null);
						}}
						onSave={handleSaveReminder}
						initial={editIdx !== null ? displayReminders[editIdx] : undefined}
					/>
					<Snackbar
						open={showUndo}
						autoHideDuration={4000}
						onClose={() => setShowUndo(false)}
						anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
						sx={{
							bottom: '24px !important',
							left: '50% !important',
							right: 'auto !important',
							transform: 'translateX(-50%) !important',
							width: 'max-content',
							maxWidth: 'calc(100vw - 32px)',
						}}
						slotProps={{
							root: {
								sx: {
									backgroundColor: 'transparent',
									border: 'none',
									boxShadow: 'none',
									p: 0,
								},
							},
						}}
					>
						<Box
							sx={{
								display: 'flex',
								alignItems: 'center',
								gap: 2,
								px: 3,
								py: 1.5,
								background: 'var(--krona-overlay-strong)',
								backdropFilter: 'blur(16px)',
								WebkitBackdropFilter: 'blur(16px)',
								borderRadius: '100px',
								border: '1px solid var(--krona-surface-border)',
								color: 'var(--krona-text)',
							}}
						>
							<Typography
								level="body-md"
								sx={{ color: 'var(--krona-text)', fontWeight: 500 }}
							>
								Reminder deleted
							</Typography>
							<Button
								variant="plain"
								size="sm"
								startDecorator={<Undo2 size={16} />}
								onClick={handleUndo}
								sx={{
									color: 'var(--krona-text)',
									minHeight: '32px',
									px: 2,
									borderRadius: '100px',
									fontWeight: 500,
									textTransform: 'none',
									'&:hover': {
										bgcolor: 'var(--krona-overlay-active)',
									},
								}}
							>
								Revert
							</Button>
						</Box>
					</Snackbar>
				</Box>
			</Box>
		</CssVarsProvider>
	);
}
