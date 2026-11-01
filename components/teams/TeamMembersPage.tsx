'use client';

import { localService } from '@/lib/localService';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
	Avatar,
	Box,
	Button,
	FormControl,
	FormLabel,
	IconButton,
	Input,
	Modal,
	ModalDialog,
	Tooltip,
	Typography,
} from '@mui/joy';
import { Copy, RefreshCw, Search, UserPlus, UserRound, X } from 'lucide-react';
import TeamAppShell from '@/components/teams/TeamAppShell';
import KronaResizableSplitLayout from '@/components/krona/KronaResizableSplitLayout';
import DashboardWidgetEmpty from '@/components/dashboard/DashboardWidgetEmpty';
import TeamMemberActivityBadge from '@/components/teams/TeamMemberActivityBadge';
import TeamMemberProfileDetail, {
	type MemberEditInput,
} from '@/components/teams/TeamMemberProfileDetail';
import type { AssignTeamTaskInput } from '@/components/teams/TeamAssignedTasksWidget';
import type { TeamNewProjectInput } from '@/components/teams/TeamNewProjectModal';
import { useTeamMode } from '@/components/teams/TeamModeContext';
import { useKronaLayoutMode } from '@/components/KronaLayoutModeProvider';
import {
	fetchMemberInsights,
	fetchTeamProjectOptions,
	type TeamProjectOption,
	type TeamTaskRow,
	type MemberInsights,
} from '@/lib/teams/dashboard';
import {
	TEAMS_MAX_SEATS,
	TEAMS_MIN_SEATS,
	clampTeamSeats,
} from '@/lib/teams/billing';
import {
	fetchOrgMembers,
	fetchPendingOrgInvites,
	createTeamProject,
	createTeamReminder,
	createTeamTask,
	deleteTeamTask,
	setTeamTaskPrioritized,
	setTeamTaskStatus,
	updateTeamTask,
	teamMemberRoleLabel,
	pendingInvitesReservingSeats,
	type PendingOrgInvite,
} from '@/lib/teams/org';
import type { OrganizationMember } from '@/lib/teams/types';
import { defaultAvatarUrl } from '@/lib/defaultAvatar';
import { localData } from '@/lib/localData';
import { useTeamLiveRefresh } from '@/hooks/useTeamLiveRefresh';
import {
	fetchTimerPresenceByUserIds,
	type TeamTimerPresenceMode,
} from '@/lib/teams/timerPresence';
import {
	reconcilePendingOrgInvites,
	teamInviteAcceptUrl,
} from '@/lib/teams/invites';
import { localDateKey, localDateKeyToIso } from '@/lib/localDate';
import { showKronaError, showKronaSuccess } from '@/lib/kronaToast';
import {
	mergeInvites,
	mergeMembers,
	mergeProjectOptions,
	sameMemberInsights,
	samePresence,
} from '@/lib/teams/stableLists';
import { MembersPageSkeleton } from '@/components/krona/KronaPageSkeletons';
import {
	kronaModalCloseButtonSx,
	kronaModalDialogSx,
	kronaModalFieldsSx,
	kronaModalPrimaryActionSx,
	kronaListItemSelectedSx,
	kronaModalTitleSx,
	kronaPrimaryButtonSx,
	kronaPrimaryIconButtonSx,
	kronaSearchInputSx,
	kronaSecondaryButtonSx,
	kronaSideListScrollSx,
	kronaSideListToolbarRowSx,
} from '@/lib/kronaStyles';

type ListItem =
	| {
			key: string;
			kind: 'member';
			member: OrganizationMember;
			name: string;
			title: string;
			onboarded: boolean;
	  }
	| {
			key: string;
			kind: 'invite';
			invite: PendingOrgInvite;
			name: string;
			title: string;
			onboarded: false;
	  }
	| {
			key: string;
			kind: 'slot';
			index: number;
			name: string;
			title: string;
			onboarded: false;
	  };

function memberDisplayName(m: OrganizationMember) {
	return m.displayName || m.email || 'Member';
}

function memberTitle(m: OrganizationMember) {
	const role = teamMemberRoleLabel(m.role);
	const job = m.jobTitle?.trim();
	return job ? `${role} · ${job}` : role;
}

