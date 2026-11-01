'use client';

import * as React from 'react';
import NextLink from 'next/link';
import { Box, Chip, IconButton, Tooltip, Typography } from '@mui/joy';
import { Bell, Plus } from 'lucide-react';
import DashboardWidgetEmpty from '@/components/dashboard/DashboardWidgetEmpty';
import {
	TeamWidgetHeader,
	TeamWidgetShell,
} from '@/components/teams/TeamWidgetChrome';
import KronaHorizontalScrollStrip from '@/components/krona/KronaHorizontalScrollStrip';
import { useKronaLayoutMode } from '@/components/KronaLayoutModeProvider';
import type { TeamReminderRow } from '@/lib/teams/dashboard';
import {
	kronaPrimaryIconButtonSx,
	kronaReminderDueChipSx,
	kronaWidgetHorizontalCardSx,
	kronaWidgetHorizontalStripLinkStyle,
} from '@/lib/kronaStyles';

function dueLabel(dueAt: string | null) {
	if (!dueAt) return 'No date';
	const due = new Date(dueAt);
	const now = new Date();
	const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const startDue = new Date(due.getFullYear(), due.getMonth(), due.getDate());
	const diffDays = Math.round(
		(startDue.getTime() - startToday.getTime()) / (24 * 60 * 60 * 1000),
	);
	if (diffDays < 0) return 'Overdue';
	if (diffDays === 0) return 'Today';
	if (diffDays === 1) return 'Tomorrow';
	return `In ${diffDays}d`;
}

export default function TeamRemindersWidget({
	reminders,
	loading,
	canCreate = false,
	onCreate,
}: {
	reminders: TeamReminderRow[];
	loading?: boolean;
	canCreate?: boolean;
	onCreate?: () => void;
}) {
	const { isDesktopDashboard } = useKronaLayoutMode();

	return (
		<TeamWidgetShell
			sx={{
				height: isDesktopDashboard ? '100%' : 'auto',
				minHeight: isDesktopDashboard ? 0 : undefined,
			}}
		>
			<TeamWidgetHeader
				title="Team reminders"
				href="/team/reminders"
				navHint="All reminders"
				actions={canCreate && onCreate ? (
					<Tooltip title="Add reminder">
						<IconButton
							size="sm"
							aria-label="Add reminder"
							onClick={onCreate}
							sx={kronaPrimaryIconButtonSx}
						>
							<Plus size={16} />
						</IconButton>
					</Tooltip>
				) : undefined}
			/>

			{loading && reminders.length === 0 ? (
				<Typography level="body-sm" sx={{ color: 'var(--krona-text-muted)' }}>
					Loading…
				</Typography>
			) : reminders.length === 0 ? (
				<DashboardWidgetEmpty icon={Bell}>
					No open team reminders.
				</DashboardWidgetEmpty>
			) : (
				<Box
					sx={{
						flex: 1,
						minHeight: 0,
						display: 'flex',
						// Shadow bleed is pt 16 / mt -8. Pull 8px so title→cards matches My team (20px).
						mt: '-8px',
					}}
				>
				<KronaHorizontalScrollStrip
					sx={{
						gap: 1.25,
						flex: 1,
						minHeight: 0,
						alignItems: 'stretch',
					}}
				>
					{reminders.map((reminder) => {
						const badge = dueLabel(reminder.due_at);
						return (
						<NextLink
							key={reminder.id}
							href="/team/reminders"
							style={kronaWidgetHorizontalStripLinkStyle}
						>
							<Box
								sx={{
									...kronaWidgetHorizontalCardSx,
									width: 154,
									p: 1.5,
									display: 'flex',
									flexDirection: 'column',
									justifyContent: 'space-between',
									gap: 1,
									height: '100%',
								}}
							>
								<Typography
									level="body-sm"
									sx={{
										color: 'var(--krona-text)',
										fontWeight: 600,
										overflow: 'hidden',
										textOverflow: 'ellipsis',
										display: '-webkit-box',
										WebkitLineClamp: 2,
										WebkitBoxOrient: 'vertical',
									}}
								>
									{reminder.name}
								</Typography>
								<Chip
									size="sm"
									variant="soft"
									sx={{
										alignSelf: 'flex-start',
										...kronaReminderDueChipSx(badge),
									}}
								>
									{badge}
								</Chip>
							</Box>
						</NextLink>
						);
					})}
				</KronaHorizontalScrollStrip>
				</Box>
			)}
		</TeamWidgetShell>
	);
}
