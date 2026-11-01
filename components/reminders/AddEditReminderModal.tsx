'use client';

import * as React from 'react';
import {
	Box,
	Button,
	FormHelperText,
	IconButton,
	Input,
	Tooltip,
	Typography,
} from '@mui/joy';
import Modal from '@mui/joy/Modal';
import ModalDialog from '@mui/joy/ModalDialog';
import FormControl from '@mui/joy/FormControl';
import FormLabel from '@mui/joy/FormLabel';
import { Info, X } from 'lucide-react';
import dayjs from 'dayjs';
import KronaDatePickerButton, {
	parseKronaDateValue,
} from '@/components/krona/KronaDatePickerButton';
import KronaSwitch from '@/components/krona/KronaSwitch';
import ReminderTypeIcon from '@/components/ReminderTypeIcon';
import { kronaPlaceholders } from '@/lib/kronaPlaceholders';
import {
	kronaInputSx,
	kronaModalCloseButtonSx,
	kronaModalDialogSx,
	kronaPrimaryButtonSx,
	kronaTabButtonSx,
} from '@/lib/kronaStyles';

export type Reminder = {
	id?: string;
	name: string;
	type: string;
	date: string;
	created: string;
	occurrence: string;
	subscriptionValue?: number | null;
	vacationEndDate?: string | null;
	activateVacationMode?: boolean;
	emailNotify?: boolean;
	taskId?: string | null;
	projectId?: string | null;
	sortOrder?: number | null;
	/** Team deadline / assigned reminders shown on personal Reminders. */
	source?: 'personal' | 'team';
	teamReminderId?: string | null;
};

export const reminderTypeOptions = [
	'Subscription',
	'Personal',
	'Work',
	'Vacation',
] as const;

export function isLinkedReminder(reminder?: Reminder | null): boolean {
	return Boolean(reminder?.taskId || reminder?.projectId || reminder?.source === 'team');
}

export function linkedReminderLabel(reminder?: Reminder | null): string | null {
	if (!reminder) return null;
	if (reminder.source === 'team') return 'Team deadline';
	if (reminder.taskId) return 'Linked to task';
	if (reminder.projectId) return 'Linked to project';
	return null;
}

export function normalizeReminderType(value: string | null | undefined): string {
	if (
		value === 'Subscription' ||
		value === 'Personal' ||
		value === 'Work' ||
		value === 'Vacation'
	) {
		return value;
	}
	if (value === 'Health') return 'Subscription';
	return 'Personal';
}

function reminderDueDateFromPicker(
	value: string,
	timeHhMm = '09:00',
): string | null {
	const parsed = parseKronaDateValue(value);
	if (!parsed) return null;
	const [rawHours, rawMinutes] = timeHhMm.split(':');
	const hours = Number.parseInt(rawHours ?? '9', 10);
	const minutes = Number.parseInt(rawMinutes ?? '0', 10);
	return dayjs(parsed)
		.startOf('day')
		.hour(Number.isFinite(hours) ? hours : 9)
		.minute(Number.isFinite(minutes) ? minutes : 0)
		.second(0)
		.millisecond(0)
		.toISOString();
}

function reminderPickerDateFromIso(iso: string | undefined): string {
	if (!iso) return '';
	const parsed = dayjs(iso);
	return parsed.isValid() ? parsed.format('YYYY-MM-DD') : '';
}

function reminderPickerTimeFromIso(iso: string | undefined): string {
	if (!iso) return '09:00';
	const parsed = dayjs(iso);
	return parsed.isValid() ? parsed.format('HH:mm') : '09:00';
}

function parseSubscriptionValueInput(raw: string): number | null {
	const cleaned = raw.trim().replace(/[^0-9.]/g, '');
	if (!cleaned) return null;
	const parsed = Number(cleaned);
	if (!Number.isFinite(parsed) || parsed < 0) return null;
	return Math.round(parsed * 100) / 100;
}

