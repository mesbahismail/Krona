'use client';

import * as React from 'react';
import NextLink from 'next/link';
import {
	Box,
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
	Button,
} from '@mui/joy';
import { FolderKanban, ListTodo, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import DashboardWidgetEmpty from '@/components/dashboard/DashboardWidgetEmpty';
import KronaDatePickerButton from '@/components/krona/KronaDatePickerButton';
import KronaListDivider from '@/components/krona/KronaListDivider';
import KronaMoreMenuButton from '@/components/krona/KronaMoreMenuButton';
import KronaPriorityStar from '@/components/krona/KronaPriorityStar';
import KronaTaskCheckbox from '@/components/krona/KronaTaskCheckbox';
import {
	DEADLINE_PAST_MESSAGE,
	isDeadlineInPast,
	localDateKey,
} from '@/lib/localDate';
import { showKronaError } from '@/lib/kronaToast';
import {
	TeamWidgetHeader,
	TeamWidgetShell,
} from '@/components/teams/TeamWidgetChrome';
import { useKronaLayoutMode } from '@/components/KronaLayoutModeProvider';
import TeamNewProjectModal, {
	type TeamNewProjectInput,
} from '@/components/teams/TeamNewProjectModal';
import type { TeamProjectOption, TeamTaskRow } from '@/lib/teams/dashboard';
import type { OrganizationMember } from '@/lib/teams/types';
import { organizationMemberLabel } from '@/lib/teams/org';
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
	kronaSelectSlotProps,
	kronaTaskPriorityStarButtonSx,
	kronaTaskRowActionsSx,
	kronaTaskRowMoreMenuButtonSx,
	kronaWidgetListItemSx,
} from '@/lib/kronaStyles';

function deadlineToDateKey(iso: string | null | undefined): string {
	if (!iso) return '';
	const raw = iso.trim();
	if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
	const parsed = new Date(raw);
	if (Number.isNaN(parsed.getTime())) return '';
	return localDateKey(parsed);
}

function nameFor(
	userId: string | null,
	membersById: Map<string, OrganizationMember>,
) {
	if (!userId) return 'Unassigned';
	return organizationMemberLabel(membersById.get(userId));
}

export type AssignTeamTaskInput = {
	name: string;
	assigneeUserId: string;
	projectId: string | null;
	deadline: string | null;
};

