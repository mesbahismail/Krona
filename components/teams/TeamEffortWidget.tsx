'use client';

import * as React from 'react';
import NextLink from 'next/link';
import { Avatar, Box, IconButton, Tooltip, Typography } from '@mui/joy';
import { Check, Plus, Trophy, Users } from 'lucide-react';
import DashboardWidgetEmpty from '@/components/dashboard/DashboardWidgetEmpty';
import {
	TeamWidgetHeader,
	TeamWidgetShell,
} from '@/components/teams/TeamWidgetChrome';
import { useKronaLayoutMode } from '@/components/KronaLayoutModeProvider';
import { defaultAvatarUrl } from '@/lib/defaultAvatar';
import type { MemberChallengeProgress } from '@/lib/teams/dashboard';
import { organizationMemberLabel } from '@/lib/teams/org';
import TeamMemberActivityBadge from '@/components/teams/TeamMemberActivityBadge';
import {
	kronaPrimaryIconButtonSx,
	kronaWidgetListItemSx,
} from '@/lib/kronaStyles';

function memberLabel(row: MemberChallengeProgress) {
	const m = row.member;
	return organizationMemberLabel(m);
}

function memberAvatarSrc(row: MemberChallengeProgress) {
	const m = row.member;
	const uploaded = m.avatarUrl?.trim();
	if (uploaded) return uploaded;
	return defaultAvatarUrl(m.email || m.displayName || m.userId);
}

/** Tall widget: each member’s daily challenge progress → Team Members page. */
export default function TeamEffortWidget({
	rows,
	loading,
	openSlots = 0,
	canManageRoster = false,
}: {
	rows: MemberChallengeProgress[];
	loading?: boolean;
	/** Seats still available to invite / onboard. */
	openSlots?: number;
	seatCount?: number;
	/** Admin manager only — invite / buy seats. */
	canManageRoster?: boolean;
}) {
	const { isDesktopDashboard } = useKronaLayoutMode();

	const onboardHref =
		openSlots > 0
			? '/teams/onboarding?intent=add-members'
			: '/team/members?buySeats=1';
	const onboardLabel =
		openSlots > 0 ? 'Onboard teammate' : 'Add seats & onboard';

	return (
		<TeamWidgetShell
			sx={{
				height: isDesktopDashboard ? '100%' : 'auto',
				minHeight: isDesktopDashboard ? 0 : 280,
			}}
		>
			<TeamWidgetHeader
				title="My team"
				href="/team/members"
				navHint="All members"
				actions={
					canManageRoster ? (
						<Tooltip title={onboardLabel}>
							<IconButton
								component={NextLink}
								href={onboardHref}
								size="sm"
								aria-label={onboardLabel}
								sx={kronaPrimaryIconButtonSx}
							>
								<Plus size={16} />
							</IconButton>
						</Tooltip>
					) : null
				}
			/>

			{loading && rows.length === 0 ? (
				<Typography level="body-sm" sx={{ color: 'var(--krona-text-muted)' }}>
					Loading…
				</Typography>
			) : rows.length === 0 ? (
				<DashboardWidgetEmpty icon={Users}>
					Invite teammates to see daily challenge progress.
				</DashboardWidgetEmpty>
			) : (
				<Box
					sx={{
						display: 'flex',
						flexDirection: 'column',
						gap: 1.25,
						overflowY: 'auto',
						flex: 1,
						minHeight: 0,
						pr: 0.5,
					}}
				>
					{rows.map((row) => {
						const challengeFinished =
							row.challengeCount > 0 && row.percent >= 100;
						return (
						<Box
							key={`${row.member.id}:${row.member.userId}`}
							component={NextLink}
							href={`/team/members?member=${row.member.userId}`}
							sx={{
								...kronaWidgetListItemSx,
								borderRadius: '20px',
								p: 1.5,
								display: 'flex',
								flexDirection: 'row',
								alignItems: 'center',
								gap: 1.25,
								minWidth: 0,
								textDecoration: 'none',
								color: 'inherit',
							}}
						>
							<Avatar
								src={memberAvatarSrc(row)}
								alt=""
								sx={{
									width: 44,
									height: 44,
									flexShrink: 0,
									borderRadius: '50%',
									bgcolor: 'var(--krona-secondary-bg)',
									border: '1px solid var(--krona-surface-border)',
								}}
							/>
							<Box sx={{ flex: 1, minWidth: 0, position: 'relative', zIndex: 1 }}>
								<Box
									sx={{
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'space-between',
										gap: 1,
										mb: 0.75,
									}}
								>
									<Box
										sx={{
											display: 'flex',
											alignItems: 'center',
											gap: 0.75,
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
												minWidth: 0,
											}}
										>
											{memberLabel(row)}
										</Typography>
										<TeamMemberActivityBadge mode={row.timerStatus} />
									</Box>
									<Typography
										level="body-xs"
										sx={{
											color: challengeFinished
												? 'var(--krona-accent)'
												: 'var(--krona-text-muted)',
											flexShrink: 0,
											display: 'inline-flex',
											alignItems: 'center',
											gap: 0.5,
											fontWeight: 700,
										}}
									>
										{row.challengeCount > 0 ? (
											<>
												{challengeFinished ? (
													<Check size={12} aria-hidden />
												) : (
													<Trophy size={12} aria-hidden />
												)}
												{row.percent}%
											</>
										) : (
											'—'
										)}
									</Typography>
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
											width: `${row.percent}%`,
											borderRadius: 999,
											background: 'var(--krona-accent-gradient)',
											transition: 'width 0.35s ease',
										}}
									/>
								</Box>
								<Typography
									level="body-xs"
									sx={{
										color: challengeFinished
											? 'var(--krona-accent)'
											: 'var(--krona-text-muted)',
										mt: 0.5,
										fontWeight: challengeFinished ? 700 : 400,
										overflow: 'hidden',
										textOverflow: 'ellipsis',
										whiteSpace: 'nowrap',
									}}
								>
									{row.label}
								</Typography>
							</Box>
						</Box>
						);
					})}
				</Box>
			)}
		</TeamWidgetShell>
	);
}