export default function AddEditReminderModal({
	open,
	onClose,
	onSave,
	initial,
}: {
	open: boolean;
	onClose: () => void;
	onSave: (reminder: Reminder) => void;
	initial?: Reminder;
}) {
	const [name, setName] = React.useState(initial?.name || '');
	const [type, setType] = React.useState(normalizeReminderType(initial?.type));
	const [date, setDate] = React.useState(
		reminderPickerDateFromIso(initial?.date),
	);
	const [time, setTime] = React.useState(
		reminderPickerTimeFromIso(initial?.date),
	);
	const [vacationEndDate, setVacationEndDate] = React.useState(
		reminderPickerDateFromIso(initial?.vacationEndDate ?? undefined),
	);
	const [occurrence, setOccurrence] = React.useState(
		initial?.occurrence || 'One time',
	);
	const [subscriptionValue, setSubscriptionValue] = React.useState(
		initial?.subscriptionValue != null ? String(initial.subscriptionValue) : '',
	);
	const [activateVacationMode, setActivateVacationMode] = React.useState(
		initial?.type === 'Vacation' ? initial.activateVacationMode !== false : true,
	);
	const [emailNotify, setEmailNotify] = React.useState(
		Boolean(initial?.emailNotify),
	);
	const [formErrors, setFormErrors] = React.useState<{
		name?: string;
		date?: string;
		vacationEndDate?: string;
		subscriptionValue?: string;
	}>({});

	React.useEffect(() => {
		setName(initial?.name || '');
		setType(normalizeReminderType(initial?.type));
		setDate(reminderPickerDateFromIso(initial?.date));
		setTime(reminderPickerTimeFromIso(initial?.date));
		setVacationEndDate(
			reminderPickerDateFromIso(initial?.vacationEndDate ?? undefined),
		);
		setOccurrence(initial?.occurrence || 'One time');
		setSubscriptionValue(
			initial?.subscriptionValue != null
				? String(initial.subscriptionValue)
				: '',
		);
		setActivateVacationMode(
			initial?.type === 'Vacation' ? initial.activateVacationMode !== false : true,
		);
		setEmailNotify(Boolean(initial?.emailNotify));
		setFormErrors({});
	}, [open, initial]);

	const occurrenceOptions = [
		'One time',
		'Weekly',
		'Monthly',
		'Quarterly',
		'Yearly',
	];

	const linked = isLinkedReminder(initial);
	const linkedLabel = linkedReminderLabel(initial);
	const showSubscriptionValue = !linked && type === 'Subscription';
	const isVacationReminder = !linked && type === 'Vacation';

	const handleSave = () => {
		const errors: {
			name?: string;
			date?: string;
			vacationEndDate?: string;
			subscriptionValue?: string;
		} = {};
		if (!name.trim()) {
			errors.name = 'Name is required.';
		}
		if (!date.trim()) {
			errors.date = 'Date is required.';
		}
		if (isVacationReminder && !vacationEndDate.trim()) {
			errors.vacationEndDate = 'End date is required.';
		}
		const parsedSubscriptionValue = showSubscriptionValue
			? parseSubscriptionValueInput(subscriptionValue)
			: null;
		if (
			showSubscriptionValue &&
			subscriptionValue.trim() &&
			parsedSubscriptionValue == null
		) {
			errors.subscriptionValue = 'Enter a valid amount.';
		}
		setFormErrors(errors);
		if (Object.keys(errors).length > 0) return;

		const dueDate = reminderDueDateFromPicker(date, time);
		if (!dueDate) {
			setFormErrors({ date: 'Enter a valid date.' });
			return;
		}
		const vacationEndDueDate = isVacationReminder
			? reminderDueDateFromPicker(vacationEndDate, time)
			: null;
		if (isVacationReminder && !vacationEndDueDate) {
			setFormErrors({ vacationEndDate: 'Enter a valid end date.' });
			return;
		}
		if (
			isVacationReminder &&
			vacationEndDueDate &&
			dayjs(vacationEndDueDate).isBefore(dayjs(dueDate), 'day')
		) {
			setFormErrors({
				vacationEndDate: 'End date must be after the start date.',
			});
			return;
		}

		const nextType = linked ? initial?.type || 'Personal' : type;
		onSave({
			...initial,
			name: name.trim(),
			type: nextType,
			date: dueDate,
			created: initial?.created || new Date().toISOString(),
			occurrence:
				linked || isVacationReminder
					? initial?.occurrence || 'One time'
					: occurrence,
			subscriptionValue:
				nextType === 'Subscription' ? parsedSubscriptionValue : null,
			vacationEndDate: nextType === 'Vacation' ? vacationEndDueDate : null,
			activateVacationMode:
				nextType === 'Vacation' ? activateVacationMode : false,
			emailNotify,
		});
		onClose();
	};

	return (
		<Modal open={open} onClose={onClose}>
			<ModalDialog
				sx={{
					...kronaModalDialogSx,
					position: 'relative',
					overflow: 'visible',
					px: { xs: '20px', sm: '24px' },
					py: '18px',
				}}
			>
				<IconButton
					size="sm"
					aria-label="Close"
					onClick={onClose}
					sx={kronaModalCloseButtonSx}
				>
					<X size={18} />
				</IconButton>
				<Typography
					level="h4"
					sx={{ mb: 1.5, pr: 4, color: 'var(--krona-text)' }}
				>
					{initial ? 'Edit reminder' : 'New reminder'}
				</Typography>
				{linked && linkedLabel ? (
					<Typography
						level="body-sm"
						sx={{ mb: 1.5, color: 'var(--krona-text-muted)' }}
					>
						{linkedLabel}. Name and date changes sync with the project.
					</Typography>
				) : null}
				<FormControl sx={{ mb: 1.25 }} error={Boolean(formErrors.name)}>
					<FormLabel sx={{ color: 'var(--krona-text)' }}>Name</FormLabel>
					<Input
						placeholder={kronaPlaceholders.reminders.name}
						value={name}
						onChange={(e) => {
							setName(e.target.value);
							if (formErrors.name) {
								setFormErrors((prev) => ({ ...prev, name: undefined }));
							}
						}}
						sx={kronaInputSx}
					/>
					{formErrors.name ? (
						<FormHelperText>{formErrors.name}</FormHelperText>
					) : null}
				</FormControl>
				{!linked ? (
					<>
						<FormControl sx={{ mb: 1.25 }}>
							<FormLabel sx={{ color: 'var(--krona-text)' }}>Type</FormLabel>
							<Box
								role="group"
								aria-label="Reminder type"
								sx={{
									display: 'grid',
									gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
									gap: 1,
								}}
							>
								{reminderTypeOptions.map((option) => (
									<Button
										key={option}
										type="button"
										variant="plain"
										aria-pressed={type === option}
										onClick={() => {
											setType(option);
											if (option !== 'Subscription') {
												setSubscriptionValue('');
												if (formErrors.subscriptionValue) {
													setFormErrors((prev) => ({
														...prev,
														subscriptionValue: undefined,
													}));
												}
											}
											if (option !== 'Vacation') {
												setVacationEndDate('');
												if (formErrors.vacationEndDate) {
													setFormErrors((prev) => ({
														...prev,
														vacationEndDate: undefined,
													}));
												}
											} else if (type !== 'Vacation') {
												setActivateVacationMode(true);
											}
										}}
										startDecorator={
											<ReminderTypeIcon type={option} size={15} />
										}
										sx={{
											...kronaTabButtonSx(type === option),
											minHeight: 38,
											border: 'none',
											boxShadow:
												type === option
													? 'none'
													: 'inset 0 0 0 1px var(--krona-surface-border)',
											overflow: 'hidden',
											fontSize: '12px',
										}}
									>
										{option}
									</Button>
								))}
							</Box>
						</FormControl>
						{showSubscriptionValue ? (
							<FormControl
								sx={{ mb: 1.25 }}
								error={Boolean(formErrors.subscriptionValue)}
							>
								<FormLabel sx={{ color: 'var(--krona-text)' }}>
									Subscription value
								</FormLabel>
								<Input
									type="number"
									placeholder={kronaPlaceholders.reminders.subscriptionValue}
									value={subscriptionValue}
									slotProps={{
										input: {
											min: 0,
											step: 0.01,
										},
									}}
									onChange={(e) => {
										setSubscriptionValue(e.target.value);
										if (formErrors.subscriptionValue) {
											setFormErrors((prev) => ({
												...prev,
												subscriptionValue: undefined,
											}));
										}
									}}
									sx={kronaInputSx}
									startDecorator={
										<Typography
											level="body-sm"
											sx={{ color: 'var(--krona-text-muted)' }}
										>
											$
										</Typography>
									}
								/>
								{formErrors.subscriptionValue ? (
									<FormHelperText>
										{formErrors.subscriptionValue}
									</FormHelperText>
								) : null}
							</FormControl>
						) : null}
						{!isVacationReminder ? (
							<FormControl sx={{ mb: 1.25 }}>
								<FormLabel sx={{ color: 'var(--krona-text)' }}>
									Occurrence
								</FormLabel>
								<Box
									role="group"
									aria-label="Reminder occurrence"
									sx={{
										display: 'grid',
										gridTemplateColumns: {
											xs: 'repeat(2, minmax(0, 1fr))',
											sm: 'repeat(3, minmax(0, 1fr))',
										},
										gap: 1,
									}}
								>
									{occurrenceOptions.map((option) => (
										<Button
											key={option}
											type="button"
											variant="plain"
											aria-pressed={occurrence === option}
											onClick={() => setOccurrence(option)}
											sx={{
												...kronaTabButtonSx(occurrence === option),
												minHeight: 38,
												border: 'none',
												boxShadow:
													occurrence === option
														? 'none'
														: 'inset 0 0 0 1px var(--krona-surface-border)',
												overflow: 'hidden',
												fontSize: '12px',
											}}
										>
											{option}
										</Button>
									))}
								</Box>
							</FormControl>
						) : null}
					</>
				) : null}
				<Box
					sx={{
						mb: 1.25,
						display: 'flex',
						alignItems: 'flex-start',
						gap: 1,
						minWidth: 0,
					}}
				>
					<FormControl
						sx={{ flex: 1, minWidth: 0 }}
						error={Boolean(formErrors.date)}
					>
						<FormLabel sx={{ color: 'var(--krona-text)' }}>
							{isVacationReminder ? 'From' : 'Date'}
						</FormLabel>
						<KronaDatePickerButton
							width="100%"
							placeholder={kronaPlaceholders.reminders.date}
							value={date}
							onChange={(value) => {
								setDate(value);
								if (formErrors.date) {
									setFormErrors((prev) => ({ ...prev, date: undefined }));
								}
							}}
						/>
						{formErrors.date ? (
							<FormHelperText>{formErrors.date}</FormHelperText>
						) : null}
					</FormControl>
					<FormControl sx={{ width: 128, flexShrink: 0 }}>
						<FormLabel
							sx={{
								color: 'transparent',
								userSelect: 'none',
								pointerEvents: 'none',
							}}
							aria-hidden
						>
							Time
						</FormLabel>
						<Input
							type="time"
							value={time}
							aria-label="Reminder time"
							onChange={(e) => setTime(e.target.value || '09:00')}
							sx={{
								...kronaInputSx,
								'& input': {
									color: 'var(--krona-text)',
								},
							}}
						/>
					</FormControl>
				</Box>
				{isVacationReminder ? (
					<>
						<FormControl
							sx={{ mb: 1.25 }}
							error={Boolean(formErrors.vacationEndDate)}
						>
							<FormLabel sx={{ color: 'var(--krona-text)' }}>To</FormLabel>
							<KronaDatePickerButton
								width="100%"
								placeholder="Select end date"
								value={vacationEndDate}
								onChange={(value) => {
									setVacationEndDate(value);
									if (formErrors.vacationEndDate) {
										setFormErrors((prev) => ({
											...prev,
											vacationEndDate: undefined,
										}));
									}
								}}
							/>
							{formErrors.vacationEndDate ? (
								<FormHelperText>{formErrors.vacationEndDate}</FormHelperText>
							) : null}
						</FormControl>
						<Box
							sx={{
								mb: 1.5,
								display: 'flex',
								alignItems: 'center',
								gap: 1,
							}}
						>
							<KronaSwitch
								checked={activateVacationMode}
								onChange={setActivateVacationMode}
								aria-label="Activate Vacation Mode during this vacation"
							/>
							<Typography
								level="body-xs"
								sx={{
									color: 'var(--krona-text)',
									fontWeight: 500,
									minWidth: 0,
								}}
							>
								Activate Vacation Mode in Krona during the selected period
							</Typography>
							<Tooltip title="Vacation Mode pauses work tracking and Daily Challenges on each selected vacation day. It turns on automatically when the period starts and turns off when it ends.">
								<IconButton
									size="sm"
									variant="plain"
									aria-label="About scheduled Vacation Mode"
									sx={{
										minWidth: 24,
										width: 24,
										minHeight: 24,
										height: 24,
										color: 'var(--krona-text-muted)',
										flexShrink: 0,
									}}
								>
									<Info size={15} aria-hidden />
								</IconButton>
							</Tooltip>
						</Box>
					</>
				) : null}
				<Box
					sx={{
						mb: 1.5,
						display: 'flex',
						alignItems: 'flex-start',
						gap: 1,
					}}
				>
					<KronaSwitch
						checked={emailNotify}
						onChange={setEmailNotify}
						aria-label="Email me when this reminder is due"
					/>
					<Box sx={{ minWidth: 0, flex: 1 }}>
						<Typography
							level="body-xs"
							sx={{
								color: 'var(--krona-text)',
								fontWeight: 500,
								display: 'flex',
								alignItems: 'center',
								gap: 0.5,
							}}
						>
							Email me when due
						</Typography>
						<Typography
							level="body-xs"
							sx={{ color: 'var(--krona-text-muted)', mt: 0.25 }}
						>
							Sends you an email when this reminder is due.
						</Typography>
					</Box>
				</Box>
				<Button onClick={handleSave} fullWidth sx={kronaPrimaryButtonSx}>
					{initial ? 'Save changes' : 'Create reminder'}
				</Button>
			</ModalDialog>
		</Modal>
	);
}
