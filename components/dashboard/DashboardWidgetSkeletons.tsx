'use client';

import * as React from 'react';
import { Box, Skeleton } from '@mui/joy';
import type { SxProps } from '@mui/joy/styles/types';
import { DASHBOARD_WIDGET_HEADER_GAP } from '@/components/dashboard/DashboardWidgetChrome';
import {
	kronaShadowBleedSx,
	kronaSkeletonSx,
	kronaTabBarSx,
	kronaTaskListCheckboxContentGap,
	kronaTaskListNameDetailsGap,
	kronaTaskListRowSx,
	kronaTaskRowActionsSx,
	kronaToolbarRowSx,
	kronaWidgetHorizontalCardSx,
	kronaWidgetListItemSx,
} from '@/lib/kronaStyles';


export function LineSkeleton({
	width,
	height = 12,
	sx,
}: {
	width: string | number;
	height?: number;
	sx?: object;
}) {
	return (
		<Skeleton
			variant="rectangular"
			animation="wave"
			sx={{
				...kronaSkeletonSx,
				width,
				height,
				borderRadius: 10,
				...sx,
			}}
		/>
	);
}

export function TaskCheckboxSkeleton() {
	return (
		<Skeleton
			variant="rectangular"
			animation="wave"
			sx={{
				...kronaSkeletonSx,
				width: 26,
				height: 26,
				minWidth: 26,
				minHeight: 26,
				borderRadius: '10px',
				flexShrink: 0,
			}}
		/>
	);
}

export function IconButtonSkeleton({ size = 32 }: { size?: number }) {
	return (
		<Skeleton
			variant="circular"
			animation="wave"
			sx={{
				...kronaSkeletonSx,
				width: size,
				height: size,
				flexShrink: 0,
			}}
		/>
	);
}

export function SearchFieldSkeleton({ sx }: { sx?: object }) {
	return (
		<LineSkeleton
			width="100%"
			height={32}
			sx={{ borderRadius: '999px', flex: 1, minWidth: 0, ...sx }}
		/>
	);
}

export function SearchToolbarSkeleton({
	withSort = false,
	withCreate = true,
	sx,
}: {
	withSort?: boolean;
	withCreate?: boolean;
	sx?: SxProps;
}) {
	return (
		<Box
			sx={[
				kronaToolbarRowSx,
				{ mb: '20px', pointerEvents: 'none' },
				...(Array.isArray(sx) ? sx : sx ? [sx] : []),
			] as SxProps}
		>
			<SearchFieldSkeleton />
			{withSort ? <IconButtonSkeleton /> : null}
			{withCreate ? <IconButtonSkeleton /> : null}
		</Box>
	);
}

export function WidgetHeaderSkeleton({
	actionCount = 1,
	mb = DASHBOARD_WIDGET_HEADER_GAP,
	titleWidth = 120,
}: {
	actionCount?: number;
	mb?: number | string;
	titleWidth?: number | string;
}) {
	return (
		<Box
			sx={{
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'space-between',
				mb,
				gap: 1,
				flexShrink: 0,
			}}
		>
			<LineSkeleton width={titleWidth} height={16} sx={{ borderRadius: 10 }} />
			{actionCount > 0 ? (
				<Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
					{Array.from({ length: actionCount }, (_, i) => (
						<IconButtonSkeleton key={i} />
					))}
				</Box>
			) : null}
		</Box>
	);
}

export function TaskListSkeleton({
	count = 4,
	variant = 'widget',
}: {
	count?: number;
	variant?: 'widget' | 'flat';
}) {
	if (variant === 'flat') {
		return (
			<Box sx={{ display: 'flex', flexDirection: 'column' }} aria-busy aria-label="Loading tasks">
				{Array.from({ length: count }, (_, i) => (
					<Box
						key={i}
						className="krona-task-list-row"
						sx={{
							...kronaTaskListRowSx(),
							display: 'flex',
							alignItems: 'center',
							gap: 1,
							minWidth: 0,
							py: 1,
							pointerEvents: 'none',
						}}
					>
						<TaskCheckboxSkeleton />
						<Box
							sx={{
								flex: 1,
								minWidth: 0,
								display: 'flex',
								flexDirection: 'column',
								justifyContent: 'center',
								ml: kronaTaskListCheckboxContentGap,
								gap: kronaTaskListNameDetailsGap,
							}}
						>
							<LineSkeleton width={i % 2 === 0 ? '68%' : '54%'} height={16} />
							<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
								<Skeleton
									variant="circular"
									animation="wave"
									sx={{ ...kronaSkeletonSx, width: 14, height: 14, flexShrink: 0 }}
								/>
								<LineSkeleton width={72} height={13} sx={{ borderRadius: 8 }} />
							</Box>
						</Box>
						<Box sx={kronaTaskRowActionsSx}>
							<IconButtonSkeleton size={28} />
						</Box>
					</Box>
				))}
			</Box>
		);
	}

	return (
		<Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }} aria-busy aria-label="Loading tasks">
			{Array.from({ length: count }, (_, i) => (
				<Box
					key={i}
					sx={{
						...kronaWidgetListItemSx,
						borderRadius: '18px',
						p: 1.25,
						display: 'flex',
						alignItems: 'center',
						gap: 1.5,
						minWidth: 0,
						pointerEvents: 'none',
					}}
				>
					<TaskCheckboxSkeleton />
					<Box sx={{ flex: 1, minWidth: 0 }}>
						<LineSkeleton width={i % 2 === 0 ? '72%' : '58%'} height={14} />
						<LineSkeleton
							width={i % 2 === 0 ? '88%' : '76%'}
							height={12}
							sx={{ mt: 0.25, borderRadius: 8 }}
						/>
					</Box>
					<Box sx={kronaTaskRowActionsSx}>
						<IconButtonSkeleton />
					</Box>
				</Box>
			))}
		</Box>
	);
}

