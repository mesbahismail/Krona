import type { SxProps } from '@mui/joy/styles/types';
import { kronaAccentColorMix } from '@/lib/kronaAccent';

/** Semibold — unified weight for page, section, and widget titles. */
export const KRONA_TITLE_FONT_WEIGHT = 600;

export const kronaTitleSx: SxProps = {
	fontWeight: KRONA_TITLE_FONT_WEIGHT,
};

/**
 * Downward-only shadow beneath in-widget card rows. The negative spread cancels
 * the sideways blur so vertical scroll containers (which must clip overflow-x)
 * never slice the shadow at the card edges.
 */
export const kronaWidgetItemShadow = 'var(--krona-widget-item-shadow)';

/** Nav-matching glass panel (widgets, cards). */
export const kronaWidgetCardSx: SxProps = {
	borderRadius: '24px',
	border: '1px solid var(--krona-surface-border)',
	background: 'var(--krona-widget-bg)',
	backdropFilter: 'blur(var(--krona-widget-blur)) saturate(var(--krona-widget-saturate))',
	WebkitBackdropFilter: 'blur(var(--krona-widget-blur)) saturate(var(--krona-widget-saturate))',
	boxShadow: 'var(--krona-widget-shadow)',
	// Keep the blur on a single composited layer. Without this, a small repaint
	// inside the card (a ticking timer digit, a refreshed count) re-runs the
	// backdrop blur for just that dirty rect, which shows up as a brighter
	// vertical band flickering across the card.
	transform: 'translateZ(0)',
	display: 'flex',
	flexDirection: 'column',
	minHeight: 0,
	overflow: 'hidden',
	height: { md: '100%' },
	color: 'var(--krona-text)',
	transition: 'border-color 0.25s ease',
	'&:hover': {
		borderColor: 'var(--krona-widget-border-hover)',
	},
};

/** Teams onboarding panels — same glass as dashboard widgets. */
export const kronaTeamsOnboardingPanelSx: SxProps = {
	borderRadius: '24px',
	border: '1px solid var(--krona-surface-border)',
	background: 'var(--krona-widget-bg)',
	backdropFilter: 'blur(var(--krona-widget-blur)) saturate(var(--krona-widget-saturate))',
	WebkitBackdropFilter: 'blur(var(--krona-widget-blur)) saturate(var(--krona-widget-saturate))',
	boxShadow: 'var(--krona-widget-shadow)',
	color: 'var(--krona-text)',
	transform: 'translateZ(0)',
};

/** ClassName twin of homepage widget glass (login / onboarding cards). */
export const kronaWidgetPanelClassName =
	'rounded-[24px] border border-[var(--krona-surface-border)] bg-[var(--krona-widget-bg)] shadow-[var(--krona-widget-shadow)] backdrop-blur-[var(--krona-widget-blur)] [backdrop-filter:blur(var(--krona-widget-blur))_saturate(var(--krona-widget-saturate))]';

export const kronaTeamsOnboardingPageSx: SxProps = {
	maxWidth: 520,
	mx: 'auto',
	px: 2,
	pt: 'calc(var(--krona-top-height, 60px) + 12px)',
	pb: 0,
	height: '100dvh',
	maxHeight: '100dvh',
	display: 'flex',
	flexDirection: 'column',
};

/** Muted text action (Skip) — matches home page link-style controls. */
export const kronaTextLinkButtonSx: SxProps = {
	color: 'var(--krona-text-muted)',
	fontWeight: 500,
	textTransform: 'none',
	minHeight: 'var(--krona-control-height)',
	'&:hover': {
		color: 'var(--krona-text)',
		bgcolor: 'transparent',
	},
};

/** Full-bleed glass shell (notes, split views). */
export const kronaGlassShellSx: SxProps = {
	borderRadius: { xs: '20px', md: '24px' },
	border: '1px solid var(--krona-surface-border)',
	background: 'var(--krona-surface-bg)',
	backdropFilter: 'blur(var(--krona-shell-blur)) saturate(var(--krona-shell-saturate))',
	WebkitBackdropFilter: 'blur(var(--krona-shell-blur)) saturate(var(--krona-shell-saturate))',
	boxShadow: 'none',
	display: 'flex',
	flexDirection: 'column',
	minHeight: 0,
	overflow: 'hidden',
	color: 'var(--krona-text)',
};

export const kronaListItemSelectedSx: SxProps = {
	borderRadius: '14px',
	bgcolor: 'var(--krona-secondary-bg)',
};

/** Vertical gap between rows in widget scroll lists (8px with default Joy spacing). */
export const kronaWidgetListGap = 1;

export const kronaWidgetListScrollSx: SxProps = {
	display: 'flex',
	flexDirection: 'column',
	gap: kronaWidgetListGap,
	// Room for row box-shadows inside overflow-x: hidden scroll areas.
	// Negative margin keeps cards aligned with the widget header/search.
	px: '16px',
	mx: '-16px',
	width: 'calc(100% + 32px)',
	boxSizing: 'border-box',
	pt: '16px',
	mt: '-8px',
	pb: '24px',
	mb: '-16px',
};

/** Task completion checkbox in dashboard tasks widget. */
export const kronaTaskCheckboxSx: SxProps = {
	width: 24,
	height: 24,
	minWidth: 24,
	minHeight: 24,
	flexShrink: 0,
	borderRadius: '10px',
	overflow: 'visible',
	'--Checkbox-size': '24px',
	'& .MuiCheckbox-checkbox': {
		width: 24,
		height: 24,
		border: 'none',
		backgroundColor: 'transparent',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
	},
	'& svg': {
		color: '#fff',
		stroke: 'currentColor',
		width: 16,
		height: 16,
		flexShrink: 0,
	},
};

/** Compact task row action icons (star, timer, ⋯) — shared hover chip; pair with kronaTaskRowActionsSx gap. */
export const kronaTaskRowActionButtonSize = 26;

