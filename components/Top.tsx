'use client';

import * as React from 'react';
import { Sheet, Box, IconButton, Chip, Tooltip, Typography } from '@mui/joy';
import { useRouter, usePathname } from 'next/navigation';
import { ChevronLeft, CalendarDays, Bell } from 'lucide-react';
import KronaChallengeNavProgress from '@/components/krona/KronaChallengeNavProgress';
import NavBarTimer from '@/components/NavBarTimer';
import NavBarTimerCenter from '@/components/NavBarTimerCenter';
import UserAccountControls from '@/components/UserAccountControls';
import { useKronaLayoutMode } from '@/components/KronaLayoutModeProvider';
import { useTeamMode } from '@/components/teams/TeamModeContext';
import { useTeamActivity } from '@/components/teams/TeamActivityProvider';
import { useTopBarWidth } from '@/hooks/useTopBarWidth';
import { KRONA_COMPACT_TITLE_MIN_PX } from '@/lib/kronaBreakpoints';
import {
	kronaDateChipSx,
	kronaHeaderActionsSx,
	kronaNavBarSx,
	kronaNavTimerControlSx,
} from '@/lib/kronaStyles';

type TopProps = {
	title?: string;
	/** Home dashboard greeting, e.g. "Morning, Alex!" */
	greetingLabel?: string;
	showLogo?: boolean;
	/** Override default back navigation (dashboard). */
	onBack?: () => void;
	/** Accessible label for the back control when shown. */
	backAriaLabel?: string;
};

const topBarShellSx = {
	position: 'fixed',
	top: 0,
	left: 'var(--krona-sidebar-width)',
	right: 'var(--krona-ai-panel-width, 0px)',
	height: 'var(--krona-top-height, 60px)',
	minHeight: 'var(--krona-top-height, 60px)',
	maxHeight: 'var(--krona-top-height, 60px)',
	transition:
		'var(--krona-ai-resize-transition, left 0.36s cubic-bezier(0.22, 1, 0.36, 1), right 0.36s cubic-bezier(0.22, 1, 0.36, 1))',
	zIndex: 1300,
	...kronaNavBarSx,
} as const;