export function NotesListSkeleton({ count = 4 }: { count?: number }) {
	return (
		<Box
			sx={{
				display: 'flex',
				gap: 1.25,
				alignItems: 'stretch',
				overflow: 'hidden',
				...kronaShadowBleedSx,
			}}
			aria-busy
			aria-label="Loading notes"
		>
			{Array.from({ length: count }, (_, i) => (
				<Box
					key={i}
					sx={{
						...kronaWidgetHorizontalCardSx,
						p: 1.5,
						display: 'flex',
						flexDirection: 'column',
						justifyContent: 'space-between',
						gap: 0.75,
						pointerEvents: 'none',
					}}
				>
					<Box sx={{ minWidth: 0 }}>
						<LineSkeleton width="72%" height={14} sx={{ borderRadius: 8 }} />
						<Box sx={{ mt: 0.5, display: 'flex', flexDirection: 'column', gap: 0.35 }}>
							<LineSkeleton width="100%" height={12} sx={{ borderRadius: 8 }} />
							<LineSkeleton width="92%" height={12} sx={{ borderRadius: 8 }} />
							<LineSkeleton width="78%" height={12} sx={{ borderRadius: 8 }} />
						</Box>
					</Box>
				</Box>
			))}
		</Box>
	);
}

export function ReminderListSkeleton({ count = 3 }: { count?: number }) {
	return (
		<Box
			sx={{
				display: 'flex',
				gap: 1.25,
				alignItems: 'stretch',
				overflow: 'hidden',
				...kronaShadowBleedSx,
			}}
			aria-busy
			aria-label="Loading reminders"
		>
			{Array.from({ length: count }, (_, i) => (
				<Box
					key={i}
					sx={{
						...kronaWidgetHorizontalCardSx,
						width: 154,
						p: 1.5,
						display: 'flex',
						flexDirection: 'column',
						justifyContent: 'space-between',
						gap: 1,
						pointerEvents: 'none',
					}}
				>
					<Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.35 }}>
						<LineSkeleton width={i % 2 === 0 ? '88%' : '72%'} height={14} sx={{ borderRadius: 8 }} />
						<LineSkeleton width={i % 2 === 0 ? '64%' : '80%'} height={14} sx={{ borderRadius: 8 }} />
					</Box>
					<Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '12px', minWidth: 0 }}>
						<LineSkeleton width={52} height={22} sx={{ borderRadius: '999px', flexShrink: 0 }} />
					</Box>
				</Box>
			))}
		</Box>
	);
}