export const kronaTaskRowActionButtonBaseSx: SxProps = {
	flexShrink: 0,
	minWidth: kronaTaskRowActionButtonSize,
	width: kronaTaskRowActionButtonSize,
	minHeight: kronaTaskRowActionButtonSize,
	height: kronaTaskRowActionButtonSize,
	p: 0,
	lineHeight: 0,
	borderRadius: '12px',
	color: 'var(--krona-text-72)',
	bgcolor: 'transparent',
	backgroundColor: 'transparent',
	boxShadow: 'none',
	transition: 'color 0.15s ease, background-color 0.15s ease',
	'&:hover': {
		color: 'var(--krona-text)',
		bgcolor: 'var(--krona-overlay-hover)',
	},
	'&:active': {
		bgcolor: 'var(--krona-overlay-active)',
	},
};

/** No chip background when star/timer toggle is active (pressed). */
export const kronaTaskRowActionActiveNoBgSx: SxProps = {
	bgcolor: 'transparent',
	backgroundColor: 'transparent',
	boxShadow: 'none',
	'&[aria-pressed="true"]': {
		bgcolor: 'transparent',
		backgroundColor: 'transparent',
		boxShadow: 'none',
	},
	'&[aria-pressed="true"]:hover': {
		bgcolor: 'transparent',
		backgroundColor: 'transparent',
		boxShadow: 'none',
	},
	'&[aria-pressed="true"]:active': {
		bgcolor: 'transparent',
		backgroundColor: 'transparent',
		boxShadow: 'none',
	},
	'&[aria-pressed="true"]:focus-visible': {
		bgcolor: 'transparent',
		backgroundColor: 'transparent',
		boxShadow: 'none',
	},
};

export const kronaTaskRowMoreMenuButtonSx: SxProps = {
	...kronaTaskRowActionButtonBaseSx,
	color: 'var(--krona-text)',
	'& svg': {
		opacity: 0.64,
		transition: 'opacity 0.15s ease',
	},
	'&:hover': {
		color: 'var(--krona-text)',
		bgcolor: 'var(--krona-overlay-hover)',
		'& svg': { opacity: 1 },
	},
	'&:active svg, &:focus-visible svg, &[aria-expanded="true"] svg': {
		opacity: 1,
	},
};

export const kronaTaskPriorityStarButtonSx = (
	prioritized: boolean,
): SxProps => ({
	...kronaTaskRowActionButtonBaseSx,
	...(prioritized
		? {
				color: '#F5C842',
				'&:hover': {
					color: '#F5C842',
					bgcolor: 'var(--krona-overlay-hover)',
				},
				'&:active': {
					bgcolor: 'var(--krona-overlay-active)',
				},
				'&[aria-pressed="true"]': {
					color: '#F5C842',
					bgcolor: 'transparent',
					backgroundColor: 'transparent',
				},
				'&[aria-pressed="true"]:hover': {
					color: '#F5C842',
					bgcolor: 'var(--krona-overlay-hover)',
					backgroundColor: 'var(--krona-overlay-hover)',
				},
				'&[aria-pressed="true"]:active': {
					bgcolor: 'var(--krona-overlay-active)',
					backgroundColor: 'var(--krona-overlay-active)',
				},
			}
		: {
				color: 'var(--krona-text-36)',
				'&:hover': {
					color: 'var(--krona-text)',
					bgcolor: 'var(--krona-overlay-hover)',
				},
				'&:active': {
					bgcolor: 'var(--krona-overlay-active)',
				},
			}),
});

/** Projects task row — select task for timer (between star and ⋯). */
export const kronaTaskTimerTrackButtonSx = (active: boolean): SxProps => ({
	...kronaTaskRowActionButtonBaseSx,
	...(active
		? {
				...kronaTaskRowActionActiveNoBgSx,
				color: kronaAccentColorMix(92),
				'&:hover': {
					color: kronaAccentColorMix(92),
					bgcolor: 'transparent',
					backgroundColor: 'transparent',
				},
				'&:active': {
					bgcolor: 'transparent',
					backgroundColor: 'transparent',
				},
				'&[aria-pressed="true"]': {
					color: kronaAccentColorMix(92),
					bgcolor: 'transparent',
					backgroundColor: 'transparent',
				},
			}
		: {
				color: 'var(--krona-text-36)',
				'&:hover': {
					color: 'var(--krona-text-72)',
					bgcolor: 'var(--krona-overlay-hover)',
				},
			}),
});

/** Projects task row: checkbox → name/details (+50% vs base flex gap 1). */
export const kronaTaskListCheckboxContentGap = 0.5;

/** Projects task row: task name → time/deadline (+30% vs previous 0.25). */
export const kronaTaskListNameDetailsGap = 0.325;

/** Task name in projects list — wraps to a second line instead of truncating. */
export const kronaTaskListItemNameSx: SxProps = {
	minWidth: 0,
	width: '100%',
	userSelect: 'text',
	color: 'var(--krona-text)',
	whiteSpace: 'normal',
	wordBreak: 'break-word',
	overflowWrap: 'anywhere',
	lineHeight: 1.35,
	maxHeight: 'calc(1.35em * 2)',
	overflow: 'hidden',
	cursor: 'pointer',
};

/** Star + timer + ⋯ grouped at the end of a task row — 4px gap keeps hover chips from touching. */
export const kronaTaskRowActionsSx: SxProps = {
	display: 'flex',
	alignItems: 'center',
	gap: '4px',
	flexShrink: 0,
};

/** Shimmer placeholders in dashboard widgets. */
export const kronaSkeletonSx: SxProps = {
	bgcolor: 'color-mix(in srgb, var(--krona-text) 8%, transparent)',
	'&::after': {
		background:
			'linear-gradient(90deg, transparent, color-mix(in srgb, var(--krona-text) 12%, transparent), transparent)',
	},
};

/** “All projects” / “All notes” chip on widget title links (revealed on widget hover). */
export const kronaWidgetNavHintSx: SxProps = {
	display: 'inline-flex',
	alignItems: 'center',
	gap: 0.5,
	flexShrink: 0,
	borderRadius: '999px',
		border: '1px solid transparent',
	maxWidth: 0,
	minWidth: 0,
	overflow: 'hidden',
	opacity: 0,
	visibility: 'hidden',
	ml: 0,
	px: 0,
	py: 0.35,
	bgcolor: 'var(--krona-overlay-hover)',
	color: 'var(--krona-text)',
	pointerEvents: 'none',
	transition:
		'opacity 0.15s ease, visibility 0.15s ease, max-width 0.15s ease, margin 0.15s ease, padding 0.15s ease, border-color 0.15s ease, background-color 0.2s ease, color 0.2s ease',
	'& .krona-widget-nav-hint-label': {
		color: 'inherit',
		fontSize: 11,
		fontWeight: 500,
		whiteSpace: 'nowrap',
		lineHeight: 1.2,
	},
	'& .krona-widget-nav-arrow': {
		color: 'inherit',
		flexShrink: 0,
		transition: 'color 0.2s ease',
	},
};

