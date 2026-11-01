'use client';

import * as React from 'react';
import {
	Box,
	Button,
	FormControl,
	FormLabel,
	Input,
	Option,
	Select,
	Typography,
} from '@mui/joy';
import { ListTodo, Plus, Search } from 'lucide-react';
import DashboardWidgetEmpty from '@/components/dashboard/DashboardWidgetEmpty';
import KronaListDivider from '@/components/krona/KronaListDivider';
import KronaTaskCheckbox from '@/components/krona/KronaTaskCheckbox';
import type { TeamTaskRow } from '@/lib/teams/dashboard';
import type { OrganizationMember } from '@/lib/teams/types';
import { organizationMemberLabel } from '@/lib/teams/org';
import { secondsToDisplayHours } from '@/lib/taskTime';
import {
	kronaPrimaryButtonSx,
	kronaSearchInputSx,
	kronaTaskListCheckboxContentGap,
	kronaTaskListItemNameSx,
	kronaTaskListNameDetailsGap,
	kronaTaskListRowSx,
	kronaTitleSx,
	kronaWidgetCardSx,
} from '@/lib/kronaStyles';

function nameFor(
	userId: string | null,
	membersById: Map<string, OrganizationMember>,
) {
	if (!userId) return 'Unassigned';
	return organizationMemberLabel(membersById.get(userId));
}

export default function TeamTasksWidget({
	tasks,
	members,
	canCreate,
	showAssignee = false,
	showDetails = true,
	busy,
	loading,
	onCreate,
	onToggleDone,
}: {
	tasks: TeamTaskRow[];
	members: OrganizationMember[];
	canCreate: boolean;
	/** Managers see assignee under the task title. */
	showAssignee?: boolean;
	/** Homepage lists hide hours/assignee; project pages keep them. */
	showDetails?: boolean;
	busy?: boolean;
	loading?: boolean;
	onCreate?: (input: {
		name: string;
		assigneeUserId: string | null;
	}) => Promise<void> | void;
	onToggleDone: (task: TeamTaskRow) => Promise<void> | void;
}) {
	const [name, setName] = React.useState('');
	const [assigneeId, setAssigneeId] = React.useState<string | null>(null);
	const [search, setSearch] = React.useState('');
	const membersById = React.useMemo(
		() => new Map(members.map((m) => [m.userId, m] as const)),
		[members],
	);

	const filteredTasks = React.useMemo(() => {
		const query = search.trim().toLowerCase();
		if (!query) return tasks;
		return tasks.filter((task) => {
			const assignee = nameFor(task.assignee_user_id, membersById);
			return (
				task.name.toLowerCase().includes(query) ||
				assignee.toLowerCase().includes(query)
			);
		});
	}, [membersById, search, tasks]);
	const pending = React.useMemo(
		() => filteredTasks.filter((t) => t.status !== 'done'),
		[filteredTasks],
	);
	const done = React.useMemo(
		() => filteredTasks.filter((t) => t.status === 'done'),
		[filteredTasks],
	);

	const submit = async () => {
		if (!canCreate || !onCreate || !name.trim()) return;
		await onCreate({ name: name.trim(), assigneeUserId: assigneeId });
		setName('');
	};

	const renderRow = (task: TeamTaskRow, completed: boolean) => (
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
				opacity: completed ? 0.85 : 1,
			}}
		>
			<KronaTaskCheckbox
				checked={completed}
				onChange={() => void onToggleDone(task)}
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
				<Typography
					level="body-md"
					sx={{
						...kronaTaskListItemNameSx,
						...(completed ? { textDecoration: 'line-through' } : null),
					}}
				>
					{task.name}
				</Typography>
				{showDetails ? (
					<Typography
						level="body-sm"
						sx={{
							color: 'var(--krona-text-64)',
							fontSize: 13,
							lineHeight: 1.35,
						}}
					>
						{showAssignee
							? `${nameFor(task.assignee_user_id, membersById)} · `
							: ''}
						{secondsToDisplayHours(task.worked_seconds ?? 0)} worked
					</Typography>
				) : null}
			</Box>
		</Box>
	);

	return (
		<Box
			sx={{
				...kronaWidgetCardSx,
				p: 2.5,
				minHeight: 0,
				height: '100%',
				display: 'flex',
				flexDirection: 'column',
			}}
		>
			<Typography
				level="title-md"
				sx={{
					...kronaTitleSx,
					color: 'var(--krona-text)',
					mb: '20px',
					flexShrink: 0,
				}}
			>
				Tasks
			</Typography>

			<Input
				size="sm"
				startDecorator={<Search size={15} aria-hidden />}
				placeholder="Search team tasks or assignees"
				value={search}
				onChange={(event) => setSearch(event.target.value)}
				slotProps={{ input: { 'aria-label': 'Search team tasks' } }}
				sx={{ ...kronaSearchInputSx, mb: '20px', flexShrink: 0 }}
			/>

			{canCreate ? (
				<Box
					sx={{
						display: 'grid',
						gridTemplateColumns: {
							xs: '1fr',
							sm: '1fr 180px auto',
						},
						gap: 1,
						mb: 2,
						alignItems: 'end',
						flexShrink: 0,
					}}
				>
					<FormControl size="sm">
						<FormLabel>New task</FormLabel>
						<Input
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="Write the task name"
							onKeyDown={(e) => {
								if (e.key === 'Enter') void submit();
							}}
						/>
					</FormControl>
					<FormControl size="sm">
						<FormLabel>Assignee</FormLabel>
						<Select
							placeholder="Unassigned"
							value={assigneeId ?? ''}
							onChange={(_, v) =>
								setAssigneeId(v && String(v).length ? String(v) : null)
							}
						>
							<Option value="">Unassigned</Option>
							{members.map((m) => {
								const label = organizationMemberLabel(m);
								return (
									<Option key={m.userId} value={m.userId} label={label}>
										{label}
									</Option>
								);
							})}
						</Select>
					</FormControl>
					<Button
						sx={kronaPrimaryButtonSx}
						loading={busy}
						startDecorator={<Plus size={16} />}
						onClick={() => void submit()}
					>
						Create
					</Button>
				</Box>
			) : null}

			{loading && tasks.length === 0 ? (
				<Typography level="body-sm" sx={{ color: 'var(--krona-text-muted)' }}>
					Loading…
				</Typography>
			) : tasks.length === 0 ? (
				<DashboardWidgetEmpty icon={ListTodo}>
					{canCreate
						? 'Create a task to get the team moving.'
						: 'Your manager assigns tasks — none for you yet.'}
				</DashboardWidgetEmpty>
			) : filteredTasks.length === 0 ? (
				<DashboardWidgetEmpty icon={Search}>
					No team tasks match your search.
				</DashboardWidgetEmpty>
			) : (
				<Box
					sx={{
						flex: 1,
						minHeight: 0,
						overflowY: 'auto',
					}}
				>
					{pending.length > 0 ? (
						<Box sx={{ mt: 0 }}>
							{pending.map((task) => renderRow(task, false))}
						</Box>
					) : null}
					{done.length > 0 ? (
						<Box sx={{ mt: pending.length > 0 ? '10px' : 0 }}>
							<KronaListDivider label="Done" compact />
							<Box sx={{ mt: '10px' }}>
								{done.map((task) => renderRow(task, true))}
							</Box>
						</Box>
					) : null}
				</Box>
			)}
		</Box>
	);
}