export default function TeamAssignedTasksWidget({
	tasks,
	members,
	projects = [],
	loading,
	busy,
	canCreateProjects = false,
	canCreateEditReminders = false,
	onCreate,
	onCreateProject,
	onUpdate,
	onDelete,
	onToggleDone,
	onTogglePriority,
}: {
	tasks: TeamTaskRow[];
	members: OrganizationMember[];
	projects?: TeamProjectOption[];
	loading?: boolean;
	busy?: boolean;
	canCreateProjects?: boolean;
	canCreateEditReminders?: boolean;
	onCreate?: (input: AssignTeamTaskInput) => Promise<void> | void;
	onCreateProject?: (
		input: TeamNewProjectInput,
	) => Promise<TeamProjectOption | null>;
	onUpdate?: (
		task: TeamTaskRow,
		input: AssignTeamTaskInput,
	) => Promise<void> | void;
	onDelete?: (task: TeamTaskRow) => Promise<void> | void;
	onToggleDone: (task: TeamTaskRow) => Promise<void> | void;
	onTogglePriority?: (task: TeamTaskRow) => Promise<void> | void;
}) {
	const { isDesktopDashboard } = useKronaLayoutMode();
	const [addOpen, setAddOpen] = React.useState(false);
	const [editingTask, setEditingTask] = React.useState<TeamTaskRow | null>(null);
	const [name, setName] = React.useState('');
	const [projectId, setProjectId] = React.useState<string | null>(null);
	const [assigneeId, setAssigneeId] = React.useState<string | null>(null);
	const [deadline, setDeadline] = React.useState('');
	const [newProjectOpen, setNewProjectOpen] = React.useState(false);
	const [createdProjects, setCreatedProjects] = React.useState<
		TeamProjectOption[]
	>([]);
	const [search, setSearch] = React.useState('');
	const canManage = Boolean(onCreate || onUpdate || onDelete);
	const showNewProjectLink = Boolean(canCreateProjects && onCreateProject);
	const projectOptions = React.useMemo(() => {
		const byId = new Map(projects.map((project) => [project.id, project]));
		for (const extra of createdProjects) {
			if (!byId.has(extra.id)) byId.set(extra.id, extra);
		}
		return Array.from(byId.values());
	}, [createdProjects, projects]);

	const membersById = React.useMemo(
		() => new Map(members.map((m) => [m.userId, m] as const)),
		[members],
	);

	const visibleTasks = React.useMemo(() => {
		const query = search.trim().toLowerCase();
		const filtered = !query
			? tasks
			: tasks.filter((task) => {
					const assignee = nameFor(task.assignee_user_id, membersById);
					return (
						task.name.toLowerCase().includes(query) ||
						assignee.toLowerCase().includes(query)
					);
				});
		return [...filtered].sort(
			(a, b) => Number(Boolean(b.prioritized)) - Number(Boolean(a.prioritized)),
		);
	}, [membersById, search, tasks]);

	const pendingTasks = React.useMemo(
		() => visibleTasks.filter((task) => task.status !== 'done'),
		[visibleTasks],
	);
	const doneTasks = React.useMemo(
		() => visibleTasks.filter((task) => task.status === 'done'),
		[visibleTasks],
	);

	const closeAdd = () => {
		if (newProjectOpen) return;
		setAddOpen(false);
		setEditingTask(null);
		setName('');
		setProjectId(null);
		setAssigneeId(null);
		setDeadline('');
		setNewProjectOpen(false);
	};

	const openEdit = (task: TeamTaskRow) => {
		setEditingTask(task);
		setName(task.name);
		setProjectId(task.project_id ?? null);
		setAssigneeId(task.assignee_user_id);
		setDeadline(deadlineToDateKey(task.deadline));
		setAddOpen(true);
	};

	const canSubmit = Boolean(name.trim() && assigneeId);

	const submit = async () => {
		if (!name.trim() || !assigneeId) return;
		if (!editingTask && isDeadlineInPast(deadline)) {
			showKronaError(DEADLINE_PAST_MESSAGE);
			return;
		}
		const payload: AssignTeamTaskInput = {
			name: name.trim(),
			assigneeUserId: assigneeId,
			projectId,
			deadline: deadline.trim() || null,
		};
		if (editingTask) {
			if (!onUpdate) return;
			await onUpdate(editingTask, payload);
		} else {
			if (!onCreate) return;
			await onCreate(payload);
		}
		closeAdd();
	};

	const renderTask = (task: TeamTaskRow) => (
		<Box
			key={task.id}
			sx={{
				...kronaWidgetListItemSx,
				p: 1.5,
				display: 'flex',
				alignItems: 'center',
				gap: 1.25,
			}}
		>
			<KronaTaskCheckbox
				checked={task.status === 'done'}
				onChange={() => void onToggleDone(task)}
			/>
			<Box
				component={NextLink}
				href={
					task.project_id
						? `/team/projects?project=${task.project_id}`
						: '/team/projects'
				}
				sx={{
					color: 'inherit',
					textDecoration: 'none',
					minWidth: 0,
					flex: 1,
				}}
			>
				<Typography
					level="body-sm"
					sx={{
						color: 'var(--krona-text)',
						fontWeight: 600,
						overflow: 'hidden',
						textOverflow: 'ellipsis',
						whiteSpace: 'nowrap',
						...(task.status === 'done'
							? { textDecoration: 'line-through', opacity: 0.72 }
							: null),
					}}
				>
					{task.name}
				</Typography>
			</Box>
			<Box className="krona-task-row-actions" sx={kronaTaskRowActionsSx}>
				{onTogglePriority && task.status !== 'done' ? (
					<IconButton
						size="sm"
						variant="plain"
						className="krona-task-row-action krona-task-priority-star"
						aria-label={
							task.prioritized ? 'Remove priority' : 'Mark as priority'
						}
						aria-pressed={Boolean(task.prioritized)}
						onClick={() => void onTogglePriority(task)}
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
				) : onTogglePriority ? (
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
				) : null}
				{task.project_id || canManage ? (
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
							{task.project_id ? (
								<MenuItem
									component={NextLink}
									href={`/team/projects?project=${task.project_id}`}
									sx={kronaMenuItemSx}
								>
									<FolderKanban size={16} style={{ marginRight: 8 }} />
									View in project
								</MenuItem>
							) : null}
							{canManage && onUpdate ? (
								<MenuItem
									sx={kronaMenuItemSx}
									onClick={() => openEdit(task)}
								>
									<Pencil size={16} style={{ marginRight: 8 }} />
									Edit
								</MenuItem>
							) : null}
							{canManage && onDelete ? (
								<MenuItem
									onClick={() => void onDelete(task)}
									{...kronaDeleteMenuItemProps}
								>
									<Trash2 size={16} style={{ marginRight: 8 }} />
									Delete
								</MenuItem>
							) : null}
						</Menu>
					</Dropdown>
				) : null}
			</Box>
		</Box>
	);

	return (
		<>
			<TeamWidgetShell
				sx={{
					height: isDesktopDashboard ? '100%' : 'auto',
					minHeight: isDesktopDashboard ? 0 : 280,
				}}
			>
				<TeamWidgetHeader
					title="Team tasks"
					href="/team/projects"
					navHint="All projects"
					actions={
						onCreate ? (
							<Tooltip title="Assign task">
								<IconButton
									size="sm"
									aria-label="Assign task"
									onClick={() => setAddOpen(true)}
									sx={kronaPrimaryIconButtonSx}
								>
									<Plus size={16} />
								</IconButton>
							</Tooltip>
						) : null
					}
				/>

				<Input
					size="sm"
					startDecorator={<Search size={15} aria-hidden />}
					placeholder="Search team tasks or assignees"
					value={search}
					onChange={(event) => setSearch(event.target.value)}
					slotProps={{ input: { 'aria-label': 'Search team tasks' } }}
					sx={{ ...kronaSearchInputSx, mb: '20px', flexShrink: 0 }}
				/>

				{loading && tasks.length === 0 ? (
					<Typography level="body-sm" sx={{ color: 'var(--krona-text-muted)' }}>
						Loading…
					</Typography>
				) : tasks.length === 0 ? (
					<DashboardWidgetEmpty icon={ListTodo}>
						No team tasks yet.
					</DashboardWidgetEmpty>
				) : visibleTasks.length === 0 ? (
					<DashboardWidgetEmpty icon={Search}>
						No team tasks match your search.
					</DashboardWidgetEmpty>
				) : (
					<Box
						sx={{
							display: 'flex',
							flexDirection: 'column',
							gap: 1,
							overflowY: 'auto',
							flex: 1,
							minHeight: 0,
						}}
					>
						{pendingTasks.map(renderTask)}
						{doneTasks.length > 0 ? (
							<KronaListDivider label="Done" compact />
						) : null}
						{doneTasks.map(renderTask)}
					</Box>
				)}
			</TeamWidgetShell>

			<Modal
				open={addOpen}
				onClose={closeAdd}
				disableEnforceFocus={newProjectOpen}
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
						onClick={closeAdd}
						sx={kronaModalCloseButtonSx}
					>
						<X size={18} />
					</IconButton>
					<Typography level="h4" sx={kronaModalTitleSx}>
						{editingTask ? 'Edit task' : 'Assign task'}
					</Typography>
					<Box
						component="form"
						sx={kronaModalFormSx}
						onSubmit={(e) => {
							e.preventDefault();
							void submit();
						}}
					>
						<Box sx={kronaModalFieldsSx}>
							<FormControl required>
								<FormLabel sx={{ color: 'var(--krona-text)' }}>
									Task name
								</FormLabel>
								<Input
									autoFocus
									value={name}
									onChange={(e) => setName(e.target.value)}
									placeholder="Ship onboarding docs"
									sx={kronaInputSx}
								/>
							</FormControl>
							<FormControl>
								<Box
									sx={{
										display: 'flex',
										alignItems: 'baseline',
										justifyContent: 'space-between',
										gap: 1,
										mb: 0.75,
									}}
								>
									<FormLabel sx={{ color: 'var(--krona-text)', mb: 0 }}>
										Project
									</FormLabel>
									{showNewProjectLink ? (
										<Typography
											component="button"
											type="button"
											aria-label="Create new project"
											onClick={() => setNewProjectOpen(true)}
											sx={{
												border: 'none',
												background: 'none',
												p: 0,
												m: 0,
												cursor: 'pointer',
												color: 'var(--krona-accent)',
												fontWeight: 600,
												fontSize: 13,
												lineHeight: 1.2,
												'&:hover': { textDecoration: 'underline' },
											}}
										>
											+ new project
										</Typography>
									) : null}
								</Box>
								<Select
									placeholder="No project"
									value={projectId ?? ''}
									onChange={(_, v) =>
										setProjectId(v && String(v).length ? String(v) : null)
									}
									sx={kronaDropdownControlSx}
									slotProps={kronaSelectSlotProps}
								>
									<Option value="" sx={kronaMenuItemSx}>
										No project
									</Option>
									{projectOptions.map((project) => (
										<Option
											key={project.id}
											value={project.id}
											sx={kronaMenuItemSx}
										>
											{project.name}
										</Option>
									))}
								</Select>
							</FormControl>
							<FormControl required>
								<FormLabel sx={{ color: 'var(--krona-text)' }}>
									Assignee
								</FormLabel>
								<Select
									placeholder="Select a teammate"
									value={assigneeId ?? ''}
									onChange={(_, v) =>
										setAssigneeId(v && String(v).length ? String(v) : null)
									}
									sx={kronaDropdownControlSx}
									slotProps={kronaSelectSlotProps}
								>
									{members.map((m) => {
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
							<FormControl>
								<FormLabel sx={{ color: 'var(--krona-text)' }}>
									Deadline
								</FormLabel>
								<KronaDatePickerButton
									value={deadline}
									onChange={setDeadline}
									placeholder="Optional deadline"
									width="100%"
									disablePast
								/>
							</FormControl>
							{deadline.trim() && !editingTask ? (
								<Typography
									level="body-xs"
									sx={{ color: 'var(--krona-text-muted)' }}
								>
									Deadline is added to the assignee’s reminders automatically.
								</Typography>
							) : null}
						</Box>
						<Button
							type="submit"
							fullWidth
							loading={busy}
							disabled={!canSubmit}
							sx={{ ...kronaPrimaryButtonSx, ...kronaModalPrimaryActionSx }}
						>
							{editingTask ? 'Save changes' : 'Assign & notify'}
						</Button>
					</Box>
				</ModalDialog>
			</Modal>
			{showNewProjectLink ? (
				<TeamNewProjectModal
					open={newProjectOpen}
					onClose={() => setNewProjectOpen(false)}
					members={members}
					busy={busy}
					canCreateEditReminders={canCreateEditReminders}
					defaultMemberIds={assigneeId ? [assigneeId] : []}
					onSubmit={async (input) => {
						if (!onCreateProject) return false;
						const created = await onCreateProject(input);
						if (!created) return false;
						setCreatedProjects((prev) =>
							prev.some((project) => project.id === created.id)
								? prev
								: [created, ...prev],
						);
						setProjectId(created.id);
						return true;
					}}
				/>
			) : null}
		</>
	);
}