/** Applied from `.krona-dashboard-widget:hover` / `:focus-within`. */
export const kronaWidgetNavHintRevealSx: SxProps = {
	opacity: 1,
	visibility: 'visible',
	maxWidth: 280,
	ml: 0.75,
	px: 1,
	pointerEvents: 'auto',
	borderColor: 'color-mix(in srgb, var(--krona-text) 12%, transparent)',
	'&:hover': {
		bgcolor: 'var(--krona-overlay-strong)',
		color: 'var(--krona-text)',
		borderColor: 'color-mix(in srgb, var(--krona-text) 18%, transparent)',
	},
};

/** In-widget list rows (tasks, reminders, notes). */
export const kronaWidgetListItemSx: SxProps = {
	borderRadius: '16px',
	border: '1px solid var(--krona-surface-border)',
	bgcolor: 'var(--krona-widget-bg)',
	boxShadow: kronaWidgetItemShadow,
	position: 'relative',
	isolation: 'isolate',
	transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
	'&::before': {
		content: '""',
		position: 'absolute',
		inset: 0,
		borderRadius: 'inherit',
		pointerEvents: 'none',
		transition: 'background-color 0.2s ease',
		bgcolor: 'transparent',
		zIndex: 0,
	},
	'&:hover': {
		borderColor: 'var(--krona-widget-border-hover)',
	},
	'&:hover::before': {
		bgcolor: 'var(--krona-widget-list-item-hover)',
	},
};

/** Small accent chip behind list icons (project folders, entity rows). */
export const kronaIconTileSx: SxProps = {
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
	width: 32,
	height: 32,
	borderRadius: '14px',
	flexShrink: 0,
	bgcolor: 'var(--krona-icon-tile-bg)',
	color: 'var(--krona-icon-tile-fg)',
};

/** Timer-selected task — border + fill only (matches dashboard timer task chip). */
export const kronaTimerSelectedTaskBorder = `1px solid ${kronaAccentColorMix(36)}`;

export const kronaTimerSelectedTaskBg = kronaAccentColorMix(
	12,
	'var(--krona-widget-bg)',
);

/** Border + background only — same as the active task chip in the timer widget. */
export const kronaTimerSelectedTaskAccentSx: SxProps = {
	border: kronaTimerSelectedTaskBorder,
	bgcolor: kronaTimerSelectedTaskBg,
};

/** Project task cards share the homepage widget surface and hover treatment. */
export const kronaTaskListRowSx = (options?: {
	highlighted?: boolean;
	selected?: boolean;
}): SxProps => {
	const highlighted = options?.highlighted ?? false;
	const selected = options?.selected ?? false;

	return {
		...kronaWidgetListItemSx,
		boxSizing: 'border-box',
		width: '100%',
		px: 1.25,
		mb: 1,
		bgcolor: selected
			? kronaTimerSelectedTaskBg
			: highlighted
				? 'var(--krona-secondary-bg)'
				: 'var(--krona-widget-bg)',
		border: selected
			? kronaTimerSelectedTaskBorder
			: '1px solid var(--krona-surface-border)',
		...(selected || highlighted
			? { '&:hover::before': { bgcolor: 'transparent' } }
			: {}),
	};
};

/**
 * A clipping box (scroll strip, `overflow: hidden` row) cuts the card shadow
 * (`0 4px 12px`) at its edges. Reserve that room as padding and cancel it with
 * matching negative margins so shadows render fully without moving the box.
 */
export const kronaShadowBleedSx = {
	pt: '16px',
	pb: '24px',
	pl: '12px',
	pr: '12px',
	mt: '-8px',
	mb: '-16px',
	ml: '-12px',
	mr: '-12px',
	width: 'calc(100% + 24px)',
} as const;

/** Fixed-width cards in horizontal widget strips (notes, reminders). */
export const kronaWidgetHorizontalCardSx: SxProps = {
	...kronaWidgetListItemSx,
	flex: '0 0 auto',
	width: 140,
	minHeight: 108,
	boxSizing: 'border-box',
	borderRadius: '20px',
};

/** Due badge on reminder cards — overdue red, upcoming accent. */
export function kronaReminderDueChipSx(label: string): SxProps {
	if (label === 'Overdue') {
		return {
			fontWeight: 600,
			flexShrink: 0,
			bgcolor: 'color-mix(in srgb, #ef4444 22%, transparent)',
			color: '#ef4444',
			border: '1px solid color-mix(in srgb, #ef4444 48%, transparent)',
		};
	}
	if (label === 'No date') {
		return {
			fontWeight: 600,
			flexShrink: 0,
			bgcolor: 'var(--krona-overlay-hover)',
			color: 'var(--krona-text-muted)',
			border: '1px solid var(--krona-surface-border)',
		};
	}
	return {
		fontWeight: 600,
		flexShrink: 0,
		bgcolor: 'var(--krona-accent-soft-bg)',
		color: 'var(--krona-accent-soft-text)',
		border: '1px solid var(--krona-accent-soft-border)',
	};
}

/** NextLink wrapper so strip cards share the tallest row height. */
export const kronaWidgetHorizontalStripLinkStyle = {
	textDecoration: 'none',
	flexShrink: 0,
	alignSelf: 'stretch',
	display: 'flex',
} as const;

/** Trailing “View all” card in notes / reminders strips. */
export const kronaWidgetViewAllCardSx: SxProps = {
	...kronaWidgetHorizontalCardSx,
	width: 104,
	height: '100%',
	p: 1.5,
	display: 'flex',
	flexDirection: 'column',
	alignItems: 'center',
	justifyContent: 'center',
	gap: 0.75,
	color: 'var(--krona-text-muted)',
};

/** Widget chrome padding (top reduced for tighter dashboard layout). */
export const kronaWidgetPaddingSx: SxProps = {
	pt: '16px',
	px: { xs: '12px', md: '24px' },
	pb: '24px',
	boxSizing: 'border-box',
};

