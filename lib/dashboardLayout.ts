export const DASHBOARD_WIDGET_IDS = [
	'tasks',
	'timer',
	'work-hours',
	'reminders',
	'performance',
] as const;

export type DashboardWidgetId = (typeof DASHBOARD_WIDGET_IDS)[number];

/** Hover label beside widget title when the header links to a full page. */
export const DASHBOARD_WIDGET_NAV_HINTS: Partial<Record<DashboardWidgetId, string>> = {
	tasks: 'All projects',
	reminders: 'All reminders',
	'work-hours': 'Today’s progress',
	performance: 'All performance',
};

export function resolveDashboardWidgetNavHint(
	widgetId: DashboardWidgetId,
	href?: string,
	navHint?: string,
): string | undefined {
	if (!href) return undefined;
	return navHint ?? DASHBOARD_WIDGET_NAV_HINTS[widgetId] ?? 'View all';
}

export type DashboardWidgetPlacement = {
	gridColumn: { xs: string; tablet: string; lg: string };
	gridRow?: { lg: string };
	order: { xs: number; tablet: number; lg: 'unset' | number };
};

export type DashboardLayoutState = Record<DashboardWidgetId, DashboardWidgetPlacement>;

/** Resolve MUI breakpoint placement objects against content-width layout mode. */
export function resolveDashboardPlacementForLayout(
	placement: DashboardWidgetPlacement,
	mode: 'mobile' | 'tablet' | 'desktop',
): {
	gridColumn: string;
	gridRow?: string;
	order: number | 'unset';
} {
	if (mode === 'desktop') {
		return {
			gridColumn: placement.gridColumn.lg,
			gridRow: placement.gridRow?.lg,
			order: placement.order.lg,
		};
	}
	if (mode === 'tablet') {
		return {
			gridColumn: placement.gridColumn.tablet,
			order: placement.order.tablet,
		};
	}
	return {
		gridColumn: placement.gridColumn.xs,
		order: placement.order.xs,
	};
}

/**
 * Desktop web: 3 columns — Timer | Tasks | Reminders + Today’s Progress + Performance.
 * Tall widgets span all three rows; the right column stacks the compact widgets.
 */
export const DEFAULT_DASHBOARD_LAYOUT: DashboardLayoutState = {
	timer: {
		gridColumn: { xs: '1', tablet: 'auto', lg: '1' },
		gridRow: { lg: '1 / 4' },
		order: { xs: 2, tablet: 2, lg: 'unset' },
	},
	tasks: {
		gridColumn: { xs: '1', tablet: 'auto', lg: '2' },
		gridRow: { lg: '1 / 4' },
		order: { xs: 1, tablet: 1, lg: 'unset' },
	},
	reminders: {
		gridColumn: { xs: '1', tablet: 'auto', lg: '3' },
		gridRow: { lg: '1' },
		order: { xs: 4, tablet: 4, lg: 'unset' },
	},
	'work-hours': {
		gridColumn: { xs: '1', tablet: 'auto', lg: '3' },
		gridRow: { lg: '2' },
		order: { xs: 3, tablet: 3, lg: 'unset' },
	},
	performance: {
		gridColumn: { xs: '1', tablet: 'auto', lg: '3' },
		gridRow: { lg: '3' },
		order: { xs: 5, tablet: 5, lg: 'unset' },
	},
};

const STORAGE_KEY = 'krona-dashboard-widget-layout-v5';

function isWidgetId(value: string): value is DashboardWidgetId {
	return (DASHBOARD_WIDGET_IDS as readonly string[]).includes(value);
}

type LegacyPlacement = {
	gridColumn?: { xs?: string; tablet?: string; md?: string; lg?: string };
	gridRow?: { md?: string; lg?: string };
	order?: { xs?: number; tablet?: number; md?: number | 'unset'; lg?: number | 'unset' };
};

function normalizePlacement(
	raw: LegacyPlacement | undefined,
	fallback: DashboardWidgetPlacement,
): DashboardWidgetPlacement {
	if (!raw || typeof raw !== 'object') return fallback;

	const gc = raw.gridColumn ?? {};
	const gr = raw.gridRow ?? {};
	const ord = raw.order ?? {};

	return {
		gridColumn: {
			xs: gc.xs ?? fallback.gridColumn.xs,
			tablet: gc.tablet ?? fallback.gridColumn.tablet,
			lg: gc.lg ?? gc.md ?? fallback.gridColumn.lg,
		},
		gridRow: gr.lg || gr.md ? { lg: gr.lg ?? gr.md! } : fallback.gridRow,
		order: {
			xs: ord.xs ?? fallback.order.xs,
			tablet: ord.tablet ?? ord.xs ?? fallback.order.tablet,
			lg: ord.lg ?? ord.md ?? fallback.order.lg,
		},
	};
}

export function loadDashboardLayout(): DashboardLayoutState {
	if (typeof window === 'undefined') return { ...DEFAULT_DASHBOARD_LAYOUT };
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return { ...DEFAULT_DASHBOARD_LAYOUT };
		const parsed = JSON.parse(raw) as Partial<Record<string, LegacyPlacement>>;
		const next = { ...DEFAULT_DASHBOARD_LAYOUT };
		for (const id of DASHBOARD_WIDGET_IDS) {
			next[id] = normalizePlacement(parsed[id], DEFAULT_DASHBOARD_LAYOUT[id]);
		}
		return next;
	} catch {
		return { ...DEFAULT_DASHBOARD_LAYOUT };
	}
}

export function saveDashboardLayout(layout: DashboardLayoutState) {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
	} catch {
		/* ignore quota */
	}
}

export function swapWidgetPlacements(
	layout: DashboardLayoutState,
	a: DashboardWidgetId,
	b: DashboardWidgetId,
): DashboardLayoutState {
	if (a === b) return layout;
	return {
		...layout,
		[a]: { ...layout[b] },
		[b]: { ...layout[a] },
	};
}

export function parseDragWidgetId(data: string): DashboardWidgetId | null {
	return isWidgetId(data) ? data : null;
}

export const DASHBOARD_DRAG_MIME = 'application/x-krona-widget-id';

export type DashboardWidgetSizeClass = 'tall' | 'compact';

export const WIDGET_SIZE_CLASS: Record<DashboardWidgetId, DashboardWidgetSizeClass> = {
	tasks: 'tall',
	timer: 'tall',
	'work-hours': 'compact',
	reminders: 'compact',
	performance: 'compact',
};

export function canSwapWidgets(
	a: DashboardWidgetId,
	b: DashboardWidgetId,
): boolean {
	return WIDGET_SIZE_CLASS[a] === WIDGET_SIZE_CLASS[b];
}
