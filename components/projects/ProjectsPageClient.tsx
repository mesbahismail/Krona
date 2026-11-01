'use client';

import * as React from 'react';
import { CssVarsProvider, extendTheme } from '@mui/joy/styles';
import CssBaseline from '@mui/joy/CssBaseline';
import Box from '@mui/joy/Box';
import Typography from '@mui/joy/Typography';
import Button from '@mui/joy/Button';
import Input from '@mui/joy/Input';
import Checkbox from '@mui/joy/Checkbox';
import IconButton from '@mui/joy/IconButton';
import Menu from '@mui/joy/Menu';
import MenuItem from '@mui/joy/MenuItem';
import Dropdown from '@mui/joy/Dropdown';
import MenuButton from '@mui/joy/MenuButton';
import {
	Modal,
	ModalDialog,
	Snackbar,
	FormControl,
	FormLabel,
	FormHelperText,
	Radio,
	RadioGroup,
} from '@mui/joy';
import {
	Plus,
	Minus,
	Edit,
	Trash2,
	Calendar as CalendarIcon,
	ClipboardList,
	CheckCircle2,
	Folder,
	Undo2,
	Clock,
	Sparkles,
	Timer,
	Trophy,
	Repeat2,
	Search,
	X,
} from 'lucide-react';

import Background from '@/components/Background';
import Top from '@/components/Top';
import KronaListDivider from '@/components/krona/KronaListDivider';
import KronaResizableSplitLayout from '@/components/krona/KronaResizableSplitLayout';
import {
	kronaSideListPanelSx,
	kronaSideListPanelBodySx,
	kronaSideListCardSx,
} from '@/lib/kronaStyles';
import KronaSearchCreateToolbar from '@/components/krona/KronaSearchCreateToolbar';
import TaskSortToggleButton from '@/components/tasks/TaskSortToggleButton';
import RepeatableTaskToggleButton from '@/components/tasks/RepeatableTaskToggleButton';
import {
	compareDashboardTasksBySortKey,
	DEFAULT_TASK_LIST_FILTERS,
	readDashboardTaskSort,
	taskMatchesListFilters,
	writeDashboardTaskSort,
	type DashboardTaskSortKey,
	type TaskListFilters,
} from '@/lib/dashboardTaskSort';
import {
	DEADLINE_PAST_MESSAGE,
	isDeadlineInPast,
	localDateKey,
} from '@/lib/localDate';
import { resetStaleRepeatableTasks } from '@/lib/repeatableTasks';
import KronaMoreMenuButton from '@/components/krona/KronaMoreMenuButton';
import KronaTaskCheckbox from '@/components/krona/KronaTaskCheckbox';
import { useTeamMode } from '@/components/teams/TeamModeContext';
import { useRouter } from 'next/navigation';
import { logEventSync } from '@/lib/telemetry';
import { createReminderForTask } from '@/lib/createTaskReminder';
import { localData } from '@/lib/localData';
import {
	KRONA_TASK_PENDING_DELETE,
	KRONA_TASK_STATUS_CHANGED,
	KRONA_TASKS_UPDATED,
	notifyChallengesSyncNow,
	notifyRemindersUpdated,
	notifyTaskPendingDelete,
	notifyTaskDeleteReverted,
	notifyTaskStatusChanged,
	notifyTasksUpdated,
	notifyKronaWin,
	type TaskPendingDeleteDetail,
	type TaskStatusChangedDetail,
} from '@/lib/kronaDataEvents';
import {
	applyTaskStatusToProjectList,
	removeTaskFromProjectList,
} from '@/lib/crossPageTaskSync';
import { persistTaskCompletion } from '@/lib/persistTaskCompletion';
import {
	shouldHideDeletedTask,
	pruneCommittedDeletesNotInFetch,
} from '@/lib/pendingTaskDeletes';
import { commitTaskDeleteToServer, flushPendingTaskDeletes } from '@/lib/taskDeleteCommit';
import { kronaPlaceholders } from '@/lib/kronaPlaceholders';
import dayjs from 'dayjs';
import {
	SELECTED_TASK_ID_KEY,
	SELECTED_TASK_NAME_KEY,
	persistSelectedTimerTask,
	syncSelectedTimerTaskName,
} from '@/lib/selectedTimerTask';
import {
	deleteRemindersForTask,
	renameProjectReminder,
	renameTaskReminder,
	syncProjectDeadlineReminder,
	syncTaskDeadlineReminder,
} from '@/lib/reminderSync';
import {
	formatDecimalHours,
	formatDecimalHoursLabel,
	hoursFromMinutes,
} from '@/lib/taskTime';
import { KRONA_JOY_PRIMARY } from '@/lib/kronaAccent';
import {
	clearTaskPrioritized,
	isTaskPrioritized,
	setTaskPrioritized,
	sortTasksWithPriorityFirst,
} from '@/lib/taskPriority';
import { showKronaError, showKronaSuccess } from '@/lib/kronaToast';
import {
	compareUndefinedProjectLast,
	isUndefinedProjectName,
} from '@/lib/undefinedProject';
import {
	addTaskToTodayDailyChallenges,
	fetchDailyChallenges,
	getTodayActiveTaskChallengeTaskIds,
	removeTaskFromTodayDailyChallenges,
} from '@/lib/challenges';
import { useSelectedTimerTask } from '@/lib/selectedTimerTask';
import {
	kronaInputSx,
	kronaDeleteButtonSx,
	kronaDeleteMenuItemProps,
	kronaMenuSx,
	kronaModalCloseButtonSx,
	kronaModalDialogSx,
	kronaModalTitleSx,
	kronaModalFormSx,
	kronaModalFieldsSx,
	kronaModalPrimaryActionSx,
	kronaNumberInputHideSpinnersSx,
	kronaPrimaryButtonSx,
	kronaPrimaryIconButtonSx,
	kronaSecondaryButtonSx,
	kronaSearchInputSx,
	kronaTaskPriorityStarButtonSx,
	kronaTaskRowMoreMenuButtonSx,
	kronaTaskTimerTrackButtonSx,
	kronaTaskListRowSx,
	kronaTaskListCheckboxContentGap,
	kronaTaskListItemNameSx,
	kronaMetaDotSx,
	kronaTaskListNameDetailsGap,
	kronaTaskRowActionsSx,
	kronaToolbarRowSx,
} from '@/lib/kronaStyles';
import KronaPriorityStar from '@/components/krona/KronaPriorityStar';
import KronaDatePickerButton from '@/components/krona/KronaDatePickerButton';
import TaskDeleteUndoToast from '@/components/tasks/TaskDeleteUndoToast';
import TaskDailyChallengeDeleteModal from '@/components/tasks/TaskDailyChallengeDeleteModal';
import { useTaskDeleteUndo } from '@/hooks/useTaskDeleteUndo';
import { commitProjectDeleteToServer } from '@/lib/projectDeleteCommit';
import {
	ProjectsDetailSkeleton,
	ProjectsListSkeleton,
} from '@/components/projects/ProjectsPageSkeletons';

type DeletedTaskUndoSnapshot = {
	userId: string;
	projectIdx: number;
	projectId: string;
	type: 'pending' | 'done';
	idx: number;
	task: Task;
	wasPrioritized: boolean;
	wasSelectedForTimer: boolean;
};

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
	components: {
		JoyInput: {
			styleOverrides: {
				root: {
					boxShadow: 'none',
					'&:focus-within': {
						boxShadow: 'none',
					},
					'&:hover': {
						boxShadow: 'none',
					},
				},
			},
		},
	},
});

type TaskTime = {
	mode: 'manual' | 'deadline';
	manualHours?: number;
	deadline?: Date;
	trackedHours?: number; // Hours tracked so far
	dailyGoal?: number; // Hours per day
};

type Task = {
	id?: string;
	text: string;
	prioritized?: boolean;
	time?: TaskTime;
	createdAt?: Date;
	completedAt?: Date;
	repeatable?: boolean;
};

const SORT_EPOCH = new Date(0);

function compareProjectsPageItemsBySortKey(
	a: { name: string; createdAt?: Date },
	b: { name: string; createdAt?: Date },
	sortBy: DashboardTaskSortKey,
): number {
	return compareDashboardTasksBySortKey(
		{ name: a.name, createdAt: a.createdAt ?? SORT_EPOCH },
		{ name: b.name, createdAt: b.createdAt ?? SORT_EPOCH },
		sortBy,
	);
}

function sortProjectsForDisplay(projects: Project[], sortBy: DashboardTaskSortKey): Project[] {
	return [...projects].sort((a, b) => {
		const undefinedOrder = compareUndefinedProjectLast(a, b);
		if (undefinedOrder !== 0) return undefinedOrder;
		return compareProjectsPageItemsBySortKey(a, b, sortBy);
	});
}

function sortPendingTasksForDisplay(tasks: Task[], sortBy: DashboardTaskSortKey): Task[] {
	return sortTasksWithPriorityFirst(tasks, (a, b) =>
		compareProjectsPageItemsBySortKey(
			{ name: a.text, createdAt: a.createdAt },
			{ name: b.text, createdAt: b.createdAt },
			sortBy,
		),
	);
}

function sortDoneTasksForDisplay(tasks: Task[], sortBy: DashboardTaskSortKey): Task[] {
	return [...tasks].sort((a, b) =>
		compareProjectsPageItemsBySortKey(
			{ name: a.text, createdAt: a.createdAt },
			{ name: b.text, createdAt: b.createdAt },
			sortBy,
		),
	);
}

function sortPendingTasks(tasks: Task[]): Task[] {
	return sortTasksWithPriorityFirst(tasks);
}

const TASK_SELECT_BASE =
	'id, project_id, name, time_assigned_minutes, total_time_worked_minutes, deadline, status, schedule_mode, daily_goal_minutes, created_at, completed_at, repeatable';
const LAST_OPENED_PROJECT_ID_KEY = 'krona:last-opened-project-id';

function mapTaskRow(
	row: {
		id: string;
		name: string;
		schedule_mode: string;
		time_assigned_minutes: number | null;
		deadline: string | null;
		total_time_worked_minutes: number | null;
		daily_goal_minutes: number | null;
		prioritized?: boolean | null;
		created_at?: string | null;
		completed_at?: string | null;
		repeatable?: boolean | null;
	},
): Task {
	return {
		id: row.id,
		text: row.name,
		createdAt: row.created_at ? new Date(row.created_at) : undefined,
		completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
		prioritized: isTaskPrioritized(row.id, row.prioritized),
		repeatable: Boolean(row.repeatable),
		time: {
			mode: row.schedule_mode === 'deadline' ? 'deadline' : 'manual',
			manualHours:
				row.schedule_mode === 'manual'
					? hoursFromMinutes(row.time_assigned_minutes || 0)
					: undefined,
			deadline: row.deadline ? new Date(row.deadline) : undefined,
			trackedHours: hoursFromMinutes(row.total_time_worked_minutes || 0),
			dailyGoal:
				row.schedule_mode === 'deadline'
					? hoursFromMinutes(row.daily_goal_minutes || 0)
					: undefined,
		},
	};
}

function mergeProjectsOnReload(prev: Project[], loaded: Project[]): Project[] {
	const prevPendingById = new Map<string, Task>();
	for (const project of prev) {
		for (const task of project.tasks.pending) {
			if (task.id) prevPendingById.set(task.id, task);
		}
	}

	return loaded.map((proj) => {
		if (!proj.id) return proj;
		const prevProj = prev.find((p) => p.id === proj.id);
		if (!prevProj) return proj;

		const optimisticPending = prevProj.tasks.pending.filter((task) =>
			task.id?.startsWith('tmp-task-'),
		);

		const loadedIds = new Set(proj.tasks.pending.map((task) => task.id));
		const mergedPending = proj.tasks.pending.map((task) => {
			if (!task.id) return task;
			const prioritized =
				isTaskPrioritized(task.id, task.prioritized) ||
				Boolean(prevPendingById.get(task.id)?.prioritized);
			return prioritized === task.prioritized ? task : { ...task, prioritized };
		});

		for (const task of optimisticPending) {
			if (!loadedIds.has(task.id)) {
				mergedPending.push(task);
			}
		}

		return {
			...proj,
			tasks: {
				...proj.tasks,
				pending: sortPendingTasks(mergedPending),
			},
		};
	});
}

type Project = {
	id?: string;
	name: string;
	is_unassigned_folder?: boolean;
	deadline: Date | null;
	reminder: boolean;
	createdAt?: Date;
	tasks: {
		pending: Task[];
		done: Task[];
	};
	projectTime?: {
		totalHours: number;
		trackedHours: number;
	};
};

type DeletedProjectUndoSnapshot = {
	userId: string;
	idx: number;
	project: Project;
	previousSelectedProjectIdx: number;
	wasSelectedForTimer: boolean;
	selectedTaskId: string | null;
	selectedTaskName: string | null;
};

function cloneTaskForUndo(task: Task): Task {
	return {
		...task,
		createdAt: task.createdAt ? new Date(task.createdAt) : undefined,
		time: task.time
			? {
					...task.time,
					deadline: task.time.deadline ? new Date(task.time.deadline) : undefined,
				}
			: undefined,
	};
}

function cloneProjectForUndo(project: Project): Project {
	return {
		...project,
		deadline: project.deadline ? new Date(project.deadline) : null,
		createdAt: project.createdAt ? new Date(project.createdAt) : undefined,
		projectTime: project.projectTime ? { ...project.projectTime } : undefined,
		tasks: {
			pending: project.tasks.pending.map(cloneTaskForUndo),
			done: project.tasks.done.map(cloneTaskForUndo),
		},
	};
}

const initialProjects: Project[] = [
	{
		name: 'Project Alpha',
		deadline: new Date(Date.now() + 14 * 86400000), // 14 days from now
		reminder: false,
		projectTime: {
			totalHours: 40,
			trackedHours: 15,
		},
		tasks: {
			pending: [
				{
					text: 'Implement responsive design for the project website.',
					time: {
						mode: 'deadline',
						deadline: new Date(Date.now() + 7 * 86400000),
						trackedHours: 5,
						dailyGoal: 2,
					},
				},
				{
					text: 'Set up a version control system using Git.',
					time: {
						mode: 'manual',
						manualHours: 10,
						trackedHours: 3,
					},
				},
			],
			done: [
				{
					text: 'Design a user-friendly interface for the application.',
					time: {
						mode: 'manual',
						manualHours: 8,
						trackedHours: 8,
					},
				},
			],
		},
	},
	{
		name: 'Project Beta',
		deadline: new Date(Date.now() + 30 * 86400000), // 30 days from now
		reminder: false,
		projectTime: {
			totalHours: 20,
			trackedHours: 5,
		},
		tasks: {
			pending: [{ text: 'Draft project proposal.' }],
			done: [],
		},
	},
];

