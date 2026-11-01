'use client';

import * as React from 'react';
import {
	Box,
	Button,
	FormControl,
	FormLabel,
	IconButton,
	Input,
	Modal,
	ModalDialog,
	Option,
	Select,
	Typography,
} from '@mui/joy';
import { X } from 'lucide-react';
import KronaDatePickerButton from '@/components/krona/KronaDatePickerButton';
import KronaSwitch from '@/components/krona/KronaSwitch';
import { localDateKey, localDateKeyToIso } from '@/lib/localDate';
import {
	createTeamReminder,
	notifyManagersOfMemberCalendarItem,
	organizationMemberLabel,
	updateTeamReminder,
} from '@/lib/teams/org';
import type { TeamReminderRow } from '@/lib/teams/dashboard';
import type { OrganizationMember } from '@/lib/teams/types';
import { localData } from '@/lib/localData';
import { showKronaError, showKronaSuccess } from '@/lib/kronaToast';
import {
	kronaDropdownControlSx,
	kronaInputSx,
	kronaMenuItemSx,
	kronaModalCloseButtonSx,
	kronaModalDialogSx,
	kronaModalFieldsSx,
	kronaModalFormSx,
	kronaModalPrimaryActionSx,
	kronaModalTitleSx,
	kronaPrimaryButtonSx,
	kronaSelectSlotProps,
} from '@/lib/kronaStyles';

const ALL_TEAM = '__all__';

function isoToDateKey(iso: string | null | undefined): string {
	if (!iso) return '';
	const parsed = new Date(iso);
	if (Number.isNaN(parsed.getTime())) return '';
	return localDateKey(parsed);
}