/** Unified dropdown / action menu surface — matches calendar popover (`--krona-dropdown-bg`). */
export const KRONA_DROPDOWN_POPOVER_Z_INDEX = 1700;

/**
 * Popper modifiers so menus/listboxes/calendars flip above or below the
 * anchor when the viewport (or modal) would otherwise clip them.
 */
export const kronaPopoverPositionModifiers = [
	{ name: 'offset', options: { offset: [0, 8] as [number, number] } },
	{
		name: 'flip',
		options: {
			padding: 12,
			fallbackPlacements: [
				'top-end',
				'top-start',
				'top',
				'bottom-end',
				'bottom-start',
				'bottom',
			],
		},
	},
	{
		name: 'preventOverflow',
		options: {
			padding: 12,
			altAxis: true,
			boundary: 'viewport' as const,
			tether: false,
		},
	},
];

export const kronaDropdownSurfaceSx: SxProps = {
	borderRadius: '20px',
	background: 'var(--krona-dropdown-bg)',
	border: '1px solid var(--krona-surface-border)',
	color: 'var(--krona-text)',
	backdropFilter: 'blur(var(--krona-shell-blur)) saturate(var(--krona-shell-saturate))',
	WebkitBackdropFilter: 'blur(var(--krona-shell-blur)) saturate(var(--krona-shell-saturate))',
	boxShadow: 'var(--krona-dropdown-shadow)',
	overflow: 'hidden',
	'--List-padding': '6px',
	'--List-radius': '20px',
	'--ListItem-radius': '14px',
};

export const kronaMenuSx: SxProps = {
	...kronaDropdownSurfaceSx,
	zIndex: KRONA_DROPDOWN_POPOVER_Z_INDEX,
};

/** Joy Select listbox popover — above modals, scrollable options. */
export const kronaSelectListboxSx: SxProps = {
	...kronaDropdownSurfaceSx,
	zIndex: KRONA_DROPDOWN_POPOVER_Z_INDEX,
	maxHeight: 'min(50vh, 360px)',
	overflow: 'auto',
};

export const kronaSelectSlotProps = {
	listbox: {
		sx: kronaSelectListboxSx,
		modifiers: kronaPopoverPositionModifiers,
	},
};

/** Standard menu / option row inside dropdown surfaces. */
export const kronaMenuItemSx: SxProps = {
	color: 'var(--krona-text)',
	borderRadius: '14px',
	outline: 'none',
	'&:hover': {
		bgcolor: 'var(--krona-secondary-bg)',
	},
	'&:focus, &:focus-visible, &.Mui-focusVisible': {
		outline: 'none',
		boxShadow: 'none',
		bgcolor: 'var(--krona-secondary-bg)',
	},
};

/** Mobile nav / action drawer — same glass tokens as dropdowns. */
export const kronaActionDrawerSx: SxProps = {
	background: 'var(--krona-dropdown-bg)',
	backdropFilter: 'blur(var(--krona-shell-blur)) saturate(var(--krona-shell-saturate))',
	WebkitBackdropFilter: 'blur(var(--krona-shell-blur)) saturate(var(--krona-shell-saturate))',
	borderRight: '1px solid var(--krona-surface-border)',
	boxShadow: 'none',
	color: 'var(--krona-text)',
};

/** Standard modal shell (~40vw, 24px radius). Dark: #000 8%; light: white 8%. */
export const kronaModalDialogSx: SxProps = {
	borderRadius: '28px',
	border: '1px solid var(--krona-surface-border)',
	background: 'var(--krona-modal-bg)',
	backdropFilter: 'blur(32px) saturate(200%)',
	WebkitBackdropFilter: 'blur(32px) saturate(200%)',
	color: 'var(--krona-text)',
	boxShadow: '0 24px 64px rgba(0, 0, 0, 0.2)',
	width: { xs: 'min(92vw, 420px)', sm: '40vw' },
	minWidth: { xs: 280, sm: 320 },
	maxWidth: 520,
	/* Cap to the viewport so tall forms (e.g. Edit member) scroll inside. */
	maxHeight: 'calc(100dvh - 2rem)',
	overflowX: 'hidden',
	overflowY: 'auto',
	overscrollBehavior: 'contain',
	px: '32px',
	py: '24px',
	boxSizing: 'border-box',
};

/** Equal vertical rhythm: title → fields and fields → primary action. */
export const KRONA_MODAL_SECTION_GAP = '16px';
/** Spacing between stacked fields inside a modal form. */
export const KRONA_MODAL_FIELD_GAP = '14px';

export const kronaModalTitleSx: SxProps = {
	mb: KRONA_MODAL_SECTION_GAP,
	pr: 4,
	color: 'var(--krona-text)',
};

export const kronaModalFormSx: SxProps = {
	display: 'flex',
	flexDirection: 'column',
	gap: 0,
};

export const kronaModalFieldsSx: SxProps = {
	display: 'flex',
	flexDirection: 'column',
	gap: KRONA_MODAL_FIELD_GAP,
};

export const kronaModalPrimaryActionSx = {
	mt: KRONA_MODAL_SECTION_GAP,
} as const;

export const kronaModalCloseButtonSx: SxProps = {
	position: 'absolute',
	top: 16,
	right: 16,
	color: 'var(--krona-text-48)',
	borderRadius: '999px',
	'&:hover': {
		bgcolor: 'var(--krona-overlay-hover)',
		color: 'var(--krona-text-72)',
	},
};

/** Settings page content row — matches main app column width. */
export const SETTINGS_PAGE_MAX_WIDTH = 960;

/** Shared side-list split (Projects, Notes, Reminders). */
export const KRONA_SIDE_LIST_DEFAULT_LEFT_PCT = 30;
export const KRONA_SIDE_LIST_MIN_LEFT_PCT = 30;
export const KRONA_SIDE_LIST_MAX_LEFT_PCT = 70;
export const KRONA_SIDE_LIST_MIN_WIDTH_PX = 220;
export const KRONA_SIDE_LIST_MAX_WIDTH_PX = 600;
export const KRONA_SIDE_LIST_SIDEBAR_PR = '24px';
export const KRONA_SIDE_LIST_DETAIL_PL = '24px';