export default function App() {
	const router = useRouter();
	const { role, canCreateEditProjects, canCreateEditTasks } = useTeamMode();
	const canManageProjects = role !== 'member' || canCreateEditProjects;
	const canManageTasks = role !== 'member' || canCreateEditTasks;
	const [projects, setProjects] = React.useState<Project[]>([]);
	const [projectsLoading, setProjectsLoading] = React.useState(true);
	const projectsInitialLoadRef = React.useRef(true);
	const [userId, setUserId] = React.useState<string | null>(null);
	const [selectedProjectIdx, setSelectedProjectIdx] = React.useState(0);
	const [addProjectOpen, setAddProjectOpen] = React.useState(false);
	const [addTaskModalOpen, setAddTaskModalOpen] = React.useState(false);
	// Mobile detail view toggle: list -> details
	const [mobileDetails, setMobileDetails] = React.useState(false);
	const [editProjectOpen, setEditProjectOpen] = React.useState(false);
	const [newProjectName, setNewProjectName] = React.useState('');
	const [newProjectDeadline, setNewProjectDeadline] =
		React.useState<Date | null>(null);
	const [newProjectReminder, setNewProjectReminder] = React.useState(false);
	const [projectFormErrors, setProjectFormErrors] = React.useState<{
		name?: string;
	}>({});
	const [editProjectFormErrors, setEditProjectFormErrors] = React.useState<{
		name?: string;
	}>({});
	const [newTask, setNewTask] = React.useState('');
	const [newTaskTime, setNewTaskTime] = React.useState<number>(0);
	const [newTaskDeadline, setNewTaskDeadline] = React.useState('');
	const [newTaskRepeatable, setNewTaskRepeatable] = React.useState(false);
	const addTaskInputRef = React.useRef<HTMLInputElement>(null);
	const [editingProjectIdx, setEditingProjectIdx] = React.useState<
		number | null
	>(null);
	const [editingProjectName, setEditingProjectName] = React.useState('');
	const [editingProjectDeadline, setEditingProjectDeadline] =
		React.useState<Date | null>(null);
	const [editingProjectReminder, setEditingProjectReminder] =
		React.useState(false);
	const [editingTask, setEditingTask] = React.useState<{
		type: 'pending' | 'done';
		idx: number;
	} | null>(null);
	const [editingTaskIdx, setEditingTaskIdx] = React.useState<{
		type: 'pending' | 'done';
		idx: number;
	} | null>(null);
	const [editingTaskText, setEditingTaskText] = React.useState('');
	const [taskEditName, setTaskEditName] = React.useState('');
	const [taskFormErrors, setTaskFormErrors] = React.useState<{ name?: string }>({});
	const [editingHeaderTitle, setEditingHeaderTitle] = React.useState(false);
	const [headerTitleDraft, setHeaderTitleDraft] = React.useState('');
	const headerTitleInputRef = React.useRef<HTMLInputElement>(null);
	const [projectSearch, setProjectSearch] = React.useState('');
	const [sortBy, setSortBy] = React.useState<DashboardTaskSortKey>(() =>
		readDashboardTaskSort(),
	);
	const [taskListFilters, setTaskListFilters] = React.useState<TaskListFilters>(
		DEFAULT_TASK_LIST_FILTERS,
	);
	const [highlightTaskId, setHighlightTaskId] = React.useState<string | null>(null);
	const { taskId: selectedTimerTaskId } = useSelectedTimerTask();
	const [dailyChallengeTaskIds, setDailyChallengeTaskIds] = React.useState<
		Set<string>
	>(() => new Set());
	const deepLinkFocusAppliedRef = React.useRef(false);
	const [initialProjectSelectionReady, setInitialProjectSelectionReady] =
		React.useState(false);
	const highlightTimeoutRef = React.useRef<number | null>(null);

	// Task edit modal state (name + time)
	const [taskEditModalOpen, setTaskEditModalOpen] = React.useState(false);
	const [taskEditRepeatable, setTaskEditRepeatable] = React.useState(false);
	const [taskTimeMode, setTaskTimeMode] = React.useState<'manual' | 'deadline'>(
		'manual',
	);
	const [taskTimeManualHours, setTaskTimeManualHours] =
		React.useState<number>(0);
	const [taskTimeDeadline, setTaskTimeDeadline] = React.useState<Date | null>(
		null,
	);
	const [taskTimeDailyGoal, setTaskTimeDailyGoal] = React.useState<number>(2);

	const [editingProjectAssignedHours, setEditingProjectAssignedHours] =
		React.useState<number>(0);

	// Delete project confirmation
	const [deleteProjectModalOpen, setDeleteProjectModalOpen] = React.useState(false);
	const [projectPendingDeleteIdx, setProjectPendingDeleteIdx] =
		React.useState<number | null>(null);
	const [challengeTaskDelete, setChallengeTaskDelete] = React.useState<{
		type: 'pending' | 'done';
		task: Task;
		taskName: string;
	} | null>(null);
	const challengeTaskDeleteRef = React.useRef(challengeTaskDelete);
	React.useEffect(() => {
		challengeTaskDeleteRef.current = challengeTaskDelete;
	}, [challengeTaskDelete]);

	// Undo assigned-time edit state
	const [showAssignedTimeUndoToast, setShowAssignedTimeUndoToast] =
		React.useState(false);
	const [assignedTimeUndo, setAssignedTimeUndo] = React.useState<
		| {
				kind: 'task';
				projectIdx: number;
				type: 'pending' | 'done';
				idx: number;
				taskId: string;
				previousHours: number;
		  }
		| {
				kind: 'project';
				projectIdx: number;
				projectId: string;
				previousHours: number;
		  }
		| null
	>(null);

	const committedTaskDeleteIdsRef = React.useRef<Set<string>>(new Set());

	React.useEffect(() => {
		const reload = () => {
			void (async () => {
			if (projectsInitialLoadRef.current) {
				setProjectsLoading(true);
			}
			try {
			const { data: userRes } = await localData.auth.getUser();
			const user = userRes.user;
			if (!user) {
				setProjects([]);
				setUserId(null);
				return;
			}
			setUserId(user.id);
			void flushPendingTaskDeletes(user.id);
			await resetStaleRepeatableTasks(user.id, localData, { notify: false });
			const [{ data: projectRows }, taskResult] = await Promise.all([
				localData
					.from('projects')
					.select(
						'id, name, is_unassigned_folder, deadline, reminder, time_assigned_minutes, time_worked_minutes, created_at',
					)
					.eq('user_id', user.id)
					.order('created_at', { ascending: true }),
				localData
					.from('tasks')
					.select(`${TASK_SELECT_BASE}, prioritized`)
					.eq('user_id', user.id)
					.order('created_at', { ascending: true }),
			]);

			let taskRows = taskResult.data;
			if (taskResult.error) {
				const fallback = await localData
					.from('tasks')
					.select(TASK_SELECT_BASE)
					.eq('user_id', user.id)
					.order('created_at', { ascending: true });
				taskRows = (fallback.data ?? null) as typeof taskResult.data;
			}

			pruneCommittedDeletesNotInFetch((taskRows || []).map((row) => row.id));

			const tasksByProject = new Map<string, { pending: Task[]; done: Task[] }>();
			(taskRows || []).forEach((row) => {
				if (!row.project_id) return;
				if (shouldHideDeletedTask(row.id)) return;
				if (!tasksByProject.has(row.project_id)) {
					tasksByProject.set(row.project_id, { pending: [], done: [] });
				}
				const task = mapTaskRow(row);
				if (row.status === 'done') {
					tasksByProject.get(row.project_id)!.done.push(task);
				} else {
					tasksByProject.get(row.project_id)!.pending.push(task);
				}
			});

			tasksByProject.forEach((group) => {
				group.pending = sortPendingTasks(group.pending);
			});

			setProjects((prev) =>
				mergeProjectsOnReload(
					prev,
					(projectRows || []).map((row) => {
						const taskGroup = tasksByProject.get(row.id) || { pending: [], done: [] };
						return {
							id: row.id,
							name: row.name,
							is_unassigned_folder: Boolean(row.is_unassigned_folder),
							deadline: row.deadline ? new Date(row.deadline) : null,
							reminder: Boolean(row.reminder),
							createdAt: row.created_at ? new Date(row.created_at) : undefined,
							tasks: taskGroup,
							projectTime: {
								totalHours: hoursFromMinutes(row.time_assigned_minutes || 0),
								trackedHours: hoursFromMinutes(row.time_worked_minutes || 0),
							},
						};
					}),
				),
			);
			} finally {
				projectsInitialLoadRef.current = false;
				setProjectsLoading(false);
			}
		})();
		};
		reload();
		const onPageShow = (e: PageTransitionEvent) => {
			if (e.persisted) reload();
		};
		const onTaskPendingDelete = (event: Event) => {
			const taskId = (event as CustomEvent<TaskPendingDeleteDetail>).detail?.taskId;
			if (!taskId) return;
			setProjects((prev) => removeTaskFromProjectList(prev, taskId));
		};
		const onTaskStatusChanged = (event: Event) => {
			const detail = (event as CustomEvent<TaskStatusChangedDetail>).detail;
			if (!detail?.taskId) return;
			setProjects((prev) =>
				applyTaskStatusToProjectList(
					prev,
					detail.taskId,
					detail.status,
					sortPendingTasks,
				),
			);
		};
		window.addEventListener('focus', reload);
		window.addEventListener('pageshow', onPageShow);
		window.addEventListener(KRONA_TASKS_UPDATED, reload);
		window.addEventListener(KRONA_TASK_PENDING_DELETE, onTaskPendingDelete);
		window.addEventListener(KRONA_TASK_STATUS_CHANGED, onTaskStatusChanged);
		return () => {
			window.removeEventListener('focus', reload);
			window.removeEventListener('pageshow', onPageShow);
			window.removeEventListener(KRONA_TASKS_UPDATED, reload);
			window.removeEventListener(KRONA_TASK_PENDING_DELETE, onTaskPendingDelete);
			window.removeEventListener(KRONA_TASK_STATUS_CHANGED, onTaskStatusChanged);
		};
	}, []);

	// After local midnight, reset completed repeatable tasks for the new day.
	React.useEffect(() => {
		const lastDateKeyRef = { current: localDateKey() };
		const rematerializeIfDayChanged = () => {
			const nextKey = localDateKey();
			if (nextKey === lastDateKeyRef.current) return;
			lastDateKeyRef.current = nextKey;
			notifyTasksUpdated();
		};
		const intervalId = window.setInterval(rematerializeIfDayChanged, 60_000);
		window.addEventListener('focus', rematerializeIfDayChanged);
		return () => {
			window.clearInterval(intervalId);
			window.removeEventListener('focus', rematerializeIfDayChanged);
		};
	}, []);

	React.useEffect(() => {
		if (projects.length === 0 || deepLinkFocusAppliedRef.current) return;

		const applyFocus = (projectId: string, taskId?: string | null) => {
			deepLinkFocusAppliedRef.current = true;

			const idx = projects.findIndex((p) => p.id === projectId);
			if (idx >= 0) setSelectedProjectIdx(idx);
			setInitialProjectSelectionReady(true);

			if (taskId) {
				if (highlightTimeoutRef.current !== null) {
					window.clearTimeout(highlightTimeoutRef.current);
				}
				setHighlightTaskId(taskId);
				highlightTimeoutRef.current = window.setTimeout(() => {
					setHighlightTaskId(null);
					highlightTimeoutRef.current = null;
				}, 4000);
				window.requestAnimationFrame(() => {
					document
						.getElementById(`task-${taskId}`)
						?.scrollIntoView({ behavior: 'smooth', block: 'center' });
				});

				const url = new URL(window.location.href);
				if (url.searchParams.has('task')) {
					url.searchParams.delete('task');
					window.history.replaceState(
						null,
						'',
						`${url.pathname}${url.search}${url.hash}`,
					);
				}
			}
		};

		try {
			const raw = sessionStorage.getItem('krona:projects-focus');
			if (raw) {
				sessionStorage.removeItem('krona:projects-focus');
				const parsed = JSON.parse(raw) as {
					projectId?: string;
					taskId?: string | null;
				};
				if (parsed.projectId) {
					applyFocus(parsed.projectId, parsed.taskId);
					return;
				}
			}
		} catch {
			/* ignore */
		}

		const params = new URLSearchParams(window.location.search);
		const projectId = params.get('project');
		const taskId = params.get('task');
		if (projectId) {
			applyFocus(projectId, taskId);
			return;
		}

		try {
			const lastOpenedId = window.localStorage.getItem(
				LAST_OPENED_PROJECT_ID_KEY,
			);
			if (lastOpenedId) {
				const idx = projects.findIndex((p) => p.id === lastOpenedId);
				if (idx >= 0) {
					applyFocus(lastOpenedId);
					return;
				}
			}
		} catch {
			/* ignore */
		}

		deepLinkFocusAppliedRef.current = true;
		setInitialProjectSelectionReady(true);
	}, [projects]);

	React.useEffect(() => {
		if (!initialProjectSelectionReady) return;
		const projectId = projects[selectedProjectIdx]?.id;
		if (!projectId) return;
		try {
			window.localStorage.setItem(LAST_OPENED_PROJECT_ID_KEY, projectId);
		} catch {
			/* ignore */
		}
	}, [initialProjectSelectionReady, projects, selectedProjectIdx]);

	React.useEffect(
		() => () => {
			if (highlightTimeoutRef.current !== null) {
				window.clearTimeout(highlightTimeoutRef.current);
			}
		},
		[],
	);

	React.useEffect(() => {
		let cancelled = false;
		const loadDailyChallengeTaskIds = async () => {
			try {
				const challenges = await fetchDailyChallenges();
				if (cancelled) return;
				setDailyChallengeTaskIds(getTodayActiveTaskChallengeTaskIds(challenges));
			} catch {
				if (!cancelled) setDailyChallengeTaskIds(new Set());
			}
		};
		void loadDailyChallengeTaskIds();
		const onChallengesUpdated = () => {
			void loadDailyChallengeTaskIds();
		};
		window.addEventListener('krona:challenges-updated', onChallengesUpdated);
		return () => {
			cancelled = true;
			window.removeEventListener(
				'krona:challenges-updated',
				onChallengesUpdated,
			);
		};
	}, []);

	React.useEffect(() => {
		if (selectedProjectIdx >= projects.length) {
			setSelectedProjectIdx(0);
		}
	}, [projects.length, selectedProjectIdx]);

	// Pending = not all tasks done, Done = all tasks done and at least one done
	const pendingProjects = projects.filter(
		(proj) =>
			proj.tasks.pending.length > 0 ||
			(proj.tasks.pending.length === 0 && proj.tasks.done.length === 0),
	);
	const doneProjects = projects.filter(
		(proj) => proj.tasks.pending.length === 0 && proj.tasks.done.length > 0,
	);

	const searchQuery = projectSearch.trim().toLowerCase();

	const projectMatchesSearch = React.useCallback(
		(proj: Project) => {
			if (!searchQuery) return true;
			if (proj.name.toLowerCase().includes(searchQuery)) return true;
			return [...proj.tasks.pending, ...proj.tasks.done].some((task) =>
				task.text.toLowerCase().includes(searchQuery),
			);
		},
		[searchQuery],
	);

	// Filter projects by name or matching task text
	const filteredPendingProjects = pendingProjects.filter(projectMatchesSearch);
	const filteredDoneProjects = doneProjects.filter(projectMatchesSearch);
	const displaySortedPendingProjects = React.useMemo(
		() => sortProjectsForDisplay(filteredPendingProjects, sortBy),
		[filteredPendingProjects, sortBy],
	);
	const displaySortedDoneProjects = React.useMemo(
		() => sortProjectsForDisplay(filteredDoneProjects, sortBy),
		[filteredDoneProjects, sortBy],
	);

	const handleTaskSortChange = React.useCallback((next: DashboardTaskSortKey) => {
		setSortBy(next);
		writeDashboardTaskSort(next);
	}, []);

	const resetAddProjectForm = () => {
		setNewProjectName('');
		setNewProjectDeadline(null);
		setNewProjectReminder(false);
		setProjectFormErrors({});
	};

	const closeAddProjectModal = () => {
		setAddProjectOpen(false);
		resetAddProjectForm();
	};

	// Add new project
	const handleAddProject = () => {
		if (!canManageProjects) return;
		const name = newProjectName.trim();
		if (!name) {
			setProjectFormErrors({ name: 'Project name is required.' });
			return;
		}
		if (
			isUndefinedProjectName(name) &&
			projects.some((project) => project.is_unassigned_folder)
		) {
			setProjectFormErrors({
				name: 'Your default folder already exists under its current name.',
			});
			return;
		}
		const deadline = newProjectDeadline;
		if (isDeadlineInPast(deadline)) {
			showKronaError(DEADLINE_PAST_MESSAGE);
			return;
		}
		const reminder = newProjectReminder;
		setProjectFormErrors({});
		const tempId = `tmp-${Date.now()}`;
		const newProject: Project = {
			id: tempId,
			name,
			is_unassigned_folder: isUndefinedProjectName(name),
			deadline,
			reminder,
			createdAt: new Date(),
			tasks: { pending: [], done: [] },
		};

		setProjects((prev) => [...prev, newProject]);
		setSelectedProjectIdx(projects.length);
		closeAddProjectModal();
		showKronaSuccess('Project created successfully.');
		notifyKronaWin('project_created');

		logEventSync('project_create', {
			name,
			deadline,
			reminder,
		});
		// Persist to local storage
		void (async () => {
			try {
				if (!userId) return;
				const { data } = await localData
					.from('projects')
					.insert([
						{
							user_id: userId,
							name,
							is_unassigned_folder: isUndefinedProjectName(name),
							deadline: deadline ? new Date(deadline) : null,
							reminder,
						},
					])
					.select('id')
					.single();
				if (!data?.id) return;
				setProjects((prev) =>
					prev.map((p) => (p.id === tempId ? { ...p, id: data.id } : p)),
				);
				if (deadline && reminder) {
					try {
						await syncProjectDeadlineReminder(userId, {
							projectId: data.id,
							name,
							deadline,
							reminderEnabled: reminder,
						});
					} catch {
						/* ignore */
					}
				}
				notifyTasksUpdated();
			} catch {}
		})();
	};
	const closeEditProjectModal = () => {
		setEditProjectOpen(false);
		setEditingProjectIdx(null);
		setEditingProjectName('');
		setEditingProjectDeadline(null);
		setEditingProjectReminder(false);
		setEditingProjectAssignedHours(0);
		setEditProjectFormErrors({});
	};

	const handleEditProject = (idx: number) => {
		if (!canManageProjects) return;
		const project = projects[idx];
		setEditingProjectIdx(idx);
		setEditingProjectName(project.name);
		setEditingProjectDeadline(project.deadline);
		setEditingProjectReminder(project.reminder);
		setEditingProjectAssignedHours(
			Number(formatDecimalHours(project.projectTime?.totalHours || 0)),
		);
		setEditProjectFormErrors({});
		setEditProjectOpen(true);
	};

	const saveProjectNameAt = (idx: number, name: string) => {
		const trimmed = name.trim();
		if (!trimmed) return;
		const prev = projects[idx];
		setProjects((list) =>
			list.map((proj, i) => (i === idx ? { ...proj, name: trimmed } : proj)),
		);
		if (prev?.id && userId) {
			void (async () => {
				await localData
					.from('projects')
					.update({ name: trimmed })
					.eq('id', prev.id)
					.eq('user_id', userId);
				try {
					await renameProjectReminder(userId, prev.id!, trimmed);
				} catch {
					/* ignore */
				}
				notifyTasksUpdated();
			})();
		}
	};

	const startHeaderTitleEdit = () => {
		if (!canManageProjects) return;
		const name = projects[selectedProjectIdx]?.name ?? '';
		setHeaderTitleDraft(name);
		setEditingHeaderTitle(true);
	};

	const commitHeaderTitleEdit = () => {
		const trimmed = headerTitleDraft.trim();
		setEditingHeaderTitle(false);
		if (!trimmed || selectedProjectIdx < 0) return;
		if (trimmed !== projects[selectedProjectIdx]?.name) {
			saveProjectNameAt(selectedProjectIdx, trimmed);
		}
	};

	React.useEffect(() => {
		if (!editingHeaderTitle) return;
		const id = window.requestAnimationFrame(() => {
			headerTitleInputRef.current?.focus();
			headerTitleInputRef.current?.select();
		});
		return () => window.cancelAnimationFrame(id);
	}, [editingHeaderTitle]);

	const handleSaveProjectEdit = () => {
		if (editingProjectIdx === null) return;
		if (!editingProjectName.trim()) {
			setEditProjectFormErrors({ name: 'Project name is required.' });
			return;
		}
		setEditProjectFormErrors({});
		const prev = projects[editingProjectIdx];
		setProjects((prev) =>
			prev.map((proj, i) =>
				i === editingProjectIdx
					? {
							...proj,
							name: editingProjectName,
							deadline: editingProjectDeadline,
							reminder: editingProjectReminder,
							projectTime: {
								totalHours: editingProjectAssignedHours,
								trackedHours: proj.projectTime?.trackedHours || 0,
							},
						}
					: proj,
			),
		);
		logEventSync('project_update', {
			index: editingProjectIdx,
			prev: {
				name: prev.name,
				deadline: prev.deadline,
				reminder: prev.reminder,
				assignedHours: prev.projectTime?.totalHours ?? 0,
			},
			next: {
				name: editingProjectName,
				deadline: editingProjectDeadline,
				reminder: editingProjectReminder,
				assignedHours: editingProjectAssignedHours,
			},
		});
		closeEditProjectModal();
		showKronaSuccess('Project updated successfully.');
		if (prev?.id && userId) {
			void (async () => {
				await localData
					.from('projects')
					.update({
						name: editingProjectName,
						deadline: editingProjectDeadline
							? new Date(editingProjectDeadline)
							: null,
						reminder: editingProjectReminder,
						time_assigned_minutes: Math.round(editingProjectAssignedHours * 60),
					})
					.eq('id', prev.id)
					.eq('user_id', userId);
				try {
					await syncProjectDeadlineReminder(userId, {
						projectId: prev.id!,
						name: editingProjectName,
						deadline: editingProjectDeadline,
						reminderEnabled: editingProjectReminder,
					});
				} catch {
					/* ignore */
				}
				notifyTasksUpdated();
			})();
		}
	};

	const openDeleteProjectModal = (idx: number) => {
		if (!canManageProjects) return;
		setProjectPendingDeleteIdx(idx);
		setDeleteProjectModalOpen(true);
	};

	const closeDeleteProjectModal = () => {
		setDeleteProjectModalOpen(false);
		setProjectPendingDeleteIdx(null);
	};

	const handleConfirmDeleteProject = () => {
		if (projectPendingDeleteIdx === null) return;
		const idx = projectPendingDeleteIdx;
		const projectToDelete = projects[idx];
		if (!projectToDelete) {
			closeDeleteProjectModal();
			return;
		}

		const projectTaskIds = [
			...projectToDelete.tasks.pending,
			...projectToDelete.tasks.done,
		]
			.map((task) => task.id)
			.filter((id): id is string => Boolean(id));

		let selectedTaskId: string | null = null;
		let selectedTaskName: string | null = null;
		let wasSelectedForTimer = false;
		try {
			selectedTaskId = window.localStorage.getItem(SELECTED_TASK_ID_KEY);
			selectedTaskName = window.localStorage.getItem(SELECTED_TASK_NAME_KEY);
			if (selectedTaskId) {
				wasSelectedForTimer = new Set(projectTaskIds).has(selectedTaskId);
			}
		} catch {
			/* ignore */
		}

		const snapshot: DeletedProjectUndoSnapshot = {
			userId: userId ?? '',
			idx,
			project: cloneProjectForUndo(projectToDelete),
			previousSelectedProjectIdx: selectedProjectIdx,
			wasSelectedForTimer,
			selectedTaskId: wasSelectedForTimer ? selectedTaskId : null,
			selectedTaskName: wasSelectedForTimer ? selectedTaskName : null,
		};

		closeDeleteProjectModal();

		void stageProjectDeleteSnapshot(snapshot, () => {
			if (projectTaskIds.some((id) => dailyChallengeTaskIds.has(id))) {
				setDailyChallengeTaskIds((prev) => {
					const next = new Set(prev);
					for (const id of projectTaskIds) next.delete(id);
					return next;
				});
			}
			setProjects((prev) => prev.filter((_, i) => i !== idx));
			if (selectedProjectIdx === idx) {
				setSelectedProjectIdx(Math.max(0, idx - 1));
			} else if (selectedProjectIdx > idx) {
				setSelectedProjectIdx(selectedProjectIdx - 1);
			}
			if (wasSelectedForTimer) {
				try {
					persistSelectedTimerTask(null, null);
				} catch {
					/* ignore */
				}
			}
			logEventSync('project_delete', { index: idx, name: projectToDelete.name });
		});
	};

	// Add new task to selected project
	const openAddTaskModal = () => {
		if (!canManageTasks) return;
		setNewTask('');
		setNewTaskTime(0);
		setNewTaskDeadline('');
		setNewTaskRepeatable(false);
		setAddTaskModalOpen(true);
	};

	const closeAddTaskModal = () => setAddTaskModalOpen(false);

	const handleAddTask = (options?: { fromModal?: boolean }) => {
		if (!canManageTasks) return;
		const taskName = newTask.trim();
		if (!taskName) return;
		const currentProject = projects[selectedProjectIdx];
		if (!currentProject) return;

		if (isDeadlineInPast(newTaskDeadline)) {
			showKronaError(DEADLINE_PAST_MESSAGE);
			return;
		}
		const deadlineDay = newTaskDeadline.trim()
			? dayjs(newTaskDeadline.trim(), 'YYYY-MM-DD', true)
			: null;
		const hasDeadline = Boolean(deadlineDay?.isValid());
		const deadlineDate = hasDeadline ? deadlineDay!.endOf('day').toDate() : null;
		const assignedHours = !hasDeadline && newTaskTime > 0 ? newTaskTime : 0;
		const tempTaskId = `tmp-task-${Date.now()}`;

		setProjects((prev) =>
			prev.map((proj, idx) =>
				idx === selectedProjectIdx
					? {
							...proj,
							tasks: {
								...proj.tasks,
								pending: [
									...proj.tasks.pending,
									{
										id: tempTaskId,
										text: taskName,
										createdAt: new Date(),
										time: hasDeadline
											? {
													mode: 'deadline',
													deadline: deadlineDate!,
													trackedHours: 0,
													dailyGoal: 2,
												}
											: assignedHours > 0
												? {
														mode: 'manual',
														manualHours: assignedHours,
														trackedHours: 0,
													}
												: undefined,
									},
								],
							},
						}
					: proj,
			),
		);
		logEventSync('project_task_create', {
			project_index: selectedProjectIdx,
			text: taskName,
			manual_hours: assignedHours > 0 ? assignedHours : null,
			deadline: hasDeadline ? deadlineDay!.format('YYYY-MM-DD') : null,
		});

		const removeOptimisticTask = () => {
			setProjects((prev) =>
				prev.map((proj, idx) =>
					idx !== selectedProjectIdx
						? proj
						: {
								...proj,
								tasks: {
									...proj.tasks,
									pending: proj.tasks.pending.filter(
										(task) => task.id !== tempTaskId,
									),
								},
							},
				),
			);
		};

		void (async () => {
			try {
				if (!userId || !currentProject?.id) {
					removeOptimisticTask();
					return;
				}

				const basePayload = {
					user_id: userId,
					project_id: currentProject.id,
					name: taskName,
					time_assigned_minutes: assignedHours ? Math.round(assignedHours * 60) : 0,
					deadline: deadlineDate ? deadlineDate.toISOString() : null,
					status: 'pending' as const,
					schedule_mode: hasDeadline ? ('deadline' as const) : ('manual' as const),
					daily_goal_minutes: hasDeadline ? 120 : 0,
					repeatable: newTaskRepeatable,
				};

				let { data, error } = await localData
					.from('tasks')
					.insert([
						{
							...basePayload,
							reminder: hasDeadline,
						},
					])
					.select('id')
					.single();

				if (error?.message?.includes('reminder')) {
					({ data, error } = await localData
						.from('tasks')
						.insert([basePayload])
						.select('id')
						.single());
				}

				if (error || !data?.id) {
					console.warn('[projects] task create failed', error?.message);
					removeOptimisticTask();
					return;
				}

				const createdTaskId = data.id as string;
				setProjects((prev) =>
					prev.map((proj, idx) =>
						idx !== selectedProjectIdx
							? proj
							: {
									...proj,
									tasks: {
										...proj.tasks,
										pending: proj.tasks.pending.map((task) =>
											task.id === tempTaskId
												? { ...task, id: createdTaskId }
												: task,
										),
									},
								},
					),
				);

				if (hasDeadline && deadlineDate) {
					try {
						await createReminderForTask(
							userId,
							createdTaskId,
							taskName,
							deadlineDate,
							currentProject.id,
						);
						notifyRemindersUpdated();
					} catch (reminderError) {
						console.warn(
							'[projects] task reminder create failed',
							reminderError,
						);
					}
				}

				showKronaSuccess('Task created successfully.');
			} catch (createError) {
				console.warn('[projects] task create threw', createError);
				removeOptimisticTask();
			}
		})();

		setNewTask('');
		setNewTaskTime(0);
		setNewTaskDeadline('');
		setNewTaskRepeatable(false);
		if (options?.fromModal) {
			closeAddTaskModal();
			return;
		}
		requestAnimationFrame(() => addTaskInputRef.current?.focus());
	};

	const clearAssignedTimeUndoToast = () => {
		setShowAssignedTimeUndoToast(false);
		setAssignedTimeUndo(null);
	};

	const handleAssignedTimeToastClose = (
		_event: React.SyntheticEvent | Event | null,
		reason?: string,
	) => {
		// Blur/click that commits inline edit can fire clickaway on the same gesture.
		if (reason === 'clickaway') return;
		clearAssignedTimeUndoToast();
	};

	const showAssignedTimeUpdatedToast = () => {
		setShowAssignedTimeUndoToast(false);
		window.setTimeout(() => {
			setShowAssignedTimeUndoToast(true);
		}, 0);
	};

	const handleSaveTaskAssignedTime = (
		type: 'pending' | 'done',
		idx: number,
		newHours: number,
	) => {
		const project = projects[selectedProjectIdx];
		const task = project?.tasks[type][idx];
		if (!task) return;

		const previousHours = Number(formatDecimalHours(task.time?.manualHours ?? 0));
		const trackedHours = task.time?.trackedHours ?? 0;
		const normalizedHours = Math.max(0, Number(formatDecimalHours(newHours)));

		if (normalizedHours === previousHours) return;

		setProjects((prev) =>
			prev.map((proj, pIdx) => {
				if (pIdx !== selectedProjectIdx) return proj;
				const tasks = { ...proj.tasks };
				const current = tasks[type][idx];
				tasks[type][idx] = {
					...current,
					time: {
						mode: 'manual',
						manualHours: normalizedHours,
						trackedHours,
					},
				};
				return { ...proj, tasks };
			}),
		);

		if (task.id && userId) {
			void (async () => {
				await localData
					.from('tasks')
					.update({
						time_assigned_minutes: Math.round(normalizedHours * 60),
						schedule_mode: 'manual',
					})
					.eq('id', task.id)
					.eq('user_id', userId);
				notifyTasksUpdated();
			})();
		}

		if (task.id) {
			setAssignedTimeUndo({
				kind: 'task',
				projectIdx: selectedProjectIdx,
				type,
				idx,
				taskId: task.id,
				previousHours,
			});
			showAssignedTimeUpdatedToast();
		}
	};

	const handleRevertAssignedTime = () => {
		if (!assignedTimeUndo) return;

		if (assignedTimeUndo.kind === 'project') {
			const { projectIdx, projectId, previousHours } = assignedTimeUndo;
			setProjects((prev) =>
				prev.map((proj, pIdx) => {
					if (pIdx !== projectIdx || proj.id !== projectId) return proj;
					return {
						...proj,
						projectTime: {
							totalHours: previousHours,
							trackedHours: proj.projectTime?.trackedHours ?? 0,
						},
					};
				}),
			);
			if (userId) {
				void (async () => {
					await localData
						.from('projects')
						.update({
							time_assigned_minutes: Math.round(previousHours * 60),
						})
						.eq('id', projectId)
						.eq('user_id', userId);
					notifyTasksUpdated();
				})();
			}
			clearAssignedTimeUndoToast();
			return;
		}

		const { projectIdx, type, idx, taskId, previousHours } = assignedTimeUndo;

		setProjects((prev) =>
			prev.map((proj, pIdx) => {
				if (pIdx !== projectIdx) return proj;
				const tasks = { ...proj.tasks };
				const current = tasks[type][idx];
				if (!current?.id || current.id !== taskId) return proj;
				const trackedHours = current.time?.trackedHours ?? 0;
				tasks[type][idx] = {
					...current,
					time: {
						mode: 'manual',
						manualHours: previousHours,
						trackedHours,
					},
				};
				return { ...proj, tasks };
			}),
		);

		if (userId) {
			void (async () => {
				await localData
					.from('tasks')
					.update({
						time_assigned_minutes: Math.round(previousHours * 60),
						schedule_mode: 'manual',
					})
					.eq('id', taskId)
					.eq('user_id', userId);
				notifyTasksUpdated();
			})();
		}

		clearAssignedTimeUndoToast();
	};

	const handleSaveProjectAssignedTime = (projectIdx: number, newHours: number) => {
		const project = projects[projectIdx];
		if (!project) return;

		const previousHours = Number(formatDecimalHours(project.projectTime?.totalHours ?? 0));
		const normalizedHours = Math.max(0, Number(formatDecimalHours(newHours)));
		if (normalizedHours === previousHours) return;

		setProjects((prev) =>
			prev.map((proj, pIdx) => {
				if (pIdx !== projectIdx) return proj;
				return {
					...proj,
					projectTime: {
						totalHours: normalizedHours,
						trackedHours: proj.projectTime?.trackedHours ?? 0,
					},
				};
			}),
		);

		if (project.id && userId) {
			void (async () => {
				await localData
					.from('projects')
					.update({
						time_assigned_minutes: Math.round(normalizedHours * 60),
					})
					.eq('id', project.id)
					.eq('user_id', userId);
				notifyTasksUpdated();
			})();
		}

		if (project.id) {
			setAssignedTimeUndo({
				kind: 'project',
				projectIdx,
				projectId: project.id,
				previousHours,
			});
			showAssignedTimeUpdatedToast();
		}
	};

	const closeTaskEditModal = () => {
		setTaskEditModalOpen(false);
		setEditingTask(null);
		setTaskEditName('');
		setTaskFormErrors({});
		setTaskEditRepeatable(false);
		setTaskTimeMode('manual');
		setTaskTimeManualHours(0);
		setTaskTimeDeadline(null);
		setTaskTimeDailyGoal(2);
	};

	const handleOpenTaskEditModal = (type: 'pending' | 'done', idx: number) => {
		if (!canManageTasks) return;
		const task = projects[selectedProjectIdx]?.tasks[type][idx];
		if (!task) return;

		setEditingTask({ type, idx });
		setTaskEditName(task.text);
		setTaskFormErrors({});
		setTaskEditRepeatable(Boolean(task.repeatable));

		if (task.time) {
			setTaskTimeMode(task.time.mode);
			setTaskTimeManualHours(
				Number(formatDecimalHours(task.time.manualHours || 0)),
			);
			setTaskTimeDeadline(task.time.deadline || null);
			setTaskTimeDailyGoal(
				Number(formatDecimalHours(task.time.dailyGoal || 2)),
			);
		} else {
			setTaskTimeMode('manual');
			setTaskTimeManualHours(0);
			setTaskTimeDeadline(null);
			setTaskTimeDailyGoal(2);
		}

		setTaskEditModalOpen(true);
	};

	const handleToggleTaskRepeatable = (
		type: 'pending' | 'done',
		idx: number,
	) => {
		const task = projects[selectedProjectIdx]?.tasks[type][idx];
		if (!task?.id || !userId) return;
		const nextRepeatable = !Boolean(task.repeatable);

		setProjects((prev) =>
			prev.map((proj, pIdx) => {
				if (pIdx !== selectedProjectIdx) return proj;
				return {
					...proj,
					tasks: {
						...proj.tasks,
						[type]: proj.tasks[type].map((t, i) =>
							i === idx ? { ...t, repeatable: nextRepeatable } : t,
						),
					},
				};
			}),
		);

		void (async () => {
			const { error } = await localData
				.from('tasks')
				.update({ repeatable: nextRepeatable })
				.eq('id', task.id!)
				.eq('user_id', userId);
			if (error) {
				console.warn('[projects] toggle repeatable failed', error.message);
				notifyTasksUpdated();
				return;
			}
			showKronaSuccess(
				nextRepeatable
					? 'Task set as repeatable daily.'
					: 'Task is no longer repeatable.',
			);
			notifyTasksUpdated();
		})();
	};

	const handleSaveTaskEdit = () => {
		if (!editingTask) return;

		const name = taskEditName.trim();
		if (!name) {
			setTaskFormErrors({ name: 'Task name is required.' });
			return;
		}

		const task =
			projects[selectedProjectIdx]?.tasks[editingTask.type][editingTask.idx];
		if (!task) return;

		const trackedHours = task.time?.trackedHours ?? 0;
		const nextRepeatable = taskEditRepeatable;
		const timeData: TaskTime = {
			mode: taskTimeMode,
			trackedHours,
			...(taskTimeMode === 'manual'
				? { manualHours: taskTimeManualHours }
				: {
						deadline: taskTimeDeadline ?? undefined,
						dailyGoal: taskTimeDailyGoal,
					}),
		};

		setProjects((prev) =>
			prev.map((proj, pIdx) => {
				if (pIdx !== selectedProjectIdx) return proj;
				const tasks = { ...proj.tasks };
				tasks[editingTask.type][editingTask.idx] = {
					...tasks[editingTask.type][editingTask.idx],
					text: name,
					time: timeData,
					repeatable: nextRepeatable,
				};
				return { ...proj, tasks };
			}),
		);

		closeTaskEditModal();
		showKronaSuccess('Task updated successfully.');

		if (task.id && name !== task.text) {
			syncSelectedTimerTaskName(task.id, name);
		}

		const project = projects[selectedProjectIdx];
		if (task.id && userId) {
			void (async () => {
				const wantsDeadlineReminder =
					taskTimeMode === 'deadline' && taskTimeDeadline != null;
				let taskReminder = false;
				if (wantsDeadlineReminder) {
					const { data: taskRow } = await localData
						.from('tasks')
						.select('reminder')
						.eq('id', task.id)
						.eq('user_id', userId)
						.maybeSingle();
					taskReminder = taskRow?.reminder === false ? false : true;
				}

				await localData
					.from('tasks')
					.update({
						name,
						time_assigned_minutes:
							taskTimeMode === 'manual' ? Math.round(taskTimeManualHours * 60) : 0,
						deadline:
							taskTimeMode === 'deadline' && taskTimeDeadline
								? taskTimeDeadline.toISOString()
								: null,
						schedule_mode: taskTimeMode,
						daily_goal_minutes:
							taskTimeMode === 'deadline' ? Math.round(taskTimeDailyGoal * 60) : 0,
						reminder: taskReminder,
						repeatable: nextRepeatable,
					})
					.eq('id', task.id)
					.eq('user_id', userId);

				if (name !== task.text) {
					try {
						await renameTaskReminder(userId, task.id!, name);
					} catch {
						/* ignore */
					}
				}

				try {
					await syncTaskDeadlineReminder(userId, {
						taskId: task.id!,
						projectId: project?.id ?? null,
						name,
						deadline:
							taskTimeMode === 'deadline' && taskTimeDeadline
								? taskTimeDeadline
								: null,
						scheduleMode: taskTimeMode,
						reminderEnabled: taskReminder,
					});
				} catch {
					/* ignore */
				}
				notifyTasksUpdated();
			})();
		}
	};

	const handleEditTask = (
		type: 'pending' | 'done',
		idx: number,
		text: string,
	) => {
		if (!canManageTasks) return;
		setEditingTaskIdx({ type, idx });
		setEditingTaskText(text);
	};

	const handleCancelTaskEdit = () => {
		setEditingTaskIdx(null);
		setEditingTaskText('');
	};

	const handleSaveTask = (
		type: 'pending' | 'done',
		idx: number,
		text: string,
	) => {
		const nextText = text.trim();
		if (!nextText) {
			handleCancelTaskEdit();
			return;
		}

		const task = projects[selectedProjectIdx]?.tasks[type][idx];
		setProjects((prev) =>
			prev.map((proj, pIdx) => {
				if (pIdx !== selectedProjectIdx) return proj;
				return {
					...proj,
					tasks: {
						...proj.tasks,
						[type]: proj.tasks[type].map((t, i) =>
							i === idx ? { ...t, text: nextText } : t,
						),
					},
				};
			}),
		);
		setEditingTaskIdx(null);
		setEditingTaskText('');
		if (task?.id && userId) {
			syncSelectedTimerTaskName(task.id, nextText);
			void (async () => {
				await localData
					.from('tasks')
					.update({ name: nextText })
					.eq('id', task.id)
					.eq('user_id', userId);
				try {
					await renameTaskReminder(userId, task.id!, nextText);
				} catch {
					/* ignore */
				}
				notifyTasksUpdated();
			})();
		}
	};

	// Delete task
	const restoreTaskInProjectState = React.useCallback((snapshot: DeletedTaskUndoSnapshot) => {
		setProjects((prev) =>
			prev.map((proj, pIdx) => {
				if (pIdx !== snapshot.projectIdx) return proj;
				const list = [...proj.tasks[snapshot.type]];
				const insertAt = Math.min(snapshot.idx, list.length);
				list.splice(insertAt, 0, snapshot.task);
				return {
					...proj,
					tasks: {
						...proj.tasks,
						[snapshot.type]: list,
					},
				};
			}),
		);
	}, []);

	const restoreProjectInState = React.useCallback((snapshot: DeletedProjectUndoSnapshot) => {
		setProjects((prev) => {
			const next = [...prev];
			const insertAt = Math.min(snapshot.idx, next.length);
			next.splice(insertAt, 0, snapshot.project);
			return next;
		});
		setSelectedProjectIdx(snapshot.previousSelectedProjectIdx);
	}, []);

	const {
		open: showDeleteProjectUndoToast,
		stage: stageProjectDeleteSnapshot,
		revert: handleRevertProjectDelete,
		handleClose: handleDeleteProjectToastClose,
	} = useTaskDeleteUndo<DeletedProjectUndoSnapshot>({
		onCommit: async (snapshot) => {
			if (!snapshot.userId || !snapshot.project.id) return;
			await commitProjectDeleteToServer(snapshot.userId, snapshot.project.id);
		},
		onRevert: (snapshot) => {
			restoreProjectInState(snapshot);
			if (snapshot.wasSelectedForTimer && snapshot.selectedTaskId) {
				try {
					persistSelectedTimerTask(
						snapshot.selectedTaskId,
						snapshot.selectedTaskName,
					);
				} catch {
					/* ignore */
				}
			}
			notifyTasksUpdated();
			notifyRemindersUpdated();
		},
	});

	const {
		open: showDeleteTaskUndoToast,
		stage: stageTaskDeleteSnapshot,
		revert: handleRevertTaskDelete,
		handleClose: handleDeleteTaskToastClose,
	} = useTaskDeleteUndo<DeletedTaskUndoSnapshot>({
		onCommit: async (snapshot) => {
			if (!snapshot.task.id) return;
			await commitTaskDeleteToServer(
				{
					userId: snapshot.userId,
					taskId: snapshot.task.id,
					wasPrioritized: snapshot.wasPrioritized,
					wasSelectedForTimer: snapshot.wasSelectedForTimer,
				},
				committedTaskDeleteIdsRef.current,
			);
		},
		onRevert: (snapshot) => {
			if (snapshot.task.id) {
				committedTaskDeleteIdsRef.current.delete(snapshot.task.id);
				notifyTaskDeleteReverted(snapshot.task.id);
			}
			restoreTaskInProjectState(snapshot);
			if (snapshot.wasPrioritized && snapshot.task.id) {
				setTaskPrioritized(snapshot.task.id, true);
			}
			if (snapshot.wasSelectedForTimer && snapshot.task.id) {
				try {
					persistSelectedTimerTask(
						snapshot.task.id,
						snapshot.task.text,
						snapshot.projectId ?? null,
					);
				} catch {
					/* ignore */
				}
			}
			notifyTasksUpdated();
		},
	});

	const performDeleteTask = React.useCallback(
		(type: 'pending' | 'done', task: Task) => {
			const project = projects[selectedProjectIdx];
			if (!task?.id || !userId || !project?.id) return;

			const idx = project.tasks[type].findIndex((item) => item.id === task.id);
			const liveTask = idx >= 0 ? project.tasks[type][idx] : task;

			let wasSelectedForTimer = false;
			try {
				wasSelectedForTimer =
					window.localStorage.getItem(SELECTED_TASK_ID_KEY) === task.id;
			} catch {
				/* ignore */
			}

			const snapshot: DeletedTaskUndoSnapshot = {
				userId,
				projectIdx: selectedProjectIdx,
				projectId: project.id,
				type,
				idx: idx >= 0 ? idx : project.tasks[type].length,
				task: {
					...liveTask,
					time: liveTask.time ? { ...liveTask.time } : liveTask.time,
				},
				wasPrioritized: Boolean(liveTask.prioritized),
				wasSelectedForTimer,
			};

			if (dailyChallengeTaskIds.has(task.id)) {
				setDailyChallengeTaskIds((prev) => {
					const next = new Set(prev);
					next.delete(task.id!);
					return next;
				});
			}

			void stageTaskDeleteSnapshot(snapshot, () => {
				// Remove by id so a stale list index cannot no-op the delete.
				setProjects((prev) => removeTaskFromProjectList(prev, task.id!));
				notifyTaskPendingDelete(task.id!);
			});
		},
		[
			dailyChallengeTaskIds,
			projects,
			selectedProjectIdx,
			stageTaskDeleteSnapshot,
			userId,
		],
	);

	const requestDeleteTask = (type: 'pending' | 'done', idx: number) => {
		const project = projects[selectedProjectIdx];
		const task = project?.tasks[type][idx];
		if (!task?.id || !userId || !project?.id) return;

		if (dailyChallengeTaskIds.has(task.id)) {
			// Defer so the task row menu can close before the confirm modal opens.
			const pending = {
				type,
				task: { ...task, time: task.time ? { ...task.time } : task.time },
				taskName: task.text,
			};
			window.requestAnimationFrame(() => {
				setChallengeTaskDelete(pending);
			});
			return;
		}

		performDeleteTask(type, task);
	};

	const confirmChallengeTaskDelete = React.useCallback(() => {
		const pending = challengeTaskDeleteRef.current;
		if (!pending?.task.id) return;
		setChallengeTaskDelete(null);
		performDeleteTask(pending.type, pending.task);
	}, [performDeleteTask]);

	// Mark task as done
	const handleCompleteTask = (taskIdx: number) => {
		const task = projects[selectedProjectIdx]?.tasks.pending[taskIdx];
		setProjects((prev) =>
			prev.map((proj, idx) => {
				if (idx !== selectedProjectIdx) return proj;
				const task = proj.tasks.pending[taskIdx];
				const newPending = proj.tasks.pending.filter((_, i) => i !== taskIdx);
				const newDone = [
					{ ...task, completedAt: task.completedAt ?? new Date() },
					...proj.tasks.done,
				];
				return {
					...proj,
					tasks: {
						pending: newPending,
						done: newDone,
					},
				};
			}),
		);
		if (task?.id && userId) {
			void (async () => {
				const result = await persistTaskCompletion({
					taskId: task.id!,
					completed: true,
					userId,
				});
				if (!result.ok) {
					showKronaError('Could not mark this task as done.');
					notifyTasksUpdated();
					return;
				}
				notifyTaskStatusChanged(task.id!, 'done');
				notifyTasksUpdated();
				notifyChallengesSyncNow();
			})();
		}
	};

	// Toggle task priority (pending tasks pin to top)
	const handleToggleTaskPriority = (taskIdx: number) => {
		const task = projects[selectedProjectIdx]?.tasks.pending[taskIdx];
		if (!task) return;
		const currentlyPrioritized = isTaskPrioritized(task.id, task.prioritized);
		const nextPrioritized = !currentlyPrioritized;

		if (task.id) {
			setTaskPrioritized(task.id, nextPrioritized);
		}

		setProjects((prev) =>
			prev.map((proj, idx) => {
				if (idx !== selectedProjectIdx) return proj;
				const pending = proj.tasks.pending.map((item, i) =>
					i === taskIdx ? { ...item, prioritized: nextPrioritized } : item,
				);
				return {
					...proj,
					tasks: {
						...proj.tasks,
						pending: sortPendingTasks(pending),
					},
				};
			}),
		);

		if (task.id && userId) {
			void (async () => {
				const { error } = await localData
					.from('tasks')
					.update({ prioritized: nextPrioritized })
					.eq('id', task.id)
					.eq('user_id', userId);
				if (error) {
					// Local storage + UI state remain source of truth until migration is applied.
					return;
				}
			})();
		}
	};

	const handleSelectTaskForTimer = (task: Task) => {
		if (!task.id || !task.text.trim()) return;
		const isActive = selectedTimerTaskId === task.id;
		const projectId = projects[selectedProjectIdx]?.id ?? null;
		persistSelectedTimerTask(
			isActive ? null : task.id,
			isActive ? null : task.text.trim(),
			isActive ? null : projectId,
		);
	};

	const handleAddTaskToDailyChallenges = React.useCallback(async (task: Task) => {
		if (!task.id) {
			showKronaError('Save this task first, then add it to daily challenges.');
			return;
		}
		const result = await addTaskToTodayDailyChallenges(task.id);
		if (!result.ok) {
			showKronaError(result.error);
			return;
		}
		setDailyChallengeTaskIds((prev) => new Set(prev).add(task.id!));
		if (result.alreadyPresent) {
			showKronaSuccess('Already in today’s daily challenges.');
			return;
		}

		// Match ChallengesApp default: tasks added to daily challenges are prioritized/highlighted.
		if (!isTaskPrioritized(task.id, task.prioritized)) {
			setTaskPrioritized(task.id, true);
			setProjects((prev) =>
				prev.map((proj) => ({
					...proj,
					tasks: {
						...proj.tasks,
						pending: sortPendingTasks(
							proj.tasks.pending.map((item) =>
								item.id === task.id ? { ...item, prioritized: true } : item,
							),
						),
						done: proj.tasks.done.map((item) =>
							item.id === task.id ? { ...item, prioritized: true } : item,
						),
					},
				})),
			);
			if (userId) {
				void (async () => {
					const { error } = await localData
						.from('tasks')
						.update({ prioritized: true })
						.eq('id', task.id)
						.eq('user_id', userId);
					if (error) {
						console.warn('[projects] prioritize challenge task failed', error.message);
					}
					notifyTasksUpdated();
				})();
			} else {
				notifyTasksUpdated();
			}
		}

		showKronaSuccess(
			result.created
				? 'Added to a new daily challenge.'
				: 'Added to today’s daily challenges.',
		);
	}, [userId]);

	const handleRemoveTaskFromDailyChallenges = React.useCallback(
		async (task: Task) => {
			if (!task.id) {
				showKronaError('Save this task first, then manage daily challenges.');
				return;
			}
			const ok = await removeTaskFromTodayDailyChallenges(task.id);
			if (!ok) {
				showKronaError('Could not remove this task from daily challenges.');
				return;
			}
			setDailyChallengeTaskIds((prev) => {
				const next = new Set(prev);
				next.delete(task.id!);
				return next;
			});
			showKronaSuccess('Removed from today’s daily challenges.');
		},
		[],
	);

	// Mark task as undone
	const handleUncompleteTask = (taskIdx: number) => {
		const task = projects[selectedProjectIdx]?.tasks.done[taskIdx];
		setProjects((prev) =>
			prev.map((proj, idx) => {
				if (idx !== selectedProjectIdx) return proj;
				const task = proj.tasks.done[taskIdx];
				const newDone = proj.tasks.done.filter((_, i) => i !== taskIdx);
				const newPending = sortPendingTasks([
					...proj.tasks.pending,
					{ ...task, completedAt: undefined },
				]);
				return {
					...proj,
					tasks: {
						pending: newPending,
						done: newDone,
					},
				};
			}),
		);
		if (task?.id && userId) {
			void (async () => {
				const result = await persistTaskCompletion({
					taskId: task.id!,
					completed: false,
					userId,
				});
				if (!result.ok) {
					showKronaError('Could not mark this task as incomplete.');
					notifyTasksUpdated();
					return;
				}
				notifyTaskStatusChanged(task.id!, 'pending');
				notifyTasksUpdated();
				notifyChallengesSyncNow();
			})();
		}
	};

	// Calculate total tracked hours from all tasks
	const getTotalTrackedHours = (project: Project) => {
		const pendingTotal = project.tasks.pending.reduce(
			(sum, task) => sum + (task.time?.trackedHours || 0),
			0,
		);
		const doneTotal = project.tasks.done.reduce(
			(sum, task) => sum + (task.time?.trackedHours || 0),
			0,
		);
		return Number(formatDecimalHours(pendingTotal + doneTotal));
	};

	// Format days left
	const [nowMs, setNowMs] = React.useState(() => Date.now());
	React.useEffect(() => {
		setNowMs(Date.now());
	}, []);

	const getDaysLeft = (deadline: Date | null) => {
		if (!deadline) return null;
		const startOfToday = new Date(nowMs);
		startOfToday.setHours(0, 0, 0, 0);
		const startOfDue = new Date(deadline);
		startOfDue.setHours(0, 0, 0, 0);
		return Math.round(
			(startOfDue.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24),
		);
	};

	// Format task time display
	const formatTaskTime = (task: Task): string | null => {
		if (!task.time) return null;

		const {
			mode,
			manualHours,
			deadline,
			trackedHours = 0,
			dailyGoal,
		} = task.time;

		if (mode === 'manual') {
			return `${formatDecimalHoursLabel(trackedHours)} / ${formatDecimalHoursLabel(manualHours ?? 0)}`;
		} else if (mode === 'deadline' && deadline) {
			const daysLeft = Math.ceil(
				(deadline.getTime() - nowMs) / (1000 * 60 * 60 * 24),
			);
			const totalNeeded = Math.max(0, daysLeft) * (dailyGoal || 2);
			return `${formatDecimalHoursLabel(trackedHours)} / ${formatDecimalHoursLabel(totalNeeded)}`;
		}

		return null;
	};

	const formatTaskDaysLeft = (task: Task): string | null => {
		if (!task.time || task.time.mode !== 'deadline' || !task.time.deadline) {
			return null;
		}
		const daysLeft = Math.ceil(
			(task.time.deadline.getTime() - nowMs) / (1000 * 60 * 60 * 24),
		);
		if (daysLeft < 0) {
			const daysOverdue = Math.abs(daysLeft);
			return `${daysOverdue} ${daysOverdue === 1 ? 'day' : 'days'} overdue`;
		}
		if (daysLeft === 0) return 'Due today';
		return `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left`;
	};

	const selectedProject = projects[selectedProjectIdx];
	const matchesTaskSearch = React.useCallback(
		(task: Task) => {
			if (!searchQuery) return true;
			if (selectedProject?.name.toLowerCase().includes(searchQuery)) return true;
			return task.text.toLowerCase().includes(searchQuery);
		},
		[searchQuery, selectedProject?.name],
	);
	const filteredPendingTasks =
		selectedProject?.tasks.pending.filter(
			(task) =>
				matchesTaskSearch(task) &&
				taskMatchesListFilters(
					{
						repeatable: task.repeatable,
						prioritized: isTaskPrioritized(task.id, task.prioritized),
					},
					taskListFilters,
				),
		) ?? [];
	const filteredDoneTasks =
		selectedProject?.tasks.done.filter(
			(task) =>
				matchesTaskSearch(task) &&
				taskMatchesListFilters(
					{
						repeatable: task.repeatable,
						prioritized: isTaskPrioritized(task.id, task.prioritized),
					},
					taskListFilters,
				),
		) ?? [];
	const displaySortedPendingTasks = React.useMemo(
		() => sortPendingTasksForDisplay(filteredPendingTasks, sortBy),
		[filteredPendingTasks, sortBy],
	);
	const displaySortedDoneTasks = React.useMemo(
		() => sortDoneTasksForDisplay(filteredDoneTasks, sortBy),
		[filteredDoneTasks, sortBy],
	);
	const taskFiltersActive =
		Boolean(searchQuery) ||
		taskListFilters.repeatableOnly ||
		taskListFilters.favoritesOnly;
	const selectedProjectHasTasks = Boolean(
		selectedProject &&
			(selectedProject.tasks.pending.length > 0 ||
				selectedProject.tasks.done.length > 0),
	);
	const noFilteredTasks =
		displaySortedPendingTasks.length === 0 &&
		displaySortedDoneTasks.length === 0;
	const filterEmptyMessage = searchQuery
		? taskListFilters.repeatableOnly || taskListFilters.favoritesOnly
			? 'No tasks match your search or filter.'
			: 'No tasks match your search.'
		: 'No tasks match this filter.';

	const findPendingTaskIndex = React.useCallback(
		(task: Task) => {
			if (!selectedProject) return -1;
			if (task.id) {
				return selectedProject.tasks.pending.findIndex((item) => item.id === task.id);
			}
			return selectedProject.tasks.pending.indexOf(task);
		},
		[selectedProject],
	);

	const findDoneTaskIndex = React.useCallback(
		(task: Task) => {
			if (!selectedProject) return -1;
			if (task.id) {
				return selectedProject.tasks.done.findIndex((item) => item.id === task.id);
			}
			return selectedProject.tasks.done.indexOf(task);
		},
		[selectedProject],
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
				}}
			>
				<Background />
				<Box
					className="krona-main-content"
					sx={{
						minHeight: 0,
						flex: 1,
						display: 'flex',
						flexDirection: 'column',
						position: 'relative',
						zIndex: 1,
						minWidth: 0,
					}}
				>
					<Top
						title="My projects"
						onBack={() => {
							if (mobileDetails) setMobileDetails(false);
							else router.push('/');
						}}
						backAriaLabel={
							mobileDetails ? 'Back to projects list' : 'Back to dashboard'
						}
					/>

					<KronaResizableSplitLayout
						resizeAtSidebarEdge
						dividerAriaLabel="Resize projects and tasks panels"
						containerSx={{ overflow: 'hidden' }}
						sidebarDisplay={{ xs: mobileDetails ? 'none' : 'flex', md: 'flex' }}
						detailDisplay={{
							xs:
								!projectsLoading && projects.length > 0 && mobileDetails
									? 'flex'
									: 'none',
							md: projectsLoading || projects.length > 0 ? 'flex' : 'none',
						}}
						sidebarSx={{
							...kronaSideListPanelSx,
							gap: 0,
							position: 'relative',
						}}
						detailSx={{
							flex: '1 1 0',
							gap: 2,
							pr: { xs: 0, md: 0 },
							pt: { xs: 2, md: 0 },
							pb: { xs: 2, md: 0 },
						}}
						sidebar={
							<>
								{projectsLoading ? (
									<ProjectsListSkeleton />
								) : projects.length === 0 ? (
									<Box
										sx={{
											flex: 1,
											minHeight: 360,
											display: 'flex',
											alignItems: 'center',
											justifyContent: 'center',
											textAlign: 'center',
											px: 2,
										}}
									>
										<Box sx={{ maxWidth: 440 }}>
											<Typography
												level="h2"
												sx={{ color: 'var(--krona-text)', mb: 1 }}
											>
												No Projects Yet
											</Typography>
											<Typography
												level="body-lg"
												sx={{ color: 'var(--krona-text-72)', mb: 3 }}
											>
												{canManageProjects
													? 'Create your first project to organize tasks and start tracking progress.'
													: 'No projects are available yet.'}
											</Typography>
											{canManageProjects ? (
												<Button
												variant="solid"
												startDecorator={<Plus size={18} />}
												onClick={() => setAddProjectOpen(true)}
												sx={{
													borderRadius: '999px',
													px: 3,
													background: 'var(--krona-accent-gradient)',
													color: '#fff',
													'&:hover': {
														background: 'var(--krona-accent-gradient-hover)',
													},
												}}
											>
												Create Project
											</Button>
											) : null}
										</Box>
									</Box>
								) : (
									<>
								<KronaSearchCreateToolbar
									searchPlaceholder={kronaPlaceholders.search.projects}
									searchValue={projectSearch}
									onSearchChange={setProjectSearch}
									beforeCreateSlot={
										<TaskSortToggleButton
											sortBy={sortBy}
											onSortChange={handleTaskSortChange}
											filters={taskListFilters}
											onFiltersChange={setTaskListFilters}
										/>
									}
									createLabel="Create project"
									createIconOnly
									onCreate={
										canManageProjects
											? () => setAddProjectOpen(true)
											: undefined
									}
									sx={{ mb: '20px' }}
								/>
							<Box sx={kronaSideListPanelBodySx}>

							<Box
								sx={{
									display: 'flex',
									flexDirection: 'column',
									gap: 1.5,
								}}
							>
								{displaySortedPendingProjects.map((project, idx) => {
									const realIdx = projects.findIndex((proj) =>
										project.id ? proj.id === project.id : proj.name === project.name,
									);
									const trackedHours = getTotalTrackedHours(project);
									const daysLeft = getDaysLeft(project.deadline);

									return (
										<Box
											key={project.name + idx}
											sx={kronaSideListCardSx(realIdx === selectedProjectIdx)}
											onClick={() => {
												setSelectedProjectIdx(realIdx);
												setMobileDetails(true);
											}}
										>
											<Box
												sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}
											>
												<Folder size={20} color="var(--krona-text)" />
												<Typography
													level="body-md"
													sx={{
														flex: 1,
														color: 'var(--krona-text)',
																fontSize: '14px',
														overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0,
														fontWeight: 600,
														fontFamily: 'Poppins, sans-serif',
													}}
												>
													{project.name}
												</Typography>
												{canManageProjects ? (
												<Dropdown>
													<MenuButton
														slots={{ root: KronaMoreMenuButton }}
														slotProps={{
															root: {
																onClick: (e: React.MouseEvent) => e.stopPropagation(),
															},
														}}
													/>
													<Menu placement="bottom-end" sx={kronaMenuSx}>
														<MenuItem
															onClick={(e) => {
																e.stopPropagation();
																handleEditProject(realIdx);
															}}
														>
															<Edit size={16} style={{ marginRight: 8 }} />
															Edit
														</MenuItem>
														<MenuItem
															onClick={(e) => {
																e.stopPropagation();
																openDeleteProjectModal(realIdx);
															}}
															{...kronaDeleteMenuItemProps}
														>
															<Trash2 size={16} style={{ marginRight: 8 }} />
															Delete
														</MenuItem>
													</Menu>
												</Dropdown>
												) : null}
											</Box>
											{project.projectTime && (
												<Box
													sx={{
														display: 'flex',
														alignItems: 'center',
														gap: 1.5,
														ml: 4,
													}}
												>
													<Typography
														level="body-sm"
														sx={{
															color: 'var(--krona-text-64)',
															fontSize: 13,
														}}
													>
														{formatDecimalHoursLabel(trackedHours)} /{' '}
														{formatDecimalHoursLabel(project.projectTime.totalHours)}
													</Typography>
													{daysLeft !== null && (
														<Typography
															level="body-sm"
															sx={{
																color:
																	daysLeft <= 3
																		? '#f87171'
																		: 'var(--krona-text-64)',
																fontSize: 13,
															}}
														>
															• {daysLeft}d left
														</Typography>
													)}
												</Box>
											)}
										</Box>
									);
								})}
							</Box>

							{/* Done Projects */}
							{filteredDoneProjects.length > 0 && (
													<Box sx={{ mt: '10px' }}>
									<KronaListDivider label="Done" />
									<Box
										sx={{
											display: 'flex',
											flexDirection: 'column',
											gap: 1.5,
											mt: '20px',
										}}
									>
										{displaySortedDoneProjects.map((project, idx) => {
											const realIdx = projects.findIndex((proj) =>
												project.id ? proj.id === project.id : proj.name === project.name,
											);
											const trackedHours = getTotalTrackedHours(project);

											return (
												<Box
													key={project.name + idx}
													sx={kronaSideListCardSx(realIdx === selectedProjectIdx)}
													onClick={() => {
														setSelectedProjectIdx(realIdx);
														setMobileDetails(true);
													}}
												>
													<Box
														sx={{
															display: 'flex',
															alignItems: 'center',
															gap: 1.5,
														}}
													>
														<Folder size={20} color="var(--krona-text)" />
														<Typography
															level="body-md"
															sx={{
																flex: 1,
																color: 'var(--krona-text)',
																fontSize: '14px',
														overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0,
																fontWeight: 600,
																fontFamily: 'Poppins, sans-serif',
															}}
														>
															{project.name}
														</Typography>
														{canManageProjects ? (
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
															<Menu placement="bottom-end" sx={kronaMenuSx}>
																<MenuItem
																	onClick={(e) => {
																		e.stopPropagation();
																		handleEditProject(realIdx);
																	}}
																>
																	<Edit size={16} style={{ marginRight: 8 }} />
																	Edit
																</MenuItem>
																<MenuItem
																	onClick={(e) => {
																		e.stopPropagation();
																		openDeleteProjectModal(realIdx);
																	}}
																	{...kronaDeleteMenuItemProps}
																>
																	<Trash2
																		size={16}
																		style={{ marginRight: 8 }}
																	/>
																	Delete
																</MenuItem>
															</Menu>
														</Dropdown>
														) : null}
													</Box>
													{project.projectTime && (
														<Box
															sx={{
																display: 'flex',
																alignItems: 'center',
																ml: 4,
															}}
														>
															<Typography
																level="body-sm"
																sx={{
																	color: 'var(--krona-text-64)',
																	fontSize: 13,
																}}
															>
																{formatDecimalHoursLabel(trackedHours)} /{' '}
																{formatDecimalHoursLabel(
																	project.projectTime.totalHours,
																)}
															</Typography>
														</Box>
													)}
												</Box>
											);
										})}
									</Box>
								</Box>
							)}

									</Box>
									</>
								)}

								{/* Modal for adding new project */}
								<Modal
									open={addProjectOpen && canManageProjects}
									onClose={closeAddProjectModal}
								>
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
											onClick={closeAddProjectModal}
											sx={kronaModalCloseButtonSx}
										>
											<X size={18} />
										</IconButton>
										<Typography
											level="h4"
											sx={{ mb: 1.5, pr: 4, color: 'var(--krona-text)' }}
										>
											New project
										</Typography>
										<FormControl
											sx={{ mb: 1.25 }}
											error={Boolean(projectFormErrors.name)}
										>
											<FormLabel sx={{ color: 'var(--krona-text)' }}>
												Project name
											</FormLabel>
											<Input
												placeholder={kronaPlaceholders.projects.name}
												value={newProjectName}
												onChange={(e) => {
													setNewProjectName(e.target.value);
													if (projectFormErrors.name) {
														setProjectFormErrors({});
													}
												}}
												onKeyDown={(e) => {
													if (e.key === 'Enter') handleAddProject();
												}}
												autoFocus
												sx={kronaInputSx}
											/>
											{projectFormErrors.name ? (
												<FormHelperText>{projectFormErrors.name}</FormHelperText>
											) : null}
										</FormControl>
										<FormControl sx={{ mb: 1.25 }}>
											<FormLabel sx={{ color: 'var(--krona-text)' }}>
												Deadline
											</FormLabel>
											<KronaDatePickerButton
												width="100%"
												placeholder={kronaPlaceholders.projects.deadline}
												disablePast
												value={
													newProjectDeadline
														? dayjs(newProjectDeadline).format('YYYY-MM-DD')
														: ''
												}
												onChange={(value) => {
													setNewProjectDeadline(
														value ? new Date(value) : null,
													);
													if (!value) {
														setNewProjectReminder(false);
													}
												}}
											/>
										</FormControl>
										<Box
											sx={{
												display: 'flex',
												alignItems: 'center',
												gap: 1,
												mb: 1.25,
											}}
										>
											<Checkbox
												checked={newProjectReminder}
												disabled={!newProjectDeadline}
												onChange={(e) =>
													setNewProjectReminder(e.target.checked)
												}
												sx={{ color: 'var(--krona-text)' }}
											/>
											<Typography
												level="body-sm"
												sx={{ color: 'var(--krona-text)' }}
											>
												Add to reminders
											</Typography>
										</Box>
										<Button
											type="button"
											fullWidth
											onClick={handleAddProject}
											sx={kronaPrimaryButtonSx}
										>
											Create project
										</Button>
									</ModalDialog>
								</Modal>

							{/* Modal for editing project */}
							<Modal
								open={editProjectOpen && canManageProjects}
								onClose={closeEditProjectModal}
							>
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
										onClick={closeEditProjectModal}
										sx={kronaModalCloseButtonSx}
									>
										<X size={18} />
									</IconButton>
									<Typography
										level="h4"
										sx={{ mb: 1.5, pr: 4, color: 'var(--krona-text)' }}
									>
										Edit project
									</Typography>
									<FormControl
										sx={{ mb: 1.25 }}
										error={Boolean(editProjectFormErrors.name)}
									>
										<FormLabel sx={{ color: 'var(--krona-text)' }}>
											Project name
										</FormLabel>
										<Input
											placeholder={kronaPlaceholders.projects.name}
											value={editingProjectName}
											onChange={(e) => {
												setEditingProjectName(e.target.value);
												if (editProjectFormErrors.name) {
													setEditProjectFormErrors({});
												}
											}}
											onKeyDown={(e) => {
												if (e.key === 'Enter') handleSaveProjectEdit();
											}}
											autoFocus
											sx={kronaInputSx}
										/>
										{editProjectFormErrors.name ? (
											<FormHelperText>{editProjectFormErrors.name}</FormHelperText>
										) : null}
									</FormControl>
									<FormControl sx={{ mb: 1.25 }}>
										<FormLabel sx={{ color: 'var(--krona-text)' }}>
											Time assigned (hours)
										</FormLabel>
										<Input
											type="number"
											placeholder={kronaPlaceholders.projects.totalHours}
											value={editingProjectAssignedHours}
											onChange={(e) =>
												setEditingProjectAssignedHours(Number(e.target.value) || 0)
											}
											slotProps={{ input: { min: 0, step: 0.5 } }}
											sx={kronaInputSx}
										/>
									</FormControl>
									<FormControl sx={{ mb: 1.25 }}>
										<FormLabel sx={{ color: 'var(--krona-text)' }}>
											Deadline
										</FormLabel>
										<KronaDatePickerButton
											width="100%"
											placeholder={kronaPlaceholders.projects.deadline}
											disablePast
											value={
												editingProjectDeadline
													? dayjs(editingProjectDeadline).format('YYYY-MM-DD')
													: ''
											}
											onChange={(value) => {
												setEditingProjectDeadline(
													value ? new Date(value) : null,
												);
												if (!value) {
													setEditingProjectReminder(false);
												}
											}}
										/>
									</FormControl>
									<Box
										sx={{
											display: 'flex',
											alignItems: 'center',
											gap: 1,
											mb: 1.25,
										}}
									>
										<Checkbox
											checked={editingProjectReminder}
											disabled={!editingProjectDeadline}
											onChange={(e) =>
												setEditingProjectReminder(e.target.checked)
											}
											sx={{ color: 'var(--krona-text)' }}
										/>
										<Typography
											level="body-sm"
											sx={{ color: 'var(--krona-text)' }}
										>
											Add to reminders
										</Typography>
									</Box>
									<Button
										fullWidth
										onClick={handleSaveProjectEdit}
										sx={kronaPrimaryButtonSx}
									>
										Save changes
									</Button>
								</ModalDialog>
							</Modal>

							{/* Task edit modal */}
							<Modal
								open={taskEditModalOpen && canManageTasks}
								onClose={closeTaskEditModal}
							>
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
										onClick={closeTaskEditModal}
										sx={kronaModalCloseButtonSx}
									>
										<X size={18} />
									</IconButton>
									<Typography
										level="h4"
										sx={{ mb: 1.5, pr: 4, color: 'var(--krona-text)' }}
									>
										Edit task
									</Typography>
									<Box
										component="form"
										onSubmit={(e) => {
											e.preventDefault();
											handleSaveTaskEdit();
										}}
									>
									<FormControl
										sx={{ mb: 1.25 }}
										error={Boolean(taskFormErrors.name)}
									>
										<FormLabel sx={{ color: 'var(--krona-text)' }}>
											Task name
										</FormLabel>
										<Input
											placeholder={kronaPlaceholders.projects.editTask}
											value={taskEditName}
											onChange={(e) => {
												setTaskEditName(e.target.value);
												if (taskFormErrors.name) {
													setTaskFormErrors({});
												}
											}}
											autoFocus
											sx={kronaInputSx}
										/>
										{taskFormErrors.name ? (
											<FormHelperText>{taskFormErrors.name}</FormHelperText>
										) : null}
									</FormControl>
									<FormControl sx={{ mb: 1.25 }}>
										<FormLabel sx={{ color: 'var(--krona-text)' }}>
											Time tracking mode
										</FormLabel>
										<RadioGroup
											value={taskTimeMode}
											onChange={(e) =>
												setTaskTimeMode(e.target.value as 'manual' | 'deadline')
											}
											sx={{ gap: 0.75 }}
										>
											<Radio
												value="manual"
												label="Manual (set total hours)"
												sx={{
													color: 'var(--krona-text)',
													'& .MuiRadio-label': { color: 'var(--krona-text)' },
												}}
											/>
											<Radio
												value="deadline"
												label="Deadline-based (track daily progress)"
												sx={{
													color: 'var(--krona-text)',
													'& .MuiRadio-label': { color: 'var(--krona-text)' },
												}}
											/>
										</RadioGroup>
									</FormControl>
									{taskTimeMode === 'manual' ? (
										<FormControl sx={{ mb: 1.25 }}>
											<FormLabel sx={{ color: 'var(--krona-text)' }}>
												Time assigned (hours)
											</FormLabel>
											<Input
												type="number"
												placeholder={kronaPlaceholders.projects.totalHours}
												value={taskTimeManualHours}
												onChange={(e) =>
													setTaskTimeManualHours(Number(e.target.value) || 0)
												}
												slotProps={{ input: { min: 0, step: 0.5 } }}
												sx={kronaInputSx}
											/>
										</FormControl>
									) : (
										<>
											<FormControl sx={{ mb: 1.25 }}>
												<FormLabel sx={{ color: 'var(--krona-text)' }}>
													Deadline
												</FormLabel>
												<KronaDatePickerButton
													width="100%"
													placeholder={kronaPlaceholders.projects.deadline}
													disablePast
													value={
														taskTimeDeadline
															? dayjs(taskTimeDeadline).format('YYYY-MM-DD')
															: ''
													}
													onChange={(value) =>
														setTaskTimeDeadline(
															value ? new Date(value) : null,
														)
													}
												/>
											</FormControl>
											<FormControl sx={{ mb: 1.25 }}>
												<FormLabel sx={{ color: 'var(--krona-text)' }}>
													Daily goal (hours per day)
												</FormLabel>
												<Input
													type="number"
													placeholder={kronaPlaceholders.projects.dailyGoal}
													value={taskTimeDailyGoal}
													onChange={(e) =>
														setTaskTimeDailyGoal(Number(e.target.value) || 0)
													}
													slotProps={{ input: { min: 0.5, step: 0.5 } }}
													sx={kronaInputSx}
												/>
											</FormControl>
										</>
									)}
									<Box
										sx={{
											display: 'flex',
											alignItems: 'center',
											justifyContent: 'space-between',
											gap: 1,
											mb: 1.25,
										}}
									>
										<Box>
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
										<RepeatableTaskToggleButton
											active={taskEditRepeatable}
											onToggle={() =>
												setTaskEditRepeatable((prev) => !prev)
											}
										/>
									</Box>
									<Button
										type="submit"
										fullWidth
										sx={kronaPrimaryButtonSx}
									>
										Save changes
									</Button>
									</Box>
								</ModalDialog>
							</Modal>

							{/* Add task modal (mobile) */}
							<Modal
								open={addTaskModalOpen && canManageTasks}
								onClose={closeAddTaskModal}
							>
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
										onClick={closeAddTaskModal}
										sx={kronaModalCloseButtonSx}
									>
										<X size={18} />
									</IconButton>
									<Typography level="h4" sx={kronaModalTitleSx}>
										Add task
									</Typography>
									<Box
										component="form"
										onSubmit={(e) => {
											e.preventDefault();
											handleAddTask({ fromModal: true });
										}}
										sx={kronaModalFormSx}
									>
										<Box sx={kronaModalFieldsSx}>
										<FormControl>
											<FormLabel sx={{ color: 'var(--krona-text)' }}>
												Task name
											</FormLabel>
											<Input
												placeholder={kronaPlaceholders.projects.taskName}
												value={newTask}
												onChange={(e) => setNewTask(e.target.value)}
												autoFocus
												sx={kronaInputSx}
											/>
										</FormControl>
										<FormControl>
											<FormLabel sx={{ color: 'var(--krona-text)' }}>
												Hours
											</FormLabel>
											<Input
												placeholder={kronaPlaceholders.projects.hours}
												type="number"
												startDecorator={
													<Clock
														size={16}
														color="var(--krona-text-muted)"
														aria-hidden
													/>
												}
												value={newTaskTime || ''}
												onChange={(e) =>
													setNewTaskTime(Number(e.target.value) || 0)
												}
												slotProps={{
													input: {
														min: 0,
														step: 0.5,
													},
												}}
												sx={kronaInputSx}
											/>
										</FormControl>
										<FormControl>
											<FormLabel sx={{ color: 'var(--krona-text)' }}>
												Deadline
											</FormLabel>
											<KronaDatePickerButton
												value={newTaskDeadline}
												onChange={setNewTaskDeadline}
												placeholder={kronaPlaceholders.projects.deadlineToolbar}
												width="100%"
												disablePast
											/>
										</FormControl>
										<Box
											sx={{
												display: 'flex',
												alignItems: 'center',
												justifyContent: 'space-between',
												gap: 1,
											}}
										>
											<Box>
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
											<RepeatableTaskToggleButton
												active={newTaskRepeatable}
												onToggle={() =>
													setNewTaskRepeatable((prev) => !prev)
												}
											/>
										</Box>
										</Box>
										<Button
											type="submit"
											fullWidth
											sx={{ ...kronaPrimaryButtonSx, ...kronaModalPrimaryActionSx }}
										>
											Add task
										</Button>
									</Box>
								</ModalDialog>
							</Modal>

							{/* Delete project confirmation */}
							<Modal
								open={deleteProjectModalOpen}
								onClose={closeDeleteProjectModal}
							>
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
										onClick={closeDeleteProjectModal}
										sx={kronaModalCloseButtonSx}
									>
										<X size={18} />
									</IconButton>
									<Typography
										level="h4"
										sx={{ mb: 1, pr: 4, color: 'var(--krona-text)' }}
									>
										Delete project?
									</Typography>
									{(() => {
										const project =
											projectPendingDeleteIdx !== null
												? projects[projectPendingDeleteIdx]
												: null;
										const challengeTasks = project
											? [
													...project.tasks.pending,
													...project.tasks.done,
												].filter(
													(task) =>
														Boolean(task.id) &&
														dailyChallengeTaskIds.has(task.id!),
												)
											: [];
										const challengeCount = challengeTasks.length;
										const challengeNames = challengeTasks
											.map((task) => task.text.trim())
											.filter(Boolean)
											.slice(0, 3);

										return (
											<>
												<Typography
													level="body-md"
													sx={{
														mb: challengeCount > 0 ? 1.25 : 2,
														color: 'var(--krona-text-muted)',
														lineHeight: 1.5,
													}}
												>
													{project ? (
														<>
															<strong
																style={{ color: 'var(--krona-text)' }}
															>
																{project.name}
															</strong>{' '}
															and all of its tasks will be removed. You
															can revert from the toast for a few seconds
															after deleting.
														</>
													) : (
														'This project and all of its tasks will be removed. You can revert from the toast for a few seconds after deleting.'
													)}
												</Typography>
												{challengeCount > 0 ? (
													<Typography
														level="body-md"
														sx={{
															mb: 2,
															color: 'var(--krona-text-muted)',
															lineHeight: 1.5,
														}}
													>
														{challengeCount === 1 ? (
															<>
																<strong
																	style={{ color: 'var(--krona-text)' }}
																>
																	{challengeNames[0] || 'One task'}
																</strong>{' '}
																is part of today’s daily challenges and
																will also be removed from those
																challenges.
															</>
														) : (
															<>
																<strong
																	style={{ color: 'var(--krona-text)' }}
																>
																	{challengeCount} tasks
																</strong>{' '}
																in this project are part of today’s
																daily challenges
																{challengeNames.length > 0 ? (
																	<>
																		{' '}
																		(
																		{challengeNames.join(', ')}
																		{challengeCount >
																		challengeNames.length
																			? `, +${
																					challengeCount -
																					challengeNames.length
																				} more`
																			: ''}
																		)
																	</>
																) : null}{' '}
																and will also be removed from those
																challenges.
															</>
														)}
													</Typography>
												) : null}
											</>
										);
									})()}
									<Box sx={{ display: 'flex', gap: 1 }}>
										<Button
											fullWidth
											onClick={closeDeleteProjectModal}
											sx={kronaSecondaryButtonSx}
										>
											Cancel
										</Button>
										<Button
											fullWidth
											onClick={handleConfirmDeleteProject}
											sx={kronaDeleteButtonSx}
										>
											Delete project
										</Button>
									</Box>
								</ModalDialog>
							</Modal>

							</>
						}
						detail={
							<>
							{projectsLoading ? (
								<ProjectsDetailSkeleton />
							) : (
							<>
							{/* Header */}
							<Box
								sx={{
									display: 'flex',
									justifyContent: 'space-between',
									alignItems: { xs: 'flex-start', md: 'center' },
									px: 1.5,
									gap: 2,
									flexWrap: { xs: 'nowrap', md: 'wrap' },
								}}
							>
								<Box
									sx={{
										display: { xs: 'flex', md: 'contents' },
										flexDirection: 'column',
										alignItems: 'flex-start',
										gap: { xs: 1, md: 0 },
										flex: { xs: 1, md: 'unset' },
										minWidth: 0,
									}}
								>
									{editingHeaderTitle ? (
										<Input
											placeholder={kronaPlaceholders.projects.headerTitle}
											slotProps={{ input: { ref: headerTitleInputRef } }}
											value={headerTitleDraft}
											onChange={(e) => setHeaderTitleDraft(e.target.value)}
											onBlur={commitHeaderTitleEdit}
											onKeyDown={(e) => {
												if (e.key === 'Enter') {
													e.preventDefault();
													commitHeaderTitleEdit();
												}
												if (e.key === 'Escape') {
													e.preventDefault();
													setEditingHeaderTitle(false);
												}
											}}
											sx={{
												...kronaInputSx,
												flex: 1,
												minWidth: 120,
												maxWidth: { xs: '100%', md: 360 },
												width: { xs: '100%', md: 'auto' },
												color: 'var(--krona-text)',
												'& input': {
													color: 'var(--krona-text)',
													fontWeight: 600,
													fontSize: '1.25rem',
												},
											}}
										/>
									) : (
										<Typography
											level="h3"
											onClick={startHeaderTitleEdit}
											sx={{
												fontWeight: 600,
												color: 'var(--krona-text)',
												cursor: canManageProjects ? 'text' : 'default',
												borderRadius: '12px',
												px: 0.5,
												mx: -0.5,
												width: { xs: '100%', md: 'auto' },
												overflow: 'hidden',
												textOverflow: 'ellipsis',
												whiteSpace: { xs: 'nowrap', md: 'normal' },
												...(canManageProjects
													? {
															'&:hover': {
																bgcolor:
																	'color-mix(in srgb, var(--krona-text) 6%, transparent)',
															},
														}
													: {}),
											}}
										>
											{selectedProjectIdx !== null &&
												projects[selectedProjectIdx]?.name}
										</Typography>
									)}
									<Box
										sx={{
											display: 'flex',
											alignItems: 'center',
											gap: 1.875,
											flexWrap: 'wrap',
											width: { xs: '100%', md: 'auto' },
										}}
									>
									{selectedProject && (
										<Box
											sx={{
												display: 'flex',
												alignItems: 'center',
												gap: 0.5,
												px: 1.25,
												py: 0.375,
												borderRadius: '100px',
												bgcolor: 'var(--krona-accent-soft-bg)',
												border:
													'1px solid var(--krona-accent-soft-border)',
											}}
										>
											<Clock
												size={14}
												color="var(--krona-accent-soft-text)"
												aria-hidden
											/>
											<Typography
												level="body-sm"
												component="span"
												sx={{
													color: 'var(--krona-text)',
													fontSize: 13,
													fontWeight: 500,
													lineHeight: 1.35,
												}}
											>
												{formatDecimalHoursLabel(
													getTotalTrackedHours(selectedProject),
												)}{' '}
												/{' '}
											</Typography>
											<EditableAssignedHours
												hours={selectedProject.projectTime?.totalHours ?? 0}
												onSave={(hours) =>
													handleSaveProjectAssignedTime(selectedProjectIdx, hours)
												}
												idleSx={{
													color: 'var(--krona-text)',
													fontSize: 13,
													fontWeight: 500,
													lineHeight: 1.35,
												}}
												inputSx={{
													'& input': { color: 'var(--krona-text)' },
												}}
											/>
										</Box>
									)}
									{selectedProject?.deadline && (
										<Box
											sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
										>
											<CalendarIcon size={14} aria-label="deadline" color="var(--krona-text)" />
											<Typography
												level="body-sm"
												sx={{
													color: 'var(--krona-text)',
													fontSize: 13,
													fontWeight: 500,
													lineHeight: 1.35,
												}}
											>
												{new Date(
													selectedProject.deadline,
												).toLocaleDateString()}
												{getDaysLeft(selectedProject.deadline) !== null ? (
													<Box
														component="span"
														sx={{
															color:
																getDaysLeft(selectedProject.deadline)! <= 3
																	? '#f87171'
																	: 'inherit',
														}}
													>
														{' '}
														({getDaysLeft(selectedProject.deadline)}d left)
													</Box>
												) : null}
											</Typography>
										</Box>
									)}
									<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
										<ClipboardList size={14} color="var(--krona-text)" aria-hidden />
										<Typography
											level="body-sm"
											sx={{
												color: 'var(--krona-text)',
												fontSize: 13,
												fontWeight: 500,
												lineHeight: 1.35,
											}}
										>
											{selectedProject?.tasks.pending.length ?? 0} pending
										</Typography>
									</Box>
									<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
										<CheckCircle2
											size={14}
											color={
												(selectedProject?.tasks.done.length ?? 0) > 0
													? '#4ade80'
													: 'var(--krona-text)'
											}
											aria-hidden
										/>
										<Typography
											level="body-sm"
											sx={{
												color:
													(selectedProject?.tasks.done.length ?? 0) > 0
														? '#4ade80'
														: 'var(--krona-text)',
												fontSize: 13,
												fontWeight: 500,
												lineHeight: 1.35,
											}}
										>
											{selectedProject?.tasks.done.length ?? 0} done
										</Typography>
									</Box>
								</Box>
								</Box>
								<Box
									sx={{
										display: { xs: 'inline-flex', md: 'none' },
										alignItems: 'center',
										gap: 0.75,
										flexShrink: 0,
										mt: 0.25,
									}}
								>
									<TaskSortToggleButton
										sortBy={sortBy}
										onSortChange={handleTaskSortChange}
										filters={taskListFilters}
										onFiltersChange={setTaskListFilters}
										size="md"
									/>
									{canManageTasks ? (
										<IconButton
											aria-label="Add task"
											onClick={openAddTaskModal}
											sx={{
												...kronaPrimaryIconButtonSx,
												width: 44,
												height: 44,
												minWidth: 44,
											}}
										>
											<Plus size={22} />
										</IconButton>
									) : null}
								</Box>
							</Box>

							<Box
								component="form"
								onSubmit={(e) => {
									e.preventDefault();
									handleAddTask();
								}}
								sx={{
									...kronaToolbarRowSx,
									mb: 1.5,
									display: { xs: 'none', md: 'flex' },
								}}
							>
								<Input
									placeholder={kronaPlaceholders.projects.taskName}
									slotProps={{ input: { ref: addTaskInputRef } }}
									value={newTask}
									onChange={(e) => setNewTask(e.target.value)}
									sx={{
										...kronaSearchInputSx,
										flex: 1,
										minWidth: 140,
										color: 'var(--krona-text)',
										'& input': { color: 'var(--krona-text)' },
										'& input::placeholder': { color: 'var(--krona-text-64)' },
									}}
								/>
								<Input
									placeholder={kronaPlaceholders.projects.hours}
									type="number"
									startDecorator={
										<Clock size={16} color="var(--krona-text-64)" />
									}
									value={newTaskTime || ''}
									onChange={(e) => setNewTaskTime(Number(e.target.value) || 0)}
									slotProps={{
										input: {
											min: 0,
											step: 0.5,
										},
									}}
									sx={{
										...kronaSearchInputSx,
										width: { xs: '100%', md: '125px' },
										flexShrink: 0,
										color: 'var(--krona-text)',
										'& input': { color: 'var(--krona-text)' },
										'& input::placeholder': { color: 'var(--krona-text-64)' },
									}}
								/>
								<KronaDatePickerButton
									value={newTaskDeadline}
									onChange={setNewTaskDeadline}
									placeholder={kronaPlaceholders.projects.deadlineToolbar}
									width={{ xs: '100%', md: '125px' }}
									disablePast
								/>
								<RepeatableTaskToggleButton
									active={newTaskRepeatable}
									onToggle={() => setNewTaskRepeatable((prev) => !prev)}
								/>
								<Button type="submit" sx={kronaPrimaryButtonSx}>
									Add
								</Button>
							</Box>

							{/* Empty State Logic */}
							{selectedProject &&
								selectedProject.tasks.pending.length === 0 &&
								selectedProject.tasks.done.length === 0 && (
									<Box
										sx={{
											flex: 1,
											display: 'flex',
											flexDirection: 'column',
											alignItems: 'center',
											justifyContent: 'center',
											minHeight: 240,
											color: 'var(--krona-text)',
											gap: 1,
										}}
									>
										<Sparkles size={32} aria-label="empty" style={{ opacity: 0.64 }} />
										<Typography
											level="body-sm"
											sx={{
												fontWeight: 500,
												fontSize: 14,
												textAlign: 'center',
												mt: 0.5,
												color: 'var(--krona-text-64)',
												maxWidth: 280,
											}}
										>
											No tasks yet!
											<br />
											Add your first task to get started.
										</Typography>
									</Box>
								)}

							{selectedProjectHasTasks && taskFiltersActive && noFilteredTasks ? (
								<Box
									sx={{
										flex: 1,
										display: 'flex',
										flexDirection: 'column',
										alignItems: 'center',
										justifyContent: 'center',
										minHeight: 240,
										color: 'var(--krona-text)',
										gap: 1,
									}}
								>
									<Search size={32} aria-hidden style={{ opacity: 0.64 }} />
									<Typography
										level="body-sm"
										sx={{
											fontWeight: 500,
											fontSize: 14,
											textAlign: 'center',
											mt: 0.5,
											color: 'var(--krona-text-64)',
											maxWidth: 280,
										}}
									>
										No tasks found
										<br />
										{filterEmptyMessage}
									</Typography>
								</Box>
							) : null}

							{/* Tasks List */}
							<Box sx={{ px: 1.5 }}>
								{selectedProject &&
									(selectedProject.tasks.pending.length > 0 ||
										selectedProject.tasks.done.length > 0) && (
										<>
											{displaySortedPendingTasks.length > 0 ? (
												<Box sx={{ mt: 0 }}>
														{displaySortedPendingTasks.map((task) => {
															const index = findPendingTaskIndex(task);
															if (index < 0) return null;
															return (
																<TaskItem
																	key={task.id ?? `${task.text}-${index}`}
																	task={task}
																	highlighted={
																		highlightTaskId === task.id &&
																		selectedTimerTaskId !== task.id
																	}
																	selectedForTimer={
																		selectedTimerTaskId === task.id
																	}
																	completed={false}
																	onComplete={() => handleCompleteTask(index)}
																	onEdit={() =>
																		handleEditTask('pending', index, task.text)
																	}
																	onOpenEditModal={() =>
																		handleOpenTaskEditModal('pending', index)
																	}
																	onDelete={() => requestDeleteTask('pending', index)}
																	editing={
																		editingTaskIdx?.type === 'pending' &&
																		editingTaskIdx.idx === index
																	}
																	editingText={editingTaskText}
																	setEditingText={setEditingTaskText}
																	onSaveEdit={(text) =>
																		handleSaveTask('pending', index, text)
																	}
																	onCancelEdit={handleCancelTaskEdit}
																	formatTaskTime={formatTaskTime}
																	formatTaskDaysLeft={formatTaskDaysLeft}
																	onSaveAssignedTime={(hours) =>
																		handleSaveTaskAssignedTime('pending', index, hours)
																	}
																	onTogglePriority={() =>
																		handleToggleTaskPriority(index)
																	}
																	onSelectForTimer={() =>
																		handleSelectTaskForTimer(task)
																	}
																	inDailyChallenges={Boolean(
																		task.id &&
																			dailyChallengeTaskIds.has(task.id),
																	)}
																	onAddToDailyChallenges={() =>
																		void handleAddTaskToDailyChallenges(task)
																	}
																	onRemoveFromDailyChallenges={() =>
																		void handleRemoveTaskFromDailyChallenges(
																			task,
																		)
																	}
																	onToggleRepeatable={() =>
																		handleToggleTaskRepeatable('pending', index)
																	}
																/>
															);
														})}
													</Box>
											) : null}

											{displaySortedDoneTasks.length > 0 ? (
													<Box sx={{ mt: '10px' }}>
													<KronaListDivider label="Done" compact />
													<Box sx={{ mt: '10px' }}>
														{displaySortedDoneTasks.map((task) => {
															const index = findDoneTaskIndex(task);
															if (index < 0) return null;
															return (
																<TaskItem
																	key={task.id ?? `${task.text}-${index}`}
																	task={task}
																	highlighted={
																		highlightTaskId === task.id &&
																		selectedTimerTaskId !== task.id
																	}
																	selectedForTimer={false}
																	completed={true}
																	onComplete={() => handleUncompleteTask(index)}
																	onEdit={() =>
																		handleEditTask('done', index, task.text)
																	}
																	onOpenEditModal={() =>
																		handleOpenTaskEditModal('done', index)
																	}
																	onDelete={() => requestDeleteTask('done', index)}
																	editing={
																		editingTaskIdx?.type === 'done' &&
																		editingTaskIdx.idx === index
																	}
																	editingText={editingTaskText}
																	setEditingText={setEditingTaskText}
																	onSaveEdit={(text) =>
																		handleSaveTask('done', index, text)
																	}
																	onCancelEdit={handleCancelTaskEdit}
																	formatTaskTime={formatTaskTime}
																	formatTaskDaysLeft={formatTaskDaysLeft}
																	onSaveAssignedTime={(hours) =>
																		handleSaveTaskAssignedTime('done', index, hours)
																	}
																	inDailyChallenges={Boolean(
																		task.id &&
																			dailyChallengeTaskIds.has(task.id),
																	)}
																	onAddToDailyChallenges={() =>
																		void handleAddTaskToDailyChallenges(task)
																	}
																	onRemoveFromDailyChallenges={() =>
																		void handleRemoveTaskFromDailyChallenges(
																			task,
																		)
																	}
																	onToggleRepeatable={() =>
																		handleToggleTaskRepeatable('done', index)
																	}
																/>
															);
														})}
													</Box>
												</Box>
											) : null}
										</>
									)}
							</Box>
							</>
							)}
							</>
						}
					/>
				</Box>


				{/* Undo assigned-time edit toast */}
				<Snackbar
					open={showAssignedTimeUndoToast}
					autoHideDuration={5000}
					onClose={handleAssignedTimeToastClose}
					anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
					sx={{
						bottom: '24px !important',
						left: '50% !important',
						right: 'auto !important',
						transform: 'translateX(-50%) !important',
						width: 'max-content',
						maxWidth: 'calc(100vw - 32px)',
						'& .MuiSnackbar-root': {
							backgroundColor: 'transparent',
						},
					}}
					slotProps={{
						root: {
							sx: {
								backgroundColor: 'transparent',
								border: 'none',
								boxShadow: 'none',
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
							background: 'var(--krona-surface-bg)',
							backdropFilter: 'blur(16px)',
							WebkitBackdropFilter: 'blur(16px)',
							borderRadius: '100px',
							border: '1px solid var(--krona-surface-border)',
							color: 'var(--krona-text)',
						}}
					>
						<Typography level="body-md" sx={{ color: 'var(--krona-text)', fontWeight: 500 }}>
							Assigned time updated
						</Typography>
						<Button
							variant="plain"
							size="sm"
							startDecorator={<Undo2 size={16} />}
							onClick={handleRevertAssignedTime}
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

				<TaskDeleteUndoToast
					open={showDeleteProjectUndoToast}
					onClose={handleDeleteProjectToastClose}
					onRevert={handleRevertProjectDelete}
					message="Project deleted"
					bottomOffset={
						showAssignedTimeUndoToast || showDeleteTaskUndoToast ? 88 : 24
					}
				/>

				<TaskDeleteUndoToast
					open={showDeleteTaskUndoToast}
					onClose={handleDeleteTaskToastClose}
					onRevert={handleRevertTaskDelete}
					bottomOffset={
						showAssignedTimeUndoToast || showDeleteProjectUndoToast ? 88 : 24
					}
				/>

				{/* Keep outside the split sidebar — on mobile that panel is display:none while viewing tasks. */}
				<TaskDailyChallengeDeleteModal
					open={challengeTaskDelete !== null}
					taskName={challengeTaskDelete?.taskName ?? ''}
					onClose={() => setChallengeTaskDelete(null)}
					onConfirm={confirmChallengeTaskDelete}
				/>
			</Box>
		</CssVarsProvider>
	);
}

