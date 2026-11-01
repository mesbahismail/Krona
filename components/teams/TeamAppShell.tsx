'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Box, Typography } from '@mui/joy';
import Top from '@/components/Top';
import Background from '@/components/Background';
import KronaPageSpinner from '@/components/krona/KronaPageSpinner';
import DashboardViewportShell from '@/components/dashboard/DashboardViewportShell';
import { useTeamMode } from '@/components/teams/TeamModeContext';
import TeamOnboardingTour from '@/components/teams/TeamOnboardingTour';
import { useKronaLayoutMode } from '@/components/KronaLayoutModeProvider';

/** Guards team routes and provides a consistent Top bar. */
export default function TeamAppShell({
	title,
	children,
	/** Lock to viewport and fit children (dashboard / split pages). */
	fillViewport = false,
	/** When fillViewport, allow the main content area to scroll (e.g. Performance). */
	contentScroll = false,
	onBack,
	backAriaLabel,
}: {
	title: string;
	children: React.ReactNode;
	fillViewport?: boolean;
	contentScroll?: boolean;
	onBack?: () => void;
	backAriaLabel?: string;
}) {
	const router = useRouter();
	const { loading, hasTeam, mode, organization, isManager } = useTeamMode();
	const { isDesktopDashboard, isMobileNav } = useKronaLayoutMode();

	React.useEffect(() => {
		if (loading) return;
		if (!hasTeam) {
			router.replace('/teams/pricing');
			return;
		}
		if (!isManager || mode === 'individual') {
			router.replace('/');
		}
	}, [loading, hasTeam, isManager, mode, router]);

	React.useEffect(() => {
		if (!fillViewport || typeof window === 'undefined') return;
		const html = document.documentElement;
		const body = document.body;
		if (isDesktopDashboard && !contentScroll) {
			html.style.overflow = 'hidden';
			body.style.overflow = 'hidden';
		} else {
			html.style.overflow = '';
			body.style.overflow = '';
		}
		return () => {
			html.style.overflow = '';
			body.style.overflow = '';
		};
	}, [fillViewport, isDesktopDashboard, contentScroll]);

	if (loading || !hasTeam || !isManager || mode !== 'team') {
		return <KronaPageSpinner />;
	}

	const lockHeight = fillViewport && isDesktopDashboard;
	const scrollMain = fillViewport && contentScroll;

	const content = (
		<Box
			sx={{
				position: 'relative',
				height: lockHeight ? '100%' : fillViewport ? '100dvh' : 'auto',
				maxHeight: lockHeight ? '100%' : fillViewport ? '100dvh' : 'none',
				minHeight: lockHeight || fillViewport ? 0 : 'auto',
				overflow: lockHeight && !scrollMain ? 'hidden' : 'visible',
				overflowX: lockHeight ? 'hidden' : 'clip',
				color: 'var(--krona-text)',
				display: 'flex',
				flexDirection: 'column',
			}}
		>
			{fillViewport ? <Background /> : null}
			<Top
				title={title}
				showLogo={!onBack}
				onBack={onBack}
				backAriaLabel={backAriaLabel}
				greetingLabel={
					!onBack && title === 'Team Effort'
						? organization?.name
							? `${organization.name}`
							: undefined
						: undefined
				}
			/>
			<Box
				sx={{
					pt: fillViewport
						? 'calc(var(--krona-top-height, 60px) + 24px)'
						: undefined,
					px: fillViewport ? { xs: '16px', md: 3 } : { xs: 2, md: 3 },
					py: fillViewport ? undefined : 2,
					pb: fillViewport
						? isMobileNav
							? 'calc(var(--krona-mobile-tab-height, 81px) + env(safe-area-inset-bottom, 0px) + 16px)'
							: 3
						: 'calc(var(--krona-mobile-tabbar-height, 0px) + 24px)',
					width: '100%',
					boxSizing: 'border-box',
					maxWidth: fillViewport ? 'none' : 1200,
					mx: fillViewport ? undefined : 'auto',
					flex: fillViewport ? 1 : '0 0 auto',
					minHeight: fillViewport ? 0 : 'auto',
					display: 'flex',
					flexDirection: 'column',
					overflow: scrollMain
						? 'auto'
						: lockHeight
							? 'hidden'
							: 'visible',
					overflowX: lockHeight || scrollMain ? 'hidden' : 'clip',
					position: 'relative',
					zIndex: 1,
				}}
			>
				{!isManager && !fillViewport ? (
					<Typography
						level="body-sm"
						sx={{ color: 'var(--krona-text-muted)', mb: 2, flexShrink: 0 }}
					>
						Showing work assigned to you.
					</Typography>
				) : null}
				<Box
					sx={{
						flex: scrollMain ? '0 0 auto' : fillViewport ? '1 1 0' : '0 0 auto',
						minHeight: fillViewport && !scrollMain ? 0 : 'auto',
						maxHeight: lockHeight && !scrollMain ? '100%' : 'none',
						overflow: lockHeight && !scrollMain ? 'hidden' : 'visible',
						display: 'flex',
						flexDirection: 'column',
					}}
				>
					{children}
				</Box>
			</Box>
		</Box>
	);

	if (fillViewport) {
		return (
			<DashboardViewportShell>
				{content}
				<TeamOnboardingTour />
			</DashboardViewportShell>
		);
	}

	return (
		<>
			{content}
			<TeamOnboardingTour />
		</>
	);
}
