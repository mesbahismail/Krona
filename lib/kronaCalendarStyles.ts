import type { SxProps } from '@mui/joy/styles/types';
import { kronaAccentColorMix } from '@/lib/kronaAccent';
import { KRONA_DROPDOWN_POPOVER_Z_INDEX, kronaMenuSx } from '@/lib/kronaStyles';

export const KRONA_CALENDAR_ACCENT = 'var(--krona-accent)';

export const kronaCalendarPopoverSx: SxProps = {
	...kronaMenuSx,
	zIndex: KRONA_DROPDOWN_POPOVER_Z_INDEX,
	borderRadius: '28px',
	border: `1px solid ${kronaAccentColorMix(36)}`,
	p: 3,
	minWidth: 0,
	overflow: 'visible !important',
};

/** Shared react-day-picker styling for Krona calendar popovers. */
export const kronaCalendarDayPickerSx: SxProps = {
	'& .rdp-root': {
		'--rdp-accent-color': KRONA_CALENDAR_ACCENT,
		'--rdp-accent-background-color': kronaAccentColorMix(16),
		color: 'var(--krona-text)',
	},
	'& .rdp-months': { justifyContent: 'center' },
	'& .rdp-month': { gap: 1 },
	'& .rdp-month_caption': {
		display: 'flex',
		justifyContent: 'center',
		alignItems: 'center',
		fontWeight: 700,
		fontSize: 15,
		mb: 0.75,
		minHeight: 32,
		color: 'var(--krona-text)',
	},
	'& .rdp-nav': {
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'space-between',
		width: '100%',
		mb: 0.75,
	},
	'& .rdp-button_previous, & .rdp-button_next': {
		border: 'none',
		bgcolor: 'transparent',
		color: KRONA_CALENDAR_ACCENT,
		borderRadius: '14px',
		width: 32,
		height: 32,
		cursor: 'pointer',
		'&:hover': {
			bgcolor: kronaAccentColorMix(14),
		},
	},
	'& .rdp-weekdays, & .rdp-week': {
		display: 'flex',
		width: '100%',
	},
	'& .rdp-weekday': {
		flex: 1,
		textAlign: 'center',
		fontSize: 12,
		color: 'var(--krona-text-48)',
		fontWeight: 500,
		textTransform: 'capitalize',
	},
	'& .rdp-day': {
		flex: 1,
		display: 'flex',
		justifyContent: 'center',
		p: 0.25,
	},
	'& .rdp-day_button': {
		border: '1px solid transparent',
		borderRadius: '14px',
		width: 36,
		height: 36,
		bgcolor: 'transparent',
		color: 'var(--krona-text)',
		fontSize: 14,
		fontWeight: 500,
		cursor: 'pointer',
		'&:hover': {
			bgcolor: kronaAccentColorMix(12),
		},
	},
	'& .rdp-selected .rdp-day_button': {
		border: `1px solid ${KRONA_CALENDAR_ACCENT}`,
		bgcolor: kronaAccentColorMix(14),
		color: 'var(--krona-text)',
		'&:hover': {
			bgcolor: kronaAccentColorMix(22),
		},
	},
	'& .rdp-today:not(.rdp-selected) .rdp-day_button': {
		border: `1px solid ${kronaAccentColorMix(45)}`,
	},
	'& .rdp-outside .rdp-day_button': {
		color: 'var(--krona-text-36)',
		opacity: 1,
	},
	'& .rdp-disabled .rdp-day_button': {
		color: 'var(--krona-text-24)',
		cursor: 'not-allowed',
	},
};

/** Tailwind classes for shadcn Popover calendar surfaces. */
export const kronaCalendarPopoverClassName =
	'z-[1700] overflow-visible rounded-3xl border border-[color-mix(in_srgb,var(--krona-accent)_36%,transparent)] bg-[var(--krona-dropdown-bg)] p-6 text-[var(--krona-text)] shadow-[0_24px_48px_rgba(0,0,0,0.32)]';
