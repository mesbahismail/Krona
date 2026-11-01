'use client';

import * as React from 'react';
import {
	DASHBOARD_DRAG_MIME,
	DEFAULT_DASHBOARD_LAYOUT,
	canSwapWidgets,
	loadDashboardLayout,
	saveDashboardLayout,
	swapWidgetPlacements,
	type DashboardLayoutState,
	type DashboardWidgetId,
} from '@/lib/dashboardLayout';

type DashboardLayoutContextValue = {
	layout: DashboardLayoutState;
	swapWidgets: (sourceId: DashboardWidgetId, targetId: DashboardWidgetId) => void;
	draggingId: DashboardWidgetId | null;
	beginDrag: (id: DashboardWidgetId) => void;
	commitDrag: (targetId: DashboardWidgetId) => void;
	endDrag: () => void;
	hoverTargetId: DashboardWidgetId | null;
	setHoverTargetId: (id: DashboardWidgetId | null) => void;
};

const DashboardLayoutContext = React.createContext<DashboardLayoutContextValue | null>(
	null,
);

export function DashboardLayoutProvider({ children }: { children: React.ReactNode }) {
	const [layout, setLayout] = React.useState<DashboardLayoutState>(
		DEFAULT_DASHBOARD_LAYOUT,
	);
	const [draggingId, setDraggingId] = React.useState<DashboardWidgetId | null>(null);
	const [hoverTargetId, setHoverTargetIdState] = React.useState<DashboardWidgetId | null>(
		null,
	);

	const dragSourceRef = React.useRef<DashboardWidgetId | null>(null);
	const hoverTargetRef = React.useRef<DashboardWidgetId | null>(null);
	const committedRef = React.useRef(false);

	React.useEffect(() => {
		setLayout(loadDashboardLayout());
	}, []);

	const setHoverTargetId = React.useCallback((id: DashboardWidgetId | null) => {
		hoverTargetRef.current = id;
		setHoverTargetIdState(id);
	}, []);

	const swapWidgets = React.useCallback(
		(sourceId: DashboardWidgetId, targetId: DashboardWidgetId) => {
			if (!canSwapWidgets(sourceId, targetId)) return;
			setLayout((prev) => {
				const next = swapWidgetPlacements(prev, sourceId, targetId);
				saveDashboardLayout(next);
				return next;
			});
		},
		[],
	);

	const beginDrag = React.useCallback((id: DashboardWidgetId) => {
		dragSourceRef.current = id;
		committedRef.current = false;
		setDraggingId(id);
		setHoverTargetId(null);
	}, [setHoverTargetId]);

	const commitDrag = React.useCallback(
		(targetId: DashboardWidgetId) => {
			if (committedRef.current) return;
			const source = dragSourceRef.current;
			if (!source || source === targetId || !canSwapWidgets(source, targetId)) return;
			committedRef.current = true;
			swapWidgets(source, targetId);
			dragSourceRef.current = null;
			hoverTargetRef.current = null;
			setDraggingId(null);
			setHoverTargetId(null);
		},
		[swapWidgets, setHoverTargetId],
	);

	const endDrag = React.useCallback(() => {
		if (!committedRef.current) {
			const source = dragSourceRef.current;
			const target = hoverTargetRef.current;
			if (source && target && canSwapWidgets(source, target)) {
				committedRef.current = true;
				swapWidgets(source, target);
			}
		}
		dragSourceRef.current = null;
		hoverTargetRef.current = null;
		committedRef.current = false;
		setDraggingId(null);
		setHoverTargetId(null);
	}, [swapWidgets, setHoverTargetId]);

	const value = React.useMemo(
		() => ({
			layout,
			swapWidgets,
			draggingId,
			beginDrag,
			commitDrag,
			endDrag,
			hoverTargetId,
			setHoverTargetId,
		}),
		[
			layout,
			swapWidgets,
			draggingId,
			beginDrag,
			commitDrag,
			endDrag,
			hoverTargetId,
			setHoverTargetId,
		],
	);

	return (
		<DashboardLayoutContext.Provider value={value}>
			{children}
		</DashboardLayoutContext.Provider>
	);
}

export function useDashboardLayout() {
	const ctx = React.useContext(DashboardLayoutContext);
	if (!ctx) {
		throw new Error('useDashboardLayout must be used within DashboardLayoutProvider');
	}
	return ctx;
}

export function useDashboardWidgetPlacement(id: DashboardWidgetId) {
	const { layout } = useDashboardLayout();
	return layout[id];
}

export { DASHBOARD_DRAG_MIME };
