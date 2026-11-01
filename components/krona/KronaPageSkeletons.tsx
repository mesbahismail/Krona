'use client';

import * as React from 'react';
import { Box, Skeleton } from '@mui/joy';
import type { SxProps } from '@mui/joy/styles/types';
import Background from '@/components/Background';
import {
	kronaSkeletonSx,
	kronaSideListScrollSx,
	kronaSideListToolbarRowSx,
	kronaTabBarSx,
	kronaWidgetCardSx,
	kronaWidgetListItemSx,
	kronaWidgetPaddingSx,
	SETTINGS_PAGE_MAX_WIDTH,
	ROUTINE_VIEW_PAGE_MAX_WIDTH,
} from '@/lib/kronaStyles';
import { DEFAULT_DASHBOARD_LAYOUT, resolveDashboardPlacementForLayout, type DashboardWidgetId } from '@/lib/dashboardLayout';
import {
	DashboardMobileSecondaryWidgetHeightsProvider,
	isMobileSecondaryEqualHeightWidget,
	mergeDashboardWidgetShellRefs,
	useDashboardMobileSecondaryWidgetHeightsOptional,
} from '@/components/dashboard/DashboardMobileSecondaryWidgetHeights';
import { useKronaLayoutMode } from '@/components/KronaLayoutModeProvider';
import { KRONA_TABLET_MAX_PX } from '@/lib/kronaBreakpoints';
import {
	LineSkeleton,
	PerformanceWidgetSkeleton,
	ReminderListSkeleton,
	SearchFieldSkeleton,
	SearchToolbarSkeleton,
	TaskListSkeleton,
	TimerWidgetSkeleton,
	TodayProgressSkeleton,
	WidgetHeaderSkeleton,
} from '@/components/dashboard/DashboardWidgetSkeletons';
import { ProjectsListSkeleton } from '@/components/projects/ProjectsPageSkeletons';
import KronaResizableSplitLayout from '@/components/krona/KronaResizableSplitLayout';

function DashboardWidgetShellSkeleton({
	id,
	children,
	sx,
	shellRef,
}: {
	id: DashboardWidgetId;
	children: React.ReactNode;
	sx?: SxProps;
	shellRef?: React.Ref<HTMLDivElement>;
}) {
	const placement = DEFAULT_DASHBOARD_LAYOUT[id];
	const { mode, isTabletDashboard, isDesktopDashboard } = useKronaLayoutMode();
	const resolvedPlacement = resolveDashboardPlacementForLayout(placement, mode);
	const mobileSecondaryHeights = useDashboardMobileSecondaryWidgetHeightsOptional();
	const registerRef = React.useCallback(
		(node: HTMLDivElement | null) => {
			mobileSecondaryHeights?.registerWidget(id, node);
		},
		[id, mobileSecondaryHeights],
	);

	const equalHeight =
		isMobileSecondaryEqualHeightWidget(id) &&
		isTabletDashboard &&
		mobileSecondaryHeights?.height
			? mobileSecondaryHeights.height
			: null;

	return (
		<Box
			ref={mergeDashboardWidgetShellRefs(registerRef, shellRef)}
			className="krona-dashboard-widget"
			sx={
				[
					kronaWidgetCardSx,
					kronaWidgetPaddingSx,
					{
						gridColumn: resolvedPlacement.gridColumn,
						gridRow: resolvedPlacement.gridRow,
						order: resolvedPlacement.order,
						pointerEvents: 'none',
					},
					equalHeight != null
						? {
								height: equalHeight,
								maxHeight: isDesktopDashboard ? 'none' : equalHeight,
								minHeight: equalHeight,
							}
						: null,
					...(sx ? [sx] : []),
				] as SxProps
			}
		>
			{children}
		</Box>
	);
}

/** Shell for `next/dynamic` route fallbacks. */
export function KronaRouteLoadingFallback({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<Box
			sx={{
				minHeight: '100dvh',
				position: 'relative',
				color: 'var(--krona-text)',
				overflow: 'hidden',
			}}
		>
			<Background />
			<Box
				className="krona-main-content"
				sx={{
					position: 'relative',
					zIndex: 1,
					minHeight: '100dvh',
					display: 'flex',
					flexDirection: 'column',
				}}
			>
				{children}
			</Box>
		</Box>
	);
}

export function ProjectsRouteSkeleton() {
	return (
		<KronaRouteLoadingFallback>
			<Box sx={{ flex: 1, px: { xs: 0, md: 0 }, py: 2, minHeight: 0 }}>
				<ProjectsListSkeleton />
			</Box>
		</KronaRouteLoadingFallback>
	);
}

