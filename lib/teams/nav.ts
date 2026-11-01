import type { LucideIcon } from 'lucide-react';
import {
	BarChart3,
	Bell,
	FolderKanban,
	Home,
	Users,
} from 'lucide-react';

export const KRONA_TEAM_NAV_ITEMS = [
	{ path: '/team', label: 'Effort' },
	{ path: '/team/performance', label: 'Performance' },
	{ path: '/team/reminders', label: 'Reminders' },
	{ path: '/team/projects', label: 'Projects' },
	{ path: '/team/members', label: 'Members' },
] as const;

export type KronaTeamMobileTabItem = {
	path: string;
	label: string;
	icon: LucideIcon;
	/** Reserved for parity with personal nav; team tabs are never locked. */
	locked?: boolean;
};

export const KRONA_TEAM_MOBILE_BOTTOM_TABS: KronaTeamMobileTabItem[] = [
	{ path: '/team', label: 'Effort', icon: Home },
	{ path: '/team/projects', label: 'Projects', icon: FolderKanban },
	{ path: '/team/reminders', label: 'Reminders', icon: Bell },
];

export const KRONA_TEAM_MOBILE_MORE_ITEMS: KronaTeamMobileTabItem[] = [
	{ path: '/team/performance', label: 'Performance', icon: BarChart3 },
	{ path: '/team/members', label: 'Members', icon: Users },
];

export function isTeamAppPath(pathname: string): boolean {
	return pathname === '/team' || pathname.startsWith('/team/');
}