/**
 * Height of the fade where list rows dissolve under a search toolbar. Matches
 * the 20px search→list gap, so nothing is dimmed while scrolled to the top.
 */
export const KRONA_LIST_TOP_FADE = '20px';

/**
 * Masks the top of a scroll area so rows fade into the page background as they
 * pass under the search toolbar. A mask beats an overlay here: it works over
 * the themed gradient and over widget surfaces without matching either.
 */
export const kronaListTopFadeMask = `linear-gradient(to bottom, transparent 0, #000 ${KRONA_LIST_TOP_FADE})`;

export const kronaListTopFadeSx = {
	maskImage: kronaListTopFadeMask,
	WebkitMaskImage: kronaListTopFadeMask,
} as const;

/** Matching resizable list panels for Projects and Reminders. */
export const kronaSideListPanelSx: SxProps = {
	...kronaWidgetCardSx,
	height: '100%',
	alignSelf: 'stretch',
	boxSizing: 'border-box',
	p: 2,
	// Override the split layout's responsive right padding at every breakpoint.
	pr: { xs: 2, md: 2 },
	pl: { xs: 2, md: 2 },
	minHeight: 0,
	minWidth: 0,
	flexGrow: { xs: 1, md: 0 },
	overflow: 'hidden',
};

/** Full-height tabbed panel; never inherit the desktop sidebar's flex-grow: 0. */
export const kronaStackedListPanelSx: SxProps = {
	...kronaSideListPanelSx,
	height: 'auto',
	flex: '1 1 0%',
	flexGrow: 1,
	display: 'flex',
	flexDirection: 'column',
};

/** Keep list controls fixed while cards scroll inside their shared panel. */
export const kronaSideListPanelBodySx: SxProps = {
	flex: 1,
	minHeight: 0,
	minWidth: 0,
	overflowY: 'auto',
	overflowX: 'hidden',
	overscrollBehavior: 'contain',
	pb: 1,
};

export const kronaSideListCardSx = (selected = false): SxProps => ({
	...kronaWidgetListItemSx,
	display: 'flex',
	flexDirection: 'column',
	gap: 1,
	p: 2,
	borderRadius: '18px',
	cursor: 'pointer',
	...(selected ? {
		borderColor: 'var(--krona-accent-35)',
		bgcolor: 'color-mix(in srgb, var(--krona-accent) 6%, var(--krona-widget-bg))',
	} : {}),
});

/** Search + create row above a page side list. */
export const kronaSideListToolbarRowSx: SxProps = {
	position: 'relative',
	pt: 1.5,
	pb: 0,
	display: 'flex',
	alignItems: 'center',
	gap: 1,
	flexShrink: 0,
};

/** Scrollable body below the side-list toolbar. */
export const kronaSideListScrollSx: SxProps = {
	flex: 1,
	minHeight: 0,
	overflowY: 'auto',
	overflowX: 'hidden',
	overscrollBehavior: 'contain',
	pt: '20px',
	pb: 1.5,
	minWidth: 0,
	...kronaListTopFadeSx,
};

/** Settings top nav — horizontal tabs, left-aligned flush with content. */
export const kronaSettingsNavListSx: SxProps = {
	'--List-padding': '6px',
	'--List-gap': '8px',
	'--ListItem-paddingY': '0px',
	'--ListItem-paddingX': '0px',
	'--ListItem-minHeight': '0px',
	gap: 1,
	p: '0 !important',
	m: 0,
	bgcolor: 'transparent',
	border: 'none',
	boxShadow: 'none',
	display: 'flex',
	flexDirection: 'row',
	flexWrap: 'wrap',
	width: '100%',
	alignItems: 'center',
	justifyContent: 'flex-start',
};

/** Shared 14px type for buttons, inputs, tabs, and toolbar controls. */
export const kronaControlTextSx: SxProps = {
	fontSize: 'var(--krona-control-font-size)',
	fontFamily: 'Poppins, sans-serif',
	lineHeight: 1.25,
};

export const kronaToolbarRowSx: SxProps = {
	display: 'flex',
	alignItems: 'center',
	gap: 1,
	flexWrap: 'wrap',
	width: '100%',
};

/** Placeholder visible when empty; hidden only after the user types. */
export const kronaPlaceholderSx: SxProps = {
	'& input::placeholder, & textarea::placeholder': {
		color: 'var(--krona-placeholder-color, var(--krona-text-muted))',
		opacity: 1,
		transition: 'opacity 0.15s ease',
	},
	'& input:not(:placeholder-shown)::placeholder, & textarea:not(:placeholder-shown)::placeholder':
		{
			opacity: 0,
		},
};

/** Field title above Krona inputs (2px under Joy’s default ~14px label). */
export const kronaFormLabelSx: SxProps = {
	fontSize: 12,
	lineHeight: 1.35,
	fontWeight: 500,
	color: 'var(--krona-text)',
	mb: 0.75,
};

export const kronaInputSx: SxProps = {
	...kronaControlTextSx,
	...kronaPlaceholderSx,
	'--Input-radius': '999px',
	'--Input-minHeight': 'var(--krona-control-height)',
	'--Input-paddingInline': '16px',
	minHeight: 'var(--krona-control-height)',
	height: 'var(--krona-control-height)',
	maxHeight: 'var(--krona-control-height)',
	borderRadius: '999px',
	bgcolor: 'transparent',
	border: '1px solid var(--krona-input-border)',
	borderColor: 'var(--krona-input-border)',
	color: 'var(--krona-text)',
	boxShadow: 'none',
	boxSizing: 'border-box',
	'& input': {
		...kronaControlTextSx,
		color: 'var(--krona-text)',
		bgcolor: 'transparent',
	},
	'& .MuiInput-endDecorator': {
		marginInlineEnd: '4px',
	},
};

/** Search fields — same 48% control border as inputs. */
export const kronaSearchInputSx: SxProps = {
	...kronaInputSx,
	boxShadow: 'none',
	'& input::placeholder': {
		color: 'var(--krona-placeholder-color, var(--krona-text-48))',
		opacity: 1,
	},
};

/** Search field in `KronaSearchCreateToolbar`. */
export const kronaSearchToolbarInputSx: SxProps = {
	...kronaSearchInputSx,
	flex: 1,
	minWidth: 140,
};

