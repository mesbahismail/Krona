'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Box, IconButton, Sheet, Typography } from '@mui/joy';
import {
	KRONA_MOBILE_BOTTOM_TABS,
	KRONA_MOBILE_MORE_ITEMS,
	KRONA_MOBILE_MORE_TAB,
} from '@/lib/kronaAppNav';
import {
	KRONA_TEAM_MOBILE_BOTTOM_TABS,
	KRONA_TEAM_MOBILE_MORE_ITEMS,
} from '@/lib/teams/nav';
import { useKronaLayoutMode } from '@/components/KronaLayoutModeProvider';
import { useTeamMode } from '@/components/teams/TeamModeContext';
import { kronaActionDrawerSx, kronaNavBarSx } from '@/lib/kronaStyles';

function isTabActive(pathname: string, path: string): boolean {
	if (path === '/' || path === '/team') return pathname === path;
	return pathname === path || pathname.startsWith(`${path}/`);
}

const mobileTabLabelSx = (active: boolean) => ({
	fontSize: 11,
	fontWeight: active ? 700 : 600,
	lineHeight: 1.1,
	textAlign: 'center' as const,
	color: active
		? 'var(--krona-accent)'
		: 'color-mix(in srgb, var(--krona-accent) 42%, var(--krona-text-muted))',
});

const mobileTabItemSx = (active: boolean) => ({
	position: 'relative' as const,
	display: 'flex',
	flexDirection: 'column' as const,
	alignItems: 'center',
	justifyContent: 'center',
	gap: 0.75,
	minHeight: 57,
	borderRadius: '16px',
	textDecoration: 'none',
	color: active
		? 'var(--krona-accent)'
		: 'color-mix(in srgb, var(--krona-accent) 42%, var(--krona-text-muted))',
	background: active
		? 'color-mix(in srgb, var(--krona-accent) 14%, transparent)'
		: 'transparent',
	transition: 'background-color 0.15s ease, color 0.15s ease',
});

const MIN_EXPANDED_TAB_WIDTH_PX = 108;

