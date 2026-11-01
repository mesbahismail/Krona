/** Phone — bottom tab bar + compact top nav. */
export const KRONA_MOBILE_MAX_PX = 899;
export const KRONA_MOBILE_MQ = `(max-width: ${KRONA_MOBILE_MAX_PX}px)`;

/** Tablet — 2-column dashboard + desktop-style nav (from 800px). */
export const KRONA_TABLET_MIN_PX = 800;
export const KRONA_TABLET_MAX_PX = 1199;
export const KRONA_TABLET_MQ = `(min-width: ${KRONA_TABLET_MIN_PX}px) and (max-width: ${KRONA_TABLET_MAX_PX}px)`;

/**
 * Narrowest compact top bar that still fits the page title next to the back
 * control, timer and account cluster. Below this the title is dropped.
 */
export const KRONA_COMPACT_TITLE_MIN_PX = 620;

/** Full web / desktop — 3-column dashboard + complete top bar chrome. */
export const KRONA_DESKTOP_MIN_PX = 1200;
export const KRONA_DESKTOP_MQ = `(min-width: ${KRONA_DESKTOP_MIN_PX}px)`;

/**
 * Layout tiers for the main chrome (top nav, tab bar, dashboard grid).
 * Prefer content width (viewport minus AI dock) over raw viewport width.
 */
export type KronaLayoutMode = 'mobile' | 'tablet' | 'desktop';

export type KronaContentLayout = {
	/** Measured main-chrome width in CSS pixels. */
	contentWidth: number;
	/** Dashboard column tier. */
	mode: KronaLayoutMode;
	/**
	 * Compact top bar + bottom tab bar.
	 * Full desktop chrome (greeting, page menu, task chip, date) needs >= 1200px.
	 */
	isMobileNav: boolean;
	/** 2-column dashboard (`800–1199`). */
	isTabletDashboard: boolean;
	/** 3-column locked dashboard (`>= 1200`). */
	isDesktopDashboard: boolean;
};

export function kronaContentLayoutFromWidth(
	widthPx: number,
	_options?: { aiDockOpen?: boolean },
): KronaContentLayout {
	const contentWidth = Math.max(0, Math.round(widthPx));
	const isDesktopDashboard = contentWidth >= KRONA_DESKTOP_MIN_PX;
	const isTabletDashboard =
		contentWidth >= KRONA_TABLET_MIN_PX && !isDesktopDashboard;
	const mode: KronaLayoutMode = isDesktopDashboard
		? 'desktop'
		: isTabletDashboard
			? 'tablet'
			: 'mobile';
	/* Below full desktop width: bottom tabs + compact top (no greeting / task chip). */
	const isMobileNav = !isDesktopDashboard;
	return {
		contentWidth,
		mode,
		isMobileNav,
		isTabletDashboard,
		isDesktopDashboard,
	};
}
