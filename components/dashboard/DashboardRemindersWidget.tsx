'use client';

import * as React from 'react';
import NextLink from 'next/link';
import { Box, Chip, IconButton, Tooltip, Typography } from '@mui/joy';
import { ArrowRight, Bell, Plus } from 'lucide-react';
import { daysUntilLabel, reminderDueIso } from '@/lib/reminders';
import {
	kronaPrimaryIconButtonSx,
	kronaReminderDueChipSx,
	kronaWidgetHorizontalCardSx,
	kronaWidgetHorizontalStripLinkStyle,
	kronaWidgetViewAllCardSx,
} from '@/lib/kronaStyles';
import DashboardWidgetEmpty from '@/components/dashboard/DashboardWidgetEmpty';
import { ReminderListSkeleton } from '@/components/dashboard/DashboardWidgetSkeletons';
import {
	DashboardWidgetHeader,
	DashboardWidgetShell,
} from '@/components/dashboard/DashboardWidgetChrome';
import KronaHorizontalScrollStrip from '@/components/krona/KronaHorizontalScrollStrip';
import { useDashboardReminders } from '@/components/dashboard/useDashboardReminders';
import { useKronaLayoutMode } from '@/components/KronaLayoutModeProvider';
import { useTeamMode } from '@/components/teams/TeamModeContext';
import AddEditReminderModal, {
	type Reminder,
} from '@/components/reminders/AddEditReminderModal';
import { createUserReminder } from '@/lib/createUserReminder';
import { showKronaError, showKronaSuccess } from '@/lib/kronaToast';

export default function DashboardRemindersWidget() {
	const { isDesktopDashboard } = useKronaLayoutMode();
	const { role, canCreateEditReminders } = useTeamMode();
	const canCreateReminder = role !== 'member' || canCreateEditReminders;
	const [createOpen, setCreateOpen] = React.useState(false);
	const { reminders, loading } = useDashboardReminders();
	const visibleReminders = React.useMemo(
		() =>
			[...reminders]
				.sort(
					(a, b) =>
						new Date(reminderDueIso(a)).getTime() -
						new Date(reminderDueIso(b)).getTime(),
				)
				.slice(0, 4),
		[reminders],
	);
	const saveNewReminder = async (reminder: Reminder) => {
		try {
			const result = await createUserReminder(reminder);
			if (result.schemaHint) showKronaError(result.schemaHint);
			else showKronaSuccess('Reminder added.');
		} catch (err) {
			showKronaError(
				err instanceof Error ? err.message : 'Could not create reminder.',
			);
		}
	};

	return (
		<>
		<DashboardWidgetShell
			id="reminders"
			sx={{
				minHeight: 0,
				height: isDesktopDashboard ? '100%' : 'auto',
				display: 'flex',
				flexDirection: 'column',
			}}
		>
			<DashboardWidgetHeader
				widgetId="reminders"
				title="Reminders"
				href="/reminders"
				actions={
					!canCreateReminder ? null : (
						<Tooltip title="Add reminder">
							<IconButton
								size="sm"
								aria-label="Add reminder"
								onClick={() => setCreateOpen(true)}
								sx={kronaPrimaryIconButtonSx}
							>
								<Plus size={16} />
							</IconButton>
						</Tooltip>
					)
				}
			/>

			{loading ? (
				<Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
					<ReminderListSkeleton />
				</Box>
			) : visibleReminders.length > 0 ? (
				<KronaHorizontalScrollStrip
					sx={{
						gap: 1.25,
						flex: 1,
						minHeight: 0,
						alignItems: 'stretch',
					}}
				>
					{visibleReminders.map((reminder) => {
						const dueIso = reminderDueIso(reminder);
						const badge = daysUntilLabel(dueIso);

						return (
							<NextLink
								key={reminder.id}
								href="/reminders"
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
										level="title-sm"
										sx={{
											color: 'var(--krona-text)',
											fontWeight: 600,
											overflow: 'hidden',
											display: '-webkit-box',
											WebkitLineClamp: 2,
											WebkitBoxOrient: 'vertical',
											lineHeight: 1.35,
											minWidth: 0,
										}}
									>
										{reminder.name}
									</Typography>
									<Box
										sx={{
											display: 'flex',
											flexDirection: 'row',
											alignItems: 'center',
											flexWrap: 'wrap',
											gap: '8px',
											minWidth: 0,
										}}
									>
										<Chip
											size="sm"
											variant="soft"
											sx={kronaReminderDueChipSx(badge)}
										>
											{badge}
										</Chip>
									</Box>
								</Box>
							</NextLink>
						);
					})}
					<NextLink href="/reminders" style={kronaWidgetHorizontalStripLinkStyle}>
						<Box sx={kronaWidgetViewAllCardSx}>
							<Typography level="body-sm" sx={{ fontWeight: 600, color: 'inherit' }}>
								View all
							</Typography>
							<ArrowRight size={18} aria-hidden />
						</Box>
					</NextLink>
				</KronaHorizontalScrollStrip>
			) : (
				<Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
					<DashboardWidgetEmpty icon={Bell}>
						Never miss a deadline.
					</DashboardWidgetEmpty>
				</Box>
			)}
		</DashboardWidgetShell>
		{!canCreateReminder ? null : (
			<AddEditReminderModal
				open={createOpen}
				onClose={() => setCreateOpen(false)}
				onSave={(reminder) => {
					void saveNewReminder(reminder);
				}}
			/>
		)}
		</>
	);
}
