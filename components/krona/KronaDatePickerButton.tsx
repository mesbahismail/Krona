'use client';

import * as React from 'react';
import { Box, IconButton, Input } from '@mui/joy';
import type { SxProps } from '@mui/joy/styles/types';
import dayjs from 'dayjs';
import { Calendar as CalendarIcon, X } from 'lucide-react';
import KronaCalendar from '@/components/krona/KronaCalendar';
import {
	Popover,
	PopoverAnchor,
	PopoverContent,
	PopoverTrigger,
} from '@/components/ui/popover';
import { kronaAccentColorMix } from '@/lib/kronaAccent';
import { kronaCalendarPopoverClassName } from '@/lib/kronaCalendarStyles';
import { parseBirthDateInput } from '@/lib/profileBirthday';
import {
	KRONA_DROPDOWN_POPOVER_Z_INDEX,
	kronaSearchInputSx,
} from '@/lib/kronaStyles';
import { isDeadlineInPast, localDateKey } from '@/lib/localDate';
import { cn } from '@/lib/utils';

export type KronaDatePickerButtonProps = {
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	width?: string | number | Record<string, string | number>;
	'aria-label'?: string;
	clearable?: boolean;
	/** Block calendar days and typed dates before today (deadlines). */
	disablePast?: boolean;
	/** Inclusive earliest YYYY-MM-DD. Overrides disablePast when set. */
	minDate?: string;
};

const DISPLAY_FORMAT = 'DD/MM/YYYY';

export function parseKronaDateValue(value: string): Date | undefined {
	if (!value) return undefined;
	const parsed = dayjs(value, 'YYYY-MM-DD', true);
	return parsed.isValid() ? parsed.toDate() : undefined;
}

export function formatKronaDateValue(date: Date): string {
	return dayjs(date).format('YYYY-MM-DD');
}

function isoToDisplay(value: string): string {
	const selected = parseKronaDateValue(value);
	return selected ? dayjs(selected).format(DISPLAY_FORMAT) : '';
}

