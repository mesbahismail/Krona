'use client';

import dynamic from 'next/dynamic';
import { ProjectsRouteSkeleton } from '@/components/krona/KronaPageSkeletons';

const ProjectsPageClient = dynamic(
	() => import('@/components/projects/ProjectsPageClient'),
	{
		loading: () => <ProjectsRouteSkeleton />,
	},
);

export default function ProjectsRoute() {
	return <ProjectsPageClient />;
}