/** Select / sort controls — 16px radius, 8% fill, 24% hover. */
export const kronaDropdownControlSx: SxProps = {
	...kronaInputSx,
	borderRadius: '20px',
	bgcolor: 'var(--krona-dropdown-bg)',
	boxShadow: 'none',
	'&:hover': { bgcolor: 'var(--krona-secondary-bg)' },
	'& .MuiSelect-button': { ...kronaControlTextSx },
};

/** Shared nav-bar numeric/label type (timer countdown + date). */
export const kronaNavBarTimeTextSx: SxProps = {
	fontFamily: 'Poppins, sans-serif',
	fontSize: 14,
	fontWeight: 600,
	lineHeight: 1.25,
	color: 'var(--krona-text)',
	fontVariantNumeric: 'tabular-nums',
};

export const kronaDateChipSx: SxProps = {
	gap: 0.5,
	display: 'inline-flex',
	alignItems: 'center',
	...kronaNavBarTimeTextSx,
	'& .MuiChip-label': {
		pl: 0,
		lineHeight: 1.25,
		display: 'flex',
		alignItems: 'center',
		...kronaNavBarTimeTextSx,
	},
	'& .MuiChip-startDecorator': {
		marginInlineEnd: '2px',
		display: 'inline-flex',
		alignItems: 'center',
		justifyContent: 'center',
		lineHeight: 0,
		'& svg': { display: 'block' },
	},
};

export const kronaMoreIconButtonSx: SxProps = {
	flexShrink: 0,
	minWidth: 'var(--krona-control-height)',
	width: 'var(--krona-control-height)',
	minHeight: 'var(--krona-control-height)',
	height: 'var(--krona-control-height)',
	color: 'var(--krona-text)',
	transition: 'color 0.15s ease, background-color 0.15s ease',
	'& svg': {
		opacity: 0.64,
		transition: 'opacity 0.15s ease',
	},
	'&:hover': {
		color: 'var(--krona-text)',
		bgcolor: 'var(--krona-overlay-hover)',
		'& svg': { opacity: 1 },
	},
	'&:active svg, &:focus-visible svg, &[aria-expanded="true"] svg, &[aria-pressed="true"] svg':
		{
			opacity: 1,
		},
};

/** Class paired with global menu rules — overrides default menu text color for delete rows. */
export const KRONA_MENU_ITEM_DELETE_CLASS = 'krona-menu-item-delete';

export const kronaMenuItemDeleteSx: SxProps = {
	color: '#f87171',
	'& svg': {
		color: 'inherit',
		stroke: 'currentColor',
	},
	'&:hover': {
		bgcolor: 'rgba(248, 113, 113, 0.12)',
		color: '#ef4444',
	},
};

export const kronaDeleteMenuItemProps = {
	className: KRONA_MENU_ITEM_DELETE_CLASS,
	sx: kronaMenuItemDeleteSx,
} as const;

/** Class paired with global menu rules — accent gradient on the active choice. */
export const KRONA_MENU_ITEM_SELECTED_CLASS = 'krona-menu-item-selected';

/** Marks the active option in a filter / sort menu. */
export function kronaSelectedMenuItemProps(selected: boolean) {
	return {
		selected,
		className: selected ? KRONA_MENU_ITEM_SELECTED_CLASS : undefined,
		sx: kronaMenuItemSx,
	};
}

/** Hide native browser spin buttons on number inputs (pair with custom +/- controls). */
export const kronaNumberInputHideSpinnersSx: SxProps = {
	'& input[type="number"]': {
		MozAppearance: 'textfield',
	},
	'& input[type="number"]::-webkit-outer-spin-button, & input[type="number"]::-webkit-inner-spin-button':
		{
			WebkitAppearance: 'none',
			margin: 0,
		},
};

/** 4px separator dot for task meta lines (project · assigned · worked). */
export const kronaMetaDotSx: SxProps = {
	width: 4,
	height: 4,
	borderRadius: '50%',
	bgcolor: 'var(--krona-text-24)',
	flexShrink: 0,
};

/** Settings / profile panels — glass surface; allow full-height scroll content. */
export const kronaSettingsPanelSx: SxProps = {
	...kronaWidgetCardSx,
	borderRadius: '28px',
	boxShadow: 'none',
	height: 'auto',
	minHeight: 0,
	overflow: 'visible',
	'& .MuiInput-root, & .MuiTextarea-root, & .MuiSelect-root': {
		width: '100%',
		maxWidth: 480,
	},
	'& .MuiButton-root': {
		width: 'fit-content',
		maxWidth: '100%',
		alignSelf: 'flex-start',
	},
	'& .MuiButton-root[data-krona-fill="true"]': {
		width: '100%',
		alignSelf: 'stretch',
		minWidth: 0,
	},
};

export const kronaSettingsInputSx: SxProps = {
	...kronaSearchInputSx,
	width: '100%',
	maxWidth: 480,
	boxShadow: 'none',
	'--Input-focusedThickness': '0px',
	'&::before': { boxShadow: 'none' },
	'&::after': { boxShadow: 'none' },
};

/** Settings form field stack — caps control width on web. */
export const kronaSettingsFieldSx = {
	display: 'flex',
	flexDirection: 'column',
	gap: 0.5,
	width: '100%',
	maxWidth: { xs: '100%', md: 480 },
} as const;

/** Settings action buttons — width hugs content. */
export const kronaSettingsButtonSx = {
	width: 'fit-content',
	maxWidth: '100%',
	alignSelf: 'flex-start',
} as const;

/** Active task / timer tracking chip (dashboard timer widget). */
export const kronaActiveTaskChipSx: SxProps = {
	display: 'inline-flex',
	alignItems: 'center',
	gap: 0.75,
	borderRadius: '999px',
	...kronaTimerSelectedTaskAccentSx,
	px: 1.25,
	py: 0.75,
	maxWidth: '100%',
	minWidth: 0,
	color: 'var(--krona-text)',
	'& svg': {
		flexShrink: 0,
		width: 16,
		height: 16,
	},
};

