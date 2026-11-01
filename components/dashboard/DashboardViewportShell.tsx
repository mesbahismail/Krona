'use client';

import * as React from 'react';
import { useKronaLayoutMode } from '@/components/KronaLayoutModeProvider';

/**
 * Locks the dashboard to the viewport only for full desktop content width.
 * Viewport `lg:` must not be used — AI dock can leave tablet content on a wide window.
 */
export default function DashboardViewportShell({
	children,
}: {
	children: React.ReactNode;
}) {
	const { isDesktopDashboard } = useKronaLayoutMode();

	return (
		<div
			className={
				isDesktopDashboard
					? 'flex h-[100dvh] max-h-[100dvh] min-h-0 w-full flex-col overflow-hidden'
					: 'flex min-h-0 w-full flex-col overflow-x-clip'
			}
		>
			{children}
		</div>
	);
}