export function RemindersPageSkeleton() {
	return (
		<Box aria-busy aria-label="Loading reminders" sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
			<Box sx={{ display: { xs: 'flex', md: 'none' }, flexDirection: 'column', flex: 1, minHeight: 0 }}>
				<Box sx={kronaSideListToolbarRowSx}>
					<SearchToolbarSkeleton withSort sx={{ mb: 0 }} />
				</Box>
				<Box sx={{ ...kronaTabBarSx, mt: '20px', flexShrink: 0 }}>
					<LineSkeleton width="50%" height={32} sx={{ borderRadius: '999px' }} />
					<LineSkeleton width="50%" height={32} sx={{ borderRadius: '999px' }} />
				</Box>
				<ReminderListColumnSkeleton />
			</Box>
			<KronaResizableSplitLayout
				dividerAriaLabel="Loading reminders"
				containerSx={{ flex: 1, minHeight: 0, display: { xs: 'none', md: 'flex' } }}
				sidebar={
					<>
						<Box sx={kronaSideListToolbarRowSx}>
							<SearchToolbarSkeleton withSort sx={{ mb: 0 }} />
						</Box>
						<ReminderListColumnSkeleton />
					</>
				}
				detail={
					<Box sx={{ pt: 1.5 }}>
						<CalendarGridSkeleton />
					</Box>
				}
			/>
		</Box>
	);
}

function ReminderListColumnSkeleton({ count = 5 }: { count?: number }) {
	return (
		<Box
			sx={{
				flex: 1,
				overflow: 'hidden',
				pt: { xs: 0, md: '20px' },
				pb: 1,
				display: 'flex',
				flexDirection: 'column',
				gap: '12px',
			}}
		>
			{Array.from({ length: count }, (_, i) => (
				<Box
					key={i}
					sx={{
						...kronaWidgetListItemSx,
						p: 2,
						borderRadius: '18px',
						display: 'flex',
						gap: 1.25,
						pointerEvents: 'none',
					}}
				>
					<Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
						<LineSkeleton width={i % 2 === 0 ? '68%' : '54%'} height={16} />
						<LineSkeleton width={i % 2 === 0 ? '44%' : '58%'} height={12} />
						<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
							<LineSkeleton width={72} height={20} sx={{ borderRadius: '999px', flexShrink: 0 }} />
							<LineSkeleton width={i % 2 === 0 ? '30%' : '38%'} height={12} />
						</Box>
					</Box>
					<LineSkeleton width={28} height={28} sx={{ borderRadius: '999px', flexShrink: 0 }} />
				</Box>
			))}
		</Box>
	);
}

function CalendarGridSkeleton() {
	return (
		<Box sx={{ pointerEvents: 'none' }}>
			<Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
				<LineSkeleton width={32} height={32} sx={{ borderRadius: '999px' }} />
				<LineSkeleton width="34%" height={22} sx={{ borderRadius: 12 }} />
				<LineSkeleton width={32} height={32} sx={{ borderRadius: '999px' }} />
			</Box>
			<Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.75, mb: 1 }}>
				{Array.from({ length: 7 }, (_, i) => (
					<LineSkeleton key={i} width="100%" height={12} />
				))}
			</Box>
			<Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0 }}>
				{Array.from({ length: 42 }, (_, i) => (
					<Skeleton
						key={i}
						variant="rectangular"
						animation="wave"
						sx={{
							...kronaSkeletonSx,
							width: '100%',
							aspectRatio: '1',
							borderRadius: 0,
							border: '1px solid var(--krona-surface-border)',
						}}
					/>
				))}
			</Box>
		</Box>
	);
}

