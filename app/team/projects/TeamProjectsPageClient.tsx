'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import {
	Box,
	Button,
	Checkbox,
	Dropdown,
	FormControl,
	FormLabel,
	IconButton,
	Input,
	Menu,
	MenuButton,
	MenuItem,
	Modal,
	ModalDialog,
	Option,
	Select,
	Tooltip,
	Typography,
} from '@mui/joy';
import {
	Calendar as CalendarIcon,
	CheckCircle2,
	ChevronDown,
	ClipboardList,
	Clock,
	Folder,
	FolderKanban,
	Pencil,
	Plus,
	Search,
	Sparkles,
	Trash2,
	UserRound,
	UserPlus,
	Users,
	X,
} from 'lucide-react';
import TeamAppShell from '@/components/teams/TeamAppShell';
import KronaResizableSplitLayout from '@/components/krona/KronaResizableSplitLayout';
import KronaDatePickerButton from '@/components/krona/KronaDatePickerButton';
import KronaListDivider from '@/components/krona/KronaListDivider';
import KronaTaskCheckbox from '@/components/krona/KronaTaskCheckbox';
import KronaMoreMenuButton from '@/components/krona/KronaMoreMenuButton';
import KronaPriorityStar from '@/components/krona/KronaPriorityStar';
import DashboardWidgetEmpty from '@/components/dashboard/DashboardWidgetEmpty';
import { useTeamMode } from '@/components/teams/TeamModeContext';
import { useKronaLayoutMode } from '@/components/KronaLayoutModeProvider';
import {
	fetchTeamProjects,
	fetchTeamTasks,
	type TeamProjectRow,
	type TeamTaskRow,
} from '@/lib/teams/dashboard';
import {
	createTeamProject,
	createTeamReminder,
	createTeamTask,
	deleteTeamProject,
	deleteTeamTask,
	fetchOrgMembers,
	organizationMemberLabel,
	setTeamTaskPrioritized,
	setTeamTaskStatus,
	updateTeamProject,
	updateTeamTask,
} from '@/lib/teams/org';
import type { OrganizationMember } from '@/lib/teams/types';
import { localData } from '@/lib/localData';
import {
	mergeMembers,
	mergeTeamProjects,
	mergeTeamTasks,
} from '@/lib/teams/stableLists';
import { isTeamUndefinedProject } from '@/lib/teams/undefinedTeamProject';
import { showKronaError, showKronaSuccess } from '@/lib/kronaToast';
import {
	DEADLINE_PAST_MESSAGE,
	isDeadlineInPast,
	localDateKeyToIso,
} from '@/lib/localDate';
import { kronaPlaceholders } from '@/lib/kronaPlaceholders';
import {
	kronaDeleteMenuItemProps,
	kronaDropdownControlSx,
	kronaInputSx,
	kronaMenuItemSx,
	kronaMenuSx,
	kronaModalCloseButtonSx,
	kronaModalDialogSx,
	kronaModalFieldsSx,
	kronaModalFormSx,
	kronaModalPrimaryActionSx,
	kronaModalTitleSx,
	kronaPrimaryButtonSx,
	kronaPrimaryIconButtonSx,
	kronaSearchInputSx,
	kronaToggleIconButtonSx,
	kronaSelectSlotProps,
	kronaTaskPriorityStarButtonSx,
	kronaTaskRowActionsSx,
	kronaTaskRowMoreMenuButtonSx,
	kronaSideListScrollSx,
	kronaSideListToolbarRowSx,
	kronaTaskListCheckboxContentGap,
	kronaTaskListItemNameSx,
	kronaTaskListNameDetailsGap,
	kronaTaskListRowSx,
	kronaToolbarRowSx,
} from '@/lib/kronaStyles';

function memberLabel(
	userId: string | null,
	membersById: Map<string, OrganizationMember>,
) {
	if (!userId) return 'Unassigned';
	return organizationMemberLabel(membersById.get(userId));
}

function daysLeftForDeadline(deadline: string | null | undefined): number | null {
	if (!deadline) return null;
	const due = new Date(deadline);
	const startDue = new Date(
		due.getFullYear(),
		due.getMonth(),
		due.getDate(),
	).getTime();
	const now = new Date();
	const startToday = new Date(
		now.getFullYear(),
		now.getMonth(),
		now.getDate(),
	).getTime();
	return Math.round((startDue - startToday) / (24 * 60 * 60 * 1000));
}

function deadlineToDueAt(dateKey: string): string | null {
	return localDateKeyToIso(dateKey, { hour: 9 });
}

function ProjectMetaDot() {
	return (
		<Typography
			component="span"
			aria-hidden
			sx={{
				color: 'var(--krona-text-64)',
				fontSize: 13,
				lineHeight: 1,
				userSelect: 'none',
			}}
		>
			·
		</Typography>
	);
}