export function RoutineCurrentSkeleton() {
	return (
		<Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }} aria-busy aria-label="Loading routine">
			<Box
				sx={{
					...kronaWidgetListItemSx,
					p: 1.5,
					display: 'flex',
					alignItems: 'center',
					gap: 1.25,
					minHeight: 72,
					boxSizing: 'border-box',
					pointerEvents: 'none',
				}}
			>
				<Skeleton
					variant="circular"
					animation="wave"
					sx={{ ...kronaSkeletonSx, width: 28, height: 28, flexShrink: 0 }}
				/>
				<Box sx={{ minWidth: 0, flex: 1 }}>
					<LineSkeleton width="55%" height={14} sx={{ borderRadius: 8 }} />
					<LineSkeleton width="40%" height={12} sx={{ mt: 0.35, borderRadius: 8 }} />
				</Box>
				<LineSkeleton width={52} height={22} sx={{ borderRadius: '999px', flexShrink: 0 }} />
			</Box>
			<Box
				sx={{
					...kronaWidgetListItemSx,
					py: 0.75,
					px: 1.25,
					display: 'flex',
					alignItems: 'center',
					gap: 1.25,
					boxSizing: 'border-box',
					pointerEvents: 'none',
				}}
			>
				<Skeleton
					variant="circular"
					animation="wave"
					sx={{ ...kronaSkeletonSx, width: 22, height: 22, flexShrink: 0 }}
				/>
				<Box sx={{ minWidth: 0, flex: 1 }}>
					<LineSkeleton width="45%" height={14} sx={{ borderRadius: 8 }} />
					<LineSkeleton width={56} height={12} sx={{ mt: 0.25, borderRadius: 8 }} />
				</Box>
				<LineSkeleton width={44} height={12} sx={{ borderRadius: 8, flexShrink: 0 }} />
			</Box>
		</Box>
	);
}

export function TimerWidgetSkeleton() {
	return (
		<Box
			sx={{
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				width: '100%',
				minHeight: 0,
				flex: 1,
				pointerEvents: 'none',
			}}
			aria-busy
			aria-label="Loading timer"
		>
			<Box sx={{ ...kronaTabBarSx, flexShrink: 0, width: '100%', mb: 3 }}>
				{Array.from({ length: 3 }, (_, i) => (
					<LineSkeleton
						key={i}
						width="100%"
						height={32}
						sx={{ borderRadius: '999px', flex: 1, minWidth: 0 }}
					/>
				))}
			</Box>
			<Box
				sx={{
					flex: 1,
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
					justifyContent: 'center',
					gap: 3,
					width: '100%',
					minHeight: 0,
					py: 1,
				}}
			>
				<Box sx={{ textAlign: 'center', width: '100%' }}>
					<LineSkeleton width={132} height={18} sx={{ borderRadius: 10, mx: 'auto', mb: 0.5 }} />
					<LineSkeleton
						width={200}
						height={56}
						sx={{ borderRadius: 14, mx: 'auto', maxWidth: '100%' }}
					/>
				</Box>
				<Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
					<IconButtonSkeleton size={48} />
					<IconButtonSkeleton size={64} />
					<IconButtonSkeleton size={48} />
				</Box>
			</Box>
		</Box>
	);
}

function TodayProgressMetricPlaceholder() {
	return (
		<Box
			sx={{
				flex: 1,
				minWidth: 0,
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				justifyContent: 'center',
				gap: 0.75,
			}}
		>
			<Box
				sx={{
					width: '72%',
					height: 10,
					borderRadius: 8,
					bgcolor: 'color-mix(in srgb, var(--krona-text) 8%, transparent)',
				}}
			/>
			<Box
				sx={{
					width: '48%',
					height: 28,
					borderRadius: 12,
					bgcolor: 'color-mix(in srgb, var(--krona-text) 8%, transparent)',
				}}
			/>
		</Box>
	);
}

export function TodayProgressSkeleton() {
	return (
		<Box
			suppressHydrationWarning
			aria-busy
			aria-label="Loading today's progress"
			sx={{
				pointerEvents: 'none',
				flex: 1,
				display: 'flex',
				alignItems: 'center',
				gap: { xs: 1.5, md: 2.5 },
				minHeight: 0,
			}}
		>
			<TodayProgressMetricPlaceholder />
			<Box
				sx={{
									width: '1px',
					height: 48,
					alignSelf: 'center',
					flexShrink: 0,
					bgcolor: 'var(--krona-surface-border)',
				}}
			/>
			<TodayProgressMetricPlaceholder />
			<Box
				sx={{
									width: '1px',
					height: 48,
					alignSelf: 'center',
					flexShrink: 0,
					bgcolor: 'var(--krona-surface-border)',
				}}
			/>
			<TodayProgressMetricPlaceholder />
		</Box>
	);
}

export function PerformanceWidgetSkeleton() {
	return (
		<Box
			sx={{
				flex: 1,
				minHeight: 0,
				display: 'flex',
				flexDirection: 'column',
				justifyContent: 'center',
				alignItems: 'center',
				pointerEvents: 'none',
			}}
			aria-busy
			aria-label="Loading performance"
		>
			<Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
				<LineSkeleton width={120} height={36} sx={{ borderRadius: 12 }} />
				<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
					<Skeleton
						variant="circular"
						animation="wave"
						sx={{ ...kronaSkeletonSx, width: 18, height: 18, flexShrink: 0 }}
					/>
					<LineSkeleton width={180} height={14} sx={{ borderRadius: 8 }} />
				</Box>
			</Box>
		</Box>
	);
}