function EditableAssignedHours({
	hours,
	onSave,
	idleSx,
	inputSx,
}: {
	hours: number;
	onSave: (hours: number) => void;
	idleSx?: Record<string, unknown>;
	inputSx?: Record<string, unknown>;
}) {
	const [editing, setEditing] = React.useState(false);
	const [draft, setDraft] = React.useState('');
	const inputRef = React.useRef<HTMLInputElement>(null);
	const openedAtRef = React.useRef(0);
	const editingRef = React.useRef(false);

	React.useEffect(() => {
		editingRef.current = editing;
	}, [editing]);

	const bumpDraft = (delta: number) => {
		setDraft((current) => {
			const base = Number(current);
			const start = Number.isFinite(base) ? base : hours;
			const next = Math.max(0, Number(formatDecimalHours(start + delta)));
			return String(next);
		});
	};

	const startEdit = (event: React.MouseEvent) => {
		event.stopPropagation();
		setDraft(formatDecimalHours(hours));
		openedAtRef.current = Date.now();
		setEditing(true);
	};

	const cancelEdit = () => {
		setEditing(false);
		setDraft(formatDecimalHours(hours));
	};

	const commitEdit = (rawValue?: string) => {
		if (!editingRef.current) return;
		const parsed = Number(rawValue ?? draft);
		if (!Number.isFinite(parsed) || parsed < 0) {
			cancelEdit();
			return;
		}
		const normalized = Math.max(0, Number(formatDecimalHours(parsed)));
		const previous = Number(formatDecimalHours(hours));
		editingRef.current = false;
		setEditing(false);
		if (normalized !== previous) {
			onSave(normalized);
		}
	};

	React.useEffect(() => {
		if (!editing) return;
		openedAtRef.current = Date.now();
		const id = window.requestAnimationFrame(() => {
			inputRef.current?.focus();
			inputRef.current?.select();
		});
		return () => window.cancelAnimationFrame(id);
	}, [editing]);

	if (editing) {
		return (
			<Box
				sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25 }}
				onMouseDown={(e) => e.stopPropagation()}
			>
				<IconButton
					size="sm"
					variant="plain"
					aria-label="Decrease assigned time"
					onMouseDown={(e) => e.preventDefault()}
					onClick={() => bumpDraft(-0.5)}
					sx={{
						minHeight: 24,
						minWidth: 24,
						color: 'var(--krona-text-72)',
					}}
				>
					<Minus size={14} />
				</IconButton>
				<Input
					size="sm"
					type="number"
					value={draft}
					slotProps={{
						input: {
							ref: inputRef,
							min: 0,
							step: 0.1,
						},
					}}
					onChange={(e) => setDraft(e.target.value)}
					onBlur={(e) => {
						if (Date.now() - openedAtRef.current < 200) return;
						commitEdit(e.currentTarget.value);
					}}
					onKeyDown={(e) => {
						if (e.key === 'Enter') {
							e.preventDefault();
							commitEdit(e.currentTarget.value);
						}
						if (e.key === 'Escape') {
							e.preventDefault();
							cancelEdit();
						}
					}}
					sx={{
						width: 72,
						minHeight: 28,
						borderRadius: '12px',
						'--Input-focusedThickness': '1px',
						...kronaNumberInputHideSpinnersSx,
						'& input': {
							textAlign: 'center',
							fontSize: 13,
							py: 0.25,
						},
						...inputSx,
					}}
				/>
				<IconButton
					size="sm"
					variant="plain"
					aria-label="Increase assigned time"
					onMouseDown={(e) => e.preventDefault()}
					onClick={() => bumpDraft(0.5)}
					sx={{
						minHeight: 24,
						minWidth: 24,
						color: 'var(--krona-text-72)',
					}}
				>
					<Plus size={14} />
				</IconButton>
			</Box>
		);
	}

	return (
		<Typography
			component="span"
			level="body-sm"
			onClick={startEdit}
			sx={{
				cursor: 'pointer',
				borderRadius: '8px',
				px: 0.25,
				boxSizing: 'border-box',
				'&:hover': {
					color: 'var(--krona-text)',
					bgcolor: 'var(--krona-overlay-hover)',
				},
				...idleSx,
			}}
		>
			{formatDecimalHoursLabel(hours)}
		</Typography>
	);
}

