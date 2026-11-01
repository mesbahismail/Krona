'use client';

import * as React from 'react';
import dayjs from 'dayjs';
import {
	Avatar,
	Box,
	Button,
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
import Link from 'next/link';
import {
	ArrowDown,
	ArrowUp,
	BarChart3,
	CalendarDays,
	Check,
	CircleHelp,
	MoreHorizontal,
	Pencil,
	Plus,
	Trash2,
	X,
} from 'lucide-react';
import KronaDatePickerButton from '@/components/krona/KronaDatePickerButton';
import KronaListDivider from '@/components/krona/KronaListDivider';
import KronaMoreMenuButton from '@/components/krona/KronaMoreMenuButton';
import KronaPriorityStar from '@/components/krona/KronaPriorityStar';
import KronaTaskCheckbox from '@/components/krona/KronaTaskCheckbox';
import TaskWorkMeta from '@/components/tasks/TaskWorkMeta';
import TeamMemberAccessPanel from '@/components/teams/TeamMemberAccessPanel';
import TeamMemberActivityBadge from '@/components/teams/TeamMemberActivityBadge';
import type { AssignTeamTaskInput } from '@/components/teams/TeamAssignedTasksWidget';
import TeamNewProjectModal, {
	type TeamNewProjectInput,
} from '@/components/teams/TeamNewProjectModal';
import { defaultAvatarUrl } from '@/lib/defaultAvatar';
import type {
	MemberInsights,
	TeamProjectOption,
	TeamTaskRow,
} from '@/lib/teams/dashboard';
import type { WorkTrendDirection } from '@/lib/performanceMetrics';
import type { OrganizationMember } from '@/lib/teams/types';
import type { TeamEmployeePermissions } from '@/lib/teams/employeePermissions';
import { organizationMemberLabel } from '@/lib/teams/org';
import {
	DEADLINE_PAST_MESSAGE,
	isDeadlineInPast,
	localDateKey,
} from '@/lib/localDate';
import { showKronaError } from '@/lib/kronaToast';
import {
	kronaDeleteButtonSx,
	kronaDeleteMenuItemProps,
	kronaDropdownControlSx,
	kronaInputSx,
	kronaMenuItemSx,
	kronaMenuSx,
	KRONA_MODAL_FIELD_GAP,
	kronaModalCloseButtonSx,
	kronaModalDialogSx,
	kronaModalFieldsSx,
	kronaModalPrimaryActionSx,
	kronaModalTitleSx,
	kronaPrimaryButtonSx,
	kronaSecondaryButtonSx,
	kronaSecondaryIconButtonSx,
	kronaSelectSlotProps,
	kronaTaskPriorityStarButtonSx,
	kronaTaskRowActionsSx,
	kronaTaskRowMoreMenuButtonSx,
	kronaWidgetCardSx,
} from '@/lib/kronaStyles';

function deadlineToDateKey(iso: string | null | undefined): string {
	if (!iso) return '';
	const raw = iso.trim();
	if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
	const parsed = new Date(raw);
	if (Number.isNaN(parsed.getTime())) return '';
	return localDateKey(parsed);
}

export type MemberEditInput = {
	displayName: string;
	email: string;
	jobTitle: string;
	role: 'manager' | 'member';
	joinedDate: string;
	hourlyRate: string;
	birthday: string;
	dailyChallengeHours: string;
	accessPermissions: TeamEmployeePermissions;
};

type Props = {
	member: OrganizationMember;
	insights: MemberInsights | null;
	loading?: boolean;
	projects: TeamProjectOption[];
	members?: OrganizationMember[];
	canAssignTask: boolean;
	canViewPerformance?: boolean;
	canCreateProjects?: boolean;
	canCreateEditReminders?: boolean;
	canManageMember: boolean;
	busy?: boolean;
	onAssignTask: (input: AssignTeamTaskInput) => Promise<boolean>;
	onCreateProject?: (
		input: TeamNewProjectInput,
	) => Promise<TeamProjectOption | null>;
	onUpdateTask?: (
		task: TeamTaskRow,
		input: AssignTeamTaskInput,
	) => Promise<boolean>;
	onDeleteTask?: (task: TeamTaskRow) => Promise<boolean>;
	onToggleTask: (task: TeamTaskRow) => Promise<void>;
	onTogglePriority?: (task: TeamTaskRow) => Promise<void>;
	onEditMember: (input: MemberEditInput) => Promise<boolean>;
	onDeleteMember: () => Promise<boolean>;
};

const TREND_UP_COLOR = 'rgba(144, 238, 144, 0.95)';
const TREND_DOWN_COLOR = 'rgba(255, 120, 120, 0.95)';

function MemberMetric({
	value,
	label,
	trend,
	unit,
}: {
	value: string;
	label: string;
	trend?: WorkTrendDirection | null;
	unit?: string;
}) {
	return (
		<Box sx={{ flex: 1, minWidth: 100, textAlign: 'center', px: 1 }}>
			<Box
				sx={{
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					gap: 0.5,
				}}
			>
				<Typography
					level="h2"
					sx={{ color: 'var(--krona-text)', fontSize: { xs: 24, md: 30 } }}
				>
					{value}
					{unit ? (
						<Typography
							component="span"
							sx={{
								color: 'var(--krona-text-muted)',
								fontSize: { xs: 14, md: 16 },
								fontWeight: 500,
								ml: 0.5,
							}}
						>
							{unit}
						</Typography>
					) : null}
				</Typography>
				{trend === 'up' ? (
					<Typography
						component="span"
						sx={{ color: TREND_UP_COLOR, display: 'flex' }}
						aria-label="Up from yesterday"
					>
						<ArrowUp size={22} strokeWidth={2.5} />
					</Typography>
				) : trend === 'down' ? (
					<Typography
						component="span"
						sx={{ color: TREND_DOWN_COLOR, display: 'flex' }}
						aria-label="Down from yesterday"
					>
						<ArrowDown size={22} strokeWidth={2.5} />
					</Typography>
				) : null}
			</Box>
			<Typography level="body-sm" sx={{ color: 'var(--krona-text-muted)' }}>
				{label}
			</Typography>
		</Box>
	);
}

export default function TeamMemberProfileDetail({
	member,
	insights,
	loading = false,
	members = [],
	projects,
	canAssignTask,
	canViewPerformance = false,
	canCreateProjects = false,
	canCreateEditReminders = false,
	canManageMember,
	busy = false,
	onAssignTask,
	onCreateProject,
	onUpdateTask,
	onDeleteTask,
	onToggleTask,
	onTogglePriority,
	onEditMember,
	onDeleteMember,
}: Props) {
	const [taskOpen, setTaskOpen] = React.useState(false);
	const [editingTask, setEditingTask] = React.useState<TeamTaskRow | null>(null);
	const [editOpen, setEditOpen] = React.useState(false);
	const [deleteOpen, setDeleteOpen] = React.useState(false);
	const [taskName, setTaskName] = React.useState('');
	const [projectId, setProjectId] = React.useState<string | null>(null);
	const [assigneeId, setAssigneeId] = React.useState<string | null>(null);
	const [deadline, setDeadline] = React.useState('');
	const [newProjectOpen, setNewProjectOpen] = React.useState(false);
	const [createdProjects, setCreatedProjects] = React.useState<
		TeamProjectOption[]
	>([]);
	const [displayName, setDisplayName] = React.useState('');
	const [email, setEmail] = React.useState('');
	const [jobTitle, setJobTitle] = React.useState('');
	const [role, setRole] = React.useState<'manager' | 'member'>('member');
	const [joinedDate, setJoinedDate] = React.useState('');
	const [hourlyRate, setHourlyRate] = React.useState('');
	const [birthday, setBirthday] = React.useState('');
	const [dailyChallengeHours, setDailyChallengeHours] = React.useState('');
	const [accessPermissions, setAccessPermissions] =
		React.useState<TeamEmployeePermissions>(member.accessPermissions);

	const memberName = member.displayName || member.email || 'Member';
	const avatar =
		member.avatarUrl ||
		defaultAvatarUrl(member.email || member.displayName || member.userId);
	const pendingTasks = (insights?.tasks ?? []).filter(
		(task) => task.status !== 'done',
	);
	const doneTasks = (insights?.tasks ?? []).filter(
		(task) => task.status === 'done',
	);
	const challengeFinished =
		(insights?.challengeCount ?? 0) > 0 &&
		(insights?.challengePercent ?? 0) >= 100;
	const showNewProjectLink = Boolean(canCreateProjects && onCreateProject);
	const projectOptions = React.useMemo(() => {
		const byId = new Map(projects.map((project) => [project.id, project]));
		for (const extra of createdProjects) {
			if (!byId.has(extra.id)) byId.set(extra.id, extra);
		}
		return Array.from(byId.values());
	}, [createdProjects, projects]);

	const openEdit = () => {
		setDisplayName(memberName);
		setEmail(member.email ?? '');
		setJobTitle(member.jobTitle ?? '');
		setRole(member.role === 'manager' ? 'manager' : 'member');
		setJoinedDate(
			member.joinedAt ? dayjs(member.joinedAt).format('YYYY-MM-DD') : '',
		);
		setHourlyRate(
			member.hourlyRate != null && member.hourlyRate > 0
				? String(member.hourlyRate)
				: '',
		);
		setBirthday(member.birthday ? member.birthday.slice(0, 10) : '');
		setDailyChallengeHours(
			member.dailyChallengeHours != null && member.dailyChallengeHours > 0
				? String(member.dailyChallengeHours)
				: '',
		);
		setAccessPermissions(member.accessPermissions);
		setEditOpen(true);
	};

	const closeTask = () => {
		if (newProjectOpen) return;
		setTaskOpen(false);
		setEditingTask(null);
		setTaskName('');
		setProjectId(null);
		setAssigneeId(null);
		setDeadline('');
		setNewProjectOpen(false);
	};

	const openEditTask = (task: TeamTaskRow) => {
		setEditingTask(task);
		setTaskName(task.name);
		setProjectId(task.project_id ?? null);
		setAssigneeId(task.assignee_user_id);
		setDeadline(deadlineToDateKey(task.deadline));
		setTaskOpen(true);
	};

	const renderAssignedTask = (task: TeamTaskRow, done: boolean) => (
		<Box
			key={task.id}
			sx={{
				display: 'flex',
				alignItems: 'center',
				gap: 1,
				py: 0.5,
				opacity: done ? 0.82 : 1,
			}}
		>
			<KronaTaskCheckbox
				checked={done}
				aria-label={done ? `Reopen ${task.name}` : `Complete ${task.name}`}
				onChange={() => void onToggleTask(task)}
			/>
			<Box sx={{ minWidth: 0, flex: 1 }}>
				<Typography
					level="body-sm"
					sx={{
						color: 'var(--krona-text)',
						...(done ? { textDecoration: 'line-through' } : null),
					}}
				>
					{task.name}
				</Typography>
				<TaskWorkMeta
					workedSeconds={task.worked_seconds ?? 0}
					assignedHours={task.estimated_hours}
					deadline={task.deadline}
				/>
			</Box>
			{canAssignTask ? (
				<Box className="krona-task-row-actions" sx={kronaTaskRowActionsSx}>
					{!done && onTogglePriority ? (
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
							<KronaPriorityStar active={Boolean(task.prioritized)} size={16} />
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
							{onUpdateTask ? (
								<MenuItem
									sx={kronaMenuItemSx}
									onClick={() => openEditTask(task)}
								>
									<Pencil size={16} style={{ marginRight: 8 }} />
									Edit
								</MenuItem>
							) : null}
							{onDeleteTask ? (
								<MenuItem
									onClick={() => void onDeleteTask(task)}
									{...kronaDeleteMenuItemProps}
								>
									<Trash2 size={16} style={{ marginRight: 8 }} />
									Delete
								</MenuItem>
							) : null}
						</Menu>
					</Dropdown>
				</Box>
			) : null}
		</Box>
	);

	return (
		<>
			<Box sx={{ display: 'grid', gap: 2, px: { xs: 0, md: 0.5 } }}>
				<Box
					sx={{
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'space-between',
						gap: 2,
						flexWrap: 'wrap',
					}}
				>
					<Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
						<Avatar
							src={avatar}
							alt={memberName}
							sx={{ width: 54, height: 54, bgcolor: 'var(--krona-surface)' }}
						/>
						<Box sx={{ minWidth: 0 }}>
							<Box
								sx={{
									display: 'flex',
									alignItems: 'center',
									gap: 1,
									flexWrap: 'wrap',
									minWidth: 0,
								}}
							>
								<Typography
									level="h2"
									sx={{
										color: 'var(--krona-text)',
										overflow: 'hidden',
										textOverflow: 'ellipsis',
										whiteSpace: 'nowrap',
										minWidth: 0,
									}}
								>
									{memberName}
								</Typography>
								<TeamMemberActivityBadge mode={insights?.timerStatus} />
							</Box>
							<Box
								sx={{
									display: 'flex',
									alignItems: 'center',
									gap: 1.5,
									flexWrap: 'wrap',
									mt: 0.25,
								}}
							>
								<Typography
									level="body-sm"
									sx={{
										color: 'var(--krona-text)',
										fontSize: 13,
										fontWeight: 500,
										lineHeight: 1.35,
									}}
								>
									{member.jobTitle?.trim() || 'Team member'}
								</Typography>
								{member.joinedAt ? (
									<>
										<Box
											aria-hidden
											sx={{
												width: 6,
												height: 6,
												borderRadius: '50%',
												flexShrink: 0,
												bgcolor: 'var(--krona-text)',
												opacity: 0.36,
											}}
										/>
										<Box
											sx={{
												display: 'flex',
												alignItems: 'center',
												gap: 0.5,
											}}
										>
											<CalendarDays
												size={14}
												color="var(--krona-text)"
												aria-hidden
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
												Joined {dayjs(member.joinedAt).format('D MMM YYYY')}
											</Typography>
										</Box>
									</>
								) : null}
							</Box>
						</Box>
					</Box>
					<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
						{canAssignTask ? (
							<Button
								size="sm"
								startDecorator={<Plus size={16} />}
								onClick={() => setTaskOpen(true)}
								sx={kronaPrimaryButtonSx}
							>
								Assign task
							</Button>
						) : null}
						{canViewPerformance ? (
							<Tooltip title="Performance">
								<IconButton
									size="sm"
									component={Link}
									href={`/team/performance?member=${encodeURIComponent(member.userId)}`}
									aria-label="View performance"
									sx={kronaSecondaryIconButtonSx}
								>
									<BarChart3 size={18} aria-hidden />
								</IconButton>
							</Tooltip>
						) : null}
						{canManageMember ? (
							<Dropdown>
								<MenuButton
									slots={{ root: IconButton }}
									slotProps={{
										root: {
											size: 'sm',
											'aria-label': 'Member actions',
											sx: kronaSecondaryIconButtonSx,
										},
									}}
								>
									<MoreHorizontal size={18} aria-hidden />
								</MenuButton>
								<Menu placement="bottom-end" sx={kronaMenuSx}>
									<MenuItem onClick={openEdit} sx={kronaMenuItemSx}>
										<Pencil size={15} />
										Edit member
									</MenuItem>
									{member.role !== 'owner' ? (
										<MenuItem
											onClick={() => setDeleteOpen(true)}
											{...kronaDeleteMenuItemProps}
										>
											<Trash2 size={15} />
											Delete member
										</MenuItem>
									) : null}
								</Menu>
							</Dropdown>
						) : null}
					</Box>
				</Box>

				<Box sx={{ ...kronaWidgetCardSx, p: 2 }}>
					<Box
						sx={{
							display: 'flex',
							justifyContent: 'space-between',
							alignItems: 'center',
							gap: 1,
							mb: 1.25,
						}}
					>
						<Typography level="title-md" sx={{ color: 'var(--krona-text)' }}>
							Daily challenge
						</Typography>
						{challengeFinished ? (
							<Box
								sx={{
									position: 'relative',
									overflow: 'hidden',
									px: 1.25,
									py: 0.45,
									borderRadius: '999px',
									bgcolor: 'var(--krona-secondary-bg)',
									border:
										'1px solid color-mix(in srgb, var(--krona-accent) 40%, transparent)',
									flexShrink: 0,
								}}
							>
								<Box
									aria-hidden
									sx={{
										position: 'absolute',
										inset: 0,
										background: 'var(--krona-accent-gradient)',
										opacity: 0.28,
									}}
								/>
								<Typography
									level="body-xs"
									sx={{
										position: 'relative',
										display: 'inline-flex',
										alignItems: 'center',
										gap: 0.5,
										fontWeight: 700,
										color: 'var(--krona-text)',
									}}
								>
									<Check size={12} aria-hidden />
									Day complete
								</Typography>
							</Box>
						) : (
							<Typography
								level="body-xs"
								sx={{ color: 'var(--krona-text-muted)' }}
							>
								{insights?.challengeTargetLabel ?? 'No daily target'}
								{insights?.challengeRemainingLabel
									? ` · ${insights.challengeRemainingLabel}`
									: ''}
							</Typography>
						)}
					</Box>
					<Box
						sx={{
							height: 8,
							borderRadius: 999,
							bgcolor: 'var(--krona-progress-track)',
							overflow: 'hidden',
						}}
					>
						<Box
							sx={{
								height: '100%',
								width: `${insights?.challengePercent ?? 0}%`,
								borderRadius: 999,
								background: 'var(--krona-accent-gradient)',
								transition: 'width 0.3s ease',
							}}
						/>
					</Box>
				</Box>

				<Box sx={{ ...kronaWidgetCardSx, p: 2 }}>
					<Typography level="title-md" sx={{ color: 'var(--krona-text)', mb: 1.5 }}>
						Assigned tasks
					</Typography>
					{loading && pendingTasks.length + doneTasks.length === 0 ? (
						<Typography level="body-sm" sx={{ color: 'var(--krona-text-muted)' }}>
							Loading tasks…
						</Typography>
					) : pendingTasks.length + doneTasks.length === 0 ? (
						<Typography level="body-sm" sx={{ color: 'var(--krona-text-muted)' }}>
							No assigned tasks yet.
						</Typography>
					) : (
						<Box sx={{ display: 'grid', gap: 1 }}>
							{pendingTasks.map((task) => renderAssignedTask(task, false))}
							{doneTasks.length ? (
								<KronaListDivider label="Done" compact />
							) : null}
							{doneTasks.map((task) => renderAssignedTask(task, true))}
						</Box>
					)}
				</Box>

				<Box sx={{ ...kronaWidgetCardSx, p: 2 }}>
					<Typography level="title-md" sx={{ color: 'var(--krona-text)', mb: 2 }}>
						Today&apos;s progress
					</Typography>
					<Box
						sx={{
							display: 'flex',
							flexWrap: { xs: 'wrap', sm: 'nowrap' },
							alignItems: 'stretch',
							gap: 0,
						}}
					>
						<MemberMetric
							value={insights?.workHoursLabel ?? '0'}
							label="Hours worked"
						/>
						<MemberMetric
							value={insights?.restHoursLabel ?? '0'}
							label="Hours rested"
						/>
						<MemberMetric
							value={String(insights?.tasksFinishedToday ?? 0)}
							label="Tasks finished"
						/>
						<MemberMetric
							value={insights?.avgWorkHoursLabel ?? '0'}
							unit="hrs"
							label="Performance"
							trend={insights?.workTrend ?? null}
						/>
					</Box>
				</Box>
			</Box>

			<Modal
				open={taskOpen}
				onClose={closeTask}
				disableEnforceFocus={newProjectOpen}
			>
				<ModalDialog sx={kronaModalDialogSx}>
					<IconButton aria-label="Close" onClick={closeTask} sx={kronaModalCloseButtonSx}>
						<X size={18} />
					</IconButton>
					<Typography level="h4" sx={kronaModalTitleSx}>
						{editingTask
							? 'Edit task'
							: `Assign task to ${memberName}`}
					</Typography>
					<Box sx={kronaModalFieldsSx}>
						<FormControl required>
							<FormLabel>Task</FormLabel>
							<Input
								value={taskName}
								onChange={(event) => setTaskName(event.target.value)}
								placeholder="What needs to be done?"
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
								<FormLabel sx={{ mb: 0 }}>Project (optional)</FormLabel>
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
								value={projectId ?? ''}
								onChange={(_, value) =>
									setProjectId(value ? String(value) : null)
								}
								sx={kronaDropdownControlSx}
								slotProps={kronaSelectSlotProps}
							>
								<Option value="" sx={kronaMenuItemSx}>
									No project
								</Option>
								{projectOptions.map((project) => (
									<Option key={project.id} value={project.id} sx={kronaMenuItemSx}>
										{project.name}
									</Option>
								))}
							</Select>
						</FormControl>
						{editingTask && members.length > 0 ? (
							<FormControl>
								<FormLabel>Assignee</FormLabel>
								<Select
									value={assigneeId ?? member.userId}
									onChange={(_, value) =>
										setAssigneeId(value ? String(value) : member.userId)
									}
									sx={kronaDropdownControlSx}
									slotProps={kronaSelectSlotProps}
								>
									{members.map((row) => (
										<Option
											key={row.userId}
											value={row.userId}
											sx={kronaMenuItemSx}
										>
											{organizationMemberLabel(row)}
										</Option>
									))}
								</Select>
							</FormControl>
						) : null}
						<FormControl>
							<FormLabel>Deadline (optional)</FormLabel>
							<KronaDatePickerButton
								value={deadline}
								onChange={setDeadline}
								width="100%"
								disablePast
							/>
						</FormControl>
						{deadline.trim() && !editingTask ? (
							<Typography level="body-xs" sx={{ color: 'var(--krona-text-muted)' }}>
								Deadline is added to the assignee’s reminders automatically.
							</Typography>
						) : null}
					</Box>
					<Button
						loading={busy}
						disabled={!taskName.trim()}
						onClick={() =>
							void (async () => {
								if (!editingTask && isDeadlineInPast(deadline)) {
									showKronaError(DEADLINE_PAST_MESSAGE);
									return;
								}
								const payload: AssignTeamTaskInput = {
									name: taskName.trim(),
									assigneeUserId: assigneeId || member.userId,
									projectId,
									deadline: deadline || null,
								};
								const ok = editingTask
									? onUpdateTask
										? await onUpdateTask(editingTask, payload)
										: false
									: await onAssignTask(payload);
								if (ok) closeTask();
							})()
						}
						sx={{ ...kronaPrimaryButtonSx, ...kronaModalPrimaryActionSx }}
					>
						{editingTask ? 'Save changes' : 'Assign & notify'}
					</Button>
				</ModalDialog>
			</Modal>
			{showNewProjectLink ? (
				<TeamNewProjectModal
					open={newProjectOpen}
					onClose={() => setNewProjectOpen(false)}
					members={members}
					busy={busy}
					canCreateEditReminders={canCreateEditReminders}
					defaultMemberIds={[assigneeId || member.userId]}
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

			<Modal open={editOpen} onClose={() => setEditOpen(false)}>
				<ModalDialog sx={{ ...kronaModalDialogSx, maxWidth: 560 }}>
					<IconButton
						aria-label="Close"
						onClick={() => setEditOpen(false)}
						sx={kronaModalCloseButtonSx}
					>
						<X size={18} />
					</IconButton>
					<Typography level="h4" sx={kronaModalTitleSx}>
						Edit member
					</Typography>
					<Box sx={kronaModalFieldsSx}>
						<FormControl required>
							<FormLabel>Name</FormLabel>
							<Input
								value={displayName}
								onChange={(event) => setDisplayName(event.target.value)}
								sx={kronaInputSx}
							/>
						</FormControl>
						{member.role !== 'owner' ? (
							<FormControl required>
								<FormLabel>Email</FormLabel>
								<Input
									type="email"
									value={email}
									onChange={(event) => setEmail(event.target.value)}
									sx={kronaInputSx}
								/>
								<Typography
									level="body-xs"
									sx={{ color: 'var(--krona-text-muted)', mt: 0.5 }}
								>
									A new address removes their current access and sends a
									fresh invite to the new email.
								</Typography>
							</FormControl>
						) : null}
						<Box
							sx={{
								display: 'grid',
								gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
								gap: KRONA_MODAL_FIELD_GAP,
							}}
						>
							<FormControl>
								<FormLabel>Position</FormLabel>
								<Input
									value={jobTitle}
									onChange={(event) => setJobTitle(event.target.value)}
									sx={kronaInputSx}
								/>
							</FormControl>
							<FormControl>
								<FormLabel>Role</FormLabel>
								{member.role === 'owner' ? (
									<Input value="Admin manager" disabled sx={kronaInputSx} />
								) : (
									<Select
										value={role}
										onChange={(_, value) =>
											setRole(value === 'manager' ? 'manager' : 'member')
										}
										sx={kronaDropdownControlSx}
										slotProps={kronaSelectSlotProps}
									>
										<Option value="member" sx={kronaMenuItemSx}>
											Employee
										</Option>
										<Option value="manager" sx={kronaMenuItemSx}>
											Manager
										</Option>
									</Select>
								)}
							</FormControl>
							<FormControl>
								<FormLabel>Hourly rate</FormLabel>
								<Input
									type="number"
									value={hourlyRate}
									onChange={(event) => setHourlyRate(event.target.value)}
									placeholder="50"
									startDecorator="$"
									slotProps={{ input: { min: 0, step: '0.01' } }}
									sx={kronaInputSx}
								/>
							</FormControl>
							<FormControl>
								<FormLabel>Birthday</FormLabel>
								<KronaDatePickerButton
									value={birthday}
									onChange={setBirthday}
									placeholder="dd/mm/yyyy"
									width="100%"
								/>
							</FormControl>
							<FormControl>
								<FormLabel>
									<Box
										component="span"
										sx={{
											position: 'relative',
											display: 'inline-block',
											pr: '22px',
										}}
									>
										Daily challenge
										<Tooltip
											title="Hours of focused work this person should complete each day. Krona uses this as their Daily Challenges work-time goal."
											placement="top"
											sx={{ maxWidth: 280 }}
										>
											<IconButton
												size="sm"
												aria-label="About daily challenge"
												sx={{
													position: 'absolute',
													right: 0,
													top: '50%',
													transform: 'translateY(-50%)',
													minWidth: 18,
													minHeight: 18,
													width: 18,
													height: 18,
													p: 0,
													'--IconButton-size': '18px',
													color: 'var(--krona-text-64)',
												}}
											>
												<CircleHelp size={14} />
											</IconButton>
										</Tooltip>
									</Box>
								</FormLabel>
								<Input
									type="number"
									value={dailyChallengeHours}
									onChange={(event) =>
										setDailyChallengeHours(event.target.value)
									}
									placeholder="8"
									endDecorator="hrs"
									slotProps={{ input: { min: 0, max: 24, step: '0.5' } }}
									sx={kronaInputSx}
								/>
							</FormControl>
							<FormControl>
								<FormLabel>Date joined</FormLabel>
								<KronaDatePickerButton
									value={joinedDate}
									onChange={setJoinedDate}
									width="100%"
								/>
							</FormControl>
						</Box>
						{member.role !== 'owner' ? (
							<TeamMemberAccessPanel
								value={accessPermissions}
								onChange={setAccessPermissions}
								idPrefix={`edit-${member.userId}`}
							/>
						) : null}
					</Box>
					<Button
						loading={busy}
						disabled={!displayName.trim()}
						onClick={() =>
							void (async () => {
								const ok = await onEditMember({
									displayName: displayName.trim(),
									email: email.trim(),
									jobTitle: jobTitle.trim(),
									role,
									joinedDate,
									hourlyRate: hourlyRate.trim(),
									birthday,
									dailyChallengeHours: dailyChallengeHours.trim(),
									accessPermissions,
								});
								if (ok) setEditOpen(false);
							})()
						}
						sx={{ ...kronaPrimaryButtonSx, ...kronaModalPrimaryActionSx }}
					>
						Save changes
					</Button>
				</ModalDialog>
			</Modal>

			<Modal open={deleteOpen} onClose={() => setDeleteOpen(false)}>
				<ModalDialog sx={kronaModalDialogSx}>
					<IconButton
						aria-label="Close"
						onClick={() => setDeleteOpen(false)}
						sx={kronaModalCloseButtonSx}
					>
						<X size={18} />
					</IconButton>
					<Typography level="h4" sx={kronaModalTitleSx}>
						Delete {memberName}?
					</Typography>
					<Typography level="body-md" sx={{ color: 'var(--krona-text-muted)', mb: 2 }}>
						They will lose access to Krona immediately, and any invite link
						they had will stop working. To use Krona again they need a new
						invite. Their paid seat becomes an open slot.
					</Typography>
					<Box sx={{ display: 'flex', gap: 1 }}>
						<Button
							fullWidth
							onClick={() => setDeleteOpen(false)}
							sx={kronaSecondaryButtonSx}
						>
							Cancel
						</Button>
						<Button
							fullWidth
							loading={busy}
							onClick={() =>
								void (async () => {
									const ok = await onDeleteMember();
									if (ok) setDeleteOpen(false);
								})()
							}
							sx={kronaDeleteButtonSx}
						>
							Delete member
						</Button>
					</Box>
				</ModalDialog>
			</Modal>
		</>
	);
}
