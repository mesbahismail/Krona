'use client';

import * as React from 'react';
import { Box } from '@mui/joy';
import TeamAppShell from '@/components/teams/TeamAppShell';
import TeamAssignedTasksWidget, {
	type AssignTeamTaskInput,
} from '@/components/teams/TeamAssignedTasksWidget';
import TeamEffortWidget from '@/components/teams/TeamEffortWidget';
import TeamMetricsWidget from '@/components/teams/TeamMetricsWidget';
import TeamProgressWidget from '@/components/teams/TeamProgressWidget';
import TeamReminderCreateModal from '@/components/teams/TeamReminderCreateModal';
import TeamRemindersWidget from '@/components/teams/TeamRemindersWidget';
import TeamTasksWidget from '@/components/teams/TeamTasksWidget';
import type { TeamNewProjectInput } from '@/components/teams/TeamNewProjectModal';
import { useTeamMode } from '@/components/teams/TeamModeContext';
import { useKronaLayoutMode } from '@/components/KronaLayoutModeProvider';
import {
	fetchMemberChallengeProgress,
	fetchTeamPerformanceSummary,
	fetchTeamProjectOptions,
	fetchTeamReminders,
	fetchTeamTasks,
	fetchTeamTodayProgress,
	type MemberChallengeProgress,
	type TeamPerformanceSummary,
	type TeamProjectOption,
	type TeamReminderRow,
	type TeamTaskRow,
	type TeamTodayProgress,
} from '@/lib/teams/dashboard';
import {
	createTeamProject,
	createTeamReminder,
	createTeamTask,
	deleteTeamTask,
	fetchOrgMembers,
	fetchPendingOrgInvites,
	setTeamTaskPrioritized,
	setTeamTaskStatus,
	updateTeamTask,
} from '@/lib/teams/org';
import type { OrganizationMember } from '@/lib/teams/types';
import { TEAMS_MIN_SEATS } from '@/lib/teams/billing';
import { localData } from '@/lib/localData';
import { useTeamLiveRefresh } from '@/hooks/useTeamLiveRefresh';
import { showKronaError, showKronaSuccess } from '@/lib/kronaToast';
import { localDateKeyToIso } from '@/lib/localDate';
import {
	mergeChallengeRows,
	mergeMembers,
	mergeProjectOptions,
	mergeReminders,
	mergeTeamTasks,
	sameMetrics,
	sameTodayProgress,
} from '@/lib/teams/stableLists';