export function MembersPageSkeleton() {
	return (
		<Box
			aria-busy
			aria-label="Loading team members"
			sx={{ flex: 1, minHeight: 0, width: '100%' }}
		>
			<KronaResizableSplitLayout
				dividerAriaLabel="Loading team members"
				containerSx={{
					flex: 1,
					minHeight: 0,
					overflow: 'hidden',
				}}
				sidebar={
					<>
						<Box sx={kronaSideListToolbarRowSx}>
							<SearchToolbarSkeleton sx={{ mb: 0 }} />
						</Box>
						<LineSkeleton
							width="42%"
							height={10}
							sx={{ mt: 1, mb: 0.5, ml: 0.5 }}
						/>
						<Box
							sx={{
								...kronaSideListScrollSx,
								display: 'flex',
								flexDirection: 'column',
								gap: '16px',
							}}
						>
							{Array.from({ length: 5 }, (_, i) => (
								<Box
									key={i}
									sx={{
										display: 'flex',
										alignItems: 'center',
										gap: 1.25,
										px: 1.5,
										py: 1.25,
										pointerEvents: 'none',
									}}
								>
									<LineSkeleton
										width={36}
										height={36}
										sx={{ borderRadius: '999px', flexShrink: 0 }}
									/>
									<Box sx={{ flex: 1, minWidth: 0 }}>
										<LineSkeleton
											width={i % 2 === 0 ? '68%' : '54%'}
											height={14}
											sx={{ mb: 0.5 }}
										/>
										<LineSkeleton
											width={i % 2 === 0 ? '44%' : '58%'}
											height={10}
										/>
									</Box>
								</Box>
							))}
						</Box>
					</>
				}
				detail={
					<Box
						sx={{
							flex: 1,
							display: 'flex',
							flexDirection: 'column',
							gap: 1.5,
							p: { xs: 2, md: 3 },
							minWidth: 0,
							pointerEvents: 'none',
						}}
					>
						<Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
							<LineSkeleton
								width={56}
								height={56}
								sx={{ borderRadius: '999px', flexShrink: 0 }}
							/>
							<Box sx={{ flex: 1, minWidth: 0 }}>
								<LineSkeleton width="38%" height={24} sx={{ mb: 0.75 }} />
								<LineSkeleton width="52%" height={12} />
							</Box>
						</Box>
						<LineSkeleton width="28%" height={12} sx={{ mt: 1 }} />
						<LineSkeleton width="100%" height={14} />
						<LineSkeleton width="92%" height={14} />
						<LineSkeleton width="74%" height={14} />
					</Box>
				}
				detailDisplay={{ xs: 'none', md: 'flex' }}
			/>
		</Box>
	);
}

