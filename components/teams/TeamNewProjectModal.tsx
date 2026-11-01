'use client';

import * as React from 'react';
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
	Typography,
} from '@mui/joy';
import { ChevronDown, X } from 'lucide-react';
import KronaDatePickerButton from '@/components/krona/KronaDatePickerButton';
import { organizationMemberLabel } from '@/lib/teams/org';
import type { OrganizationMember } from '@/lib/teams/types';
import {
	DEADLINE_PAST_MESSAGE,
	isDeadlineInPast,
} from '@/lib/localDate';
import { showKronaError } from '@/lib/kronaToast';
import {
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
} from '@/lib/kronaStyles';

export type TeamNewProjectInput = {
	name: string;
	memberUserIds: string[];
	deadline: string | null;
	addToReminders: boolean;
};

export default function TeamNewProjectModal({
	open,
	onClose,
	members,
	busy = false,
	canCreateEditReminders = false,
	defaultMemberIds,
	onSubmit,
}: {
	open: boolean;
	onClose: () => void;
	members: OrganizationMember[];
	busy?: boolean;
	canCreateEditReminders?: boolean;
	defaultMemberIds?: string[];
	onSubmit: (input: TeamNewProjectInput) => Promise<boolean> | boolean;
}) {
	const [name, setName] = React.useState('');
	const [memberIds, setMemberIds] = React.useState<string[]>([]);
	const [deadline, setDeadline] = React.useState('');
	const [addToReminders, setAddToReminders] = React.useState(false);
	const [assignMenuOpen, setAssignMenuOpen] = React.useState(false);

	const membersById = React.useMemo(
		() => new Map(members.map((m) => [m.userId, m] as const)),
		[members],
	);

	const assigneeOptions = React.useMemo(() => {
		const onboardedTeammates = members.filter(
			(m) =>
				(m.role === 'member' || m.role === 'manager') && m.onboardingCompleted,
		);
		const seen = new Set(onboardedTeammates.map((m) => m.userId));
		const extras = members.filter(
			(m) => memberIds.includes(m.userId) && !seen.has(m.userId),
		);
		return [...onboardedTeammates, ...extras];
	}, [memberIds, members]);

	const defaultMemberKey = (defaultMemberIds ?? []).join(',');

	React.useEffect(() => {
		if (!open) return;
		const defaults = defaultMemberKey
			? Array.from(new Set(defaultMemberKey.split(',').filter(Boolean)))
			: [];
		setName('');
		setMemberIds(defaults);
		setDeadline('');
		setAddToReminders(false);
		setAssignMenuOpen(false);
	}, [open, defaultMemberKey]);

	const toggleMember = (userId: string) => {
		setMemberIds((prev) =>
			prev.includes(userId)
				? prev.filter((id) => id !== userId)
				: [...prev, userId],
		);
	};

	const handleClose = () => {
		if (busy) return;
		onClose();
	};

	const handleSubmit = async () => {
		const trimmed = name.trim();
		if (!trimmed) return;
		if (isDeadlineInPast(deadline)) {
			showKronaError(DEADLINE_PAST_MESSAGE);
			return;
		}
		const ok = await onSubmit({
			name: trimmed,
			memberUserIds: memberIds,
			deadline: deadline.trim() || null,
			addToReminders:
				canCreateEditReminders && Boolean(deadline.trim()) && addToReminders,
		});
		if (ok) onClose();
	};

	return (
		<Modal open={open} onClose={handleClose} sx={{ zIndex: 1400 }}>
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
					onClick={handleClose}
					sx={kronaModalCloseButtonSx}
				>
					<X size={18} />
				</IconButton>
				<Typography level="h4" sx={kronaModalTitleSx}>
					New project
				</Typography>
				<Box
					component="form"
					sx={kronaModalFormSx}
					onSubmit={(e) => {
						e.preventDefault();
						e.stopPropagation();
						void handleSubmit();
					}}
				>
					<Box sx={kronaModalFieldsSx}>
						<FormControl required>
							<FormLabel sx={{ color: 'var(--krona-text)' }}>
								Project name
							</FormLabel>
							<Input
								autoFocus
								value={name}
								onChange={(e) => setName(e.target.value)}
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
								Choose onboarded managers or employees to include on this project.
							</Typography>
							<Dropdown
								open={assignMenuOpen}
								onOpenChange={(_, next) => setAssignMenuOpen(next)}
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
												memberIds.length > 0
													? 'var(--krona-text)'
													: 'var(--krona-text-64)',
											overflow: 'hidden',
											textOverflow: 'ellipsis',
											whiteSpace: 'nowrap',
										}}
									>
										{memberIds.length === 0
											? 'Select teammates'
											: memberIds.length === 1
												? organizationMemberLabel(
														membersById.get(memberIds[0]),
													)
												: `${memberIds.length} teammates`}
									</Typography>
									<ChevronDown size={16} aria-hidden />
								</MenuButton>
								<Menu
									placement="bottom-start"
									sx={{
										...kronaMenuSx,
										zIndex: 1500,
										minWidth: 'min(100%, 320px)',
										maxHeight: 280,
										overflowY: 'auto',
									}}
								>
									{assigneeOptions.length === 0 ? (
										<MenuItem disabled sx={kronaMenuItemSx}>
											No onboarded teammates yet
										</MenuItem>
									) : (
										assigneeOptions.map((m) => {
											const checked = memberIds.includes(m.userId);
											return (
												<MenuItem
													key={m.userId}
													sx={kronaMenuItemSx}
													onClick={(e) => {
														e.preventDefault();
														toggleMember(m.userId);
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
								value={deadline}
								onChange={(value) => {
									setDeadline(value);
									if (!value) setAddToReminders(false);
								}}
								placeholder="Optional deadline"
								width="100%"
								disablePast
							/>
						</FormControl>
						{deadline.trim() && canCreateEditReminders ? (
							<Box
								component="button"
								type="button"
								onClick={() => setAddToReminders((prev) => !prev)}
								sx={{
									display: 'flex',
									alignItems: 'center',
									gap: 1,
									textAlign: 'left',
									border: 'none',
									background: 'transparent',
									p: 0,
									cursor: 'pointer',
									color: 'var(--krona-text)',
								}}
							>
								<Checkbox
									size="sm"
									checked={addToReminders}
									tabIndex={-1}
									sx={{ pointerEvents: 'none' }}
								/>
								<Typography
									level="body-sm"
									sx={{ color: 'var(--krona-text)' }}
								>
									Add to reminders
								</Typography>
							</Box>
						) : null}
					</Box>
					<Button
						type="submit"
						fullWidth
						loading={busy}
						disabled={!name.trim()}
						sx={{ ...kronaPrimaryButtonSx, ...kronaModalPrimaryActionSx }}
					>
						Create project
					</Button>
				</Box>
			</ModalDialog>
		</Modal>
	);
}