export default function TeamMembersPage() {
	const router = useRouter();
	const {
		organization,
		isManager,
		isOwner,
		canCreateEditTasks,
		canCreateEditProjects,
		canCreateEditReminders,
		loading: teamLoading,
	} = useTeamMode();
	const { isDesktopDashboard } = useKronaLayoutMode();
	const searchParams = useSearchParams();
	const memberQuery = searchParams.get('member');
	const buySeatsQuery = searchParams.get('buySeats') === '1';
	const [members, setMembers] = React.useState<OrganizationMember[]>([]);
	const [invites, setInvites] = React.useState<PendingOrgInvite[]>([]);
	const [projects, setProjects] = React.useState<TeamProjectOption[]>([]);
	const [selectedKey, setSelectedKey] = React.useState<string | null>(null);
	const [search, setSearch] = React.useState('');
	const [insights, setInsights] = React.useState<MemberInsights | null>(null);
	const [timerPresence, setTimerPresence] = React.useState<
		Map<string, TeamTimerPresenceMode>
	>(() => new Map());
	const [loading, setLoading] = React.useState(true);
	const [insightsLoading, setInsightsLoading] = React.useState(false);
	const [mobileDetails, setMobileDetails] = React.useState(false);
	const [buySeatsOpen, setBuySeatsOpen] = React.useState(false);
	const [extraSeats, setExtraSeats] = React.useState(1);
	const [busy, setBusy] = React.useState(false);
	const [rosterBusy, setRosterBusy] = React.useState(false);
	const loadedOnceRef = React.useRef(false);
	const loadGenRef = React.useRef(0);
	const orgId = organization?.id ?? null;

	const seatCount = Math.max(
		TEAMS_MIN_SEATS,
		organization?.seatCount ?? TEAMS_MIN_SEATS,
	);
	const reservingInvites = pendingInvitesReservingSeats(invites, members);
	const usedSeats = members.length + reservingInvites.length;
	const openSlots = Math.max(0, seatCount - usedSeats);

	const load = React.useCallback(async (silent = false) => {
		if (!orgId) return;
		const showSpinner = !silent && !loadedOnceRef.current;
		const gen = ++loadGenRef.current;
		if (showSpinner) setLoading(true);
		try {
			if (isOwner && !silent) await reconcilePendingOrgInvites(orgId);
			const [memberList, pending, projectOptions] = await Promise.all([
				fetchOrgMembers(orgId),
				isManager
					? fetchPendingOrgInvites(orgId)
					: Promise.resolve([] as PendingOrgInvite[]),
				fetchTeamProjectOptions(orgId),
			]);
			if (gen !== loadGenRef.current) return;
			const presence = isManager
				? await fetchTimerPresenceByUserIds(memberList.map((m) => m.userId))
				: new Map<string, TeamTimerPresenceMode>();
			if (gen !== loadGenRef.current) return;
			setMembers((prev) => mergeMembers(prev, memberList));
			setInvites((prev) => mergeInvites(prev, pending));
			setProjects((prev) => mergeProjectOptions(prev, projectOptions));
			setTimerPresence((prev) => (samePresence(prev, presence) ? prev : presence));
			loadedOnceRef.current = true;
		} finally {
			if (showSpinner && gen === loadGenRef.current) setLoading(false);
		}
	}, [orgId, isManager, isOwner]);

	React.useEffect(() => {
		void load();
	}, [load]);

	const items = React.useMemo((): ListItem[] => {
		const memberItems: ListItem[] = members.map((m) => ({
			key: `member:${m.userId}`,
			kind: 'member',
			member: m,
			name: memberDisplayName(m),
			title: memberTitle(m),
			onboarded: m.onboardingCompleted !== false,
		}));
		const inviteItems: ListItem[] = reservingInvites.map((inv) => ({
			key: `invite:${inv.id}`,
			kind: 'invite',
			invite: inv,
			name: inv.email,
			title: teamMemberRoleLabel(inv.role),
			onboarded: false as const,
		}));
		const slotsLeft =
			loading || teamLoading
				? 0
				: Math.max(0, seatCount - memberItems.length - inviteItems.length);
		const slotItems: ListItem[] = Array.from({ length: slotsLeft }, (_, i) => ({
			key: `slot:${i + 1}`,
			kind: 'slot' as const,
			index: i + 1,
			name: `Open seat ${usedSeats + i + 1}`,
			title: 'Available',
			onboarded: false as const,
		}));
		return [...memberItems, ...inviteItems, ...slotItems];
	}, [loading, teamLoading, members, reservingInvites, seatCount, usedSeats]);

	const filtered = React.useMemo(() => {
		const q = search.trim().toLowerCase();
		if (!q) return items;
		return items.filter(
			(item) =>
				item.name.toLowerCase().includes(q) ||
				item.title.toLowerCase().includes(q) ||
				(item.kind === 'slot' && 'not onboarded yet'.includes(q)),
		);
	}, [items, search]);

	const appliedMemberQueryRef = React.useRef(false);

	const showRosterSkeleton = teamLoading || Boolean(orgId && loading);

	React.useEffect(() => {
		if (showRosterSkeleton || !filtered.length) {
			if (!showRosterSkeleton) setSelectedKey(null);
			return;
		}
		if (memberQuery && !appliedMemberQueryRef.current) {
			const fromQuery = `member:${memberQuery}`;
			if (filtered.some((i) => i.key === fromQuery)) {
				setSelectedKey(fromQuery);
				setMobileDetails(true);
				appliedMemberQueryRef.current = true;
				return;
			}
		}
		if (!selectedKey || !filtered.some((i) => i.key === selectedKey)) {
			setSelectedKey(filtered[0].key);
		}
	}, [filtered, selectedKey, memberQuery, showRosterSkeleton]);

	React.useEffect(() => {
		if (!buySeatsQuery || !isOwner || loading) return;
		setBuySeatsOpen(true);
		router.replace('/team/members', { scroll: false });
	}, [buySeatsQuery, isOwner, loading, router]);

	const selected = filtered.find((i) => i.key === selectedKey) ?? null;
	const selectedRef = React.useRef(selected);
	selectedRef.current = selected;

	const refreshLive = React.useCallback(() => {
		void load(true);
		const current = selectedRef.current;
		if (!orgId || !current || current.kind !== 'member') return;
		void fetchMemberInsights(orgId, current.member.userId, {
			dailyChallengeHours: current.member.dailyChallengeHours,
		}).then((next) => {
			setInsights((prev) => (sameMemberInsights(prev, next) ? prev : next));
		});
	}, [load, orgId]);

	useTeamLiveRefresh(orgId, refreshLive, {
		enabled: Boolean(orgId && isManager),
	});

	const reloadMemberInsights = React.useCallback(
		async (member: OrganizationMember) => {
			if (!orgId) return;
			try {
				const next = await fetchMemberInsights(orgId, member.userId, {
					dailyChallengeHours: member.dailyChallengeHours,
				});
				setInsights((prev) =>
					sameMemberInsights(prev, next) ? prev : next,
				);
			} catch {
				/* keep the last list rather than flashing an empty state */
			}
		},
		[orgId],
	);

	const selectedUserId =
		selected?.kind === 'member' ? selected.member.userId : null;
	const insightsUserRef = React.useRef<string | null>(null);

	React.useEffect(() => {
		if (!orgId || !selectedUserId) {
			insightsUserRef.current = null;
			setInsights(null);
			setInsightsLoading(false);
			return;
		}
		const switched = insightsUserRef.current !== selectedUserId;
		insightsUserRef.current = selectedUserId;
		let cancelled = false;
		if (switched) {
			setInsights(null);
			setInsightsLoading(true);
		}
		void fetchMemberInsights(orgId, selectedUserId, {
			dailyChallengeHours:
				selected?.kind === 'member'
					? selected.member.dailyChallengeHours
					: null,
		})
			.then((data) => {
				if (cancelled) return;
				setInsights((prev) =>
					sameMemberInsights(prev, data) ? prev : data,
				);
				setInsightsLoading(false);
			})
			.catch(() => {
				if (!cancelled) setInsightsLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [orgId, selectedUserId]);

	const startAddMembersOnboarding = () => {
		router.push('/teams/onboarding?intent=add-members');
	};

	const openAddMember = () => {
		setExtraSeats(Math.max(1, openSlots > 0 ? 1 : 1));
		setBuySeatsOpen(true);
	};

	const removeMember = async (target: OrganizationMember): Promise<boolean> => {
		if (!organization || !isOwner) return false;
		setRosterBusy(true);
		try {
			const res = await localService('teams/members/remove', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					organizationId: organization.id,
					userId: target.userId,
					email: target.email,
				}),
			});
			const json = (await res.json()) as { error?: string };
			if (!res.ok) {
				showKronaError(json.error || 'Could not remove member.');
				return false;
			}
			showKronaSuccess(
				`${memberDisplayName(target)} was removed. They no longer have Krona access, and their invite link no longer works.`,
			);
			setSelectedKey(null);
			await load();
			return true;
		} finally {
			setRosterBusy(false);
		}
	};

	const assignTaskToMember = async (
		target: OrganizationMember,
		input: AssignTeamTaskInput,
	): Promise<boolean> => {
		if (!organization) return false;
		setRosterBusy(true);
		try {
			const { data: userRes } = await localData.auth.getUser();
			if (!userRes.user) return false;
			const id = await createTeamTask({
				organizationId: organization.id,
				name: input.name,
				assigneeUserId: target.userId,
				projectId: input.projectId,
				deadline: input.deadline,
				createdBy: userRes.user.id,
			});
			if (!id) {
				showKronaError('Could not assign task.');
				return false;
			}
			showKronaSuccess(
				input.deadline
					? `Task assigned to ${memberDisplayName(target)}. Deadline added to their reminders.`
					: `Task assigned to ${memberDisplayName(target)}.`,
			);
			await reloadMemberInsights(target);
			return true;
		} finally {
			setRosterBusy(false);
		}
	};

	const createProject = async (
		input: TeamNewProjectInput,
	): Promise<TeamProjectOption | null> => {
		if (!organization || !canCreateEditProjects) return null;
		const { data: userRes } = await localData.auth.getUser();
		const user = userRes.user;
		if (!user) return null;
		setRosterBusy(true);
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
			setRosterBusy(false);
		}
	};

	const updateMemberTask = async (
		target: OrganizationMember,
		task: TeamTaskRow,
		input: AssignTeamTaskInput,
	): Promise<boolean> => {
		if (!organization) return false;
		setRosterBusy(true);
		try {
			const ok = await updateTeamTask({
				organizationId: organization.id,
				taskId: task.id,
				name: input.name,
				assigneeUserId: input.assigneeUserId,
				projectId: input.projectId,
				deadline: input.deadline,
			});
			if (!ok) {
				showKronaError('Could not save task.');
				return false;
			}
			showKronaSuccess('Task saved.');
			await reloadMemberInsights(target);
			if (input.assigneeUserId !== target.userId) {
				await load(true);
			}
			return true;
		} finally {
			setRosterBusy(false);
		}
	};

	const removeMemberTask = async (
		target: OrganizationMember,
		task: TeamTaskRow,
	): Promise<boolean> => {
		if (!organization) return false;
		const ok = await deleteTeamTask({
			organizationId: organization.id,
			taskId: task.id,
		});
		if (!ok) {
			showKronaError('Could not delete task.');
			return false;
		}
		showKronaSuccess('Task deleted.');
		await reloadMemberInsights(target);
		return true;
	};

	const toggleMemberTaskPriority = async (
		target: OrganizationMember,
		task: TeamTaskRow,
	) => {
		if (!organization || task.status === 'done') return;
		const ok = await setTeamTaskPrioritized({
			organizationId: organization.id,
			taskId: task.id,
			name: task.name,
			prioritized: !task.prioritized,
			assigneeUserId: task.assignee_user_id,
		});
		if (!ok) {
			showKronaError('Could not update priority.');
			return;
		}
		await reloadMemberInsights(target);
	};

	const toggleMemberTask = async (
		target: OrganizationMember,
		task: TeamTaskRow,
	) => {
		if (!organization) return;
		const { data: userRes } = await localData.auth.getUser();
		if (!userRes.user) return;
		await setTeamTaskStatus({
			organizationId: organization.id,
			taskId: task.id,
			name: task.name,
			actorUserId: userRes.user.id,
			nextStatus: task.status === 'done' ? 'pending' : 'done',
			estimatedHours: task.estimated_hours ?? null,
			createdAt: task.created_at,
		});
		await reloadMemberInsights(target);
	};

	const editMember = async (
		target: OrganizationMember,
		input: MemberEditInput,
	): Promise<boolean> => {
		if (!organization || !isOwner) return false;
		setRosterBusy(true);
		try {
			const res = await localService('teams/members/edit', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					organizationId: organization.id,
					userId: target.userId,
					challengeDate: localDateKey(),
					...input,
				}),
			});
			const json = (await res.json().catch(() => ({}))) as {
				error?: string;
				emailReinvited?: boolean;
				email?: string;
			};
			if (!res.ok) {
				showKronaError(json.error || 'Could not edit member.');
				return false;
			}
			if (json.emailReinvited) {
				showKronaSuccess(
					json.email
						? `Invite sent to ${json.email}. They must accept it to rejoin.`
						: 'Invite sent to the new email.',
				);
				await load();
				return true;
			}
			showKronaSuccess('Member updated.');
			await load();
			await reloadMemberInsights(target);
			return true;
		} finally {
			setRosterBusy(false);
		}
	};

	const copyPendingInviteLink = async (invite: PendingOrgInvite) => {
		await navigator.clipboard.writeText(teamInviteAcceptUrl(invite.token));
		showKronaSuccess(`Invite link copied for ${invite.email}.`);
	};

	const retryPendingInvite = async (invite: PendingOrgInvite) => {
		if (!organization || !isOwner) return;
		setRosterBusy(true);
		try {
			const response = await localService('teams/invite', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'retry',
					organizationId: organization.id,
					inviteId: invite.id,
				}),
			});
			const body = (await response.json().catch(() => ({}))) as {
				error?: string;
				delivery?: { status?: string };
			};
			if (!response.ok) {
				showKronaError(body.error || 'Could not retry invite email.');
				return;
			}
			showKronaSuccess(
				body.delivery?.status === 'sent'
					? `Invite email sent to ${invite.email}.`
					: `Invite saved. Email delivery will retry automatically.`,
			);
			await load();
		} finally {
			setRosterBusy(false);
		}
	};

	const purchaseSeats = async () => {
		if (!organization) return;
		const nextSeats = clampTeamSeats(seatCount + extraSeats);
		if (nextSeats <= seatCount) {
			showKronaError('Choose how many seats to add.');
			return;
		}
		setBusy(true);
		try {
			try {
				sessionStorage.setItem('krona:teamsOrgId', organization.id);
			} catch {
				/* ignore */
			}
			const res = await localService('teams/checkout', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					seats: nextSeats,
					// Interval is ignored when an active Lemon subscription is updated
					// in place; only used if the team still needs a first checkout.
					intent: 'add-members',
				}),
			});
			const json = (await res.json()) as {
				url?: string;
				error?: string;
				updated?: boolean;
			};
			if (!res.ok || !json.url) {
				throw new Error(json.error || 'Could not update seats.');
			}
			window.location.href = json.url;
		} catch (err) {
			showKronaError(
				err instanceof Error ? err.message : 'Could not add seats.',
			);
		} finally {
			setBusy(false);
		}
	};

	const selectItem = (key: string) => {
		setSelectedKey(key);
		setMobileDetails(true);
	};

	const listPanel = (
		<>
			<Box sx={{ ...kronaSideListToolbarRowSx, pb: 0 }}>
				<Input
					startDecorator={<Search size={16} aria-hidden />}
					placeholder="Search members"
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					sx={{ ...kronaSearchInputSx, flex: 1, minWidth: 0 }}
					slotProps={{
						input: { 'aria-label': 'Search members' },
					}}
				/>
				{isOwner ? (
					<Tooltip title="Buy seats and onboard new members">
						<IconButton
							size="sm"
							aria-label="Buy seats and onboard new members"
							onClick={openAddMember}
							sx={kronaPrimaryIconButtonSx}
						>
							<UserPlus size={16} />
						</IconButton>
					</Tooltip>
				) : null}
			</Box>

			{isManager ? (
				<Typography
					level="body-xs"
					sx={{
						color: 'var(--krona-text-muted)',
						px: 0.5,
						pt: 1,
						pb: 0.5,
						flexShrink: 0,
					}}
				>
					{usedSeats} / {seatCount} seats used
					{openSlots > 0
						? ` · ${openSlots} open`
						: ' · full — purchase to add more'}
				</Typography>
			) : null}

			<Box
				sx={{
					...kronaSideListScrollSx,
					display: 'flex',
					flexDirection: 'column',
					gap: '16px',
				}}
			>
				{loading && filtered.length === 0 ? (
					<Typography level="body-sm" sx={{ color: 'var(--krona-text-muted)', px: 1 }}>
						Loading…
					</Typography>
				) : filtered.length === 0 ? (
					<Box sx={{ px: 1, py: 4, textAlign: 'center' }}>
						<Typography level="body-sm" sx={{ color: 'var(--krona-text-muted)' }}>
							No team members yet.
						</Typography>
					</Box>
				) : (
					filtered.map((item) => {
						const selectedRow = item.key === selectedKey;
						const isSlot = item.kind === 'slot';
						return (
							<Box
								key={item.key}
								role="button"
								tabIndex={0}
								aria-current={selectedRow ? 'true' : undefined}
								onClick={() => selectItem(item.key)}
								onKeyDown={(e) => {
									if (e.key === 'Enter' || e.key === ' ') {
										e.preventDefault();
										selectItem(item.key);
									}
								}}
								sx={{
									px: 1.5,
									py: 1.25,
									borderRadius: '14px',
									cursor: 'pointer',
									border: isSlot
										? '1px dashed color-mix(in srgb, var(--krona-surface-border) 80%, transparent)'
										: 'none',
									bgcolor: 'transparent',
									opacity: isSlot ? 0.92 : 1,
									transition: 'background 0.15s ease',
									...(selectedRow ? kronaListItemSelectedSx : {}),
									'&:hover': {
										bgcolor: selectedRow
											? 'var(--krona-secondary-bg)'
											: 'rgba(128, 128, 128, 0.12)',
									},
								}}
							>
								<Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
									<Avatar
										src={
											item.kind === 'member'
												? item.member.avatarUrl ||
													defaultAvatarUrl(
														item.member.email ||
															item.member.displayName ||
															item.member.userId,
													)
												: undefined
										}
										sx={{ width: 36, height: 36, flexShrink: 0 }}
									>
										<UserRound size={17} />
									</Avatar>
									<Box sx={{ minWidth: 0 }}>
										<Box
											sx={{
												display: 'flex',
												alignItems: 'center',
												gap: 0.75,
												minWidth: 0,
											}}
										>
											<Typography
												level="body-md"
												sx={{
													color: isSlot
														? 'var(--krona-text-muted)'
														: 'var(--krona-text)',
													fontWeight: 600,
													overflow: 'hidden',
													textOverflow: 'ellipsis',
													whiteSpace: 'nowrap',
													minWidth: 0,
												}}
											>
												{item.name}
											</Typography>
											{item.kind === 'member' ? (
												<TeamMemberActivityBadge
													mode={timerPresence.get(item.member.userId)}
												/>
											) : null}
										</Box>
										{item.onboarded ? (
											<Typography
												level="body-xs"
												sx={{ color: 'var(--krona-text-muted)', mt: 0.25 }}
											>
												{item.title}
											</Typography>
										) : (
											<Typography
												level="body-xs"
												sx={{
													color: 'var(--krona-warning, #e6a23c)',
													mt: 0.25,
													fontWeight: 600,
												}}
											>
												Not onboarded yet
											</Typography>
										)}
									</Box>
								</Box>
							</Box>
						);
					})
				)}
			</Box>
		</>
	);

	const detailPanel = (
		<Box
			sx={{
				flex: 1,
				minHeight: 0,
				minWidth: 0,
				display: 'flex',
				flexDirection: 'column',
				overflow: 'auto',
				pt: { xs: 1, md: 0.5 },
				pb: 2,
			}}
		>
			{!selected ? (
				<DashboardWidgetEmpty icon={UserRound}>
					Select a teammate to view their stats.
				</DashboardWidgetEmpty>
			) : selected.kind === 'slot' ? (
				<Box sx={{ px: { xs: 0, md: 0.5 } }}>
					<Typography level="h3" sx={{ color: 'var(--krona-text)', mb: 0.5 }}>
						{selected.name}
					</Typography>
					<Typography
						level="body-md"
						sx={{
							color: 'var(--krona-warning, #e6a23c)',
							fontWeight: 600,
							mb: 2,
						}}
					>
						Not onboarded yet
					</Typography>
					<Typography
						level="body-md"
						sx={{ color: 'var(--krona-text-muted)', mb: 2.5 }}
					>
						This seat is included in your plan but no one has been invited yet.
						Onboard a teammate to fill it — they get an email invite and join your
						team.
					</Typography>
					{isOwner ? (
						<Button
							startDecorator={<UserPlus size={16} />}
							sx={kronaPrimaryButtonSx}
							onClick={startAddMembersOnboarding}
						>
							Onboard a member
						</Button>
					) : (
						<Typography level="body-sm" sx={{ color: 'var(--krona-text-muted)' }}>
							Ask the admin manager to invite someone into this seat.
						</Typography>
					)}
				</Box>
			) : selected.kind === 'invite' || !selected.onboarded ? (
				<Box sx={{ px: { xs: 0, md: 0.5 } }}>
					<Typography level="h3" sx={{ color: 'var(--krona-text)', mb: 0.5 }}>
						{selected.name}
					</Typography>
					<Typography
						level="body-md"
						sx={{
							color: 'var(--krona-warning, #e6a23c)',
							fontWeight: 600,
							mb: 2,
						}}
					>
						Not onboarded yet
					</Typography>
					<Typography level="body-md" sx={{ color: 'var(--krona-text-muted)' }}>
						{selected.kind === 'invite'
							? 'They’ve been invited but haven’t joined Krona for Teams yet. Stats will appear after they accept and finish setup.'
							: 'This teammate hasn’t finished onboarding. Stats will appear once they’re set up.'}
					</Typography>
					{selected.kind === 'invite' ? (
						<Box sx={{ display: 'grid', gap: 1.25, mt: 2.5 }}>
							<Typography
								level="body-sm"
								sx={{
									color:
										selected.invite.deliveryStatus === 'sent'
											? 'var(--krona-success, #22a06b)'
											: 'var(--krona-warning, #e6a23c)',
									fontWeight: 600,
								}}
							>
								{selected.invite.deliveryStatus === 'sent'
									? 'Email delivered to the provider'
									: selected.invite.deliveryStatus === 'sending'
										? 'Sending email…'
										: selected.invite.deliveryStatus === 'failed'
											? 'Email delivery needs attention'
											: 'Email queued for automatic retry'}
							</Typography>
							{selected.invite.deliveryLastError ? (
								<Typography
									level="body-xs"
									sx={{ color: 'var(--krona-text-muted)' }}
								>
									{selected.invite.deliveryLastError}
								</Typography>
							) : null}
							{isOwner ? (
								<Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
									<Button
										size="sm"
										variant="plain"
										startDecorator={<Copy size={15} />}
										onClick={() => void copyPendingInviteLink(selected.invite)}
										sx={kronaSecondaryButtonSx}
									>
										Copy invite link
									</Button>
									<Button
										size="sm"
										variant="plain"
										startDecorator={<RefreshCw size={15} />}
										loading={rosterBusy}
										onClick={() => void retryPendingInvite(selected.invite)}
										sx={kronaSecondaryButtonSx}
									>
										Retry email
									</Button>
								</Box>
							) : null}
						</Box>
					) : null}
				</Box>
			) : (
				<TeamMemberProfileDetail
					member={selected.member}
					insights={insights}
					loading={insightsLoading}
					members={members}
					projects={projects}
					canAssignTask={canCreateEditTasks}
					canViewPerformance={isManager}
					canCreateProjects={canCreateEditProjects}
					canCreateEditReminders={canCreateEditReminders}
					canManageMember={isOwner}
					busy={rosterBusy}
					onAssignTask={(input) =>
						assignTaskToMember(selected.member, input)
					}
					onCreateProject={
						canCreateEditProjects ? createProject : undefined
					}
					onUpdateTask={(task, input) =>
						updateMemberTask(selected.member, task, input)
					}
					onDeleteTask={(task) =>
						removeMemberTask(selected.member, task)
					}
					onToggleTask={(task) =>
						toggleMemberTask(selected.member, task)
					}
					onTogglePriority={(task) =>
						toggleMemberTaskPriority(selected.member, task)
					}
					onEditMember={(input) => editMember(selected.member, input)}
					onDeleteMember={() => removeMember(selected.member)}
				/>
			)}
		</Box>
	);

	return (
		<TeamAppShell
			title="Team Members"
			fillViewport
			onBack={
				mobileDetails && !isDesktopDashboard
					? () => setMobileDetails(false)
					: undefined
			}
			backAriaLabel="Back to members list"
		>
			{showRosterSkeleton ? (
				<MembersPageSkeleton />
			) : (
				<KronaResizableSplitLayout
					dividerAriaLabel="Resize members list and details"
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
					sidebar={listPanel}
					detail={detailPanel}
				/>
			)}

			<Modal open={buySeatsOpen} onClose={() => setBuySeatsOpen(false)}>
				<ModalDialog sx={kronaModalDialogSx}>
					<Box
						sx={{
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'space-between',
							mb: 1,
						}}
					>
						<Typography level="h4" sx={kronaModalTitleSx}>
							Add seats
						</Typography>
						<IconButton
							size="sm"
							aria-label="Close"
							onClick={() => setBuySeatsOpen(false)}
							sx={kronaModalCloseButtonSx}
						>
							<X size={18} />
						</IconButton>
					</Box>
					<Typography level="body-sm" sx={{ color: 'var(--krona-text-muted)', mb: 2 }}>
						Purchase more seats for {organization?.name ?? 'your team'}. After
						checkout you can invite people — no team name or logo setup again.
						{openSlots > 0
							? ` You already have ${openSlots} open seat${openSlots === 1 ? '' : 's'} you can fill without buying.`
							: ''}
					</Typography>
					{openSlots > 0 ? (
						<Button
							variant="plain"
							sx={{ mb: 2, alignSelf: 'flex-start' }}
							onClick={() => {
								setBuySeatsOpen(false);
								startAddMembersOnboarding();
							}}
						>
							Invite into open seats instead
						</Button>
					) : null}
					<Box sx={kronaModalFieldsSx}>
						<FormControl>
							<FormLabel>Seats to add</FormLabel>
							<Box
								sx={{
									display: 'flex',
									alignItems: 'center',
									gap: 1.5,
									mt: 0.5,
								}}
							>
								<IconButton
									size="sm"
									disabled={extraSeats <= 1}
									onClick={() => setExtraSeats((n) => Math.max(1, n - 1))}
									aria-label="Fewer seats"
								>
									−
								</IconButton>
								<Typography
									level="title-lg"
									sx={{ color: 'var(--krona-text)', minWidth: 32, textAlign: 'center' }}
								>
									{extraSeats}
								</Typography>
								<IconButton
									size="sm"
									disabled={seatCount + extraSeats >= TEAMS_MAX_SEATS}
									onClick={() =>
										setExtraSeats((n) =>
											Math.min(TEAMS_MAX_SEATS - seatCount, n + 1),
										)
									}
									aria-label="More seats"
								>
									+
								</IconButton>
								<Typography
									level="body-sm"
									sx={{ color: 'var(--krona-text-muted)' }}
								>
									→ {seatCount + extraSeats} total
								</Typography>
							</Box>
						</FormControl>
					</Box>
					<Button
						sx={{ ...kronaModalPrimaryActionSx, mt: 2 }}
						loading={busy}
						onClick={() => void purchaseSeats()}
					>
						Continue to checkout
					</Button>
				</ModalDialog>
			</Modal>
		</TeamAppShell>
	);
}