export default function TeamProjectsPageClient() {
	const {
		organization,
		isManager,
		canCreateEditProjects,
		canCreateEditTasks,
		canCreateEditReminders,
	} = useTeamMode();
	const { isMobileNav } = useKronaLayoutMode();
	const searchParams = useSearchParams();
	const [projects, setProjects] = React.useState<TeamProjectRow[]>([]);
	const [tasks, setTasks] = React.useState<TeamTaskRow[]>([]);
	const [members, setMembers] = React.useState<OrganizationMember[]>([]);
	const [selectedId, setSelectedId] = React.useState<string | null>(null);
	const [search, setSearch] = React.useState('');
	const [mobileDetails, setMobileDetails] = React.useState(false);
	const [loading, setLoading] = React.useState(true);
	const [busy, setBusy] = React.useState(false);
	const loadedOnceRef = React.useRef(false);
	const orgId = organization?.id ?? null;
	const projectQuery = searchParams.get('project');

	const [projectModalOpen, setProjectModalOpen] = React.useState(false);
	const [editingProjectId, setEditingProjectId] = React.useState<string | null>(
		null,
	);
	const [projectName, setProjectName] = React.useState('');
	const [projectDeadline, setProjectDeadline] = React.useState('');
	const [projectMemberIds, setProjectMemberIds] = React.useState<string[]>([]);

	const [newTaskName, setNewTaskName] = React.useState('');
	const [newTaskDeadline, setNewTaskDeadline] = React.useState('');
	const [newTaskHours, setNewTaskHours] = React.useState(0);
	const [newTaskAssigneeIds, setNewTaskAssigneeIds] = React.useState<string[]>(
		[],
	);
	const [assignMenuOpen, setAssignMenuOpen] = React.useState(false);

	const [editingTask, setEditingTask] = React.useState<TeamTaskRow | null>(
		null,
	);
	const [editTaskName, setEditTaskName] = React.useState('');
	const [editTaskDeadline, setEditTaskDeadline] = React.useState('');
	const [editTaskHours, setEditTaskHours] = React.useState(0);
	const [editingHeaderTitle, setEditingHeaderTitle] = React.useState(false);
	const [headerTitleDraft, setHeaderTitleDraft] = React.useState('');
	const headerTitleInputRef = React.useRef<HTMLInputElement>(null);
	const [editingTaskId, setEditingTaskId] = React.useState<string | null>(null);
	const [editingTaskText, setEditingTaskText] = React.useState('');
	const taskNameInputRef = React.useRef<HTMLInputElement>(null);
	const taskEditOpenedAtRef = React.useRef(0);

	const [assigningTask, setAssigningTask] = React.useState<TeamTaskRow | null>(
		null,
	);
	const [assignTaskUserId, setAssignTaskUserId] = React.useState<string | null>(
		null,
	);

	const [deletingTask, setDeletingTask] = React.useState<TeamTaskRow | null>(
		null,
	);
	const [deletingProject, setDeletingProject] =
		React.useState<TeamProjectRow | null>(null);
	const [projectAssignMenuOpen, setProjectAssignMenuOpen] =
		React.useState(false);
	const [projectAddToReminders, setProjectAddToReminders] =
		React.useState(false);

	const membersById = React.useMemo(
		() => new Map(members.map((m) => [m.userId, m] as const)),
		[members],
	);

	const onboardedTeammates = React.useMemo(
		() =>
			members.filter(
				(m) =>
					(m.role === 'member' || m.role === 'manager') &&
					m.onboardingCompleted,
			),
		[members],
	);

	const projectAssigneeOptions = React.useMemo(() => {
		const seen = new Set(onboardedTeammates.map((m) => m.userId));
		const extras = members.filter(
			(m) => projectMemberIds.includes(m.userId) && !seen.has(m.userId),
		);
		return [...onboardedTeammates, ...extras];
	}, [members, onboardedTeammates, projectMemberIds]);

	const load = React.useCallback(async () => {
		if (!orgId) return;
		const showSpinner = !loadedOnceRef.current;
		if (showSpinner) setLoading(true);
		try {
			const [projectRows, taskRows, memberList] = await Promise.all([
				fetchTeamProjects(orgId),
				fetchTeamTasks(orgId),
				fetchOrgMembers(orgId),
			]);
			setProjects((prev) => mergeTeamProjects(prev, projectRows));
			setTasks((prev) => mergeTeamTasks(prev, taskRows));
			setMembers((prev) => mergeMembers(prev, memberList));

			setSelectedId((prev) => {
				if (projectQuery && projectRows.some((p) => p.id === projectQuery)) {
					return projectQuery;
				}
				if (prev && projectRows.some((p) => p.id === prev)) return prev;
				return projectRows[0]?.id ?? null;
			});
			loadedOnceRef.current = true;
		} finally {
			if (showSpinner) setLoading(false);
		}
	}, [orgId, projectQuery]);

	React.useEffect(() => {
		void load();
	}, [load]);

	React.useEffect(() => {
		const fromQuery = searchParams.get('project');
		if (fromQuery && projects.some((p) => p.id === fromQuery)) {
			setSelectedId(fromQuery);
			if (isMobileNav) setMobileDetails(true);
		}
	}, [searchParams, projects, isMobileNav]);

	const filtered = React.useMemo(() => {
		const q = search.trim().toLowerCase();
		if (!q) return projects;
		return projects.filter((p) => p.name.toLowerCase().includes(q));
	}, [projects, search]);

	const selected = projects.find((p) => p.id === selectedId) ?? null;

	const startHeaderTitleEdit = () => {
		if (!canCreateEditProjects || !selected || isTeamUndefinedProject(selected)) {
			return;
		}
		setHeaderTitleDraft(selected.name);
		setEditingHeaderTitle(true);
	};

	const commitHeaderTitleEdit = async () => {
		const trimmed = headerTitleDraft.trim();
		setEditingHeaderTitle(false);
		if (!organization || !selected || !canCreateEditProjects) return;
		if (!trimmed || trimmed === selected.name) return;
		const memberUserIds = selected.member_user_ids?.length
			? selected.member_user_ids
			: selected.assignee_user_id
				? [selected.assignee_user_id]
				: [];
		setProjects((prev) =>
			prev.map((project) =>
				project.id === selected.id ? { ...project, name: trimmed } : project,
			),
		);
		const ok = await updateTeamProject({
			organizationId: organization.id,
			projectId: selected.id,
			name: trimmed,
			memberUserIds,
			deadline: selected.deadline?.slice(0, 10) ?? null,
		});
		if (!ok) {
			setProjects((prev) =>
				prev.map((project) =>
					project.id === selected.id
						? { ...project, name: selected.name }
						: project,
				),
			);
			showKronaError('Could not rename project.');
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

	React.useEffect(() => {
		setEditingHeaderTitle(false);
		setEditingTaskId(null);
	}, [selectedId]);

	const canRenameTasks = isManager || canCreateEditTasks;

	const startTaskNameEdit = (task: TeamTaskRow) => {
		if (!canRenameTasks) return;
		taskEditOpenedAtRef.current = Date.now();
		setEditingTaskId(task.id);
		setEditingTaskText(task.name);
	};

	const cancelTaskNameEdit = () => {
		setEditingTaskId(null);
		setEditingTaskText('');
	};

	const commitTaskNameEdit = async (task: TeamTaskRow, nextName?: string) => {
		const trimmed = (nextName ?? editingTaskText).trim();
		setEditingTaskId(null);
		setEditingTaskText('');
		if (!organization || !canRenameTasks) return;
		if (!trimmed || trimmed === task.name) return;
		setTasks((prev) =>
			prev.map((row) => (row.id === task.id ? { ...row, name: trimmed } : row)),
		);
		const ok = await updateTeamTask({
			organizationId: organization.id,
			taskId: task.id,
			name: trimmed,
		});
		if (!ok) {
			setTasks((prev) =>
				prev.map((row) =>
					row.id === task.id ? { ...row, name: task.name } : row,
				),
			);
			showKronaError('Could not rename task.');
		}
	};

	React.useEffect(() => {
		if (!editingTaskId) return;
		const id = window.requestAnimationFrame(() => {
			taskNameInputRef.current?.focus();
			taskNameInputRef.current?.select();
		});
		return () => window.cancelAnimationFrame(id);
	}, [editingTaskId]);

	const projectTasks = React.useMemo(
		() => tasks.filter((t) => t.project_id === selectedId),
		[tasks, selectedId],
	);
	const pendingTasks = projectTasks
		.filter((t) => t.status !== 'done')
		.slice()
		.sort(
			(a, b) => Number(Boolean(b.prioritized)) - Number(Boolean(a.prioritized)),
		);
	const doneTasks = projectTasks.filter((t) => t.status === 'done');

	const projectAssignees = React.useMemo(() => {
		if (!selected) return [] as OrganizationMember[];
		const ids = selected.member_user_ids?.length
			? selected.member_user_ids
			: selected.assignee_user_id
				? [selected.assignee_user_id]
				: [];
		return ids
			.map((id) => membersById.get(id))
			.filter(
				(m): m is OrganizationMember =>
					!!m && (m.role === 'member' || m.role === 'manager'),
			);
	}, [selected, membersById]);

	const closeProjectModal = () => {
		setProjectModalOpen(false);
		setEditingProjectId(null);
		setProjectName('');
		setProjectDeadline('');
		setProjectMemberIds([]);
		setProjectAssignMenuOpen(false);
		setProjectAddToReminders(false);
	};

	const openProjectModal = () => {
		setEditingProjectId(null);
		setProjectName('');
		setProjectDeadline('');
		setProjectMemberIds([]);
		setProjectAddToReminders(false);
		setProjectModalOpen(true);
	};

	const openEditProjectModal = (project: TeamProjectRow) => {
		if (isTeamUndefinedProject(project)) return;
		setEditingProjectId(project.id);
		setProjectName(project.name);
		setProjectDeadline(project.deadline?.slice(0, 10) ?? '');
		setProjectMemberIds(
			project.member_user_ids?.length
				? project.member_user_ids
				: project.assignee_user_id
					? [project.assignee_user_id]
					: [],
		);
		setProjectModalOpen(true);
	};

	const resetNewTaskForm = () => {
		setNewTaskName('');
		setNewTaskDeadline('');
		setNewTaskHours(0);
		setNewTaskAssigneeIds([]);
		setAssignMenuOpen(false);
	};

	React.useEffect(() => {
		resetNewTaskForm();
	}, [selectedId]);

	const submitProject = async () => {
		if (!organization || !projectName.trim() || !canCreateEditProjects) return;
		if (!editingProjectId && isDeadlineInPast(projectDeadline)) {
			showKronaError(DEADLINE_PAST_MESSAGE);
			return;
		}
		const { data: userRes } = await localData.auth.getUser();
		const user = userRes.user;
		if (!user) return;
		setBusy(true);
		try {
			const addDeadlineReminders = async () => {
				const dateKey = projectDeadline.trim();
				if (!projectAddToReminders || !dateKey) return;
				const dueAt = deadlineToDueAt(dateKey);
				if (!dueAt) {
					showKronaError(
						'Project saved, but the deadline could not be added to reminders.',
					);
					return;
				}
				const reminderName = `${projectName.trim()} deadline`;
				const targets =
					projectMemberIds.length > 0 ? projectMemberIds : [null];
				let added = 0;
				for (const assigneeUserId of targets) {
					let existingQuery = localData
						.from('team_reminders')
						.select('id')
						.eq('organization_id', organization.id)
						.eq('name', reminderName)
						.eq('due_at', dueAt)
						.neq('status', 'done')
						.limit(1);
					existingQuery =
						assigneeUserId == null
							? existingQuery.is('assignee_user_id', null)
							: existingQuery.eq('assignee_user_id', assigneeUserId);
					const { data: existing } = await existingQuery.maybeSingle();
					if (existing?.id) {
						added += 1;
						continue;
					}
					const reminderId = await createTeamReminder({
						organizationId: organization.id,
						name: reminderName,
						assigneeUserId,
						createdBy: user.id,
						dueAt,
					});
					if (reminderId) added += 1;
				}
				if (added === 0) {
					showKronaError(
						'Project saved, but the deadline could not be added to reminders.',
					);
				}
			};

			if (editingProjectId) {
				const updated = await updateTeamProject({
					organizationId: organization.id,
					projectId: editingProjectId,
					name: projectName,
					memberUserIds: projectMemberIds,
					deadline: projectDeadline.trim() || null,
				});
				if (!updated) {
					showKronaError('Could not update project.');
					return;
				}
				await addDeadlineReminders();
				showKronaSuccess('Project updated.');
				closeProjectModal();
				await load();
				setSelectedId(editingProjectId);
				return;
			}

			const id = await createTeamProject({
				organizationId: organization.id,
				name: projectName.trim(),
				memberUserIds: projectMemberIds,
				deadline: projectDeadline.trim() || null,
				createdBy: user.id,
			});
			if (!id) {
				showKronaError('Could not create project.');
				return;
			}
			await addDeadlineReminders();
			showKronaSuccess(
				projectMemberIds.length
					? `Project created for ${projectMemberIds.length} teammate${projectMemberIds.length === 1 ? '' : 's'}.`
					: 'Project created.',
			);
			closeProjectModal();
			await load();
			setSelectedId(id);
			if (isMobileNav) setMobileDetails(true);
		} finally {
			setBusy(false);
		}
	};

	const submitInlineTask = async () => {
		if (!organization || !selected || !canCreateEditTasks) return;
		const name = newTaskName.trim();
		if (!name) {
			showKronaError('Enter a task name.');
			return;
		}
		if (isDeadlineInPast(newTaskDeadline)) {
			showKronaError(DEADLINE_PAST_MESSAGE);
			return;
		}
		const { data: userRes } = await localData.auth.getUser();
		const user = userRes.user;
		if (!user) return;

		const assignees =
			newTaskAssigneeIds.length > 0 ? newTaskAssigneeIds : [null];

		setBusy(true);
		try {
			let created = 0;
			for (const assigneeId of assignees) {
				const id = await createTeamTask({
					organizationId: organization.id,
					name,
					assigneeUserId: assigneeId,
					projectId: selected.id,
					deadline: newTaskDeadline.trim() || null,
					estimatedHours: newTaskHours > 0 ? newTaskHours : null,
					createdBy: user.id,
				});
				if (!id) continue;
				created += 1;
			}
			if (!created) {
				showKronaError('Could not create task.');
				return;
			}
			showKronaSuccess(
				created === 1
					? 'Task created.'
					: `${created} tasks created (one per assignee).`,
			);
			resetNewTaskForm();
			await load();
		} finally {
			setBusy(false);
		}
	};

	const toggleTaskDone = async (task: TeamTaskRow) => {
		if (!organization) return;
		const { data: userRes } = await localData.auth.getUser();
		const user = userRes.user;
		if (!user) return;
		const next = task.status === 'done' ? 'pending' : 'done';
		const ok = await setTeamTaskStatus({
			organizationId: organization.id,
			taskId: task.id,
			name: task.name,
			actorUserId: user.id,
			nextStatus: next,
			estimatedHours: task.estimated_hours ?? null,
			createdAt: task.created_at,
		});
		if (!ok) {
			showKronaError('Could not update this task.');
			return;
		}
		await load();
	};

	const toggleTaskPriority = async (task: TeamTaskRow) => {
		if (!organization || task.status === 'done') return;
		const next = !task.prioritized;
		setTasks((rows) =>
			rows.map((row) =>
				row.id === task.id ? { ...row, prioritized: next } : row,
			),
		);
		const ok = await setTeamTaskPrioritized({
			organizationId: organization.id,
			taskId: task.id,
			name: task.name,
			prioritized: next,
			assigneeUserId: task.assignee_user_id,
		});
		if (!ok) {
			setTasks((rows) =>
				rows.map((row) =>
					row.id === task.id ? { ...row, prioritized: task.prioritized } : row,
				),
			);
			showKronaError('Could not update priority.');
			return;
		}
		if (next && task.assignee_user_id) {
			showKronaSuccess('Priority set. Assignee was notified.');
		}
	};

	const toggleProjectMember = (userId: string) => {
		setProjectMemberIds((prev) =>
			prev.includes(userId)
				? prev.filter((id) => id !== userId)
				: [...prev, userId],
		);
	};

	const toggleNewTaskAssignee = (userId: string) => {
		setNewTaskAssigneeIds((prev) =>
			prev.includes(userId)
				? prev.filter((id) => id !== userId)
				: [...prev, userId],
		);
	};

	const openEditTask = (task: TeamTaskRow) => {
		setEditingTask(task);
		setEditTaskName(task.name);
		setEditTaskDeadline(task.deadline?.slice(0, 10) ?? '');
		setEditTaskHours(task.estimated_hours ?? 0);
	};

	const closeEditTask = () => {
		setEditingTask(null);
		setEditTaskName('');
		setEditTaskDeadline('');
		setEditTaskHours(0);
	};

	const submitEditTask = async () => {
		if (!organization || !editingTask || !editTaskName.trim()) return;
		setBusy(true);
		try {
			const ok = await updateTeamTask({
				organizationId: organization.id,
				taskId: editingTask.id,
				name: editTaskName,
				deadline: editTaskDeadline.trim() || null,
				estimatedHours: editTaskHours > 0 ? editTaskHours : null,
			});
			if (!ok) {
				showKronaError('Could not update task.');
				return;
			}
			showKronaSuccess('Task updated.');
			closeEditTask();
			await load();
		} finally {
			setBusy(false);
		}
	};

	const openAssignTask = async (task: TeamTaskRow) => {
		setAssigningTask(task);
		setAssignTaskUserId(task.assignee_user_id);
	};

	const closeAssignTask = () => {
		setAssigningTask(null);
		setAssignTaskUserId(null);
	};

	const submitAssignTask = async () => {
		if (!organization || !assigningTask) return;
		setBusy(true);
		try {
			const nextAssignee = assignTaskUserId || null;
			if (nextAssignee !== assigningTask.assignee_user_id) {
				const ok = await updateTeamTask({
					organizationId: organization.id,
					taskId: assigningTask.id,
					assigneeUserId: nextAssignee,
				});
				if (!ok) {
					showKronaError('Could not assign this task.');
					return;
				}
			}
			showKronaSuccess(
				nextAssignee ? 'Task assigned.' : 'Task unassigned.',
			);
			closeAssignTask();
			await load();
		} finally {
			setBusy(false);
		}
	};

	const submitDeleteTask = async () => {
		if (!organization || !deletingTask) return;
		setBusy(true);
		try {
			const ok = await deleteTeamTask({
				organizationId: organization.id,
				taskId: deletingTask.id,
			});
			if (!ok) {
				showKronaError('Could not delete task.');
				return;
			}
			showKronaSuccess('Task deleted.');
			setDeletingTask(null);
			await load();
		} finally {
			setBusy(false);
		}
	};

	const submitDeleteProject = async () => {
		if (!organization || !deletingProject || !canCreateEditProjects) return;
		setBusy(true);
		try {
			const ok = await deleteTeamProject({
				organizationId: organization.id,
				projectId: deletingProject.id,
			});
			if (!ok) {
				showKronaError('Could not delete project.');
				return;
			}
			if (selectedId === deletingProject.id) {
				setSelectedId(null);
				setMobileDetails(false);
			}
			showKronaSuccess('Project deleted.');
			setDeletingProject(null);
			await load();
		} finally {
			setBusy(false);
		}
	};

	const selectProject = (id: string) => {
		setSelectedId(id);
		if (isMobileNav) setMobileDetails(true);
	};

	const listPane = (
		<>
			<Box sx={kronaSideListToolbarRowSx}>
				<Input
					size="sm"
					placeholder="Search projects"
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					startDecorator={<Search size={16} />}
					sx={{ ...kronaSearchInputSx, flex: 1 }}
				/>
				{canCreateEditProjects ? (
					<Tooltip title="New project">
						<IconButton
							size="sm"
							aria-label="New project"
							onClick={openProjectModal}
							sx={kronaPrimaryIconButtonSx}
						>
							<Plus size={16} />
						</IconButton>
					</Tooltip>
				) : null}
			</Box>
			{loading ? (
				<Typography
					level="body-sm"
					sx={{ color: 'var(--krona-text-muted)', px: 1 }}
				>
					Loading…
				</Typography>
			) : filtered.length === 0 ? (
				<DashboardWidgetEmpty icon={FolderKanban}>
					{canCreateEditProjects
						? 'Create a project to organize team work.'
						: 'No projects assigned to you yet.'}
				</DashboardWidgetEmpty>
			) : (
				<Box
					sx={{
						...kronaSideListScrollSx,
						display: 'flex',
						flexDirection: 'column',
						gap: 1,
					}}
				>
					{filtered.map((project) => {
						const active = project.id === selectedId;
						const daysLeft = daysLeftForDeadline(project.deadline);
						return (
							<Box
								key={project.id}
								role="button"
								tabIndex={0}
								onClick={() => selectProject(project.id)}
								onKeyDown={(event) => {
									if (event.key === 'Enter' || event.key === ' ') {
										event.preventDefault();
										selectProject(project.id);
									}
								}}
								sx={{
									display: 'flex',
									flexDirection: 'column',
									gap: 0.5,
									width: '100%',
									textAlign: 'left',
									cursor: 'pointer',
									px: 1,
									py: 0.5,
									border: 'none',
									borderRadius: '12px',
									bgcolor: active
										? 'var(--krona-overlay-hover)'
										: 'transparent',
									'&:hover': {
										bgcolor:
											'color-mix(in srgb, var(--krona-text) 5%, transparent)',
									},
								}}
							>
								<Box
									sx={{
										display: 'flex',
										alignItems: 'center',
										gap: 1.5,
										minWidth: 0,
									}}
								>
									<Folder size={20} color="var(--krona-text)" aria-hidden />
									<Typography
										level="body-md"
										sx={{
											flex: 1,
											minWidth: 0,
											color: 'var(--krona-text)',
											fontSize: '16px',
											fontWeight: 500,
											fontFamily: 'Poppins, sans-serif',
											overflow: 'hidden',
											textOverflow: 'ellipsis',
											whiteSpace: 'nowrap',
										}}
									>
										{project.name}
									</Typography>
									{canCreateEditProjects && !isTeamUndefinedProject(project) ? (
										<Box
											onClick={(event) => event.stopPropagation()}
											onKeyDown={(event) => event.stopPropagation()}
											sx={{ flexShrink: 0 }}
										>
											<Dropdown>
												<MenuButton
													slots={{ root: KronaMoreMenuButton }}
													slotProps={{
														root: {
															'aria-label': `Project actions for ${project.name}`,
														},
													}}
												/>
												<Menu placement="bottom-end" sx={kronaMenuSx}>
													<MenuItem
														onClick={() => openEditProjectModal(project)}
														sx={kronaMenuItemSx}
													>
														<Pencil size={15} />
														Edit project
													</MenuItem>
													<MenuItem
														onClick={() => setDeletingProject(project)}
														{...kronaDeleteMenuItemProps}
													>
														<Trash2 size={15} />
														Delete project
													</MenuItem>
												</Menu>
											</Dropdown>
										</Box>
									) : null}
								</Box>
								<Box
									sx={{
										display: 'flex',
										alignItems: 'center',
										gap: 1,
										ml: 4,
										minWidth: 0,
									}}
								>
									<Typography
										level="body-sm"
										sx={{
											color: 'var(--krona-text-64)',
											fontSize: 13,
											overflow: 'hidden',
											textOverflow: 'ellipsis',
											whiteSpace: 'nowrap',
										}}
									>
										{project.member_user_ids?.length
											? `${project.member_user_ids.length} assigned`
											: memberLabel(project.assignee_user_id, membersById)}
										{project.deadline
											? ` · Due ${new Date(project.deadline).toLocaleDateString()}`
											: ''}
									</Typography>
									{daysLeft != null ? (
										<Typography
											level="body-sm"
											sx={{
												color:
													daysLeft <= 3
														? '#f87171'
														: 'var(--krona-text-64)',
												fontSize: 13,
												flexShrink: 0,
											}}
										>
											• {daysLeft}d left
										</Typography>
									) : null}
								</Box>
							</Box>
						);
					})}
				</Box>
			)}
		</>
	);

	const detailPane = !selected ? (
		<Box sx={{ display: 'grid', placeItems: 'center', height: '100%', px: 2 }}>
			<Typography level="body-sm" sx={{ color: 'var(--krona-text-muted)' }}>
				Select a project to view tasks.
			</Typography>
		</Box>
	) : (
		<Box
			sx={{
				display: 'flex',
				flexDirection: 'column',
				minHeight: 0,
				height: '100%',
			}}
		>
			<Box
				sx={{
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: { xs: 'flex-start', md: 'center' },
					px: 1.5,
					gap: 2,
					flexWrap: 'wrap',
					flexShrink: 0,
					mb: 1.5,
				}}
			>
				{editingHeaderTitle ? (
					<Input
						placeholder={kronaPlaceholders.projects.headerTitle}
						slotProps={{ input: { ref: headerTitleInputRef } }}
						value={headerTitleDraft}
						onChange={(e) => setHeaderTitleDraft(e.target.value)}
						onBlur={() => {
							void commitHeaderTitleEdit();
						}}
						onKeyDown={(e) => {
							if (e.key === 'Enter') {
								e.preventDefault();
								void commitHeaderTitleEdit();
							}
							if (e.key === 'Escape') {
								e.preventDefault();
								setEditingHeaderTitle(false);
							}
						}}
						sx={{
							...kronaInputSx,
							flex: '1 1 auto',
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
							flex: '1 1 auto',
							minWidth: 0,
							overflow: 'hidden',
							textOverflow: 'ellipsis',
							whiteSpace: 'nowrap',
							cursor:
								canCreateEditProjects && !isTeamUndefinedProject(selected)
									? 'text'
									: 'default',
							borderRadius: '12px',
							px: 0.5,
							mx: -0.5,
							...(canCreateEditProjects && !isTeamUndefinedProject(selected)
								? {
										'&:hover': {
											bgcolor:
												'color-mix(in srgb, var(--krona-text) 6%, transparent)',
										},
									}
								: {}),
						}}
					>
						{selected.name}
					</Typography>
				)}
				<Box
					sx={{
						display: 'flex',
						alignItems: 'center',
						gap: 1,
						flexWrap: 'wrap',
						flexShrink: 0,
						ml: { xs: 0, md: 'auto' },
					}}
				>
					<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
						{projectAssignees.length > 0 ? (
							<Tooltip
								arrow
								placement="bottom-start"
								enterDelay={200}
								title={
									<Box
										sx={{
											display: 'flex',
											flexDirection: 'column',
											gap: 0.35,
											py: 0.15,
											textAlign: 'left',
										}}
									>
										{projectAssignees.map((m) => (
											<Box
												key={m.userId}
												component="span"
												sx={{
													display: 'block',
													fontSize: 12,
													fontWeight: 600,
													lineHeight: 1.35,
													color: 'var(--krona-text)',
												}}
											>
												{organizationMemberLabel(m)}
											</Box>
										))}
									</Box>
								}
							>
								<Box
									sx={{
										display: 'inline-flex',
										alignItems: 'center',
										gap: 0.5,
										cursor: 'default',
									}}
								>
									<UserRound size={14} color="var(--krona-text)" aria-hidden />
									<Typography
										level="body-sm"
										sx={{
											color: 'var(--krona-text)',
											fontSize: 13,
											fontWeight: 500,
											lineHeight: 1.35,
										}}
									>
										{`${projectAssignees.length} assigned`}
									</Typography>
								</Box>
							</Tooltip>
						) : (
							<>
								<UserRound size={14} color="var(--krona-text)" aria-hidden />
								<Typography
									level="body-sm"
									sx={{
										color: 'var(--krona-text)',
										fontSize: 13,
										fontWeight: 500,
										lineHeight: 1.35,
									}}
								>
									No one assigned
								</Typography>
							</>
						)}
					</Box>
					{selected.deadline ? (
						<>
							<ProjectMetaDot />
							<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
								<CalendarIcon
									size={14}
									aria-label="deadline"
									color="var(--krona-text)"
								/>
								<Typography
									level="body-sm"
									sx={{
										color: 'var(--krona-text)',
										fontSize: 13,
										fontWeight: 500,
										lineHeight: 1.35,
									}}
								>
									{new Date(selected.deadline).toLocaleDateString()}
									{(() => {
										const left = daysLeftForDeadline(selected.deadline);
										if (left == null) return null;
										return (
											<Box
												component="span"
												sx={{
													color: left <= 3 ? '#f87171' : 'inherit',
												}}
											>
												{' '}
												({left}d left)
											</Box>
										);
									})()}
								</Typography>
							</Box>
						</>
					) : null}
					<ProjectMetaDot />
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
							{pendingTasks.length} pending
						</Typography>
					</Box>
					<ProjectMetaDot />
					<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
						<CheckCircle2
							size={14}
							color={doneTasks.length > 0 ? '#4ade80' : 'var(--krona-text)'}
							aria-hidden
						/>
						<Typography
							level="body-sm"
							sx={{
								color:
									doneTasks.length > 0 ? '#4ade80' : 'var(--krona-text)',
								fontSize: 13,
								fontWeight: 500,
								lineHeight: 1.35,
							}}
						>
							{doneTasks.length} done
						</Typography>
					</Box>
				</Box>
			</Box>

			{canCreateEditTasks ? (
				<Box
					component="form"
					onSubmit={(e) => {
						e.preventDefault();
						void submitInlineTask();
					}}
					sx={{
						...kronaToolbarRowSx,
						mb: 1.5,
						px: 1.5,
						flexShrink: 0,
					}}
				>
					<Input
						placeholder={kronaPlaceholders.projects.taskName}
						value={newTaskName}
						onChange={(e) => setNewTaskName(e.target.value)}
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
							<Clock size={16} color="var(--krona-text-64)" aria-hidden />
						}
						value={newTaskHours || ''}
						onChange={(e) => setNewTaskHours(Number(e.target.value) || 0)}
						slotProps={{ input: { min: 0, step: 0.5 } }}
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
					<Dropdown
						open={assignMenuOpen}
						onOpenChange={(_, open) => setAssignMenuOpen(open)}
					>
						<Tooltip title="Assign teammates on this project">
							<MenuButton
								slots={{ root: IconButton }}
								slotProps={{
									root: {
										size: 'sm',
										'aria-label': 'Assign teammates',
										'aria-pressed': newTaskAssigneeIds.length > 0,
										sx: {
											...kronaToggleIconButtonSx(
												newTaskAssigneeIds.length > 0,
											),
											position: 'relative',
										},
									},
								}}
							>
								<Users size={16} />
								{newTaskAssigneeIds.length > 0 ? (
									<Box
										component="span"
										aria-hidden
										sx={{
											position: 'absolute',
											top: -4,
											right: -4,
											minWidth: 16,
											height: 16,
											px: 0.4,
											borderRadius: '999px',
											display: 'inline-flex',
											alignItems: 'center',
											justifyContent: 'center',
											fontSize: 9,
											fontWeight: 700,
											lineHeight: 1,
											color: '#fff',
											background: 'var(--krona-accent-gradient)',
											border: '1px solid rgba(255,255,255,0.25)',
										}}
									>
										{newTaskAssigneeIds.length}
									</Box>
								) : null}
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
							{projectAssignees.length === 0 ? (
								<MenuItem disabled sx={kronaMenuItemSx}>
									No teammates on this project
								</MenuItem>
							) : (
								projectAssignees.map((m) => {
									const checked = newTaskAssigneeIds.includes(m.userId);
									return (
										<MenuItem
											key={m.userId}
											sx={kronaMenuItemSx}
											onClick={(e) => {
												e.preventDefault();
												toggleNewTaskAssignee(m.userId);
											}}
										>
											<Checkbox
												size="sm"
												checked={checked}
												tabIndex={-1}
												sx={{ mr: 1, pointerEvents: 'none' }}
											/>
											{organizationMemberLabel(m)}
										</MenuItem>
									);
								})
							)}
						</Menu>
					</Dropdown>
					<Button
						type="submit"
						loading={busy}
						startDecorator={<Plus size={16} aria-hidden />}
						sx={kronaPrimaryButtonSx}
					>
						Add
					</Button>
				</Box>
			) : null}

			<Box
				sx={{
					flex: 1,
					minHeight: 0,
					overflowY: 'auto',
					px: 1.5,
					pb: 1,
				}}
			>
				{pendingTasks.length === 0 && doneTasks.length === 0 ? (
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
						<Sparkles size={32} aria-hidden style={{ opacity: 0.64 }} />
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
							{canCreateEditProjects
								? 'Add your first task to get started.'
								: 'Your manager assigns tasks to this project.'}
						</Typography>
					</Box>
				) : (
					<>
						{pendingTasks.length > 0 ? (
							<Box sx={{ mt: 0 }}>
								{pendingTasks.map((task) => {
										const left = daysLeftForDeadline(task.deadline);
										return (
											<Box
												key={task.id}
												className="krona-task-list-row"
												sx={{
													...kronaTaskListRowSx(),
													display: 'flex',
													alignItems: 'center',
													gap: 1,
													py: 1,
													minWidth: 0,
												}}
											>
												<KronaTaskCheckbox
													checked={false}
													onChange={() => {
														void toggleTaskDone(task);
													}}
												/>
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
													{editingTaskId === task.id ? (
														<Input
															placeholder={kronaPlaceholders.projects.editTask}
															slotProps={{
																input: { ref: taskNameInputRef },
															}}
															value={editingTaskText}
															onChange={(e) =>
																setEditingTaskText(e.target.value)
															}
															onBlur={(e) => {
																if (
																	Date.now() - taskEditOpenedAtRef.current <
																	200
																) {
																	return;
																}
																void commitTaskNameEdit(
																	task,
																	e.currentTarget.value,
																);
															}}
															onKeyDown={(e) => {
																if (e.key === 'Enter') {
																	e.preventDefault();
																	void commitTaskNameEdit(
																		task,
																		e.currentTarget.value,
																	);
																}
																if (e.key === 'Escape') {
																	e.preventDefault();
																	cancelTaskNameEdit();
																}
															}}
															size="sm"
															sx={{
																...kronaInputSx,
																minWidth: 0,
																width: '100%',
																color: 'var(--krona-text)',
																'& input': { color: 'var(--krona-text)' },
															}}
														/>
													) : (
														<Typography
															level="body-md"
															sx={{
																...kronaTaskListItemNameSx,
																cursor: canRenameTasks
																	? 'pointer'
																	: 'default',
															}}
															onClick={() => startTaskNameEdit(task)}
														>
															{task.name}
														</Typography>
													)}
													{isManager ? (
														<Typography
															level="body-sm"
															sx={{
																color: 'var(--krona-text-64)',
																fontSize: 13,
																lineHeight: 1.35,
															}}
														>
															{memberLabel(
																task.assignee_user_id,
																membersById,
															)}
															{task.deadline
																? ` · ${new Date(task.deadline).toLocaleDateString()}`
																: ''}
															{left != null ? ` · ${left}d left` : ''}
														</Typography>
													) : task.deadline || left != null ? (
														<Typography
															level="body-sm"
															sx={{
																color: 'var(--krona-text-64)',
																fontSize: 13,
																lineHeight: 1.35,
															}}
														>
															{task.deadline
																? new Date(
																		task.deadline,
																	).toLocaleDateString()
																: ''}
															{left != null
																? `${task.deadline ? ' · ' : ''}${left}d left`
																: ''}
														</Typography>
													) : null}
												</Box>
												<Box
													className="krona-task-row-actions"
													sx={kronaTaskRowActionsSx}
												>
													{isManager ? (
														<IconButton
															size="sm"
															variant="plain"
															className="krona-task-row-action krona-task-priority-star"
															aria-label={
																task.prioritized
																	? 'Remove priority'
																	: 'Mark as priority'
															}
															aria-pressed={Boolean(task.prioritized)}
															onClick={() => {
																void toggleTaskPriority(task);
															}}
															sx={kronaTaskPriorityStarButtonSx(
																Boolean(task.prioritized),
															)}
														>
															<KronaPriorityStar
																active={Boolean(task.prioritized)}
																size={16}
															/>
														</IconButton>
													) : null}
													<Dropdown>
														<MenuButton
															slots={{ root: KronaMoreMenuButton }}
															slotProps={{
																root: {
																	className: 'krona-task-row-action',
																	sx: kronaTaskRowMoreMenuButtonSx,
																	'aria-label': `Task actions for ${task.name}`,
																},
															}}
														/>
														<Menu placement="bottom-end" sx={kronaMenuSx}>
															<MenuItem
																sx={kronaMenuItemSx}
																onClick={() => openEditTask(task)}
															>
																<Pencil size={16} style={{ marginRight: 8 }} />
																Edit
															</MenuItem>
															<MenuItem
																sx={kronaMenuItemSx}
																onClick={() => {
																	void openAssignTask(task);
																}}
															>
																<UserPlus
																	size={16}
																	style={{ marginRight: 8 }}
																/>
																Assign
															</MenuItem>
															<MenuItem
																onClick={() => setDeletingTask(task)}
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
												</Box>
											</Box>
										);
									})}
								</Box>
						) : null}

						{doneTasks.length > 0 ? (
							<Box sx={{ mt: pendingTasks.length > 0 ? '10px' : 0 }}>
								<KronaListDivider label="Done" compact />
								<Box sx={{ mt: '10px' }}>
									{doneTasks.map((task) => (
										<Box
											key={task.id}
											className="krona-task-list-row"
											sx={{
												...kronaTaskListRowSx(),
												display: 'flex',
												alignItems: 'center',
												gap: 1,
												py: 1,
												minWidth: 0,
												opacity: 0.85,
											}}
										>
											<KronaTaskCheckbox
												checked
												onChange={() => {
													void toggleTaskDone(task);
												}}
											/>
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
												{editingTaskId === task.id ? (
													<Input
														placeholder={kronaPlaceholders.projects.editTask}
														slotProps={{
															input: { ref: taskNameInputRef },
														}}
														value={editingTaskText}
														onChange={(e) =>
															setEditingTaskText(e.target.value)
														}
														onBlur={(e) => {
															if (
																Date.now() - taskEditOpenedAtRef.current <
																200
															) {
																return;
															}
															void commitTaskNameEdit(
																task,
																e.currentTarget.value,
															);
														}}
														onKeyDown={(e) => {
															if (e.key === 'Enter') {
																e.preventDefault();
																void commitTaskNameEdit(
																	task,
																	e.currentTarget.value,
																);
															}
															if (e.key === 'Escape') {
																e.preventDefault();
																cancelTaskNameEdit();
															}
														}}
														size="sm"
														sx={{
															...kronaInputSx,
															minWidth: 0,
															width: '100%',
															color: 'var(--krona-text)',
															'& input': { color: 'var(--krona-text)' },
														}}
													/>
												) : (
													<Typography
														level="body-md"
														sx={{
															...kronaTaskListItemNameSx,
															textDecoration: 'line-through',
															cursor: canRenameTasks
																? 'pointer'
																: 'default',
														}}
														onClick={() => startTaskNameEdit(task)}
													>
														{task.name}
													</Typography>
												)}
												{isManager ? (
													<Typography
														level="body-sm"
														sx={{
															color: 'var(--krona-text-64)',
															fontSize: 13,
															lineHeight: 1.35,
														}}
													>
														{memberLabel(
															task.assignee_user_id,
															membersById,
														)}
													</Typography>
												) : null}
											</Box>
											<Box
												className="krona-task-row-actions"
												sx={kronaTaskRowActionsSx}
											>
												<Dropdown>
													<MenuButton
														slots={{ root: KronaMoreMenuButton }}
														slotProps={{
															root: {
																className: 'krona-task-row-action',
																sx: kronaTaskRowMoreMenuButtonSx,
																'aria-label': `Task actions for ${task.name}`,
															},
														}}
													/>
													<Menu placement="bottom-end" sx={kronaMenuSx}>
														<MenuItem
															sx={kronaMenuItemSx}
															onClick={() => openEditTask(task)}
														>
															<Pencil size={16} style={{ marginRight: 8 }} />
															Edit
														</MenuItem>
														<MenuItem
															sx={kronaMenuItemSx}
															onClick={() => {
																void openAssignTask(task);
															}}
														>
															<UserPlus
																size={16}
																style={{ marginRight: 8 }}
															/>
															Assign
														</MenuItem>
														<MenuItem
															onClick={() => setDeletingTask(task)}
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
											</Box>
										</Box>
									))}
								</Box>
							</Box>
						) : null}
					</>
				)}
			</Box>
		</Box>
	);

	return (
		<TeamAppShell
			title="Team Projects"
			fillViewport
			onBack={
				isMobileNav && mobileDetails
					? () => setMobileDetails(false)
					: undefined
			}
			backAriaLabel="Back to projects"
		>
			<KronaResizableSplitLayout
				dividerAriaLabel="Resize projects list and details"
				containerSx={{
					flex: 1,
					minHeight: 0,
					overflow: 'hidden',
				}}
				sidebarDisplay={{
					xs: mobileDetails ? 'none' : 'flex',
					md: 'flex',
				}}
				detailDisplay={{
					xs: mobileDetails ? 'flex' : 'none',
					md: 'flex',
				}}
				sidebarSx={{
					gap: 0,
					pt: { xs: 1, md: 0 },
					pb: { xs: 1, md: 0 },
				}}
				detailSx={{
					gap: 0,
					pt: { xs: 1, md: 0 },
					pb: { xs: 1, md: 0 },
				}}
				sidebar={listPane}
				detail={detailPane}
			/>

			<Modal open={projectModalOpen} onClose={closeProjectModal}>
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
						onClick={closeProjectModal}
						sx={kronaModalCloseButtonSx}
					>
						<X size={18} />
					</IconButton>
					<Typography level="h4" sx={kronaModalTitleSx}>
						{editingProjectId ? 'Edit project' : 'New project'}
					</Typography>
					<Box
						component="form"
						sx={kronaModalFormSx}
						onSubmit={(e) => {
							e.preventDefault();
							void submitProject();
						}}
					>
						<Box sx={kronaModalFieldsSx}>
							<FormControl required>
								<FormLabel sx={{ color: 'var(--krona-text)' }}>
									Project name
								</FormLabel>
								<Input
									autoFocus
									value={projectName}
									onChange={(e) => setProjectName(e.target.value)}
									placeholder="Q3 onboarding"
									sx={kronaInputSx}
								/>
							</FormControl>
							<FormControl>
								<FormLabel sx={{ color: 'var(--krona-text)' }}>Assign to</FormLabel>
								<Typography
									level="body-xs"
									sx={{ color: 'var(--krona-text-muted)', mb: 1 }}
								>
									Choose onboarded employees to include on this project.
								</Typography>
								<Dropdown
									open={projectAssignMenuOpen}
									onOpenChange={(_, open) => setProjectAssignMenuOpen(open)}
								>
									<MenuButton
										sx={{
											...kronaDropdownControlSx,
											width: '100%',
											display: 'flex',
											alignItems: 'center',
											justifyContent: 'space-between',
											gap: 1,
											textAlign: 'left',
											fontWeight: 400,
										}}
									>
										<Typography
											level="body-sm"
											sx={{
												color:
													projectMemberIds.length > 0
														? 'var(--krona-text)'
														: 'var(--krona-text-64)',
												overflow: 'hidden',
												textOverflow: 'ellipsis',
												whiteSpace: 'nowrap',
											}}
										>
											{projectMemberIds.length === 0
												? 'Select teammates'
												: projectMemberIds.length === 1
													? organizationMemberLabel(
															membersById.get(projectMemberIds[0]),
														)
													: `${projectMemberIds.length} teammates`}
										</Typography>
										<ChevronDown size={16} aria-hidden />
									</MenuButton>
									<Menu
										placement="bottom-start"
										sx={{
											...kronaMenuSx,
											zIndex: 2000,
											minWidth: 'min(100%, 320px)',
											maxHeight: 280,
											overflowY: 'auto',
										}}
									>
										{projectAssigneeOptions.length === 0 ? (
											<MenuItem disabled sx={kronaMenuItemSx}>
											No onboarded teammates yet
											</MenuItem>
										) : (
											projectAssigneeOptions.map((m) => {
												const checked = projectMemberIds.includes(m.userId);
												return (
													<MenuItem
														key={m.userId}
														sx={kronaMenuItemSx}
														onClick={(e) => {
															e.preventDefault();
															toggleProjectMember(m.userId);
														}}
													>
														<Checkbox
															size="sm"
															checked={checked}
															tabIndex={-1}
															sx={{ mr: 1, pointerEvents: 'none' }}
														/>
														{organizationMemberLabel(m)}
													</MenuItem>
												);
											})
										)}
									</Menu>
								</Dropdown>
							</FormControl>
							<FormControl>
								<FormLabel sx={{ color: 'var(--krona-text)' }}>
									Deadline
								</FormLabel>
								<KronaDatePickerButton
									value={projectDeadline}
									onChange={(value) => {
										setProjectDeadline(value);
										if (!value) setProjectAddToReminders(false);
									}}
									placeholder="Optional deadline"
									width="100%"
									disablePast
								/>
							</FormControl>
							<Box
								component="button"
								type="button"
								disabled={!projectDeadline.trim() || !canCreateEditReminders}
								onClick={() => {
									if (!projectDeadline.trim() || !canCreateEditReminders) {
										return;
									}
									setProjectAddToReminders((prev) => !prev);
								}}
								sx={{
									display: 'flex',
									alignItems: 'center',
									gap: 1,
									textAlign: 'left',
									border: 'none',
									background: 'transparent',
									p: 0,
									cursor:
										projectDeadline.trim() && canCreateEditReminders
											? 'pointer'
											: 'default',
									opacity:
										projectDeadline.trim() && canCreateEditReminders
											? 1
											: 0.5,
									color: 'var(--krona-text)',
								}}
							>
								<Checkbox
									size="sm"
									checked={projectAddToReminders}
									disabled={!projectDeadline.trim() || !canCreateEditReminders}
									tabIndex={-1}
									sx={{ pointerEvents: 'none' }}
								/>
								<Typography level="body-sm" sx={{ color: 'var(--krona-text)' }}>
									Add this deadline to reminders
								</Typography>
							</Box>
						</Box>
						<Button
							type="submit"
							fullWidth
							loading={busy}
							disabled={!projectName.trim()}
							sx={{ ...kronaPrimaryButtonSx, ...kronaModalPrimaryActionSx }}
						>
							{editingProjectId ? 'Save changes' : 'Create project'}
						</Button>
					</Box>
				</ModalDialog>
			</Modal>

			<Modal open={Boolean(editingTask)} onClose={closeEditTask}>
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
						onClick={closeEditTask}
						sx={kronaModalCloseButtonSx}
					>
						<X size={18} />
					</IconButton>
					<Typography level="h4" sx={kronaModalTitleSx}>
						Edit task
					</Typography>
					<Box
						component="form"
						sx={kronaModalFormSx}
						onSubmit={(e) => {
							e.preventDefault();
							void submitEditTask();
						}}
					>
						<Box sx={kronaModalFieldsSx}>
							<FormControl required>
								<FormLabel sx={{ color: 'var(--krona-text)' }}>
									Task name
								</FormLabel>
								<Input
									autoFocus
									value={editTaskName}
									onChange={(e) => setEditTaskName(e.target.value)}
									sx={kronaInputSx}
								/>
							</FormControl>
							<FormControl>
								<FormLabel sx={{ color: 'var(--krona-text)' }}>Hours</FormLabel>
								<Input
									type="number"
									startDecorator={
										<Clock size={16} color="var(--krona-text-64)" aria-hidden />
									}
									value={editTaskHours || ''}
									onChange={(e) =>
										setEditTaskHours(Number(e.target.value) || 0)
									}
									slotProps={{ input: { min: 0, step: 0.5 } }}
									sx={kronaInputSx}
								/>
							</FormControl>
							<FormControl>
								<FormLabel sx={{ color: 'var(--krona-text)' }}>
									Deadline
								</FormLabel>
								<KronaDatePickerButton
									value={editTaskDeadline}
									onChange={setEditTaskDeadline}
									placeholder="Optional deadline"
									width="100%"
									disablePast
								/>
							</FormControl>
						</Box>
						<Button
							type="submit"
							fullWidth
							loading={busy}
							disabled={!editTaskName.trim()}
							sx={{ ...kronaPrimaryButtonSx, ...kronaModalPrimaryActionSx }}
						>
							Save changes
						</Button>
					</Box>
				</ModalDialog>
			</Modal>

			<Modal open={Boolean(assigningTask)} onClose={closeAssignTask}>
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
						onClick={closeAssignTask}
						sx={kronaModalCloseButtonSx}
					>
						<X size={18} />
					</IconButton>
					<Typography level="h4" sx={kronaModalTitleSx}>
						Assign task
					</Typography>
					<Box
						component="form"
						sx={kronaModalFormSx}
						onSubmit={(e) => {
							e.preventDefault();
							void submitAssignTask();
						}}
					>
						<Box sx={kronaModalFieldsSx}>
							<FormControl>
								<FormLabel sx={{ color: 'var(--krona-text)' }}>
									Assignee
								</FormLabel>
								<Select
									placeholder="Select a teammate"
									value={assignTaskUserId ?? ''}
									onChange={(_, v) => {
										const next =
											v && String(v).length ? String(v) : null;
										setAssignTaskUserId(next);
									}}
									sx={kronaDropdownControlSx}
									slotProps={kronaSelectSlotProps}
								>
									<Option value="" label="Unassigned" sx={kronaMenuItemSx}>
										Unassigned
									</Option>
									{(projectAssignees.length > 0
										? projectAssignees
										: onboardedTeammates
									).map((m) => {
										const label = organizationMemberLabel(m);
										return (
											<Option
												key={m.userId}
												value={m.userId}
												label={label}
												sx={kronaMenuItemSx}
											>
												{label}
											</Option>
										);
									})}
								</Select>
							</FormControl>
						</Box>
						<Button
							type="submit"
							fullWidth
							loading={busy}
							sx={{ ...kronaPrimaryButtonSx, ...kronaModalPrimaryActionSx }}
						>
							Save assignment
						</Button>
					</Box>
				</ModalDialog>
			</Modal>

			<Modal
				open={Boolean(deletingTask)}
				onClose={() => setDeletingTask(null)}
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
						onClick={() => setDeletingTask(null)}
						sx={kronaModalCloseButtonSx}
					>
						<X size={18} />
					</IconButton>
					<Typography level="h4" sx={kronaModalTitleSx}>
						Delete task?
					</Typography>
					<Typography
						level="body-sm"
						sx={{ color: 'var(--krona-text-muted)', mb: 2 }}
					>
						{deletingTask
							? `“${deletingTask.name}” will be removed from this project.`
							: ''}
					</Typography>
					<Button
						fullWidth
						loading={busy}
						onClick={() => void submitDeleteTask()}
						sx={{
							...kronaPrimaryButtonSx,
							...kronaModalPrimaryActionSx,
							background: '#ef4444',
							'&:hover': { background: '#dc2626' },
						}}
					>
						Delete
					</Button>
				</ModalDialog>
			</Modal>

			<Modal
				open={Boolean(deletingProject)}
				onClose={() => setDeletingProject(null)}
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
						onClick={() => setDeletingProject(null)}
						sx={kronaModalCloseButtonSx}
					>
						<X size={18} />
					</IconButton>
					<Typography level="h4" sx={kronaModalTitleSx}>
						Delete project?
					</Typography>
					<Typography
						level="body-sm"
						sx={{ color: 'var(--krona-text-muted)', mb: 2 }}
					>
						{deletingProject
							? isTeamUndefinedProject(deletingProject)
								? 'Deleting “Undefined” will permanently remove every ungrouped task.'
								: `“${deletingProject.name}” and its tasks will be permanently removed.`
							: ''}
					</Typography>
					<Button
						fullWidth
						loading={busy}
						onClick={() => void submitDeleteProject()}
						sx={{
							...kronaPrimaryButtonSx,
							...kronaModalPrimaryActionSx,
							background: '#ef4444',
							'&:hover': { background: '#dc2626' },
						}}
					>
						Delete
					</Button>
				</ModalDialog>
			</Modal>
		</TeamAppShell>
	);
}
