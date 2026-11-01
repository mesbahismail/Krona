import type { LucideIcon } from 'lucide-react';
import {
	BarChart3,
	Bell,
	FolderKanban,
	Home,
	LayoutGrid,
	Settings,
} from 'lucide-react';

export const KRONA_APP_NAV_ITEMS = [
	{ path: '/', label: 'Home' },
	{ path: '/projects', label: 'My projects' },
	{ path: '/performance', label: 'Performance' },
	{ path: '/reminders', label: 'Reminders' },
	{ path: '/settings', label: 'Settings' },
	{ path: '/help', label: 'Help Center' },
] as const;

export type KronaMobileTabItem = {
	path: string;
	label: string;
	icon: LucideIcon;
};

/** Primary bottom tabs on mobile. */
export const KRONA_MOBILE_BOTTOM_TABS: KronaMobileTabItem[] = [
	{ path: '/', label: 'Home', icon: Home },
	{ path: '/projects', label: 'My projects', icon: FolderKanban },
	{ path: '/reminders', label: 'Reminders', icon: Bell },
];

export const KRONA_MOBILE_MORE_TAB = {
	id: 'more',
	label: 'More',
	icon: LayoutGrid,
} as const;

/** Secondary destinations opened from the mobile “More” tab. */
export const KRONA_MOBILE_MORE_ITEMS: KronaMobileTabItem[] = [
	{ path: '/performance', label: 'Performance', icon: BarChart3 },
	{ path: '/settings', label: 'Settings', icon: Settings },
];

const KRONA_PAGE_NAV_ICONS: Record<string, LucideIcon> = {
	'/projects': FolderKanban,
	'/performance': BarChart3,
	'/reminders': Bell,
	'/settings': Settings,
};

export type KronaPageSwitcherItem = {
	path: string;
	label: string;
	icon: LucideIcon;
};

/** Pages shown in the nav bar title switcher (excludes Home and Help). */
export const KRONA_PAGE_SWITCHER_ITEMS: KronaPageSwitcherItem[] =
	KRONA_APP_NAV_ITEMS.filter(
		({ path }) => path !== '/' && path !== '/help',
	).map(({ path, label }) => ({
		path,
		label,
		icon: KRONA_PAGE_NAV_ICONS[path] ?? FolderKanban,
	}));