export default function TeamReminderCreateModal({
	open,
	onClose,
	organizationId,
	members,
	initial,
	onCreated,
}: {
	open: boolean;
	onClose: () => void;
	organizationId: string;
	members: OrganizationMember[];
	initial?: TeamReminderRow | null;
	onCreated?: () => void | Promise<void>;
}) {
	const editing = Boolean(initial?.id);
	const [name, setName] = React.useState('');
	const [dueAt, setDueAt] = React.useState('');
	const [assigneeId, setAssigneeId] = React.useState<string>(ALL_TEAM);
	const [emailNotify, setEmailNotify] = React.useState(true);
	const [busy, setBusy] = React.useState(false);

	const reset = React.useCallback(() => {
		setName('');
		setDueAt('');
		setAssigneeId(ALL_TEAM);
		setEmailNotify(true);
	}, []);

	React.useEffect(() => {
		if (!open) return;
		if (initial) {
			setName(initial.name);
			setDueAt(isoToDateKey(initial.due_at));
			setAssigneeId(initial.assignee_user_id ?? ALL_TEAM);
			setEmailNotify(Boolean(initial.email_notify));
			return;
		}
		reset();
	}, [initial, open, reset]);

	const close = () => {
		if (busy) return;
		reset();
		onClose();
	};

	const submit = async () => {
		if (!name.trim() || !dueAt.trim()) return;
		const { data: userRes } = await localData.auth.getUser();
		const user = userRes.user;
		if (!user) return;
		const dueIso = localDateKeyToIso(dueAt.trim(), { hour: 9 });
		if (!dueIso) {
			showKronaError('Enter a valid due date.');
			return;
		}

		if (editing && initial) {
			const nextAssignee =
				assigneeId && assigneeId !== ALL_TEAM ? assigneeId : null;
			if (!nextAssignee) {
				showKronaError('Choose a teammate.');
				return;
			}
			setBusy(true);
			try {
				const ok = await updateTeamReminder({
					organizationId,
					reminderId: initial.id,
					name: name.trim(),
					assigneeUserId: nextAssignee,
					dueAt: dueIso,
					emailNotify,
				});
				if (!ok) {
					showKronaError('Could not save reminder.');
					return;
				}
				showKronaSuccess('Reminder saved.');
				reset();
				onClose();
				await onCreated?.();
			} finally {
				setBusy(false);
			}
			return;
		}

		const targets =
			assigneeId === ALL_TEAM
				? members.map((member) => member.userId)
				: [assigneeId];
		if (!targets.length) {
			showKronaError('Choose a teammate or assign to the whole team.');
			return;
		}
		setBusy(true);
		try {
			const created: string[] = [];
			for (const userId of targets) {
				const id = await createTeamReminder({
					organizationId,
					name: name.trim(),
					assigneeUserId: userId,
					createdBy: user.id,
					dueAt: dueIso,
					emailNotify,
				});
				if (id) created.push(id);
			}
			if (!created.length) {
				showKronaError('Could not create reminder.');
				return;
			}
			void notifyManagersOfMemberCalendarItem({
				actorUserId: user.id,
				reminderId: created[0],
				name: name.trim(),
				dueAt: dueIso,
				entityType: 'team_reminder',
			});
			showKronaSuccess(
				assigneeId === ALL_TEAM
					? `Reminder assigned to ${created.length} teammate${created.length === 1 ? '' : 's'}.`
					: 'Reminder assigned.',
			);
			reset();
			onClose();
			await onCreated?.();
		} finally {
			setBusy(false);
		}
	};

	return (
		<Modal open={open} onClose={close}>
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
					onClick={close}
					sx={kronaModalCloseButtonSx}
				>
					<X size={18} />
				</IconButton>
				<Typography level="h4" sx={kronaModalTitleSx}>
					{editing ? 'Edit reminder' : 'New reminder'}
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
								Reminder name
							</FormLabel>
							<Input
								autoFocus
								value={name}
								onChange={(e) => setName(e.target.value)}
								placeholder="Follow up with design"
								sx={kronaInputSx}
							/>
						</FormControl>
						<FormControl required>
							<FormLabel sx={{ color: 'var(--krona-text)' }}>
								Assign to
							</FormLabel>
							<Select
								placeholder={editing ? 'Choose a teammate' : 'All team'}
								value={assigneeId}
								onChange={(_, value) =>
									setAssigneeId(
										value
											? String(value)
											: editing
												? assigneeId
												: ALL_TEAM,
									)
								}
								sx={kronaDropdownControlSx}
								slotProps={kronaSelectSlotProps}
							>
								{editing ? null : (
									<Option value={ALL_TEAM} sx={kronaMenuItemSx}>
										All team
									</Option>
								)}
								{members.map((member) => {
									const label = organizationMemberLabel(member);
									return (
										<Option
											key={member.userId}
											value={member.userId}
											label={label}
											sx={kronaMenuItemSx}
										>
											{label}
										</Option>
									);
								})}
							</Select>
						</FormControl>
						<FormControl required>
							<FormLabel sx={{ color: 'var(--krona-text)' }}>
								Due date
							</FormLabel>
							<KronaDatePickerButton
								value={dueAt}
								onChange={setDueAt}
								placeholder="Select due date"
								width="100%"
							/>
						</FormControl>
						<Box
							sx={{
								display: 'flex',
								alignItems: 'flex-start',
								gap: 1,
							}}
						>
							<KronaSwitch
								checked={emailNotify}
								onChange={setEmailNotify}
								aria-label="Email assignees when this reminder is due"
							/>
							<Box sx={{ minWidth: 0, flex: 1 }}>
								<Typography
									level="body-xs"
									sx={{
										color: 'var(--krona-text)',
										fontWeight: 500,
									}}
								>
									Email assignees when due
								</Typography>
								<Typography
									level="body-xs"
									sx={{ color: 'var(--krona-text-muted)', mt: 0.25 }}
								>
									Sends to each assignee's signup inbox on the due date.
								</Typography>
							</Box>
						</Box>
					</Box>
					<Button
						type="submit"
						fullWidth
						loading={busy}
						disabled={!name.trim() || !dueAt.trim()}
						sx={{ ...kronaPrimaryButtonSx, ...kronaModalPrimaryActionSx }}
					>
						{editing ? 'Save changes' : 'Create reminder'}
					</Button>
				</Box>
			</ModalDialog>
		</Modal>
	);
}
