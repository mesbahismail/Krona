'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { usePomodoroTimer } from '@/components/PomodoroContext';
import { KRONA_APP_NAV_ITEMS } from '@/lib/kronaAppNav';

function modeShortLabel(
	mode: 'work' | 'break' | 'longBreak',
	workFree = false,
) {
	if (mode === 'work') return 'Work';
	if (mode === 'break') return workFree ? 'Rest' : 'Short rest';
	return 'Long rest';
}

const EXTRA_PAGE_TITLES: Record<string, string> = {
	'/login': 'Log in',
	'/signin': 'Sign in',
	'/subscribe': 'Upgrade',
	'/billing/success': 'Billing',
	'/subscribe/success': 'Billing',
	'/complete-profile': 'Complete profile',
	'/account': 'Account',
	'/profile': 'Profile',
	'/password': 'Password',
	'/timer': 'Timer',
	'/office': 'Krona Office',
};

/** Public marketing/legal routes keep Next.js metadata titles (better for SEO). */
const SEO_METADATA_PATHS = [
	'/landing',
	'/about',
	'/contact',
	'/privacy',
	'/terms',
	'/refund',
] as const;

function shouldPreserveMetadataTitle(pathname: string): boolean {
	return SEO_METADATA_PATHS.some(
		(path) => pathname === path || pathname.startsWith(`${path}/`),
	);
}

function pageLabelForPath(pathname: string): string | null {
	if (!pathname || pathname === '/') return 'Home';

	const navMatch = KRONA_APP_NAV_ITEMS.find(
		(item) =>
			item.path !== '/' &&
			(pathname === item.path || pathname.startsWith(`${item.path}/`)),
	);
	if (navMatch) return navMatch.label;

	if (pathname.startsWith('/signin')) return 'Sign in';
	if (pathname.startsWith('/login')) return 'Log in';
	if (pathname.startsWith('/subscribe')) return 'Upgrade';
	if (pathname.startsWith('/billing')) return 'Billing';

	for (const [path, label] of Object.entries(EXTRA_PAGE_TITLES)) {
		if (pathname === path || pathname.startsWith(`${path}/`)) return label;
	}

	return null;
}

function kronaDocumentTitle(pathname: string): string {
	const label = pageLabelForPath(pathname);
	return label ? `Krona - ${label}` : 'Krona';
}

/** Sets the browser tab title from the current page; shows the timer while running. */
export default function DocumentTitleTimer() {
	const pathname = usePathname() || '/';
	const { displayRemaining, running, format, mode, timerStyle } =
		usePomodoroTimer();

	React.useEffect(() => {
		if (shouldPreserveMetadataTitle(pathname)) {
			return;
		}

		const pageTitle = kronaDocumentTitle(pathname);
		if (running) {
			document.title = `${format(displayRemaining)} · ${modeShortLabel(
				mode,
				timerStyle === 'workFree',
			)} | ${pageTitle}`;
		} else {
			document.title = pageTitle;
		}
	}, [pathname, displayRemaining, running, format, mode, timerStyle]);

	React.useEffect(() => {
		return () => {
			// Runtime unmount (logout / leaving app shell) — never leave a live timer title.
			document.title = 'Krona';
		};
	}, []);

	return null;
}
