'use client';

import { Box, Skeleton } from '@mui/joy';
import { kronaSkeletonSx } from '@/lib/kronaStyles';
import {
	LineSkeleton,
	SearchFieldSkeleton,
	SearchToolbarSkeleton,
	TaskListSkeleton,
} from '@/components/dashboard/DashboardWidgetSkeletons';

export function ProjectsListSkeleton({ count = 5 }: { count?: number }) {
	return (
		<Box aria-busy aria-label="Loading projects">
			<SearchToolbarSkeleton withSort />
			<Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
				{Array.from({ length: count }, (_, i) => (
					<Box
						key={i}
						sx={{
							display: 'flex',
							flexDirection: 'column',
							gap: 0.75,
							px: 1,
							py: 0.5,
							pointerEvents: 'none',
						}}
					>
						<Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
							<Skeleton
								variant="rectangular"
								animation="wave"
								sx={{
									...kronaSkeletonSx,
									width: 20,
									height: 20,
									borderRadius: 8,
									flexShrink: 0,
								}}
							/>
							<LineSkeleton width={i % 2 === 0 ? '58%' : '72%'} height={16} />
						</Box>
						<Box sx={{ ml: 3.5 }}>
							<LineSkeleton width={i % 2 === 0 ? '36%' : '44%'} height={12} />
						</Box>
					</Box>
				))}
			</Box>
		</Box>
	);
}

export function ProjectsDetailSkeleton() {
	return (
		<Box aria-busy aria-label="Loading project details">
			<Box
				sx={{
					display: 'flex',
					flexDirection: 'column',
					gap: 1.5,
					px: 1.5,
					mb: 2,
					pointerEvents: 'none',
				}}
			>
				<LineSkeleton width="42%" height={28} sx={{ borderRadius: 12 }} />
				<Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
					<LineSkeleton width={96} height={14} />
					<LineSkeleton width={120} height={14} />
					<LineSkeleton width={88} height={14} />
				</Box>
			</Box>
			<Box sx={{ px: 1.5, mb: 2, pointerEvents: 'none' }}>
				<SearchFieldSkeleton />
			</Box>
			<Box sx={{ px: 0.5 }}>
				<TaskListSkeleton count={5} variant="flat" />
			</Box>
		</Box>
	);
}