export default function KronaDatePickerButton({
	value,
	onChange,
	placeholder = 'dd/mm/yyyy',
	width = { xs: '100%', md: '125px' },
	'aria-label': ariaLabel = 'Select date',
	clearable = true,
	disablePast = false,
	minDate,
}: KronaDatePickerButtonProps) {
	const selected = parseKronaDateValue(value);
	const hasDate = Boolean(selected);
	const minIso = minDate?.trim() || (disablePast ? localDateKey() : '');
	const minDay = minIso ? parseKronaDateValue(minIso) : undefined;
	const [open, setOpen] = React.useState(false);
	const [draft, setDraft] = React.useState(() => isoToDisplay(value));

	const applyIso = React.useCallback(
		(iso: string) => {
			if (minIso && isDeadlineInPast(iso, minIso)) {
				setDraft(isoToDisplay(value));
				return false;
			}
			onChange(iso);
			setDraft(isoToDisplay(iso));
			return true;
		},
		[minIso, onChange, value],
	);

	React.useEffect(() => {
		setDraft(isoToDisplay(value));
	}, [value]);

	const commitDraft = React.useCallback(
		(raw: string) => {
			const trimmed = raw.trim();
			if (!trimmed) {
				onChange('');
				setDraft('');
				return;
			}
			const iso = parseBirthDateInput(trimmed);
			if (iso) {
				applyIso(iso);
				return;
			}
			// Invalid — keep draft until blur restores committed value.
			setDraft(isoToDisplay(value));
		},
		[applyIso, onChange, value],
	);

	const handleTextChange = (next: string) => {
		setDraft(next);
		const trimmed = next.trim();
		if (!trimmed) {
			onChange('');
			return;
		}
		if (/^\d{1,2}[\/.-]\d{1,2}[\/.-]\d{4}$/.test(trimmed)) {
			const iso = parseBirthDateInput(trimmed);
			if (iso) applyIso(iso);
		}
	};

	const clearDate = (event: React.MouseEvent) => {
		event.preventDefault();
		event.stopPropagation();
		onChange('');
		setDraft('');
		setOpen(false);
	};

	const iconColor = hasDate ? 'var(--krona-text)' : 'var(--krona-text-64)';

	const fieldSx: SxProps = {
		...kronaSearchInputSx,
		width: '100%',
		maxWidth: '100%',
		minWidth: 0,
		flexShrink: 1,
		boxSizing: 'border-box',
		color: 'var(--krona-text)',
		cursor: 'text',
		'--Input-paddingInline': '12px',
		'& input': {
			color: 'var(--krona-text)',
			cursor: 'text',
		},
		'& .MuiInput-endDecorator': {
			marginInlineEnd: '6px',
		},
		'& input::placeholder': {
			color: 'var(--krona-text-64)',
		},
		...(hasDate
			? {
					borderColor: kronaAccentColorMix(55),
					bgcolor: kronaAccentColorMix(16),
				}
			: {}),
	};

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverAnchor asChild>
				<Box
					sx={{
						width,
						maxWidth: '100%',
						minWidth: 0,
						display: 'flex',
						flexShrink: 1,
						position: 'relative',
						boxSizing: 'border-box',
					}}
				>
					<Input
						placeholder={placeholder}
						value={draft}
						aria-label={ariaLabel}
						slotProps={{
							input: {
								inputMode: 'numeric',
								autoComplete: 'bday',
							},
						}}
						onChange={(e) => handleTextChange(e.target.value)}
						onBlur={() => commitDraft(draft)}
						onKeyDown={(e) => {
							if (e.key === 'Enter') {
								e.preventDefault();
								commitDraft(draft);
							}
						}}
						startDecorator={
							<PopoverTrigger asChild>
								<IconButton
									size="sm"
									variant="plain"
									type="button"
									aria-label="Open calendar"
									aria-expanded={open}
									aria-haspopup="dialog"
									onMouseDown={(e) => e.preventDefault()}
									sx={{
										minWidth: 24,
										minHeight: 24,
										width: 24,
										height: 24,
										flexShrink: 0,
										color: iconColor,
										'&:hover': {
											bgcolor: 'var(--krona-overlay-hover)',
											color: 'var(--krona-text)',
										},
									}}
								>
									<CalendarIcon size={16} aria-hidden />
								</IconButton>
							</PopoverTrigger>
						}
						endDecorator={
							clearable && (hasDate || draft) ? (
								<IconButton
									size="sm"
									variant="plain"
									type="button"
									aria-label="Clear date"
									onClick={clearDate}
									sx={{
										minWidth: 24,
										minHeight: 24,
										width: 24,
										height: 24,
										flexShrink: 0,
										color: 'var(--krona-text-muted)',
										'&:hover': {
											bgcolor: 'var(--krona-overlay-hover)',
											color: 'var(--krona-text)',
										},
									}}
								>
									<X size={12} />
								</IconButton>
							) : undefined
						}
						sx={fieldSx}
					/>
				</Box>
			</PopoverAnchor>
			<PopoverContent
				align="start"
				side="bottom"
				sideOffset={8}
				collisionPadding={16}
				avoidCollisions
				className={cn(
					kronaCalendarPopoverClassName,
					'w-auto border p-0 shadow-none',
				)}
				style={{ zIndex: KRONA_DROPDOWN_POPOVER_Z_INDEX }}
				onOpenAutoFocus={(event) => event.preventDefault()}
			>
				<Box
					onMouseDown={(event) => event.stopPropagation()}
					onClick={(event) => event.stopPropagation()}
					sx={{ p: 3 }}
				>
					<KronaCalendar
						mode="single"
						selected={selected}
						disabled={minDay ? { before: minDay } : undefined}
						onSelect={(date) => {
							if (!date) {
								onChange('');
								setDraft('');
								return;
							}
							const iso = formatKronaDateValue(date);
							if (applyIso(iso)) setOpen(false);
						}}
					/>
				</Box>
			</PopoverContent>
		</Popover>
	);
}