export default function MobileAppTabBar() {
	const pathname = usePathname();
	const router = useRouter();
	const { isMobileNav } = useKronaLayoutMode();
	const { mode } = useTeamMode();
	const bottomTabs =
		mode === 'team'
			? KRONA_TEAM_MOBILE_BOTTOM_TABS
			: KRONA_MOBILE_BOTTOM_TABS;
	const moreItems =
		mode === 'team'
			? KRONA_TEAM_MOBILE_MORE_ITEMS
			: KRONA_MOBILE_MORE_ITEMS;
	const baseTabSlots = bottomTabs.length + 1;
	const [moreOpen, setMoreOpen] = React.useState(false);
	const [navElement, setNavElement] = React.useState<HTMLElement | null>(null);
	const [availableTabSlots, setAvailableTabSlots] = React.useState(baseTabSlots);
	const navRef = React.useCallback((node: HTMLElement | null) => {
		setNavElement(node);
	}, []);

	React.useEffect(() => {
		setMoreOpen(false);
	}, [pathname]);

	React.useEffect(() => {
		setAvailableTabSlots((previous) =>
			Math.max(previous, baseTabSlots) === previous
				? previous
				: Math.max(previous, baseTabSlots),
		);
	}, [baseTabSlots]);

	React.useEffect(() => {
		if (!navElement) return;
		const updateCapacity = () => {
			const innerWidth = Math.max(0, navElement.clientWidth - 32);
			const slots = Math.max(
				baseTabSlots,
				Math.floor(innerWidth / MIN_EXPANDED_TAB_WIDTH_PX),
			);
			setAvailableTabSlots((previous) => (previous === slots ? previous : slots));
		};
		updateCapacity();
		const observer = new ResizeObserver(updateCapacity);
		observer.observe(navElement);
		return () => observer.disconnect();
	}, [navElement, baseTabSlots]);

	const totalDestinationCount = bottomTabs.length + moreItems.length;
	const needsMoreTab = availableTabSlots < totalDestinationCount;
	const promotedCount = Math.max(
		0,
		Math.min(
			moreItems.length,
			availableTabSlots - bottomTabs.length - (needsMoreTab ? 1 : 0),
		),
	);
	const visibleTabs = [
		...bottomTabs,
		...moreItems.slice(0, promotedCount),
	];
	const hiddenMoreItems = moreItems.slice(promotedCount);
	const moreActive = hiddenMoreItems.some(
		({ path }) => isTabActive(pathname, path),
	);
	const drawerOpen = needsMoreTab && moreOpen;

	if (!isMobileNav) {
		return null;
	}

	return (
		<>
			<Box
				ref={navRef}
				component="nav"
				aria-label="App navigation"
				sx={{
					display: 'flex',
					position: 'fixed',
					left: 0,
					right: 'var(--krona-ai-panel-width, 0px)',
					bottom: 0,
					zIndex: 1250,
					boxSizing: 'border-box',
					px: '16px',
					pt: '12px',
					pb: 'calc(12px + env(safe-area-inset-bottom, 0px))',
					borderRadius: '20px 20px 0 0',
					overflow: 'hidden',
					transition:
						'var(--krona-ai-resize-transition, right 0.36s cubic-bezier(0.22, 1, 0.36, 1))',
					...kronaNavBarSx,
					borderTop: '1px solid var(--krona-surface-border)',
					borderBottom: 'none',
					background: 'var(--krona-widget-bg)',
				}}
			>
				<Box
					sx={{
						display: 'grid',
						gridTemplateColumns: `repeat(${visibleTabs.length + (needsMoreTab ? 1 : 0)}, minmax(0, 1fr))`,
						gap: 0.25,
						width: '100%',
					}}
				>
					{visibleTabs.map(({ path, label, icon: Icon }) => {
						const active = isTabActive(pathname, path);
						return (
							<Box
								key={path}
								component={Link}
								href={path}
								aria-current={active ? 'page' : undefined}
								aria-label={label}
								sx={mobileTabItemSx(active)}
							>
								<Icon size={22} strokeWidth={active ? 2.25 : 2} aria-hidden />
								<Typography level="body-xs" sx={mobileTabLabelSx(active)}>
									{label}
								</Typography>
							</Box>
						);
					})}

					{needsMoreTab ? (
						<Box
							component="button"
							type="button"
							aria-expanded={moreOpen}
							aria-haspopup="dialog"
							onClick={() => setMoreOpen(true)}
							sx={{
								...mobileTabItemSx(moreActive || moreOpen),
								border: 'none',
								cursor: 'pointer',
								fontFamily: 'inherit',
							}}
						>
							<KRONA_MOBILE_MORE_TAB.icon
								size={22}
								strokeWidth={moreActive || moreOpen ? 2.25 : 2}
								aria-hidden
							/>
							<Typography
								level="body-xs"
								sx={mobileTabLabelSx(moreActive || moreOpen)}
							>
								{KRONA_MOBILE_MORE_TAB.label}
							</Typography>
						</Box>
					) : null}
				</Box>
			</Box>

			{drawerOpen ? (
				<Box
					role="presentation"
					onClick={() => setMoreOpen(false)}
					sx={{
						position: 'fixed',
						left: 0,
						right: 'var(--krona-ai-panel-width, 0px)',
						top: 0,
						bottom: 0,
						zIndex: 1260,
						bgcolor: 'rgba(0,0,0,0.45)',
					}}
				/>
			) : null}

			<Sheet
				role="dialog"
				aria-label="More navigation"
				aria-hidden={!drawerOpen}
				sx={{
					position: 'fixed',
					left: 0,
					right: 'var(--krona-ai-panel-width, 0px)',
					bottom: 0,
					zIndex: 1270,
					borderRadius: '24px 24px 0 0',
					pb: 'calc(16px + env(safe-area-inset-bottom, 0px))',
					pt: 1.5,
					px: 2,
					transform: drawerOpen ? 'translateY(0)' : 'translateY(100%)',
					transition: 'transform 0.28s ease',
					...kronaActionDrawerSx,
				}}
			>
				<Box
					sx={{
						width: 40,
						height: 4,
						borderRadius: 999,
						bgcolor: 'var(--krona-surface-border)',
						mx: 'auto',
						mb: 1.5,
					}}
				/>
				<Typography level="title-sm" sx={{ mb: 1.5, px: 0.5, fontWeight: 700 }}>
					More
				</Typography>
				<Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
					{hiddenMoreItems.map(({ path, label, icon: Icon }) => {
						const active = isTabActive(pathname, path);
						return (
							<Box
								key={path}
								component="button"
								type="button"
								aria-label={label}
								onClick={() => {
									setMoreOpen(false);
									router.push(path);
								}}
								sx={{
									position: 'relative',
									display: 'flex',
									alignItems: 'center',
									gap: 1.25,
									width: '100%',
									border: 'none',
									borderRadius: '16px',
									px: 1.5,
									py: 1.25,
									cursor: 'pointer',
									fontFamily: 'inherit',
									textAlign: 'left',
									color: active ? '#fff' : 'var(--krona-text)',
									background: active
										? 'var(--krona-accent-gradient)'
										: 'transparent',
									'&:hover': {
										background: active
											? 'var(--krona-accent-gradient-hover)'
											: 'var(--krona-secondary-bg)',
									},
								}}
							>
								<Icon
									size={18}
									aria-hidden
									color={active ? '#fff' : 'currentColor'}
									opacity={1}
								/>
								<Typography
									level="body-sm"
									sx={{
										fontWeight: 600,
										color: active ? '#fff' : 'var(--krona-text)',
										opacity: 1,
									}}
								>
									{label}
								</Typography>
							</Box>
						);
					})}
				</Box>
				<IconButton
					aria-label="Close menu"
					onClick={() => setMoreOpen(false)}
					sx={{
						position: 'absolute',
						top: 12,
						right: 12,
						color: 'var(--krona-text-muted)',
					}}
				>
					✕
				</IconButton>
			</Sheet>
		</>
	);
}
