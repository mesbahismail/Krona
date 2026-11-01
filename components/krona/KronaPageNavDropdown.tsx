'use client';

import * as React from 'react';
import { Box, IconButton, Menu, MenuItem, Typography } from '@mui/joy';
import {
	BarChart3,
	Bell,
	FolderKanban,
	Menu as MenuIcon,
	Users,
	type LucideIcon,
} from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { KRONA_PAGE_SWITCHER_ITEMS } from '@/lib/kronaAppNav';
import { KRONA_TEAM_NAV_ITEMS } from '@/lib/teams/nav';
import { useTeamMode } from '@/components/teams/TeamModeContext';
import { kronaMenuSx } from '@/lib/kronaStyles';

const TEAM_NAV_ICONS: Record<string, LucideIcon> = {
	'/team/performance': BarChart3,
	'/team/reminders': Bell,
	'/team/projects': FolderKanban,
	'/team/members': Users,
};

const MENU_OFFSET_PX = 16;

type KronaPageNavDropdownProps = {
	title: string;
};

/** Page title with line menu to jump to other app sections. */
export default function KronaPageNavDropdown({
	title,
}: KronaPageNavDropdownProps) {
	const router = useRouter();
	const pathname = usePathname();
	const { mode } = useTeamMode();
	const switcherItems =
		mode === 'team'
			? KRONA_TEAM_NAV_ITEMS.filter((item) => item.path !== '/team').map(
					({ path, label }) => ({
						path,
						label,
						icon: TEAM_NAV_ICONS[path] ?? FolderKanban,
					}),
				)
			: KRONA_PAGE_SWITCHER_ITEMS;
	const anchorRef = React.useRef<HTMLDivElement>(null);
	const [open, setOpen] = React.useState(false);
	const closeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

	const clearCloseTimer = React.useCallback(() => {
		if (closeTimerRef.current) {
			clearTimeout(closeTimerRef.current);
			closeTimerRef.current = null;
		}
	}, []);

	const openMenu = React.useCallback(() => {
		clearCloseTimer();
		setOpen(true);
	}, [clearCloseTimer]);

	const scheduleClose = React.useCallback(() => {
		clearCloseTimer();
		closeTimerRef.current = setTimeout(() => setOpen(false), 120);
	}, [clearCloseTimer]);

	React.useEffect(() => () => clearCloseTimer(), [clearCloseTimer]);

	React.useEffect(() => {
		if (!open) return;

		const onPointerDown = (event: PointerEvent) => {
			const target = event.target as Element | null;
			if (!target) return;
			if (anchorRef.current?.contains(target)) return;
			if (target.closest('[role="menu"]')) return;
			setOpen(false);
		};

		window.addEventListener('pointerdown', onPointerDown);
		return () => window.removeEventListener('pointerdown', onPointerDown);
	}, [open]);

	return (
		<>
			<Box
				ref={anchorRef}
				data-tour="dashboard-page-menu"
				onMouseEnter={openMenu}
				onMouseLeave={scheduleClose}
				sx={{
					display: 'flex',
					alignItems: 'center',
					gap: 1.25,
					minWidth: 0,
					maxWidth: '100%',
					flex: '1 1 auto',
				}}
			>
				<Typography
					level="title-lg"
					title={title}
					sx={{
						color: 'var(--krona-text)',
						fontSize: { xs: 17, sm: 22 },
						fontWeight: 600,
						overflow: 'hidden',
						textOverflow: 'ellipsis',
						whiteSpace: 'nowrap',
						width: 'max-content',
						maxWidth: '100%',
						minWidth: 0,
						flex: '1 1 auto',
					}}
				>
					{title}
				</Typography>
				<IconButton
					variant="plain"
					size="sm"
					aria-label="Go to another page"
					aria-expanded={open}
					aria-haspopup="menu"
					onClick={() => setOpen((prev) => !prev)}
					sx={{
						flexShrink: 0,
						width: 20,
						height: 20,
						minWidth: 20,
						minHeight: 20,
						p: 0,
						border: 'none',
						bgcolor: 'transparent',
						color: 'color-mix(in srgb, var(--krona-text) 64%, transparent)',
						'&:hover': { bgcolor: 'var(--krona-overlay-hover)' },
					}}
				>
					<MenuIcon size={20} strokeWidth={2} aria-hidden />
				</IconButton>
			</Box>
			<Menu
				anchorEl={anchorRef.current}
				open={open}
				onClose={() => setOpen(false)}
				placement="bottom-start"
				slotProps={{
					root: {
						onMouseEnter: openMenu,
						onMouseLeave: scheduleClose,
						modifiers: [
							{
								name: 'offset',
								options: { offset: [0, MENU_OFFSET_PX] },
							},
						],
					},
				}}
				sx={{
					...kronaMenuSx,
					minWidth: 260,
					'& .MuiMenu-listbox': {
						px: 1.25,
						py: 0.75,
					},
				}}
			>
				{switcherItems.map(({ path, label, icon: NavIcon }) => {
					const isActive = pathname === path;
					return (
						<MenuItem
							key={path}
							selected={isActive}
							onClick={() => {
								setOpen(false);
								router.push(path);
							}}
							sx={{
								position: 'relative',
								fontSize: { xs: 17, sm: 18 },
								fontWeight: 600,
								fontFamily: 'Poppins, sans-serif',
								color: 'var(--krona-text)',
								borderRadius: '14px',
								gap: 1.25,
								py: 1,
								px: 1.25,
								justifyContent: 'flex-start',
								'&:hover': {
									bgcolor: 'var(--krona-overlay-strong)',
								},
								'&.Mui-selected': {
									bgcolor: 'var(--krona-overlay-strong)',
									'&:hover': {
										bgcolor: 'var(--krona-overlay-strong)',
									},
								},
							}}
						>
							<Box
								component="span"
								sx={{
									display: 'inline-flex',
									alignItems: 'center',
									justifyContent: 'center',
									width: 24,
									flexShrink: 0,
									opacity: 0.92,
								}}
							>
								<NavIcon size={20} strokeWidth={2} aria-hidden />
							</Box>
							<Box component="span" sx={{ whiteSpace: 'nowrap' }}>
								{label}
							</Box>
						</MenuItem>
					);
				})}
			</Menu>
		</>
	);
}