/** Task name badge in the top nav timer (cap so the centered cluster stays tight). */
export const kronaNavTimerTaskBadgeSx: SxProps = {
	display: 'inline-flex',
	alignItems: 'center',
	gap: 0.75,
	minWidth: 0,
	maxWidth: 'min(220px, calc(var(--krona-top-width, 100vw) * 0.22))',
	borderRadius: '999px',
	border: `1px solid ${kronaAccentColorMix(45)}`,
	bgcolor: kronaAccentColorMix(18, 'var(--krona-widget-bg)'),
	px: 1,
	py: 0.35,
	color: 'var(--krona-text)',
	flexShrink: 1,
	'& svg': {
		flexShrink: 0,
		width: 16,
		height: 16,
	},
};

export const kronaSettingsTabButtonSx = (selected: boolean): SxProps => ({
	...kronaControlTextSx,
	width: 'fit-content',
	maxWidth: '100%',
	borderRadius: '999px',
	fontWeight: 600,
	flexDirection: 'row',
	alignItems: 'center',
	justifyContent: 'center',
	textAlign: 'center',
	py: 1,
	px: { xs: 1.25, md: 2 },
	gap: 0.75,
	minHeight: 40,
	boxShadow: 'none !important',
	outline: 'none',
	border: 'none',
	boxSizing: 'border-box',
	overflow: 'hidden',
	color: selected ? '#fff' : 'var(--krona-text)',
	background: selected ? 'var(--krona-accent-gradient)' : 'transparent',
	backgroundClip: 'border-box',
	'&:hover': {
		background: selected
			? 'var(--krona-accent-gradient-hover)'
			: 'var(--krona-overlay-hover)',
		border: 'none',
		boxShadow: 'none',
	},
});

/** Routine page content column max widths (view is narrower than editor) */
export const ROUTINE_VIEW_PAGE_MAX_WIDTH = 700;
export const ROUTINE_EDITOR_PAGE_MAX_WIDTH = 720;

export const kronaPrimaryButtonSx: SxProps = {
	...kronaControlTextSx,
	borderRadius: '999px',
	fontWeight: 600,
	minHeight: 'var(--krona-control-height)',
	height: 'var(--krona-control-height)',
	maxHeight: 'var(--krona-control-height)',
	background: 'var(--krona-accent-gradient)',
	color: '#fff',
	border: 'none',
	boxSizing: 'border-box',
	textTransform: 'none',
	'&:hover': {
		background: 'var(--krona-accent-gradient-hover)',
		border: 'none',
		boxShadow: 'var(--krona-primary-hover-shadow)',
	},
	'&:active, &:focus-visible': {
		border: 'none',
		boxShadow: 'var(--krona-control-inset-stroke), var(--krona-accent-shadow)',
	},
	'&:disabled, &.Mui-disabled': {
		opacity: 1,
		color: 'var(--krona-text-48)',
		background:
			'linear-gradient(45deg, color-mix(in srgb, var(--krona-accent-stop-0) 24%, transparent) 0%, color-mix(in srgb, var(--krona-accent-stop-34) 24%, transparent) 34%, color-mix(in srgb, var(--krona-accent-stop-68) 24%, transparent) 68%, color-mix(in srgb, var(--krona-accent-stop-100) 24%, transparent) 100%)',
		boxShadow: 'none',
		cursor: 'not-allowed',
	},
	'&:disabled:hover, &.Mui-disabled:hover': {
		background:
			'linear-gradient(45deg, color-mix(in srgb, var(--krona-accent-stop-0) 24%, transparent) 0%, color-mix(in srgb, var(--krona-accent-stop-34) 24%, transparent) 34%, color-mix(in srgb, var(--krona-accent-stop-68) 24%, transparent) 68%, color-mix(in srgb, var(--krona-accent-stop-100) 24%, transparent) 100%)',
		border: 'none',
		boxShadow: 'none',
	},
};

/** Compact gradient icon control (widget + headers). */
export const kronaPrimaryIconButtonSx: SxProps = {
	...kronaPrimaryButtonSx,
	borderRadius: '999px',
	flexShrink: 0,
	p: 0,
	minWidth: 'var(--krona-control-height)',
	width: 'var(--krona-control-height)',
	'& svg': { color: '#fff' },
};

export const kronaSearchToolbarButtonSx: SxProps = {
	...kronaPrimaryButtonSx,
	flexShrink: 0,
	whiteSpace: 'nowrap',
	px: 2,
};

/** Floating action button (e.g. Edit routine). */
export const kronaPrimaryFabSx: SxProps = {
	...kronaPrimaryButtonSx,
	borderRadius: '50%',
	width: 56,
	height: 56,
	minWidth: 56,
	minHeight: 56,
	maxHeight: 56,
	maxWidth: 56,
	boxShadow: 'var(--krona-accent-shadow)',
	'& svg': { color: '#fff' },
};

export const kronaSecondaryButtonSx: SxProps = {
	...kronaControlTextSx,
	borderRadius: '999px',
	fontWeight: 600,
	minHeight: 'var(--krona-control-height)',
	height: 'var(--krona-control-height)',
	maxHeight: 'var(--krona-control-height)',
	color: 'var(--krona-text)',
	border: '1px solid var(--krona-secondary-border)',
	background: 'var(--krona-secondary-bg)',
	transition:
		'background-color 0.2s ease, border-color 0.2s ease, transform 0.2s ease, opacity 0.2s ease',
	'&:hover': {
		bgcolor: 'color-mix(in srgb, var(--krona-text) 10%, transparent)',
		borderColor: 'color-mix(in srgb, var(--krona-text) 18%, transparent)',
		transform: 'translateY(-1px)',
	},
	'&:active': {
		bgcolor: 'color-mix(in srgb, var(--krona-text) 14%, transparent)',
		borderColor: 'color-mix(in srgb, var(--krona-text) 24%, transparent)',
		transform: 'translateY(0)',
	},
	'&:focus-visible': {
		borderColor: 'color-mix(in srgb, var(--krona-text) 28%, transparent)',
		outline: '2px solid color-mix(in srgb, var(--krona-text) 20%, transparent)',
		outlineOffset: 0,
	},
};

/** Destructive action button — red fill for confirm-delete modals and similar. */
export const kronaDeleteButtonSx: SxProps = {
	...kronaControlTextSx,
	borderRadius: '999px',
	fontWeight: 600,
	minHeight: 'var(--krona-control-height)',
	height: 'var(--krona-control-height)',
	maxHeight: 'var(--krona-control-height)',
	bgcolor: '#ef4444',
	color: '#fff',
	border: 'none',
	textTransform: 'none',
	boxShadow: 'none',
	'&:hover': {
		bgcolor: '#dc2626',
		boxShadow: 'none',
	},
	'&:disabled, &.Mui-disabled': {
		opacity: 0.48,
		bgcolor: '#ef4444',
		color: '#fff',
		cursor: 'not-allowed',
	},
};