export default function TeamEffortPage() {
	const {
		organization,
		isManager,
		isOwner,
		canCreateEditTasks,
		canCreateEditProjects,
		canCreateEditReminders,
	} = useTeamMode();
	const { isDesktopDashboard, isTabletDashboard } = useKronaLayoutMode();
	const [members, setMembers] = React.useState<OrganizationMember[]>([]);
	const [projects, setProjects] = React.useState<TeamProjectOption[]>([]);
	const [pendingInviteCount, setPendingInviteCount] = React.useState(0);
	const [tasks, setTasks] = React.useState<TeamTaskRow[]>([]);
	const [reminders, setReminders] = React.useState<TeamReminderRow[]>([]);
	const [challengeRows, setChallengeRows] = React.useState<
		MemberChallengeProgress[]
	>([]);
	const [progress, setProgress] = React.useState<TeamTodayProgress | null>(null);
	const [metrics, setMetrics] = React.useState<TeamPerformanceSummary | null>(
		null,
	);
	const [loading, setLoading] = React.useState(true);
	const [busy, setBusy] = React.useState(false);
	const [reminderModalOpen, setReminderModalOpen] = React.useState(false);
	const loadedOnceRef = React.useRef(false);
	const loadGenRef = React.useRef(0);
	const orgId = organization?.id ?? null;

	const seatCount = Math.max(
		TEAMS_MIN_SEATS,
		organization?.seatCount ?? TEAMS_MIN_SEATS,
	);
	const openSlots = Math.max(
		0,
		seatCount - members.length - pendingInviteCount,
	);

	const load = React.useCallback(async (silent = false) => {
		if (!orgId) return;
		const { data: userRes } = await localData.auth.getUser();
		const uid = userRes.user?.id;
		const showSpinner = !silent && !loadedOnceRef.current;
		const gen = ++loadGenRef.current;

		if (showSpinner) setLoading(true);
		try {
			const [memberList, pending, projectList] = await Promise.all([
				fetchOrgMembers(orgId),
				isManager
					? fetchPendingOrgInvites(orgId)
					: Promise.resolve([] as Awaited<
							ReturnType<typeof fetchPendingOrgInvites>
						>),
				isManager ? fetchTeamProjectOptions(orgId) : Promise.resolve([]),
			]);
			if (gen !== loadGenRef.current) return;
			setMembers((prev) => mergeMembers(prev, memberList));
			setPendingInviteCount((prev) =>
				prev === pending.length ? prev : pending.length,
			);
			setProjects((prev) => mergeProjectOptions(prev, projectList));

			if (isManager) {
				const [allTasks, challenges, today, rem, summary] = await Promise.all([
					fetchTeamTasks(orgId),
					fetchMemberChallengeProgress(orgId),
					fetchTeamTodayProgress(orgId),
					fetchTeamReminders(orgId),
					fetchTeamPerformanceSummary(orgId),
				]);
				if (gen !== loadGenRef.current) return;
				setTasks((prev) => mergeTeamTasks(prev, allTasks));
				setChallengeRows((prev) => mergeChallengeRows(prev, challenges));
				setProgress((prev) => (sameTodayProgress(prev, today) ? prev : today));
				setReminders((prev) => mergeReminders(prev, rem));
				setMetrics((prev) => (sameMetrics(prev, summary) ? prev : summary));
			} else if (uid) {
				const mine = await fetchTeamTasks(orgId, { assigneeUserId: uid });
				if (gen !== loadGenRef.current) return;
				setTasks((prev) => mergeTeamTasks(prev, mine));
				setChallengeRows((prev) => (prev.length === 0 ? prev : []));
				setProgress((prev) => (prev == null ? prev : null));
				setReminders((prev) => (prev.length === 0 ? prev : []));
				setMetrics((prev) => (prev == null ? prev : null));
			}
			loadedOnceRef.current = true;
		} finally {
			if (showSpinner && gen === loadGenRef.current) setLoading(false);
		}
	}, [orgId, isManager]);

	React.useEffect(() => {
		void load();
	}, [load]);

	useTeamLiveRefresh(orgId, () => void load(true), {
		enabled: Boolean(orgId && isManager),
	});

	const createTask = async (input: AssignTeamTaskInput) => {
		if (!organization) return;
		const { data: userRes } = await localData.auth.getUser();
		const user = userRes.user;
		if (!user) return;
		setBusy(true);
		try {
			const id = await createTeamTask({
				organizationId: organization.id,
				name: input.name,
				assigneeUserId: input.assigneeUserId,
				projectId: input.projectId,
				deadline: input.deadline,
				createdBy: user.id,
			});
			if (!id) {
				showKronaError('Could not create task.');
				return;
			}
			showKronaSuccess(
				input.deadline && input.assigneeUserId
					? 'Task assigned. Deadline added to their reminders.'
					: 'Task assigned.',
			);
			await load(true);
		} finally {
			setBusy(false);
		}
	};

	const createProject = async (
		input: TeamNewProjectInput,
	): Promise<TeamProjectOption | null> => {
		if (!organization || !canCreateEditProjects) return null;
		const { data: userRes } = await localData.auth.getUser();
		const user = userRes.user;
		if (!user) return null;
		setBusy(true);
		try {
			const id = await createTeamProject({
				organizationId: organization.id,
				name: input.name,
				memberUserIds: input.memberUserIds,
				deadline: input.deadline,
				createdBy: user.id,
			});
			if (!id) {
				showKronaError('Could not create project.');
				return null;
			}
			if (input.addToReminders && input.deadline) {
				const dueAt = localDateKeyToIso(input.deadline, { hour: 9 });
				const targets =
					input.memberUserIds.length > 0 ? input.memberUserIds : [null];
				let added = 0;
				if (dueAt) {
					for (const assigneeUserId of targets) {
						const reminderId = await createTeamReminder({
							organizationId: organization.id,
							name: `${input.name} deadline`,
							assigneeUserId,
							createdBy: user.id,
							dueAt,
						});
						if (reminderId) added += 1;
					}
				}
				if (!dueAt || added === 0) {
					showKronaError(
						'Project saved, but the deadline could not be added to reminders.',
					);
				}
			}
			const created = { id, name: input.name };
			setProjects((prev) =>
				prev.some((project) => project.id === id)
					? prev
					: [created, ...prev],
			);
			showKronaSuccess(
				input.memberUserIds.length
					? `Project created for ${input.memberUserIds.length} teammate${input.memberUserIds.length === 1 ? '' : 's'}.`
					: 'Project created.',
			);
			void load(true);
			return created;
		} finally {
			setBusy(false);
		}
	};

	const updateTask = async (
		row: TeamTaskRow,
		input: {
			name: string;
			assigneeUserId: string;
			projectId: string | null;
			deadline: string | null;
		},
	) => {
		if (!organization) return;
		setBusy(true);
		try {
			const ok = await updateTeamTask({
				organizationId: organization.id,
				taskId: row.id,
				name: input.name,
				assigneeUserId: input.assigneeUserId,
				projectId: input.projectId,
				deadline: input.deadline,
			});
			if (!ok) {
				showKronaError('Could not save task.');
				return;
			}
			showKronaSuccess('Task saved.');
			await load(true);
		} finally {
			setBusy(false);
		}
	};

	const removeTask = async (row: TeamTaskRow) => {
		if (!organization) return;
		const ok = await deleteTeamTask({
			organizationId: organization.id,
			taskId: row.id,
		});
		if (!ok) {
			showKronaError('Could not delete task.');
			return;
		}
		showKronaSuccess('Task deleted.');
		await load(true);
	};

	const toggleDone = async (row: TeamTaskRow) => {
		if (!organization) return;
		const { data: userRes } = await localData.auth.getUser();
		const user = userRes.user;
		if (!user) return;
		const next = row.status === 'done' ? 'pending' : 'done';
		await setTeamTaskStatus({
			organizationId: organization.id,
			taskId: row.id,
			name: row.name,
			actorUserId: user.id,
			nextStatus: next,
			estimatedHours: row.estimated_hours ?? null,
			createdAt: row.created_at,
		});
		await load(true);
	};

	const togglePriority = async (row: TeamTaskRow) => {
		if (!organization || row.status === 'done') return;
		const next = !row.prioritized;
		const ok = await setTeamTaskPrioritized({
			organizationId: organization.id,
			taskId: row.id,
			name: row.name,
			prioritized: next,
			assigneeUserId: row.assignee_user_id,
		});
		if (!ok) {
			showKronaError('Could not update priority.');
			return;
		}
		if (next && row.assignee_user_id) {
			showKronaSuccess('Priority set. Assignee was notified.');
		}
		await load(true);
	};

	const lock = isManager && isDesktopDashboard;

	return (
		<TeamAppShell title="Team Effort" fillViewport={isManager}>
			{isManager ? (
				<Box
					sx={{
						display: 'grid',
						gap: '24px',
						width: '100%',
						flex: lock ? '1 1 0' : '0 0 auto',
						minHeight: lock ? 0 : 'auto',
						maxHeight: lock ? '100%' : 'none',
						overflow: lock ? 'hidden' : 'visible',
						overflowX: lock ? 'hidden' : 'clip',
						gridTemplateColumns: lock
							? 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)'
							: isTabletDashboard
								? 'repeat(2, minmax(0, 1fr))'
								: '1fr',
						gridTemplateRows: lock ? 'repeat(3, minmax(0, 1fr))' : 'none',
						alignItems: 'stretch',
					}}
				>
					{/* Tall: Team Effort (member challenge progress) */}
					<Box
						data-tour="team-widget-effort"
						sx={{
							minHeight: 0,
							height: lock ? '100%' : 'auto',
							gridColumn: lock ? '1' : '1 / -1',
							gridRow: lock ? '1 / 4' : 'auto',
							order: lock ? undefined : 1,
						}}
					>
						<TeamEffortWidget
							rows={challengeRows}
							loading={loading}
							openSlots={openSlots}
							seatCount={seatCount}
							canManageRoster={isOwner}
						/>
					</Box>

					{/* Tall: Team tasks + assign */}
					<Box
						data-tour="team-widget-tasks"
						sx={{
							minHeight: 0,
							height: lock ? '100%' : 'auto',
							gridColumn: lock ? '2' : '1 / -1',
							gridRow: lock ? '1 / 4' : 'auto',
							order: lock ? undefined : 2,
						}}
					>
						<TeamAssignedTasksWidget
							tasks={tasks}
							members={members}
							projects={projects}
							loading={loading}
							busy={busy}
							onCreate={canCreateEditTasks ? createTask : undefined}
							onCreateProject={
								canCreateEditProjects ? createProject : undefined
							}
							canCreateProjects={canCreateEditProjects}
							canCreateEditReminders={canCreateEditReminders}
							onUpdate={canCreateEditTasks ? updateTask : undefined}
							onDelete={canCreateEditTasks ? removeTask : undefined}
							onToggleDone={toggleDone}
							onTogglePriority={
								canCreateEditTasks ? togglePriority : undefined
							}
						/>
					</Box>

					{/* Compact stack: reminders / progress / performance */}
					<Box
						data-tour="team-widget-reminders"
						sx={{
							minHeight: 0,
							height: lock ? '100%' : 'auto',
							gridColumn: lock ? '3' : '1 / -1',
							gridRow: lock ? '1' : 'auto',
							order: lock ? undefined : 3,
						}}
					>
						<TeamRemindersWidget
							reminders={reminders}
							loading={loading}
							canCreate={canCreateEditReminders}
							onCreate={() => setReminderModalOpen(true)}
						/>
					</Box>
					<Box
						sx={{
							minHeight: 0,
							height: lock ? '100%' : 'auto',
							gridColumn: lock ? '3' : '1 / -1',
							gridRow: lock ? '2' : 'auto',
							order: lock ? undefined : 4,
						}}
					>
						<TeamProgressWidget progress={progress} loading={loading} />
					</Box>
					<Box
						sx={{
							minHeight: 0,
							height: lock ? '100%' : 'auto',
							gridColumn: lock ? '3' : '1 / -1',
							gridRow: lock ? '3' : 'auto',
							order: lock ? undefined : 5,
						}}
					>
						<TeamMetricsWidget summary={metrics} loading={loading} />
					</Box>
				</Box>
			) : (
				<Box data-tour="team-widget-tasks">
					<TeamTasksWidget
						tasks={tasks}
						members={members}
						canCreate={false}
						showAssignee={false}
						showDetails={false}
						loading={loading}
						onToggleDone={toggleDone}
					/>
				</Box>
			)}
			{organization && canCreateEditReminders ? (
				<TeamReminderCreateModal
					open={reminderModalOpen}
					onClose={() => setReminderModalOpen(false)}
					organizationId={organization.id}
					members={members}
					onCreated={() => void load(true)}
				/>
			) : null}
		</TeamAppShell>
	);
}