function TaskItem({
	task,
	completed = false,
	highlighted = false,
	selectedForTimer = false,
	onComplete,
	onEdit,
	onOpenEditModal,
	onDelete,
	editing,
	editingText,
	setEditingText,
	onSaveEdit,
	onCancelEdit,
	formatTaskTime,
	formatTaskDaysLeft,
	onSaveAssignedTime,
	onTogglePriority,
	onSelectForTimer,
	inDailyChallenges = false,
	onAddToDailyChallenges,
	onRemoveFromDailyChallenges,
	onToggleRepeatable,
}: {
	task: Task;
	completed?: boolean;
	highlighted?: boolean;
	selectedForTimer?: boolean;
	onComplete?: () => void;
	onEdit?: () => void;
	onOpenEditModal?: () => void;
	onDelete?: () => void;
	editing?: boolean;
	editingText?: string;
	setEditingText?: (v: string) => void;
	onSaveEdit?: (text: string) => void;
	onCancelEdit?: () => void;
	formatTaskTime: (task: Task) => string | null;
	formatTaskDaysLeft?: (task: Task) => string | null;
	onSaveAssignedTime?: (hours: number) => void;
	onTogglePriority?: () => void;
	onSelectForTimer?: () => void;
	inDailyChallenges?: boolean;
	onAddToDailyChallenges?: () => void;
	onRemoveFromDailyChallenges?: () => void;
	onToggleRepeatable?: () => void;
}) {
	const taskTime = task.time ?? {
		mode: 'manual' as const,
		manualHours: 0,
		trackedHours: 0,
	};
	const isManualTime = taskTime.mode !== 'deadline';
	const timeDisplay = formatTaskTime({ ...task, time: taskTime });
	const trackedHours = taskTime.trackedHours ?? 0;
	const assignedHours =
		taskTime.mode === 'manual' ? (taskTime.manualHours ?? 0) : 0;
	const isOverAssigned =
		isManualTime && assignedHours > 0 && trackedHours > assignedHours;
	const timeMetaColor = isOverAssigned ? '#f87171' : 'var(--krona-text-64)';
	const completedAtLabel =
		completed && task.completedAt
			? task.completedAt.toLocaleDateString(undefined, {
					month: 'short',
					day: 'numeric',
					year: 'numeric',
				})
			: null;
	const daysLeftLabel = formatTaskDaysLeft?.(
		{ ...task, time: taskTime },
	) ?? null;
	const secondaryMetaLabel = completedAtLabel ?? daysLeftLabel;
	const showTimeMeta = isManualTime || Boolean(timeDisplay);
	const showMetaRow =
		showTimeMeta || Boolean(task.repeatable) || Boolean(secondaryMetaLabel);
	const isPrioritized = isTaskPrioritized(task.id, task.prioritized);
	const editInputRef = React.useRef<HTMLInputElement>(null);
	const editOpenedAtRef = React.useRef(0);

	React.useEffect(() => {
		if (!editing) return;
		editOpenedAtRef.current = Date.now();
		const id = window.requestAnimationFrame(() => {
			editInputRef.current?.focus();
			editInputRef.current?.select();
		});
		return () => window.cancelAnimationFrame(id);
	}, [editing]);

	return (
		<Box
			id={task.id ? `task-${task.id}` : undefined}
			className="krona-task-list-row"
			sx={{
				...kronaTaskListRowSx({
					highlighted,
					selected: selectedForTimer && !completed,
				}),
				display: 'flex',
				alignItems: 'center',
				gap: 1,
				py: 1,
				minWidth: 0,
			}}
		>
			<KronaTaskCheckbox checked={completed} onChange={onComplete} />
			{editing ? (
				<Input
					placeholder={kronaPlaceholders.projects.editTask}
					slotProps={{ input: { ref: editInputRef } }}
					value={editingText}
					onChange={(e) => setEditingText?.(e.target.value)}
					onBlur={(e) => {
						if (Date.now() - editOpenedAtRef.current < 200) return;
						onSaveEdit?.(e.currentTarget.value);
					}}
					onKeyDown={(e) => {
						if (e.key === 'Enter') {
							e.preventDefault();
							onSaveEdit?.(e.currentTarget.value);
						}
						if (e.key === 'Escape') {
							e.preventDefault();
							onCancelEdit?.();
						}
					}}
					size="sm"
					sx={{
						flex: 1,
						borderRadius: '12px',
						color: 'var(--krona-text)',
						'& input': { color: 'var(--krona-text)' },
					}}
				/>
			) : (
				<Box
					sx={{
						flex: 1,
						display: 'flex',
						flexDirection: 'column',
						justifyContent: 'center',
						minWidth: 0,
						ml: kronaTaskListCheckboxContentGap,
						gap: kronaTaskListNameDetailsGap,
					}}
				>
					<Typography
						level="body-md"
						sx={kronaTaskListItemNameSx}
						onClick={onEdit}
					>
						{task.text}
					</Typography>
					{(showMetaRow) && (
						<Box
							sx={{
								display: 'flex',
								alignItems: 'center',
								gap: 0.5,
								flexShrink: 0,
								flexWrap: 'wrap',
								color: timeMetaColor,
							}}
						>
							{showTimeMeta && (
								<>
									<Clock size={14} color={timeMetaColor} />
									{isManualTime ? (
										<>
											<Typography
												level="body-sm"
												sx={{ color: 'inherit', fontSize: 13, lineHeight: 1.35 }}
											>
												{formatDecimalHoursLabel(trackedHours)}
											</Typography>
											<Typography
												level="body-sm"
												sx={{ color: 'inherit', fontSize: 13, lineHeight: 1.35 }}
											>
												/
											</Typography>
											<EditableAssignedHours
												hours={taskTime.manualHours ?? 0}
												onSave={(hours) => onSaveAssignedTime?.(hours)}
												idleSx={{
													color: 'inherit',
													fontSize: 13,
													lineHeight: 1.35,
												}}
												inputSx={{
													'& input': { color: 'var(--krona-text)' },
												}}
											/>
										</>
									) : (
										<Typography
											level="body-sm"
											sx={{
												color: 'inherit',
												fontSize: 13,
												lineHeight: 1.35,
												whiteSpace: 'nowrap',
											}}
										>
											{timeDisplay}
										</Typography>
									)}
								</>
							)}
							{secondaryMetaLabel ? (
								<>
									{showTimeMeta ? (
										<Box
											component="span"
											sx={{
												...kronaMetaDotSx,
												opacity: 0.55,
												mx: '2px',
											}}
											aria-hidden
										/>
									) : null}
									<Typography
										level="body-sm"
										sx={{
											color: 'inherit',
											fontSize: 13,
											lineHeight: 1.35,
											whiteSpace: 'nowrap',
										}}
									>
										{secondaryMetaLabel}
									</Typography>
								</>
							) : null}
							{task.repeatable ? (
								<>
									{(showTimeMeta || secondaryMetaLabel) && (
										<Box component="span" sx={kronaMetaDotSx} aria-hidden />
									)}
									<Box
										sx={{
											display: 'inline-flex',
											alignItems: 'center',
											gap: 0.35,
										}}
										aria-label="Repeatable daily"
									>
										<Repeat2 size={13} aria-hidden />
										<Typography
											level="body-sm"
											sx={{ color: 'inherit', fontSize: 13, lineHeight: 1.35 }}
										>
											Daily
										</Typography>
									</Box>
								</>
							) : null}
						</Box>
					)}
				</Box>
			)}
			{!completed ? (
				<Box className="krona-task-row-actions" sx={kronaTaskRowActionsSx}>
					<IconButton
						size="sm"
						variant="plain"
						className="krona-task-row-action krona-task-priority-star"
						aria-label={isPrioritized ? 'Remove priority' : 'Mark as priority'}
						aria-pressed={isPrioritized}
						onMouseDown={(e) => e.preventDefault()}
						onClick={(e) => {
							e.stopPropagation();
							onTogglePriority?.();
						}}
						sx={kronaTaskPriorityStarButtonSx(isPrioritized)}
					>
						<KronaPriorityStar active={isPrioritized} size={16} />
					</IconButton>
					<IconButton
						size="sm"
						variant="plain"
						className="krona-task-row-action krona-task-timer-track"
						aria-label={
							selectedForTimer ? 'Stop tracking with timer' : 'Track with timer'
						}
						aria-pressed={selectedForTimer}
						onMouseDown={(e) => e.preventDefault()}
						onClick={(e) => {
							e.stopPropagation();
							onSelectForTimer?.();
						}}
						sx={kronaTaskTimerTrackButtonSx(selectedForTimer)}
					>
						<Timer size={16} strokeWidth={2.25} aria-hidden />
					</IconButton>
					<Dropdown>
						<MenuButton
							slots={{ root: KronaMoreMenuButton }}
							slotProps={{
								root: {
									className: 'krona-task-row-action',
									sx: kronaTaskRowMoreMenuButtonSx,
								},
							}}
						/>
						<Menu placement="bottom-end" sx={kronaMenuSx}>
							<MenuItem
								onClick={() => {
									window.requestAnimationFrame(() => onOpenEditModal?.());
								}}
							>
								<Edit size={16} style={{ marginRight: 8 }} />
								Edit
							</MenuItem>
							{onToggleRepeatable ? (
								<MenuItem
									onClick={() => {
										window.requestAnimationFrame(() => onToggleRepeatable());
									}}
								>
									<Repeat2 size={16} style={{ marginRight: 8 }} />
									{task.repeatable
										? 'Remove repeatable'
										: 'Make repeatable daily'}
								</MenuItem>
							) : null}
							<MenuItem onClick={onDelete} {...kronaDeleteMenuItemProps}>
								<Trash2 size={16} style={{ marginRight: 8 }} />
								Delete
							</MenuItem>
						</Menu>
					</Dropdown>
				</Box>
			) : (
				<Box className="krona-task-row-actions" sx={kronaTaskRowActionsSx}>
					<Dropdown>
						<MenuButton
							slots={{ root: KronaMoreMenuButton }}
							slotProps={{
								root: {
									className: 'krona-task-row-action',
									sx: kronaTaskRowMoreMenuButtonSx,
								},
							}}
						/>
						<Menu placement="bottom-end" sx={kronaMenuSx}>
							<MenuItem
								onClick={() => {
									window.requestAnimationFrame(() => onOpenEditModal?.());
								}}
							>
								<Edit size={16} style={{ marginRight: 8 }} />
								Edit
							</MenuItem>
							{onToggleRepeatable ? (
								<MenuItem
									onClick={() => {
										window.requestAnimationFrame(() => onToggleRepeatable());
									}}
								>
									<Repeat2 size={16} style={{ marginRight: 8 }} />
									{task.repeatable
										? 'Remove repeatable'
										: 'Make repeatable daily'}
								</MenuItem>
							) : null}
							<MenuItem onClick={onDelete} {...kronaDeleteMenuItemProps}>
								<Trash2 size={16} style={{ marginRight: 8 }} />
								Delete
							</MenuItem>
						</Menu>
					</Dropdown>
				</Box>
			)}
		</Box>
	);
}
