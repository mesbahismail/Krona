'use client';

import * as React from 'react';
import NextLink from 'next/link';
import {
	Box,
	Typography,
	Button,
	Input,
	Checkbox,
	IconButton,
	Modal,
	ModalDialog,
	FormControl,
	FormLabel,
	FormHelperText,
	Select,
	Option,
	Dropdown,
	Menu,
	MenuButton,
	MenuItem,
	Tooltip,
	Chip,
} from '@mui/joy';
import {
	Plus,
	Clock3,
	ClipboardList,
	X,
	Folder,
	FolderKanban,
	ChevronLeft,
	Repeat2,
	Edit,
	Trash2,
} from 'lucide-react';
import KronaListDivider from '@/components/krona/KronaListDivider';
import KronaSearchCreateToolbar from '@/components/krona/KronaSearchCreateToolbar';
import KronaMoreMenuButton from '@/components/krona/KronaMoreMenuButton';
import KronaTaskCheckbox from '@/components/krona/KronaTaskCheckbox';
import DashboardWidgetEmpty from '@/components/dashboard/DashboardWidgetEmpty';
import DashboardPerformanceWidget from '@/components/dashboard/DashboardPerformanceWidget';
import DashboardTodayProgressWidget from '@/components/dashboard/DashboardTodayProgressWidget';
import Background from '@/components/Background';
import Top from '@/components/Top';
import { kronaAccentColorMix } from '@/lib/kronaAccent';
import { kronaPlaceholders } from '@/lib/kronaPlaceholders';
import {
	kronaWidgetCardSx,
	kronaInputSx,
	kronaDeleteMenuItemProps,
	kronaPrimaryButtonSx,
	kronaPrimaryIconButtonSx,
	kronaSearchInputSx,
	kronaSecondaryIconButtonSx,
	kronaMenuSx,
	kronaModalDialogSx,
	kronaModalCloseButtonSx,
	kronaModalTitleSx,
	kronaModalFormSx,
	kronaModalFieldsSx,
	kronaModalPrimaryActionSx,
	kronaTaskPriorityStarButtonSx,
	kronaTaskRowMoreMenuButtonSx,
	kronaTaskRowActionsSx,
	kronaTimerSelectedTaskBg,
	kronaTimerSelectedTaskBorder,
	kronaTitleSx,
	kronaWidgetListItemSx,
	kronaWidgetListScrollSx,
	kronaIconTileSx,
} from '@/lib/kronaStyles';
import { usePomodoroTimer } from '@/components/PomodoroContext';
import { localData } from '@/lib/localData';
import { showKronaError, showKronaSuccess } from '@/lib/kronaToast';
import { formatDecimalHours } from '@/lib/taskTime';
import KronaDatePickerButton from '@/components/krona/KronaDatePickerButton';
import { DEADLINE_PAST_MESSAGE, isDeadlineInPast } from '@/lib/localDate';
import DashboardTimerWidget from '@/components/dashboard/DashboardTimerWidget';
import DashboardRemindersWidget from '@/components/dashboard/DashboardRemindersWidget';
import {
	isDashboardTaskDone,
	useDashboardTasks,
	type DashboardTask,
} from '@/components/dashboard/useDashboardTasks';
import { DashboardPageSkeleton } from '@/components/krona/KronaPageSkeletons';
import { DashboardLayoutProvider } from '@/components/dashboard/DashboardLayoutContext';
import { DashboardMobileSecondaryWidgetHeightsProvider } from '@/components/dashboard/DashboardMobileSecondaryWidgetHeights';
import { useKronaLayoutMode } from '@/components/KronaLayoutModeProvider';
import { useTeamMode } from '@/components/teams/TeamModeContext';
import { useMyTeamWork } from '@/hooks/useMyTeamWork';
import {
	deleteTeamTask,
	setTeamTaskPrioritized,
	setTeamTaskStatus,
} from '@/lib/teams/org';
import type { TeamTaskRow } from '@/lib/teams/dashboard';
import {
	DashboardDataProvider,
	useDashboardData,
} from '@/components/dashboard/DashboardDataProvider';
import DashboardOnboardingTour from '@/components/dashboard/DashboardOnboardingTour';
import VacationModeBanner from '@/components/VacationModeBanner';
import { useVacationMode } from '@/components/VacationModeContext';
import {
	DASHBOARD_TASKS_TIMER_MIN_HEIGHT_PX,
	useDashboardTasksTimerEqualHeight,
} from '@/components/dashboard/useDashboardTasksTimerEqualHeight';
import TaskFolderFilterButton from '@/components/tasks/TaskFolderFilterButton';
import TaskSortToggleButton from '@/components/tasks/TaskSortToggleButton';
import TaskDeleteUndoToast from '@/components/tasks/TaskDeleteUndoToast';
import { useTaskDeleteUndo } from '@/hooks/useTaskDeleteUndo';
import { commitTaskDeleteToServer } from '@/lib/taskDeleteCommit';
import {
	notifyTaskPendingDelete,
	notifyTaskDeleteReverted,
	notifyTasksUpdated,
} from '@/lib/kronaDataEvents';
import { projectsDeepLink } from '@/lib/reminderSync';
import KronaPriorityStar from '@/components/krona/KronaPriorityStar';
import {
	isTaskPrioritized,
	setTaskPrioritized,
	sortTasksWithPriorityFirst,
} from '@/lib/taskPriority';
import {
	persistSelectedTimerTask,
	useSelectedTimerTask,
} from '@/lib/selectedTimerTask';
import {
	DEFAULT_TASK_LIST_FILTERS,
	compareDashboardTasksBySortKey,
	taskMatchesListFilters,
	type TaskListFilters,
} from '@/lib/dashboardTaskSort';
import {
	DashboardWidgetHeader,
	DashboardWidgetShell,
} from '@/components/dashboard/DashboardWidgetChrome';
import DashboardWidgetScrollArea from '@/components/dashboard/DashboardWidgetScrollArea';
import { TaskListSkeleton } from '@/components/dashboard/DashboardWidgetSkeletons';
import {
	compareUndefinedProjectLast,
	ensureUndefinedProject,
	isUndefinedProject,
	isUndefinedProjectName,
} from '@/lib/undefinedProject';

function greetingPrefixFromHour(hour: number) {
	if (hour < 12) return 'Morning';
	if (hour < 17) return 'Afternoon';
	return 'Evening';
}

const cardSx = kronaWidgetCardSx;

const UNASSIGNED_FOLDER_ID = '__unassigned__';
const UNDEFINED_PROJECT_OPTION = '__undefined_project__';
const TEAM_FOLDER_PREFIX = 'team:';

function teamFolderId(projectId: string) {
	return `${TEAM_FOLDER_PREFIX}${projectId}`;
}

function teamFolderProjectId(folderId: string | null) {
	if (!folderId?.startsWith(TEAM_FOLDER_PREFIX)) return null;
	return folderId.slice(TEAM_FOLDER_PREFIX.length);
}