export function NotesPageSkeleton() {
	return (
		<Box aria-busy aria-label="Loading notes" sx={{ flex: 1, minHeight: 0, width: '100%' }}>
			<KronaResizableSplitLayout
				dividerAriaLabel="Loading notes"
			sidebar={
				<>
					<Box sx={kronaSideListToolbarRowSx}>
						<SearchToolbarSkeleton sx={{ mb: 0 }} />
					</Box>
					<Box sx={{ ...kronaSideListScrollSx, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
						{Array.from({ length: 6 }, (_, i) => (
							<Box key={i} sx={{ px: 1.5, py: 1, pointerEvents: 'none' }}>
								<LineSkeleton width={i % 2 === 0 ? '72%' : '58%'} height={14} sx={{ mb: 0.5 }} />
								<LineSkeleton width={i % 2 === 0 ? '48%' : '62%'} height={10} />
							</Box>
						))}
					</Box>
				</>
			}
			detail={
				<Box
					sx={{
						flex: 1,
						display: 'flex',
						flexDirection: 'column',
						gap: 2,
						p: 3,
						minWidth: 0,
						pointerEvents: 'none',
					}}
				>
					<LineSkeleton width="46%" height={28} sx={{ borderRadius: 12 }} />
					<LineSkeleton width="100%" height={14} />
					<LineSkeleton width="96%" height={14} />
					<LineSkeleton width="88%" height={14} />
					<LineSkeleton width="72%" height={14} />
				</Box>
			}
			detailDisplay={{ xs: 'none', md: 'flex' }}
			/>
		</Box>
	);
}

export function RoutineViewPageSkeleton() {
	return (
		<Box
			aria-busy
			aria-label="Loading routine"
			sx={{
				width: '100%',
				maxWidth: ROUTINE_VIEW_PAGE_MAX_WIDTH,
				mx: 'auto',
				px: { xs: 0, md: 0 },
				py: { xs: 2, md: 3 },
				pointerEvents: 'none',
			}}
		>
			<Box sx={{ display: 'flex', gap: 1, mb: 2.5, overflow: 'hidden' }}>
				{Array.from({ length: 8 }, (_, i) => (
					<Skeleton
						key={i}
						variant="rectangular"
						animation="wave"
						sx={{
							...kronaSkeletonSx,
							width: 56,
							height: 64,
							borderRadius: 18,
							flexShrink: 0,
						}}
					/>
				))}
			</Box>
			<Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
				<LineSkeleton width="38%" height={24} sx={{ borderRadius: 12 }} />
				<LineSkeleton width={120} height={40} sx={{ borderRadius: '999px' }} />
			</Box>
			<Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
				{Array.from({ length: 5 }, (_, i) => (
					<Box
						key={i}
						sx={{
							py: 1,
							px: 1.5,
							borderRadius: '20px',
							border: '1px solid var(--krona-surface-border)',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'space-between',
							gap: 2,
						}}
					>
						<Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
							<Skeleton
								variant="circular"
								animation="wave"
								sx={{ ...kronaSkeletonSx, width: 28, height: 28, flexShrink: 0 }}
							/>
							<LineSkeleton width={i % 2 === 0 ? '48%' : '36%'} height={16} />
						</Box>
						<LineSkeleton width={88} height={14} />
					</Box>
				))}
			</Box>
		</Box>
	);
}

export function RoutineRouteSkeleton() {
	return (
		<KronaRouteLoadingFallback>
			<Box sx={{ flex: 1, minHeight: 0 }}>
				<RoutineViewPageSkeleton />
			</Box>
		</KronaRouteLoadingFallback>
	);
}

export function RoutineEditorPageSkeleton() {
	return (
		<Box
			aria-busy
			aria-label="Loading routine editor"
			sx={{
				flex: 1,
				px: { xs: 2, md: 3 },
				py: 2,
				maxWidth: 720,
				mx: 'auto',
				width: '100%',
				pointerEvents: 'none',
			}}
		>
			<Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
				<Skeleton
					variant="circular"
					animation="wave"
					sx={{ ...kronaSkeletonSx, width: 36, height: 36, flexShrink: 0 }}
				/>
				<LineSkeleton width="42%" height={22} sx={{ borderRadius: 12 }} />
			</Box>
			<LineSkeleton width="56%" height={14} sx={{ mb: 2 }} />
			<Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
				{Array.from({ length: 4 }, (_, i) => (
					<Box
						key={i}
						sx={{
							borderRadius: '20px',
							border: '1px solid var(--krona-surface-border)',
							p: 2,
							display: 'flex',
							flexDirection: 'column',
							gap: 1.25,
						}}
					>
						<Box sx={{ display: 'flex', gap: 1.25, alignItems: 'center' }}>
							<Skeleton
								variant="circular"
								animation="wave"
								sx={{ ...kronaSkeletonSx, width: 36, height: 36 }}
							/>
							<LineSkeleton width={i % 2 === 0 ? '40%' : '52%'} height={16} />
						</Box>
						<LineSkeleton width="100%" height={40} sx={{ borderRadius: 16 }} />
						<LineSkeleton width="72%" height={32} sx={{ borderRadius: '999px' }} />
					</Box>
				))}
			</Box>
		</Box>
	);
}

export function RoutineEditorRouteSkeleton() {
	return (
		<KronaRouteLoadingFallback>
			<RoutineEditorPageSkeleton />
		</KronaRouteLoadingFallback>
	);
}

export function SettingsPageSkeleton() {
	return (
		<Box
			aria-busy
			aria-label="Loading settings"
			sx={{
				display: 'flex',
				flexDirection: 'column',
				width: '100%',
				gap: { xs: 2, md: 2.5 },
				pointerEvents: 'none',
			}}
		>
			<Box
				sx={{
					display: 'flex',
					flexDirection: 'row',
					flexWrap: 'wrap',
					gap: 1,
					justifyContent: 'flex-start',
				}}
			>
				{Array.from({ length: 5 }, (_, i) => (
					<LineSkeleton
						key={i}
						width={i === 0 ? 130 : 110}
						height={40}
						sx={{ borderRadius: '999px' }}
					/>
				))}
			</Box>
			<Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
				<LineSkeleton width="34%" height={24} sx={{ borderRadius: 12 }} />
				{Array.from({ length: 3 }, (_, i) => (
					<Box key={i} sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
						<LineSkeleton width="28%" height={12} />
						<LineSkeleton width="100%" height={40} sx={{ borderRadius: 16 }} />
					</Box>
				))}
				<LineSkeleton width={140} height={40} sx={{ borderRadius: '999px', mt: 1 }} />
			</Box>
		</Box>
	);
}

export function PasswordPageSkeleton() {
	return (
		<Box
			aria-busy
			aria-label="Loading password settings"
			sx={{
				width: '100%',
				maxWidth: SETTINGS_PAGE_MAX_WIDTH,
				mx: 'auto',
				px: { xs: 0, md: 3 },
				py: 2,
				display: 'flex',
				flexDirection: 'column',
				gap: 2,
				pointerEvents: 'none',
			}}
		>
			{Array.from({ length: 3 }, (_, i) => (
				<Box key={i} sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
					<LineSkeleton width="36%" height={12} />
					<LineSkeleton width="100%" height={40} sx={{ borderRadius: 16 }} />
				</Box>
			))}
			<LineSkeleton width={160} height={40} sx={{ borderRadius: '999px', mt: 1 }} />
		</Box>
	);
}

export function SubscriptionPanelSkeleton() {
	return (
		<Box
			aria-busy
			aria-label="Loading subscription"
			sx={{ display: 'flex', flexDirection: 'column', gap: 2, pointerEvents: 'none' }}
		>
			<LineSkeleton width="40%" height={22} sx={{ borderRadius: 12 }} />
			<LineSkeleton width="100%" height={88} sx={{ borderRadius: 16 }} />
			<LineSkeleton width={180} height={40} sx={{ borderRadius: '999px' }} />
		</Box>
	);
}

export function DashboardPageSkeleton() {
	const timerShellRef = React.useRef<HTMLDivElement>(null);
	const [mobileTasksHeight, setMobileTasksHeight] = React.useState<number | null>(null);

	React.useLayoutEffect(() => {
		if (typeof window === 'undefined') return;
		const mq = window.matchMedia(`(max-width: ${KRONA_TABLET_MAX_PX}px)`);
		const measure = () => {
			if (!mq.matches) {
				setMobileTasksHeight(null);
				return;
			}
			const height = timerShellRef.current?.offsetHeight;
			if (height && height > 0) {
				setMobileTasksHeight(height);
			}
		};

		measure();
		const observer = new ResizeObserver(() => measure());
		const node = timerShellRef.current;
		if (node) observer.observe(node);
		mq.addEventListener('change', measure);
		window.addEventListener('orientationchange', measure);

		return () => {
			observer.disconnect();
			mq.removeEventListener('change', measure);
			window.removeEventListener('orientationchange', measure);
		};
	}, []);

	return (
		<DashboardMobileSecondaryWidgetHeightsProvider>
			<DashboardWidgetShellSkeleton
				id="tasks"
				sx={{
					minHeight: 0,
					height: {
						xs: mobileTasksHeight ?? 'auto',
						lg: '100%',
					},
					maxHeight: {
						xs: mobileTasksHeight ?? 'none',
						lg: 'none',
					},
					display: 'flex',
					flexDirection: 'column',
				}}
			>
				<WidgetHeaderSkeleton actionCount={3} titleWidth={96} />
				<Box sx={{ mb: '20px' }}>
					<SearchFieldSkeleton />
				</Box>
				<Box sx={{ flex: 1, minHeight: 0 }}>
					<TaskListSkeleton count={4} />
				</Box>
			</DashboardWidgetShellSkeleton>

			<DashboardWidgetShellSkeleton
				id="timer"
				shellRef={timerShellRef}
				sx={{
					minHeight: 0,
					height: { lg: '100%' },
					display: 'flex',
					flexDirection: 'column',
					flex: 1,
				}}
			>
				<WidgetHeaderSkeleton actionCount={1} titleWidth={56} />
				<TimerWidgetSkeleton />
			</DashboardWidgetShellSkeleton>

			<DashboardWidgetShellSkeleton
				id="work-hours"
				sx={{
					minHeight: 0,
					height: { lg: '100%' },
					display: 'flex',
					flexDirection: 'column',
					justifyContent: 'center',
				}}
			>
				<WidgetHeaderSkeleton actionCount={0} titleWidth={132} />
				<TodayProgressSkeleton />
			</DashboardWidgetShellSkeleton>

			<DashboardWidgetShellSkeleton
				id="reminders"
				sx={{
					minHeight: 0,
					height: { lg: '100%' },
					display: 'flex',
					flexDirection: 'column',
				}}
			>
				<WidgetHeaderSkeleton actionCount={1} titleWidth={88} mb={1} />
				<Box sx={{ flex: 1, minHeight: 0 }}>
					<ReminderListSkeleton />
				</Box>
			</DashboardWidgetShellSkeleton>

			<DashboardWidgetShellSkeleton
				id="performance"
				sx={{
					minHeight: 0,
					height: { lg: '100%' },
					display: 'flex',
					flexDirection: 'column',
				}}
			>
				<WidgetHeaderSkeleton actionCount={0} titleWidth={120} mb={0} />
				<PerformanceWidgetSkeleton />
			</DashboardWidgetShellSkeleton>
		</DashboardMobileSecondaryWidgetHeightsProvider>
	);
}
