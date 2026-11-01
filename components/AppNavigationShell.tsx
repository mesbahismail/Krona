'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
	BarChart3,
	Bell,
	CircleHelp,
	FolderKanban,
	Home,
	Moon,
	Settings,
	Sun,
	Users,
} from 'lucide-react';
import { Tooltip } from '@mui/joy';
import Logo from '@/components/Logo';
import { KronaLayoutModeProvider } from '@/components/KronaLayoutModeProvider';
import { useTeamMode } from '@/components/teams/TeamModeContext';
import {
	getKronaTheme,
	KRONA_THEME_CHANGE_EVENT,
	toggleKronaTheme,
	type KronaThemeMode,
} from '@/lib/kronaTheme';

const personalLinks = [
	{ href: '/', label: 'Home', Icon: Home },
	{ href: '/projects', label: 'My projects', Icon: FolderKanban },
	{ href: '/performance', label: 'Performance', Icon: BarChart3 },
	{ href: '/reminders', label: 'Reminders', Icon: Bell },
];
const teamLinks = [
	{ href: '/team', label: 'Team dashboard', Icon: Users },
	{ href: '/team/projects', label: 'Team projects', Icon: FolderKanban },
	{ href: '/team/performance', label: 'Team performance', Icon: BarChart3 },
	{ href: '/team/reminders', label: 'Team reminders', Icon: Bell },
	{ href: '/team/members', label: 'Team members', Icon: Users },
];

export default function AppNavigationShell({
	children,
}: {
	children: React.ReactNode;
}) {
	const contentRef = React.useRef<HTMLDivElement>(null);
	const gradientId = `rail-gradient-${React.useId().replace(/:/g, '')}`;
	const iconStroke = `url(#${gradientId})`;
	const pathname = usePathname();
	const { mode } = useTeamMode();
	const team =
		mode === 'team' || pathname === '/team' || pathname.startsWith('/team/');
	const links = team ? teamLinks : personalLinks;
	const [theme, setTheme] = React.useState<KronaThemeMode>('dark');
	React.useEffect(() => {
		const sync = () => setTheme(getKronaTheme());
		sync();
		window.addEventListener(KRONA_THEME_CHANGE_EVENT, sync);
		return () => window.removeEventListener(KRONA_THEME_CHANGE_EVENT, sync);
	}, []);
	const renderLink = ({
		href,
		label,
		Icon,
	}: (typeof personalLinks)[number]) => {
		const active =
			pathname === href ||
			(href !== '/' && href !== '/team' && pathname.startsWith(`${href}/`));
		return (
			<Tooltip key={href} title={label} placement="right">
				<Link
					href={href}
					className="krona-rail-button"
					aria-label={label}
					aria-current={active ? 'page' : undefined}
				>
					<Icon
						size={22}
						stroke={active ? iconStroke : 'currentColor'}
						strokeWidth={1.8}
						aria-hidden="true"
					/>
				</Link>
			</Tooltip>
		);
	};
	return (
		<KronaLayoutModeProvider contentRef={contentRef}>
			<aside className="krona-side-menu" aria-label="Sidebar">
				<svg
					width="0"
					height="0"
					aria-hidden="true"
					className="krona-rail-gradient-defs"
				>
					<defs>
						<linearGradient
							id={gradientId}
							gradientUnits="userSpaceOnUse"
							x1="2"
							y1="22"
							x2="22"
							y2="2"
						>
							<stop offset="0%" stopColor="var(--krona-accent-stop-0)" />
							<stop offset="34%" stopColor="var(--krona-accent-stop-34)" />
							<stop offset="68%" stopColor="var(--krona-accent-stop-68)" />
							<stop offset="100%" stopColor="var(--krona-accent-stop-100)" />
						</linearGradient>
					</defs>
				</svg>
				<Link
					href={team ? '/team' : '/'}
					className="krona-rail-brand"
					aria-label="Krona home"
					data-tour="dashboard-logo"
				>
					<Logo width={30} height={30} variant="app" />
				</Link>
				<nav aria-label="Main navigation" className="krona-rail-links">
					{links.map(renderLink)}
					{renderLink({
						href: '/help',
						label: 'Help Center',
						Icon: CircleHelp,
					})}
					{renderLink({ href: '/settings', label: 'Settings', Icon: Settings })}
				</nav>
				<div className="krona-rail-appearance">
					<Tooltip
						title={
							theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
						}
						placement="right"
					>
						<button
							className="krona-rail-button"
							type="button"
							aria-label={
								theme === 'dark'
									? 'Switch to light mode'
									: 'Switch to dark mode'
							}
							onClick={toggleKronaTheme}
						>
							{theme === 'dark' ? (
								<Sun size={22} stroke="currentColor" aria-hidden="true" />
							) : (
								<Moon size={22} stroke="currentColor" aria-hidden="true" />
							)}
						</button>
					</Tooltip>
				</div>
			</aside>
			<div ref={contentRef} className="krona-app-content">
				{children}
			</div>
		</KronaLayoutModeProvider>
	);
}