const DashboardTasksAndTimer = React.memo(function DashboardTasksAndTimer() {
	const { running, mode, timerStyle } = usePomodoroTimer();
	const {
		role,
		canCreateEditTasks,
		canCreateEditProjects,
		canCreateEditReminders,
		loading: teamContextLoading,
	} = useTeamMode();
	const canManageTasks = role !== 'member' || canCreateEditTasks;
	const canManageProjects = role !== 'member' || canCreateEditProjects;
	const canManageReminders = role !== 'member' || canCreateEditReminders;
	const remindersLocked = !canManageReminders;
	const dashboard = useDashboardData();
	const { isDesktopDashboard } = useKronaLayoutMode();
	const {
		sortedTasks,
		loading: tasksLoading,
		selectedTask,
		selectedTaskId,
		setSelectedTaskId,
		sortBy,
		setSortBy,
		createTask,
		updateTask,
		setTaskCompleted,
		toggleTaskPriority,
		setTaskRepeatable,
		projects,
	} = useDashboardTasks();
	const selectedTimerTask = useSelectedTimerTask();
	const teamWork = useMyTeamWork();
	const teamProjectNameById = React.useMemo(() => {
		const map = new Map<string, string>();
		for (const project of teamWork.projects) {
			map.set(project.id, project.name);
		}
		return map;
	}, [teamWork.projects]);
	const undefinedProject = React.useMemo(
		() => projects.find((project) => isUndefinedProject(project)) ?? null,
		[projects],
	);
	const undefinedProjectId = undefinedProject?.id ?? null;
	const undefinedProjectLabel = undefinedProject?.name ?? 'Undefined';
	const [taskSearch, setTaskSearch] = React.useState('');
	const [taskListFilters, setTaskListFilters] = React.useState<TaskListFilters>(
		DEFAULT_TASK_LIST_FILTERS,
	);
	const [addOpen, setAddOpen] = React.useState(false);
	const [editingTaskId, setEditingTaskId] = React.useState<string | null>(null);
	const [newTaskName, setNewTaskName] = React.useState('');
	const [newTaskProjectId, setNewTaskProjectId] = React.useState<string | null>(
		null,
	);
	const [newTaskHours, setNewTaskHours] = React.useState('1');
	const [newTaskHasTime, setNewTaskHasTime] = React.useState(true);
	const [newTaskDeadline, setNewTaskDeadline] = React.useState('');
	const [newTaskReminder, setNewTaskReminder] = React.useState(false);
	const [newTaskRepeatable, setNewTaskRepeatable] = React.useState(false);
	const [newProjectName, setNewProjectName] = React.useState('');
	const [showNewProjectInput, setShowNewProjectInput] = React.useState(false);
	const [savingTask, setSavingTask] = React.useState(false);
	const [taskFormErrors, setTaskFormErrors] = React.useState<{
		taskName?: string;
		projectName?: string;
		assignedHours?: string;
		deadline?: string;
	}>({});
	const [folderBrowseOpen, setFolderBrowseOpen] = React.useState(false);
	const [selectedFolderProjectId, setSelectedFolderProjectId] = React.useState<
		string | null
	>(null);
	const [hiddenDeletedTaskIds, setHiddenDeletedTaskIds] = React.useState<
		Set<string>
	>(() => new Set());
	const committedTaskDeleteIdsRef = React.useRef<Set<string>>(new Set());

	type DashboardDeleteSnapshot = {
		task: DashboardTask;
		userId: string;
		wasPrioritized: boolean;
		wasSelectedForTimer: boolean;
	};

	const {
		open: showDeleteTaskUndoToast,
		stage: stageTaskDeleteSnapshot,
		revert: handleRevertTaskDelete,
		handleClose: handleDeleteTaskToastClose,
	} = useTaskDeleteUndo<DashboardDeleteSnapshot>({
		onCommit: async (snapshot) => {
			const ok = await commitTaskDeleteToServer(
				{
					userId: snapshot.userId,
					taskId: snapshot.task.id,
					wasPrioritized: snapshot.wasPrioritized,
					wasSelectedForTimer: snapshot.wasSelectedForTimer,
				},
				committedTaskDeleteIdsRef.current,
			);
			if (!ok) {
				// Keep hidden + pending so a later refetch cannot resurrect it.
				return;
			}
			setHiddenDeletedTaskIds((prev) => {
				const next = new Set(prev);
				next.delete(snapshot.task.id);
				return next;
			});
			setSelectedTaskId((prev) => (prev === snapshot.task.id ? null : prev));
		},
		onRevert: (snapshot) => {
			committedTaskDeleteIdsRef.current.delete(snapshot.task.id);
			notifyTaskDeleteReverted(snapshot.task.id);
			setHiddenDeletedTaskIds((prev) => {
				const next = new Set(prev);
				next.delete(snapshot.task.id);
				return next;
			});
			if (snapshot.wasPrioritized) {
				setTaskPrioritized(snapshot.task.id, true);
			}
			if (snapshot.wasSelectedForTimer) {
				try {
					persistSelectedTimerTask(
						snapshot.task.id,
						snapshot.task.name,
						snapshot.task.projectId ?? null,
					);
				} catch {
					/* ignore */
				}
			}
			notifyTasksUpdated();
		},
	});

	const visibleSortedTasks = React.useMemo(
		() => sortedTasks.filter((task) => !hiddenDeletedTaskIds.has(task.id)),
		[sortedTasks, hiddenDeletedTaskIds],
	);

	const folderEntries = React.useMemo(() => {
		const search = taskSearch.trim().toLowerCase();
		const entries = projects.map((p) => {
			const projectTasks = visibleSortedTasks.filter(
				(t) => t.projectId === p.id,
			);
			return {
				id: p.id,
				name: p.name,
				is_unassigned_folder: p.isUnassignedFolder,
				isTeam: false,
				taskCount: projectTasks.length,
				activeCount: projectTasks.filter((t) => !isDashboardTaskDone(t.status))
					.length,
			};
		});
		const unassignedTasks = visibleSortedTasks.filter((t) => !t.projectId);
		if (unassignedTasks.length > 0) {
			entries.push({
				id: UNASSIGNED_FOLDER_ID,
				name: 'Unassigned',
				is_unassigned_folder: false,
				isTeam: false,
				taskCount: unassignedTasks.length,
				activeCount: unassignedTasks.filter(
					(t) => !isDashboardTaskDone(t.status),
				).length,
			});
		}
		for (const project of teamWork.projects) {
			const projectTasks = teamWork.tasks.filter(
				(task) => task.project_id === project.id,
			);
			entries.push({
				id: teamFolderId(project.id),
				name: project.name,
				is_unassigned_folder: false,
				isTeam: true,
				taskCount: projectTasks.length,
				activeCount: projectTasks.filter((task) => task.status !== 'done')
					.length,
			});
		}
		entries.sort((a, b) => {
			const undefinedOrder = compareUndefinedProjectLast(a, b);
			if (undefinedOrder !== 0) return undefinedOrder;
			return a.name.localeCompare(b.name);
		});
		if (!search) return entries;
		return entries.filter((entry) => entry.name.toLowerCase().includes(search));
	}, [projects, visibleSortedTasks, taskSearch, teamWork.projects, teamWork.tasks]);

	const scopedTasks = React.useMemo(() => {
		if (!folderBrowseOpen || selectedFolderProjectId === null) {
			return visibleSortedTasks;
		}
		if (teamFolderProjectId(selectedFolderProjectId)) {
			return [];
		}
		if (selectedFolderProjectId === UNASSIGNED_FOLDER_ID) {
			return visibleSortedTasks.filter((t) => !t.projectId);
		}
		return visibleSortedTasks.filter(
			(t) => t.projectId === selectedFolderProjectId,
		);
	}, [folderBrowseOpen, selectedFolderProjectId, visibleSortedTasks]);

	const visibleTeamTasks = React.useMemo(() => {
		if (folderBrowseOpen && !selectedFolderProjectId) return [];
		const selectedTeamProjectId = teamFolderProjectId(selectedFolderProjectId);
		if (folderBrowseOpen && selectedFolderProjectId && !selectedTeamProjectId) {
			return [];
		}
		const search = taskSearch.trim().toLowerCase();
		const compare = (a: TeamTaskRow, b: TeamTaskRow) =>
			compareDashboardTasksBySortKey(
				{ name: a.name, createdAt: new Date(a.created_at) },
				{ name: b.name, createdAt: new Date(b.created_at) },
				sortBy,
			);
		const filtered = teamWork.tasks.filter((task) => {
			if (selectedTeamProjectId && task.project_id !== selectedTeamProjectId) {
				return false;
			}
			if (search && !task.name.toLowerCase().includes(search)) {
				return false;
			}
			return taskMatchesListFilters(
				{
					repeatable: false,
					prioritized: Boolean(task.prioritized),
				},
				taskListFilters,
			);
		});
		return sortTasksWithPriorityFirst(filtered, compare);
	}, [
		folderBrowseOpen,
		selectedFolderProjectId,
		taskSearch,
		taskListFilters,
		sortBy,
		teamWork.tasks,
	]);
	const teamActiveTasks = React.useMemo(
		() => visibleTeamTasks.filter((task) => task.status !== 'done'),
		[visibleTeamTasks],
	);
	const teamDoneTasks = React.useMemo(
		() => visibleTeamTasks.filter((task) => task.status === 'done'),
		[visibleTeamTasks],
	);

	const filteredTasks = React.useMemo(
		() =>
			scopedTasks.filter((t) => {
				if (!t.name.toLowerCase().includes(taskSearch.trim().toLowerCase())) {
					return false;
				}
				return taskMatchesListFilters(
					{
						repeatable: t.repeatable,
						prioritized: isTaskPrioritized(t.id, t.prioritized),
					},
					taskListFilters,
				);
			}),
		[scopedTasks, taskSearch, taskListFilters],
	);
	const activeTasks = React.useMemo(
		() => filteredTasks.filter((t) => !isDashboardTaskDone(t.status)),
		[filteredTasks],
	);
	const doneTasks = React.useMemo(
		() => filteredTasks.filter((t) => isDashboardTaskDone(t.status)),
		[filteredTasks],
	);
	const hasTasks =
		activeTasks.length > 0 ||
		doneTasks.length > 0 ||
		teamActiveTasks.length > 0 ||
		teamDoneTasks.length > 0;

	const selectedFolderName = React.useMemo(() => {
		if (!selectedFolderProjectId) return null;
		if (selectedFolderProjectId === UNASSIGNED_FOLDER_ID) return 'Unassigned';
		const teamProjectId = teamFolderProjectId(selectedFolderProjectId);
		if (teamProjectId) {
			return teamProjectNameById.get(teamProjectId) ?? 'Team project';
		}
		return (
			projects.find((p) => p.id === selectedFolderProjectId)?.name ?? 'Project'
		);
	}, [projects, selectedFolderProjectId, teamProjectNameById]);

	const tasksWidgetProjectLink = React.useMemo(() => {
		if (teamFolderProjectId(selectedFolderProjectId)) {
			return { href: undefined, navHint: undefined };
		}
		if (
			selectedFolderProjectId &&
			selectedFolderProjectId !== UNASSIGNED_FOLDER_ID
		) {
			return {
				href: projectsDeepLink(selectedFolderProjectId),
				navHint: 'Open in projects',
			};
		}
		return { href: '/projects' as const, navHint: undefined };
	}, [selectedFolderProjectId]);

	const handleFolderFilterToggle = () => {
		if (folderBrowseOpen) {
			setFolderBrowseOpen(false);
			setSelectedFolderProjectId(null);
			return;
		}
		setFolderBrowseOpen(true);
		setSelectedFolderProjectId(null);
	};

	const handleFolderBack = (event?: React.MouseEvent) => {
		event?.preventDefault();
		event?.stopPropagation();
		setSelectedFolderProjectId(null);
	};

	const openTeamProjectFolder = (projectId: string) => {
		setFolderBrowseOpen(true);
		setSelectedFolderProjectId(teamFolderId(projectId));
	};

	const openAddTask = () => {
		if (!canManageTasks) return;
		if (selectedFolderProjectId === UNASSIGNED_FOLDER_ID) {
			setNewTaskProjectId(null);
		} else if (
			selectedFolderProjectId &&
			selectedFolderProjectId !== UNASSIGNED_FOLDER_ID &&
			!teamFolderProjectId(selectedFolderProjectId)
		) {
			setNewTaskProjectId(selectedFolderProjectId);
		}
		setAddOpen(true);
	};

	const renderFolderRow = (entry: {
		id: string;
		name: string;
		taskCount: number;
		activeCount: number;
		isTeam?: boolean;
	}) => (
		<Box
			key={entry.id}
			onClick={() => setSelectedFolderProjectId(entry.id)}
			sx={{
				...kronaWidgetListItemSx,
				borderRadius: '18px',
				border: '1px solid var(--krona-surface-border)',
				p: 1.25,
				cursor: 'pointer',
			}}
		>
			<Box
				sx={{
					display: 'flex',
					gap: 1.5,
					alignItems: 'center',
					minWidth: 0,
				}}
			>
				<Box sx={kronaIconTileSx}>
					<Folder size={16} aria-hidden />
				</Box>
				<Box sx={{ minWidth: 0, flex: 1 }}>
					<Box
						sx={{
							display: 'flex',
							alignItems: 'center',
							gap: 0.75,
							minWidth: 0,
						}}
					>
						<Typography
							level="body-sm"
							sx={{
								fontWeight: 600,
								color: 'var(--krona-text)',
								overflow: 'hidden',
								textOverflow: 'ellipsis',
								whiteSpace: 'nowrap',
							}}
						>
							{entry.name}
						</Typography>
						{entry.isTeam ? (
							<Chip
								size="sm"
								variant="soft"
								color="primary"
								sx={{ flexShrink: 0, minHeight: 18, fontSize: 10 }}
							>
								Team
							</Chip>
						) : null}
					</Box>
					<Typography level="body-xs" sx={{ color: 'var(--krona-text-muted)' }}>
						{entry.activeCount > 0
							? `${entry.activeCount} active · ${entry.taskCount} total`
							: entry.taskCount === 0
								? 'No tasks'
								: `${entry.taskCount} task${entry.taskCount === 1 ? '' : 's'}`}
					</Typography>
				</Box>
			</Box>
		</Box>
	);

	const renderTeamTaskRow = (task: TeamTaskRow) => {
		const isDone = task.status === 'done';
		const isActiveForTimer =
			!isDone &&
			(task.id === selectedTaskId || task.id === selectedTimerTask.taskId);

		return (
			<Box
				key={`team-task:${task.id}`}
				onClick={() => {
					if (isDone) return;
					const nextId = isActiveForTimer ? null : task.id;
					setSelectedTaskId(nextId);
					persistSelectedTimerTask(
						nextId,
						nextId ? task.name : null,
						nextId ? task.project_id ?? null : null,
					);
				}}
				sx={{
					...kronaWidgetListItemSx,
					borderRadius: '18px',
					border: isActiveForTimer
						? kronaTimerSelectedTaskBorder
						: '1px solid var(--krona-surface-border)',
					bgcolor: isActiveForTimer
						? kronaTimerSelectedTaskBg
						: 'var(--krona-widget-bg)',
					...(isActiveForTimer
						? {
								'&::before': { bgcolor: 'transparent' },
								'&:hover': {
									borderColor: kronaAccentColorMix(36),
								},
								'&:hover::before': { bgcolor: 'transparent' },
							}
						: {}),
					p: 1.25,
					cursor: isDone ? 'default' : 'pointer',
					opacity: isDone ? 0.72 : 1,
				}}
			>
				<Box
					sx={{
						display: 'flex',
						gap: 1.5,
						alignItems: 'center',
						minWidth: 0,
					}}
				>
					<KronaTaskCheckbox
						checked={isDone}
						onClick={(e) => e.stopPropagation()}
						onChange={() => {
							void (async () => {
								if (!teamWork.organization || !teamWork.userId) return;
								const ok = await setTeamTaskStatus({
									organizationId: teamWork.organization.id,
									taskId: task.id,
									name: task.name,
									actorUserId: teamWork.userId,
									nextStatus: isDone ? 'pending' : 'done',
									estimatedHours: task.estimated_hours,
									createdAt: task.created_at,
								});
								if (ok && !isDone) showKronaSuccess('Task completed');
								await teamWork.reload();
							})();
						}}
					/>
					<Box sx={{ minWidth: 0, flex: 1 }}>
						<Typography
							level="title-sm"
							sx={{
								color: 'var(--krona-text)',
								fontWeight: 600,
								overflow: 'hidden',
								textOverflow: 'ellipsis',
								whiteSpace: 'nowrap',
								textDecoration: isDone ? 'line-through' : 'none',
							}}
						>
							{task.name}
						</Typography>
					</Box>
					<Box className="krona-task-row-actions" sx={kronaTaskRowActionsSx}>
						{canManageTasks && !isDone ? (
							<IconButton
								size="sm"
								variant="plain"
								className="krona-task-row-action krona-task-priority-star"
								aria-label={
									task.prioritized ? 'Remove priority' : 'Mark as priority'
								}
								aria-pressed={Boolean(task.prioritized)}
								onMouseDown={(e) => e.preventDefault()}
								onClick={(e) => {
									e.stopPropagation();
									void (async () => {
										if (!teamWork.organization) return;
										const ok = await setTeamTaskPrioritized({
											organizationId: teamWork.organization.id,
											taskId: task.id,
											name: task.name,
											prioritized: !task.prioritized,
											assigneeUserId: task.assignee_user_id,
										});
										if (!ok) {
											showKronaError('Could not update priority.');
											return;
										}
										await teamWork.reload();
									})();
								}}
								sx={kronaTaskPriorityStarButtonSx(Boolean(task.prioritized))}
							>
								<KronaPriorityStar
									active={Boolean(task.prioritized)}
									size={16}
								/>
							</IconButton>
						) : task.prioritized ? (
							<Box
								className="krona-task-row-action"
								sx={{
									display: 'inline-flex',
									flexShrink: 0,
									color: '#F5C842',
								}}
								aria-label="Priority task"
							>
								<KronaPriorityStar active size={16} />
							</Box>
						) : (
							<Box
								className="krona-task-row-action"
								sx={{
									display: 'inline-flex',
									flexShrink: 0,
									color: 'var(--krona-text-72)',
									pointerEvents: 'none',
								}}
								aria-hidden
							>
								<KronaPriorityStar active={false} size={16} />
							</Box>
						)}
						<Dropdown>
							<MenuButton
								slots={{ root: KronaMoreMenuButton }}
								slotProps={{
									root: {
										className: 'krona-task-row-action',
										sx: kronaTaskRowMoreMenuButtonSx,
										onClick: (e: React.MouseEvent) => e.stopPropagation(),
									},
								}}
							/>
							<Menu
								placement="bottom-end"
								onClick={(e) => e.stopPropagation()}
								sx={kronaMenuSx}
							>
								{task.project_id &&
								selectedFolderProjectId !==
									teamFolderId(task.project_id) ? (
									<MenuItem
										onClick={(e) => {
											e.stopPropagation();
											openTeamProjectFolder(task.project_id!);
										}}
									>
										<FolderKanban size={16} style={{ marginRight: 8 }} />
										View in project
									</MenuItem>
								) : null}
								{canManageTasks ? (
									<MenuItem
										onClick={(e) => {
											e.stopPropagation();
											void (async () => {
												if (!teamWork.organization) return;
												const ok = await deleteTeamTask({
													organizationId: teamWork.organization.id,
													taskId: task.id,
												});
												if (!ok) {
													showKronaError('Could not delete task.');
													return;
												}
												showKronaSuccess('Task deleted.');
												await teamWork.reload();
											})();
										}}
										{...kronaDeleteMenuItemProps}
									>
										<Trash2 size={16} style={{ marginRight: 8 }} />
										Delete
									</MenuItem>
								) : null}
							</Menu>
						</Dropdown>
					</Box>
				</Box>
			</Box>
		);
	};

	const renderTaskRow = (task: (typeof visibleSortedTasks)[number]) => {
		const isDone = isDashboardTaskDone(task.status);
		const isPrioritized = isTaskPrioritized(task.id, task.prioritized);
		const isActiveForTimer = !isDone && task.id === selectedTaskId;

		return (
			<Box
				key={task.id}
				onClick={() => {
					if (isDone) return;
					setSelectedTaskId(isActiveForTimer ? null : task.id);
				}}
				sx={{
					...kronaWidgetListItemSx,
					borderRadius: '18px',
					border: isActiveForTimer
						? kronaTimerSelectedTaskBorder
						: '1px solid var(--krona-surface-border)',
					bgcolor: isActiveForTimer
						? kronaTimerSelectedTaskBg
						: 'var(--krona-widget-bg)',
					...(isActiveForTimer
						? {
								'&::before': { bgcolor: 'transparent' },
								'&:hover': {
									borderColor: kronaAccentColorMix(36),
								},
								'&:hover::before': { bgcolor: 'transparent' },
							}
						: {}),
					p: 1.25,
					cursor: isDone ? 'default' : 'pointer',
					opacity: isDone ? 0.72 : 1,
				}}
			>
				<Box
					sx={{
						display: 'flex',
						gap: 1.5,
						alignItems: 'center',
						minWidth: 0,
					}}
				>
					<KronaTaskCheckbox
						checked={isDone}
						onClick={(e) => e.stopPropagation()}
						onChange={() => {
							void (async () => {
								const ok = await setTaskCompleted(task.id, !isDone);
								if (ok && !isDone) showKronaSuccess('Task completed');
							})();
						}}
					/>
					<Box sx={{ minWidth: 0, flex: 1 }}>
						<Typography
							level="title-sm"
							sx={{
								color: 'var(--krona-text)',
								fontWeight: 600,
								overflow: 'hidden',
								textOverflow: 'ellipsis',
								whiteSpace: 'nowrap',
								textDecoration: isDone ? 'line-through' : 'none',
							}}
						>
							{task.name}
						</Typography>
					</Box>
					<Box className="krona-task-row-actions" sx={kronaTaskRowActionsSx}>
						{!isDone ? (
							<IconButton
								size="sm"
								variant="plain"
								className="krona-task-row-action krona-task-priority-star"
								aria-label={
									isPrioritized ? 'Remove priority' : 'Mark as priority'
								}
								aria-pressed={isPrioritized}
								onMouseDown={(e) => e.preventDefault()}
								onClick={(e) => {
									e.stopPropagation();
									toggleTaskPriority(task.id);
								}}
								sx={kronaTaskPriorityStarButtonSx(isPrioritized)}
							>
								<KronaPriorityStar active={isPrioritized} size={16} />
							</IconButton>
						) : null}
						<Dropdown>
							<MenuButton
								slots={{ root: KronaMoreMenuButton }}
								slotProps={{
									root: {
										className: 'krona-task-row-action',
										sx: kronaTaskRowMoreMenuButtonSx,
										onClick: (e: React.MouseEvent) => e.stopPropagation(),
									},
								}}
							/>
							<Menu
								placement="bottom-end"
								modifiers={[
									{
										name: 'offset',
										options: { offset: [0, 16] },
									},
								]}
								onClick={(e) => e.stopPropagation()}
								sx={kronaMenuSx}
							>
								{task.projectId ? (
									<MenuItem
										component={NextLink}
										href={projectsDeepLink(task.projectId, task.id)}
										onClick={(e) => e.stopPropagation()}
									>
										<FolderKanban size={16} style={{ marginRight: 8 }} />
										View in project
									</MenuItem>
								) : null}
								{canManageTasks ? (
									<>
								<MenuItem
									onClick={(e) => {
										e.stopPropagation();
										openEditTask(task);
									}}
								>
									<Edit size={16} style={{ marginRight: 8 }} />
									Edit
								</MenuItem>
								<MenuItem
									onClick={(e) => {
										e.stopPropagation();
										void (async () => {
											const next = !Boolean(task.repeatable);
											const ok = await setTaskRepeatable(task.id, next);
											if (!ok) {
												showKronaError('Could not update repeatable setting.');
												return;
											}
											showKronaSuccess(
												next
													? 'Task set as repeatable daily.'
													: 'Task is no longer repeatable.',
											);
										})();
									}}
								>
									<Repeat2 size={16} style={{ marginRight: 8 }} />
									{task.repeatable
										? 'Remove repeatable'
										: 'Make repeatable daily'}
								</MenuItem>
								<MenuItem
									onClick={(e) => {
										e.stopPropagation();
										requestDeleteTask(task);
									}}
									{...kronaDeleteMenuItemProps}
								>
									<Trash2 size={16} style={{ marginRight: 8 }} />
									Delete
								</MenuItem>
									</>
								) : null}
							</Menu>
						</Dropdown>
					</Box>
				</Box>
			</Box>
		);
	};

	const resetTaskForm = () => {
		setEditingTaskId(null);
		setNewTaskName('');
		setNewTaskHours('1');
		setNewTaskHasTime(true);
		setNewTaskDeadline('');
		setNewTaskReminder(false);
		setNewTaskRepeatable(false);
		setNewTaskProjectId(null);
		setNewProjectName('');
		setShowNewProjectInput(false);
		setTaskFormErrors({});
	};

	const closeTaskModal = () => {
		setAddOpen(false);
		resetTaskForm();
	};

	const performDeleteTask = React.useCallback(
		(task: DashboardTask) => {
			void (async () => {
				const { data: userRes } = await localData.auth.getUser();
				const userId = userRes.user?.id;
				if (!userId) return;

				let wasSelectedForTimer = false;
				try {
					wasSelectedForTimer =
						window.localStorage.getItem('krona:selectedTaskId') === task.id;
				} catch {
					/* ignore */
				}

				const snapshot: DashboardDeleteSnapshot = {
					task,
					userId,
					wasPrioritized: Boolean(task.prioritized),
					wasSelectedForTimer,
				};

				await stageTaskDeleteSnapshot(snapshot, () => {
					setHiddenDeletedTaskIds((prev) => new Set(prev).add(task.id));
					notifyTaskPendingDelete(task.id);
				});
			})();
		},
		[stageTaskDeleteSnapshot],
	);

	const requestDeleteTask = (task: DashboardTask) => {
		performDeleteTask(task);
	};

	const openEditTask = (task: (typeof visibleSortedTasks)[number]) => {
		if (!canManageTasks) return;
		setEditingTaskId(task.id);
		setNewTaskName(task.name);
		setNewTaskProjectId(
			task.projectId === undefinedProjectId ? null : task.projectId,
		);
		if (task.assignedSeconds && task.assignedSeconds > 0) {
			setNewTaskHasTime(true);
			setNewTaskHours(formatDecimalHours(task.assignedSeconds / 3600));
		} else {
			setNewTaskHasTime(false);
			setNewTaskHours('');
		}
		setNewTaskDeadline('');
		setNewTaskReminder(false);
		setNewTaskRepeatable(Boolean(task.repeatable));
		setAddOpen(true);
	};

	const validateTaskForm = () => {
		const errors: typeof taskFormErrors = {};
		if (!newTaskName.trim()) {
			errors.taskName = 'Task name is required.';
		}
		if (!editingTaskId && showNewProjectInput && !newProjectName.trim()) {
			errors.projectName = 'Project name is required.';
		}
		if (newTaskHasTime && !newTaskHours.trim()) {
			errors.assignedHours = 'Estimated time is required.';
		} else if (
			newTaskHasTime &&
			newTaskHours.trim() &&
			(Number(newTaskHours) <= 0 || Number.isNaN(Number(newTaskHours)))
		) {
			errors.assignedHours = 'Enter a valid number of hours.';
		}
		if (!editingTaskId && newTaskReminder && !newTaskDeadline.trim()) {
			errors.deadline = 'Deadline is required to add a reminder.';
		} else if (isDeadlineInPast(newTaskDeadline)) {
			errors.deadline = DEADLINE_PAST_MESSAGE;
		}
		setTaskFormErrors(errors);
		return Object.keys(errors).length === 0;
	};

	const handleSaveTask = async () => {
		if (!validateTaskForm()) return;
		setSavingTask(true);
		let projectId = newTaskProjectId;

		if (!showNewProjectInput && !projectId) {
			const { data: userRes } = await localData.auth.getUser();
			const user = userRes.user;
			if (!user) {
				setSavingTask(false);
				showKronaError('Could not create task. Please try again.');
				return;
			}
			projectId = await ensureUndefinedProject(user.id);
			if (!projectId) {
				setSavingTask(false);
				showKronaError('Could not create the default project.');
				return;
			}
		}

		if (editingTaskId) {
			const ok = await updateTask(editingTaskId, {
				name: newTaskName,
				projectId,
				assignedHours:
					newTaskHasTime && newTaskHours.trim()
						? Number(newTaskHours) || 0
						: null,
				repeatable: newTaskRepeatable,
			});
			setSavingTask(false);
			if (ok) {
				setAddOpen(false);
				resetTaskForm();
			}
			return;
		}

		if (newProjectName.trim()) {
			const { data: userRes } = await localData.auth.getUser();
			const user = userRes.user;
			if (user) {
				if (isUndefinedProjectName(newProjectName)) {
					projectId = await ensureUndefinedProject(user.id);
				} else {
					const { data: project } = await localData
						.from('projects')
						.insert({
							user_id: user.id,
							name: newProjectName.trim(),
						})
						.select('id')
						.single();
					if (project?.id) projectId = project.id as string;
				}
			}
		}
		if (!projectId) {
			setSavingTask(false);
			showKronaError('Could not create the selected project.');
			return;
		}
		const deadline = newTaskDeadline
			? new Date(`${newTaskDeadline}T23:59:59`)
			: null;
		const id = await createTask({
			name: newTaskName,
			projectId,
			assignedHours:
				newTaskHasTime && newTaskHours.trim()
					? Number(newTaskHours) || 0
					: null,
			deadline,
			addToReminders: !remindersLocked && newTaskReminder && Boolean(deadline),
			repeatable: newTaskRepeatable,
		});
		setSavingTask(false);
		if (id) {
			setAddOpen(false);
			resetTaskForm();
			if (folderBrowseOpen && !selectedFolderProjectId) {
				setSelectedFolderProjectId(
					projectId ? projectId : UNASSIGNED_FOLDER_ID,
				);
			}
			showKronaSuccess('Task added.');
		} else {
			showKronaError('Could not create task. Please try again.');
		}
	};

	const tasksShellRef = React.useRef<HTMLDivElement>(null);
	const timerShellRef = React.useRef<HTMLDivElement>(null);
	const pairHeight = useDashboardTasksTimerEqualHeight(
		tasksShellRef,
		timerShellRef,
		// Re-measure when timer chrome / selected task label changes size.
		`${selectedTask?.name ?? ''}:${mode}:${running ? 1 : 0}`,
	);

	return (
		<>
			<DashboardWidgetShell
				ref={tasksShellRef}
				id="tasks"
				sx={{
					// Locked to timer content height below desktop (also set inline by the hook).
					...(pairHeight != null
						? {
								height: `${pairHeight}px`,
								minHeight: `${pairHeight}px`,
								maxHeight: `${pairHeight}px`,
							}
						: {
								height: isDesktopDashboard ? '100%' : 'auto',
								minHeight: isDesktopDashboard
									? 0
									: `${DASHBOARD_TASKS_TIMER_MIN_HEIGHT_PX}px`,
								maxHeight: 'none',
							}),
					// Clear locked px heights on desktop so grid fill can apply.
					...(isDesktopDashboard
						? {
								height: '100%',
								minHeight: 0,
								maxHeight: 'none',
							}
						: {}),
					overflow: 'hidden',
					display: 'flex',
					flexDirection: 'column',
					flex: isDesktopDashboard ? 1 : '0 0 auto',
					alignSelf: isDesktopDashboard ? 'stretch' : 'start',
				}}
			>
				<DashboardWidgetHeader
					widgetId="tasks"
					leading={
						selectedFolderProjectId ? (
							<Tooltip title="Back to projects">
								<IconButton
									size="sm"
									aria-label="Back to projects"
									onClick={(event) => handleFolderBack(event)}
									sx={kronaSecondaryIconButtonSx}
								>
									<ChevronLeft size={18} />
								</IconButton>
							</Tooltip>
						) : undefined
					}
					title={
						selectedFolderProjectId && selectedFolderName
							? selectedFolderName
							: folderBrowseOpen
								? 'My projects'
								: 'My tasks'
					}
					href={
						selectedFolderProjectId === UNASSIGNED_FOLDER_ID
							? undefined
							: tasksWidgetProjectLink.href
					}
					navHint={tasksWidgetProjectLink.navHint}
					actions={
						<Box
							sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}
						>
							{!folderBrowseOpen || selectedFolderProjectId ? (
								<TaskSortToggleButton
									sortBy={sortBy}
									onSortChange={setSortBy}
									filters={taskListFilters}
									onFiltersChange={setTaskListFilters}
								/>
							) : null}
							<TaskFolderFilterButton
								active={folderBrowseOpen}
								onToggle={handleFolderFilterToggle}
							/>
							{canManageTasks ? (
								<Tooltip title="Add task">
									<IconButton
										size="sm"
										aria-label="Add task"
										onClick={openAddTask}
										sx={kronaPrimaryIconButtonSx}
									>
										<Plus size={18} />
									</IconButton>
								</Tooltip>
							) : null}
						</Box>
					}
				/>
				<Box
					sx={{
						position: 'relative',
						mb: '20px',
						flexShrink: 0,
						zIndex: 1,
						// Scroll list reserves 16px top padding for row shadows — pull it
						// back so the visible search→task gap stays 20px.
						'& + .krona-widget-scroll': { marginTop: '-16px' },
					}}
				>
					<KronaSearchCreateToolbar
						searchPlaceholder={
							folderBrowseOpen && !selectedFolderProjectId
								? kronaPlaceholders.search.projects
								: kronaPlaceholders.search.tasks
						}
						searchValue={taskSearch}
						onSearchChange={setTaskSearch}
						sx={{
							mb: 0,
							flexShrink: 0,
							'& .krona-search-toolbar-row': { gap: 2 },
						}}
					/>
				</Box>
				<DashboardWidgetScrollArea
					sx={{
						...kronaWidgetListScrollSx,
						gap: 1,
						// Let wheel/touch chain to the page on short tablet views so lower
						// widgets stay reachable when the pair is height-locked.
						overscrollBehavior: 'auto',
					}}
					topFade
				>
					{(tasksLoading || teamContextLoading || teamWork.loading) &&
					visibleSortedTasks.length === 0 &&
					teamWork.tasks.length === 0 ? (
						<TaskListSkeleton />
					) : folderBrowseOpen && !selectedFolderProjectId ? (
						folderEntries.length === 0 ? (
							<Box
								sx={{
									flex: 1,
									display: 'flex',
									flexDirection: 'column',
									alignItems: 'center',
									justifyContent: 'center',
									textAlign: 'center',
									gap: 1.5,
									py: 2,
								}}
							>
								<Folder
									size={48}
									strokeWidth={1.25}
									color="var(--krona-text)"
									style={{ opacity: 0.48 }}
									aria-hidden
								/>
								<Typography
									level="body-sm"
									sx={{ color: 'var(--krona-text-muted)', maxWidth: 240 }}
								>
									{projects.length === 0 && teamWork.projects.length === 0
										? 'No projects yet. Create one when adding a task.'
										: 'No projects match your search.'}
								</Typography>
							</Box>
						) : (
							folderEntries.map(renderFolderRow)
						)
					) : !hasTasks ? (
						<Box
							sx={{
								flex: 1,
								display: 'flex',
								flexDirection: 'column',
								alignItems: 'center',
								justifyContent: 'center',
								textAlign: 'center',
								gap: 1.5,
								py: 2,
							}}
						>
							<ClipboardList
								size={48}
								strokeWidth={1.25}
								color="var(--krona-text)"
								style={{ opacity: 0.48 }}
								aria-hidden
							/>
							<Typography
								level="body-sm"
								sx={{ color: 'var(--krona-text-muted)', maxWidth: 240 }}
							>
								{canManageTasks
									? 'No tasks yet. Add one to track time and stay on top of your work.'
									: 'No tasks are available yet.'}
							</Typography>
							{canManageTasks ? (
								<Button size="sm" onClick={openAddTask} sx={kronaPrimaryButtonSx}>
									Add task
								</Button>
							) : null}
						</Box>
					) : (
						<>
							{activeTasks.map(renderTaskRow)}
							{teamActiveTasks.map(renderTeamTaskRow)}
							{doneTasks.length > 0 || teamDoneTasks.length > 0 ? (
								<>
									<KronaListDivider label="Done" compact />
									{doneTasks.map(renderTaskRow)}
									{teamDoneTasks.map(renderTeamTaskRow)}
								</>
							) : null}
						</>
					)}
				</DashboardWidgetScrollArea>
			</DashboardWidgetShell>

			<Modal open={addOpen && canManageTasks} onClose={closeTaskModal}>
				<ModalDialog
					sx={{
						...kronaModalDialogSx,
						position: 'relative',
						px: { xs: '20px', sm: '24px' },
						py: '18px',
					}}
				>
					<IconButton
						size="sm"
						aria-label="Close"
						onClick={closeTaskModal}
						sx={kronaModalCloseButtonSx}
					>
						<X size={18} />
					</IconButton>
					<Typography level="h4" sx={kronaModalTitleSx}>
						{editingTaskId ? 'Edit task' : 'New task'}
					</Typography>
					<Box
						component="form"
						onSubmit={(e) => {
							e.preventDefault();
							void handleSaveTask();
						}}
						sx={kronaModalFormSx}
					>
						<Box sx={kronaModalFieldsSx}>
							<FormControl error={Boolean(taskFormErrors.taskName)}>
								<FormLabel sx={{ color: 'var(--krona-text)' }}>
									Task name
								</FormLabel>
								<Input
									placeholder={kronaPlaceholders.dashboard.taskName}
									value={newTaskName}
									onChange={(e) => {
										setNewTaskName(e.target.value);
										if (taskFormErrors.taskName) {
											setTaskFormErrors((prev) => ({
												...prev,
												taskName: undefined,
											}));
										}
									}}
									sx={kronaInputSx}
								/>
								{taskFormErrors.taskName ? (
									<FormHelperText>{taskFormErrors.taskName}</FormHelperText>
								) : null}
							</FormControl>
							<FormControl>
								<FormLabel sx={{ color: 'var(--krona-text)' }}>
									Project
								</FormLabel>
								<Select
									value={newTaskProjectId ?? UNDEFINED_PROJECT_OPTION}
									onChange={(_, v) => {
										setNewTaskProjectId(
											v === UNDEFINED_PROJECT_OPTION ? null : String(v),
										);
										setShowNewProjectInput(false);
										setNewProjectName('');
									}}
									placeholder={undefinedProjectLabel}
									sx={kronaInputSx}
								>
									{projects
										.filter((project) => !project.isUnassignedFolder)
										.map((project) => (
											<Option key={project.id} value={project.id}>
												{project.name}
											</Option>
										))}
									<Option value={UNDEFINED_PROJECT_OPTION}>
										{undefinedProjectLabel}
									</Option>
								</Select>
								{canManageProjects && !editingTaskId && !showNewProjectInput ? (
									<Button
										variant="plain"
										size="sm"
										startDecorator={<Plus size={16} />}
										onClick={() => {
											setShowNewProjectInput(true);
											setNewTaskProjectId(null);
											setNewProjectName('');
										}}
										sx={{
											alignSelf: 'flex-start',
											mt: 0.75,
											px: 0,
											minHeight: 0,
											color: 'var(--krona-text-muted)',
											fontWeight: 500,
											'&:hover': {
												bgcolor: 'transparent',
												color: 'var(--krona-text)',
											},
										}}
									>
										New project
									</Button>
								) : null}
								{!editingTaskId && showNewProjectInput ? (
									<FormControl
										error={Boolean(taskFormErrors.projectName)}
										sx={{ mt: 0.75 }}
									>
										<Input
											placeholder={kronaPlaceholders.dashboard.projectName}
											value={newProjectName}
											onChange={(e) => {
												setNewProjectName(e.target.value);
												if (taskFormErrors.projectName) {
													setTaskFormErrors((prev) => ({
														...prev,
														projectName: undefined,
													}));
												}
											}}
											sx={kronaInputSx}
										/>
										{taskFormErrors.projectName ? (
											<FormHelperText>
												{taskFormErrors.projectName}
											</FormHelperText>
										) : null}
									</FormControl>
								) : null}
							</FormControl>
							<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
								<Checkbox
									checked={newTaskHasTime}
									onChange={(e) => {
										setNewTaskHasTime(e.target.checked);
										if (!e.target.checked && taskFormErrors.assignedHours) {
											setTaskFormErrors((prev) => ({
												...prev,
												assignedHours: undefined,
											}));
										}
									}}
									sx={{ color: 'var(--krona-text)' }}
								/>
								<Typography level="body-sm" sx={{ color: 'var(--krona-text)' }}>
									Assign estimated time
								</Typography>
							</Box>
							{newTaskHasTime && (
								<FormControl error={Boolean(taskFormErrors.assignedHours)}>
									<FormLabel sx={{ color: 'var(--krona-text)' }}>
										Assigned time (hours)
									</FormLabel>
									<Input
										type="number"
										slotProps={{ input: { min: 0, step: 0.25 } }}
										value={newTaskHours}
										onChange={(e) => {
											setNewTaskHours(e.target.value);
											if (taskFormErrors.assignedHours) {
												setTaskFormErrors((prev) => ({
													...prev,
													assignedHours: undefined,
												}));
											}
										}}
										placeholder={kronaPlaceholders.dashboard.assignedHours}
										sx={kronaInputSx}
									/>
									{taskFormErrors.assignedHours ? (
										<FormHelperText>
											{taskFormErrors.assignedHours}
										</FormHelperText>
									) : null}
								</FormControl>
							)}
							{!editingTaskId && (
								<>
									<FormControl error={Boolean(taskFormErrors.deadline)}>
										<FormLabel sx={{ color: 'var(--krona-text)' }}>
											Deadline
										</FormLabel>
										<KronaDatePickerButton
											width="100%"
											placeholder={kronaPlaceholders.dashboard.deadline}
											value={newTaskDeadline}
											disablePast
											onChange={(value) => {
												setNewTaskDeadline(value);
												if (!value) {
													setNewTaskReminder(false);
												}
												if (taskFormErrors.deadline) {
													setTaskFormErrors((prev) => ({
														...prev,
														deadline: undefined,
													}));
												}
											}}
										/>
										{taskFormErrors.deadline ? (
											<FormHelperText>{taskFormErrors.deadline}</FormHelperText>
										) : null}
									</FormControl>
									<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
										<Checkbox
											checked={newTaskReminder && !remindersLocked}
											disabled={remindersLocked || !newTaskDeadline}
											onChange={(e) => {
												if (remindersLocked) return;
												setNewTaskReminder(e.target.checked);
												if (!e.target.checked && taskFormErrors.deadline) {
													setTaskFormErrors((prev) => ({
														...prev,
														deadline: undefined,
													}));
												}
											}}
											sx={{ color: 'var(--krona-text)' }}
										/>
										<Typography
											level="body-sm"
											sx={{
												color: 'var(--krona-text)',
												display: 'inline-flex',
												alignItems: 'center',
												gap: 0.75,
											}}
										>
											Add to reminders
										</Typography>
									</Box>
								</>
							)}
							<Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
								<Checkbox
									checked={newTaskRepeatable}
									onChange={(event) =>
										setNewTaskRepeatable(event.target.checked)
									}
									sx={{ color: 'var(--krona-text)', mt: '-2px' }}
								/>
								<Box sx={{ minWidth: 0 }}>
									<Typography
										level="body-sm"
										sx={{ color: 'var(--krona-text)' }}
									>
										Repeatable daily
									</Typography>
									<Typography
										level="body-xs"
										sx={{ color: 'var(--krona-text-muted)', mt: 0.25 }}
									>
										Resets to undone each new day after you complete it.
									</Typography>
								</Box>
							</Box>
						</Box>
						<Button
							type="submit"
							fullWidth
							loading={savingTask}
							sx={{ ...kronaPrimaryButtonSx, ...kronaModalPrimaryActionSx }}
						>
							{editingTaskId ? 'Save changes' : 'Create task'}
						</Button>
					</Box>
				</ModalDialog>
			</Modal>

			<TaskDeleteUndoToast
				open={showDeleteTaskUndoToast}
				onClose={handleDeleteTaskToastClose}
				onRevert={handleRevertTaskDelete}
			/>

			<DashboardWidgetShell
				ref={timerShellRef}
				id="timer"
				sx={{
					// Content-sized below desktop; tasks mirrors this height.
					height: isDesktopDashboard ? '100%' : 'auto',
					minHeight: isDesktopDashboard
						? 0
						: `${DASHBOARD_TASKS_TIMER_MIN_HEIGHT_PX}px`,
					maxHeight: 'none',
					overflow: 'hidden',
					flex: isDesktopDashboard ? 1 : '0 0 auto',
					alignSelf: isDesktopDashboard ? 'stretch' : 'start',
					display: 'flex',
					flexDirection: 'column',
				}}
			>
				<DashboardWidgetHeader
					widgetId="timer"
					title={timerStyle === 'workFree' ? 'Timer' : 'Pomodoro timer'}
					actions={
						<Tooltip title="Timer settings">
							<IconButton
								component={NextLink}
								href="/settings?tab=timer"
								size="sm"
								aria-label="Timer duration settings"
								sx={kronaSecondaryIconButtonSx}
							>
								<Clock3 size={18} />
							</IconButton>
						</Tooltip>
					}
				/>
				<Box
					sx={{
						flex: 1,
						display: 'flex',
						flexDirection: 'column',
						justifyContent: 'center',
						minHeight: 0,
						width: '100%',
					}}
				>
					<DashboardTimerWidget
						selectedTaskLabel={
							selectedTask?.name ?? selectedTimerTask.taskName
						}
					/>
				</Box>
			</DashboardWidgetShell>
		</>
	);
});