export default function Top({
	title = '',
	greetingLabel,
	onBack,
	backAriaLabel,
}: TopProps) {
	const router = useRouter();
	const pathname = usePathname();
	const navRef = React.useRef<HTMLDivElement>(null);
	const { isMobileNav, contentWidth } = useKronaLayoutMode();
	const { mode: workspaceMode, hasTeam } = useTeamMode();
	const {
		open: activityOpen,
		toggle: toggleActivity,
		unreadCount,
	} = useTeamActivity();
	const showNavTimer = workspaceMode !== 'team';
	const showTeamActivity = hasTeam;
	const showChallengeProgress = workspaceMode !== 'team';
	const [dateLabel, setDateLabel] = React.useState('');
	useTopBarWidth(navRef);

	const isHome = pathname === '/' || pathname === '/team';
	const showBack = !isHome;

	const pageTitle = greetingLabel || title || '';
	const showCompactTitle =
		!!pageTitle && contentWidth >= KRONA_COMPACT_TITLE_MIN_PX;

	React.useEffect(() => {
		const update = () => {
			setDateLabel(
				new Date().toLocaleDateString('en-US', {
					weekday: 'short',
					month: 'short',
					day: 'numeric',
				}),
			);
		};
		update();
		const id = window.setInterval(update, 60_000);
		return () => window.clearInterval(id);
	}, []);

	const handleBack = () => {
		if (onBack) onBack();
		else if (pathname.startsWith('/team')) router.push('/team');
		else router.push('/');
	};

	const backAria = backAriaLabel ?? (onBack ? 'Go back' : 'Back to dashboard');

	const renderBackButton = () =>
		showBack ? (
			<IconButton
				size="sm"
				aria-label={backAria}
				onClick={handleBack}
				sx={kronaNavTimerControlSx}
			>
				<ChevronLeft size={20} />
			</IconButton>
		) : null;

	const renderActivityButton = () =>
		showTeamActivity && !activityOpen ? (
			<Tooltip title="Activity">
				<IconButton
					size="sm"
					variant="plain"
					aria-label="Open activity"
					data-tour="team-activity-bell"
					onClick={toggleActivity}
					sx={{
						...kronaNavTimerControlSx,
						flexShrink: 0,
						position: 'relative',
						overflow: 'visible',
					}}
				>
					<Bell size={18} />
					{unreadCount > 0 ? (
						<Box
							component="span"
							aria-label={`${unreadCount} unread`}
							sx={{
								position: 'absolute',
								top: 0,
								right: 0,
								width: 8,
								height: 8,
								borderRadius: '50%',
								bgcolor: 'var(--krona-accent)',
								pointerEvents: 'none',
								transform: 'translate(15%, -15%)',
							}}
						/>
					) : null}
				</IconButton>
			</Tooltip>
		) : null;

	return (
		<>
			<Box ref={navRef} sx={topBarShellSx}>
				{/* Compact top bar — the side rail owns page navigation. */}
				<Box
					component="header"
					sx={{
						display: isMobileNav ? 'grid' : 'none',
						gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)',
						alignItems: 'center',
						gap: 0.75,
						px: '16px',
						py: 0,
						bgcolor: 'transparent',
						height: '100%',
						minWidth: 0,
					}}
				>
					<Box
						sx={{
							display: 'flex',
							alignItems: 'center',
							gap: 0.75,
							flex: showCompactTitle ? '1 1 auto' : '0 0 auto',
							minWidth: 0,
							maxWidth: '100%',
							justifySelf: 'start',
						}}
					>
						{renderBackButton()}
						{showCompactTitle ? (
							<Typography
								level="title-lg"
								title={pageTitle}
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
								{pageTitle}
							</Typography>
						) : null}
					</Box>

					<Box
						sx={{
							justifySelf: 'center',
							minWidth: 0,
							display: 'flex',
							justifyContent: 'center',
							alignItems: 'center',
							px: 0.5,
						}}
					>
						{showNavTimer ? <NavBarTimer compact /> : null}
					</Box>

					<Box
						sx={{
							display: 'flex',
							alignItems: 'center',
							gap: 1.75,
							justifySelf: 'end',
							flexShrink: 0,
						}}
					>
						{renderActivityButton()}
						<UserAccountControls onboardingTourEnabled={isMobileNav} />
					</Box>
				</Box>

				{/* Desktop top bar — page title, focus timer and account controls. */}
				<Sheet
					component="header"
					sx={{
						display: isMobileNav ? 'none' : 'grid',
						gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)',
						alignItems: 'center',
						gap: 1,
						px: { md: '24px', lg: '36px' },
						py: 0,
						bgcolor: 'transparent',
						height: '100%',
						position: 'relative',
						minWidth: 0,
						boxSizing: 'border-box',
					}}
				>
					<Box
						sx={{
							display: 'flex',
							alignItems: 'center',
							gap: 2,
							justifyContent: 'flex-start',
							flex: '0 1 auto',
							width: 'max-content',
							minWidth: 0,
							maxWidth: '100%',
							justifySelf: 'start',
							pr: 0.5,
							position: 'relative',
							zIndex: 3,
						}}
					>
						{renderBackButton()}
						{pageTitle ? (
							<Typography
								level="title-lg"
								noWrap
								sx={{ color: 'var(--krona-text)', fontWeight: 600 }}
							>
								{pageTitle}
							</Typography>
						) : null}
					</Box>

					{/* Equal outer grid columns keep the timer at the center of the bar. */}
					<NavBarTimerCenter
						data-tour={isHome ? 'dashboard-header' : undefined}
						sx={{ justifySelf: 'center', width: 'max-content', minWidth: 0, px: 1 }}
					>
						{showNavTimer ? <NavBarTimer /> : null}
					</NavBarTimerCenter>

					<Box
						sx={{
							...kronaHeaderActionsSx,
							justifySelf: 'end',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'flex-end',
							flexShrink: 0,
							minWidth: 0,
							pl: 0.5,
						}}
					>
						<Chip
							variant="soft"
							color="neutral"
							startDecorator={<CalendarDays size={16} aria-hidden />}
							aria-label={`Today — ${dateLabel || 'today'}`}
							sx={{
								...kronaDateChipSx,
								background: 'none',
								boxShadow: 'none',
								display: { xs: 'none', lg: 'inline-flex' },
								flexShrink: 0,
								textDecoration: 'none',
								cursor: 'default',
								color: 'var(--krona-text-muted)',
								transition: 'color 0.15s ease, background-color 0.15s ease',
								'& .MuiChip-label, & .MuiChip-startDecorator': {
									color: 'inherit',
								},
								'&:hover': {
									background: 'var(--krona-overlay-hover)',
									color: 'var(--krona-text)',
								},
							}}
						>
							{dateLabel || '—'}
						</Chip>

						{isHome ? (
							<Box
								sx={{
									display: 'inline-flex',
									alignItems: 'center',
									gap: 3,
									flexShrink: 0,
								}}
							>
								{showChallengeProgress ? <KronaChallengeNavProgress /> : null}
								{renderActivityButton()}
								<UserAccountControls onboardingTourEnabled={!isMobileNav} />
							</Box>
						) : (
							<>
								{showChallengeProgress ? <KronaChallengeNavProgress /> : null}
								{renderActivityButton()}
								<UserAccountControls onboardingTourEnabled={!isMobileNav} />
							</>
						)}
					</Box>
				</Sheet>
			</Box>
		</>
	);
}