export const kronaSecondaryIconButtonSx: SxProps = {
	borderRadius: '999px',
	color: 'var(--krona-text)',
	border: '1px solid var(--krona-secondary-border)',
	background: 'var(--krona-secondary-bg)',
	minHeight: 'var(--krona-control-height)',
	height: 'var(--krona-control-height)',
	width: 'var(--krona-control-height)',
	minWidth: 'var(--krona-control-height)',
	'& svg': {
		opacity: 0.64,
		transition: 'opacity 0.15s ease',
	},
	'&:hover': {
		bgcolor: 'var(--krona-secondary-bg)',
		'& svg': { opacity: 1 },
	},
	'&:active svg, &:focus-visible svg, &[aria-pressed="true"] svg, &[aria-expanded="true"] svg':
		{
			opacity: 1,
		},
};

/** Active / selected state for secondary toggle icon buttons (folder filter, repeatable, etc.). */
export const kronaToggleIconButtonActiveSx: SxProps = {
	color: 'var(--krona-text)',
	borderColor: kronaAccentColorMix(55),
	bgcolor: kronaAccentColorMix(28),
	'& svg': { opacity: 1 },
	'&:hover': {
		bgcolor: kronaAccentColorMix(36),
		'& svg': { opacity: 1 },
	},
};

export const kronaToggleIconButtonSx = (active: boolean): SxProps => ({
	...kronaSecondaryIconButtonSx,
	...(active ? kronaToggleIconButtonActiveSx : {}),
});

/** Nav bar timer transport controls and matching header icon actions (e.g. feedback). */
export const kronaNavTimerControlSx: SxProps = {
	...kronaSecondaryIconButtonSx,
	flexShrink: 0,
};

/** Fixed top nav / header bars — matches dashboard widget glass. */
export const kronaNavBarSx: SxProps = {
	borderBottom: '1px solid var(--krona-surface-border)',
	background: 'var(--krona-widget-bg)',
	backdropFilter: 'blur(var(--krona-widget-blur)) saturate(var(--krona-widget-saturate))',
	WebkitBackdropFilter: 'blur(var(--krona-widget-blur)) saturate(var(--krona-widget-saturate))',
};

export const kronaHeaderBarSx: SxProps = {
	...kronaNavBarSx,
};

/** Date chip, theme toggle, and account avatar in the top bar. */
export const kronaHeaderActionsSx: SxProps = {
	display: 'flex',
	alignItems: 'center',
	flexShrink: 0,
	gap: { xs: 2, md: 3 },
	'& .krona-header-account': {
		marginLeft: { md: 0.5 },
	},
};

export const kronaTabBarSx: SxProps = {
	width: '100%',
	display: 'flex',
	alignItems: 'stretch',
	gap: 0.5,
	borderRadius: '999px',
	border: '1px solid var(--krona-surface-border)',
	p: 0.5,
	boxSizing: 'border-box',
	minHeight: 'calc(var(--krona-control-height) + 4px)',
	overflow: 'hidden',
};

/** Pill tab inside `kronaTabBarSx` — white label on gradient when active. */
export const kronaTabButtonSx = (active: boolean): SxProps => ({
	...kronaControlTextSx,
	flex: 1,
	minWidth: 0,
	border: 'none',
	outline: 'none',
	cursor: 'pointer',
	fontWeight: 600,
	borderRadius: '999px',
	px: 1,
	fontFamily: 'Poppins, sans-serif',
	color: active ? '#fff' : 'var(--krona-text)',
	background: active ? 'var(--krona-accent-gradient)' : 'transparent',
	backgroundClip: 'border-box',
	boxShadow: 'none',
	transition: 'background 0.2s, color 0.2s',
	'&:hover': {
		background: active
			? 'var(--krona-accent-gradient-hover)'
			: 'var(--krona-secondary-bg)',
		border: 'none',
		boxShadow: 'none',
	},
});

/** Gradient display type shared by timer counter and widget metrics. */
export const kronaMetricGradientTextSx: SxProps = {
	lineHeight: 1.05,
	fontFamily: 'Poppins, sans-serif',
	fontWeight: 600,
	background:
		'linear-gradient(to bottom, var(--krona-text), color-mix(in srgb, var(--krona-text) 64%, transparent))',
	WebkitBackgroundClip: 'text',
	WebkitTextFillColor: 'transparent',
	backgroundClip: 'text',
};

/** Pomodoro timer digits. */
export const kronaTimerCounterSx: SxProps = {
	...kronaMetricGradientTextSx,
	fontSize: { xs: '56px', sm: '68px', md: '76px' },
	letterSpacing: '-1px',
};

/** Single hero metric (e.g. performance widget). */
export const kronaWidgetMetricValueSx: SxProps = {
	...kronaMetricGradientTextSx,
	fontSize: { xs: '36px', md: '44px' },
	letterSpacing: '-0.75px',
};

/** Compact metric in a multi-column widget (e.g. today's progress). */
export const kronaWidgetMetricValueCompactSx: SxProps = {
	...kronaMetricGradientTextSx,
	fontSize: { xs: '30px', md: '36px' },
	letterSpacing: '-0.5px',
};

export const kronaWidgetMetricUnitSx: SxProps = {
	...kronaMetricGradientTextSx,
	fontSize: '0.42em',
	fontWeight: 600,
	letterSpacing: '-0.02em',
};

export const kronaTimerPlayButtonSx: SxProps = {
	...kronaPrimaryButtonSx,
	minHeight: 64,
	height: 64,
	width: 64,
	minWidth: 64,
	maxHeight: 64,
	maxWidth: 64,
	borderRadius: '50%',
	boxShadow: 'var(--krona-accent-shadow)',
};

export const kronaTimerSecondaryControlSx: SxProps = {
	...kronaSecondaryIconButtonSx,
	minHeight: 48,
	height: 48,
	width: 48,
	minWidth: 48,
	maxHeight: 48,
	maxWidth: 48,
	borderRadius: '50%',
};