export default function DashboardHome() {
	return (
		<DashboardDataProvider>
			<DashboardHomeContent />
		</DashboardDataProvider>
	);
}

function DashboardHomeContent() {
	const dashboard = useDashboardData();
	const { active: vacationActive } = useVacationMode();
	const { isMobileNav, isTabletDashboard, isDesktopDashboard } =
		useKronaLayoutMode();
	const firstName = dashboard.firstName || 'there';
	const showPageSkeleton = dashboard.loading;
	const [greeting, setGreeting] = React.useState('Hello');

	React.useEffect(() => {
		setGreeting(greetingPrefixFromHour(new Date().getHours()));
	}, []);

	React.useEffect(() => {
		if (typeof window === 'undefined') return;
		const html = document.documentElement;
		const body = document.body;
		if (isDesktopDashboard) {
			html.style.overflow = 'hidden';
			body.style.overflow = 'hidden';
		} else {
			html.style.overflow = '';
			body.style.overflow = '';
		}
		return () => {
			html.style.overflow = '';
			body.style.overflow = '';
		};
	}, [isDesktopDashboard]);

	const gridColumns = isDesktopDashboard
		? 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)'
		: isTabletDashboard
			? 'repeat(2, minmax(0, 1fr))'
			: '1fr';

	return (
		<Box
			sx={{
				position: 'relative',
				height: isDesktopDashboard ? '100%' : 'auto',
				maxHeight: isDesktopDashboard ? '100%' : 'none',
				minHeight: isDesktopDashboard ? 0 : 'auto',
				overflow: isDesktopDashboard ? 'hidden' : 'visible',
				// `clip` (not `hidden`) so the vertical axis stays `visible` instead of
				// computing to `auto` and trapping page scroll on tablet viewports.
				overflowX: isDesktopDashboard ? 'hidden' : 'clip',
				color: 'var(--krona-text)',
				display: 'flex',
				flexDirection: 'column',
			}}
		>
			<Background />
			<Top showLogo greetingLabel={`${greeting}, ${firstName}!`} />

			<Box
				sx={{
					pt: 'calc(var(--krona-top-height, 60px) + 24px)',
					pb: isMobileNav
						? 'calc(var(--krona-mobile-tab-height, 81px) + env(safe-area-inset-bottom, 0px) + 16px)'
						: 3,
					px: isMobileNav ? '16px' : 3,
					width: '100%',
					boxSizing: 'border-box',
					flex: isDesktopDashboard ? 1 : '0 0 auto',
					minHeight: isDesktopDashboard ? 0 : 'auto',
					display: 'flex',
					flexDirection: 'column',
					overflow: isDesktopDashboard ? 'hidden' : 'visible',
					overflowX: isDesktopDashboard ? 'hidden' : 'clip',
					position: 'relative',
					zIndex: 1,
				}}
			>
				{vacationActive ? <VacationModeBanner /> : null}
				<Box
					aria-busy={showPageSkeleton}
					aria-label={showPageSkeleton ? 'Loading dashboard' : undefined}
					sx={{
						display: 'grid',
						gap: '24px',
						width: '100%',
						flex: isDesktopDashboard ? '1 1 0' : '0 0 auto',
						minHeight: isDesktopDashboard ? 0 : 'auto',
						maxHeight: isDesktopDashboard ? '100%' : 'none',
						// Never `overflowX: hidden` here — with overflowY:visible it
						// computes to auto and traps scroll on short tablet viewports.
						// `clip` contains widget bleed without becoming a scroll port.
						overflow: isDesktopDashboard ? 'hidden' : 'visible',
						overflowX: isDesktopDashboard ? 'hidden' : 'clip',
						gridTemplateColumns: gridColumns,
						gridTemplateRows: isDesktopDashboard
							? 'repeat(3, minmax(0, 1fr))'
							: 'none',
					}}
				>
					{showPageSkeleton ? (
						<DashboardPageSkeleton />
					) : (
						<DashboardLayoutProvider>
							<DashboardMobileSecondaryWidgetHeightsProvider>
								<DashboardTasksAndTimer />
								<DashboardRemindersWidget />
								<DashboardTodayProgressWidget />
								<DashboardPerformanceWidget />
							</DashboardMobileSecondaryWidgetHeightsProvider>
						</DashboardLayoutProvider>
					)}
				</Box>
			</Box>

			<React.Suspense fallback={null}>
				<DashboardOnboardingTour />
			</React.Suspense>
		</Box>
	);
}
