'use client';

import * as React from 'react';
import type { DashboardWidgetId } from '@/lib/dashboardLayout';

export const MOBILE_SECONDARY_WIDGET_IDS = [
	'work-hours',
	'reminders',
	'performance',
] as const satisfies readonly DashboardWidgetId[];

const MOBILE_SECONDARY_WIDGET_ID_SET = new Set<DashboardWidgetId>(
	MOBILE_SECONDARY_WIDGET_IDS,
);

const TABLET_EQUAL_HEIGHT_MQ =
	'(min-width: 800px) and (max-width: 1199px)';
const HEIGHT_EPSILON_PX = 2;
const SCROLL_MEASURE_BLOCK_MS = 350;

function isTabletContentLayout(): boolean {
	const mode = document.documentElement.dataset.kronaLayout;
	if (mode) return mode === 'tablet';
	return window.matchMedia(TABLET_EQUAL_HEIGHT_MQ).matches;
}

type DashboardMobileSecondaryWidgetHeightsContextValue = {
	height: number | null;
	registerWidget: (id: DashboardWidgetId, node: HTMLElement | null) => void;
};

const DashboardMobileSecondaryWidgetHeightsContext =
	React.createContext<DashboardMobileSecondaryWidgetHeightsContextValue | null>(
		null,
	);

export function DashboardMobileSecondaryWidgetHeightsProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const registryRef = React.useRef(new Map<DashboardWidgetId, HTMLElement>());
	const observerRef = React.useRef<ResizeObserver | null>(null);
	const [height, setHeight] = React.useState<number | null>(null);
	const heightRef = React.useRef<number | null>(null);
	const appliedHeightsRef = React.useRef<number[]>([]);
	const measureRafRef = React.useRef<number | null>(null);
	const isScrollingRef = React.useRef(false);
	const isMeasuringRef = React.useRef(false);
	const scrollIdleTimerRef = React.useRef<number | null>(null);
	const mutationObserversRef = React.useRef(
		new Map<DashboardWidgetId, MutationObserver>(),
	);

	/**
	 * Applying an equal height can change a widget's own natural height, which
	 * measures back as a different max and flips the row between two values on
	 * every frame. Settle on the taller of the two instead of ping-ponging.
	 */
	const applyHeight = React.useCallback((next: number) => {
		const prev = heightRef.current;
		if (prev != null && Math.abs(prev - next) <= HEIGHT_EPSILON_PX) return;

		const history = appliedHeightsRef.current;
		const bouncingBack = history.some(
			(applied) => Math.abs(applied - next) <= HEIGHT_EPSILON_PX,
		);
		const settled = bouncingBack && prev != null ? Math.max(prev, next) : next;
		if (prev != null && Math.abs(prev - settled) <= HEIGHT_EPSILON_PX) return;

		history.push(settled);
		if (history.length > 4) history.shift();
		heightRef.current = settled;
		setHeight(settled);
	}, []);

	const measure = React.useCallback(() => {
		if (typeof window === 'undefined') return;
		if (isScrollingRef.current || isMeasuringRef.current) return;
		if (!isTabletContentLayout()) {
			appliedHeightsRef.current = [];
			heightRef.current = null;
			setHeight(null);
			return;
		}

		const nodes = MOBILE_SECONDARY_WIDGET_IDS.map((id) =>
			registryRef.current.get(id),
		).filter((node): node is HTMLElement => Boolean(node));
		if (nodes.length === 0) return;

		let max = 0;
		const restores: Array<() => void> = [];

		// Unset heights to read natural size; observers must ignore the churn.
		isMeasuringRef.current = true;
		try {
			for (const node of nodes) {
				const prevHeight = node.style.height;
				const prevMinHeight = node.style.minHeight;
				node.style.height = 'auto';
				node.style.minHeight = '0';
				restores.push(() => {
					node.style.height = prevHeight;
					node.style.minHeight = prevMinHeight;
				});
				max = Math.max(max, node.offsetHeight);
			}
			restores.forEach((restore) => restore());
		} finally {
			requestAnimationFrame(() => {
				isMeasuringRef.current = false;
			});
		}

		if (max > 0) applyHeight(max);
	}, [applyHeight]);

	const scheduleMeasure = React.useCallback(() => {
		if (isScrollingRef.current || isMeasuringRef.current) return;
		if (measureRafRef.current != null) {
			cancelAnimationFrame(measureRafRef.current);
		}
		measureRafRef.current = requestAnimationFrame(() => {
			measureRafRef.current = null;
			if (isScrollingRef.current) return;
			measure();
		});
	}, [measure]);

	const registerWidget = React.useCallback(
		(id: DashboardWidgetId, node: HTMLElement | null) => {
			if (!MOBILE_SECONDARY_WIDGET_ID_SET.has(id)) return;

			const registry = registryRef.current;
			const observer = observerRef.current;
			const prev = registry.get(id);
			const prevMutation = mutationObserversRef.current.get(id);

			if (prev && observer) {
				observer.unobserve(prev);
			}
			prevMutation?.disconnect();
			mutationObserversRef.current.delete(id);

			if (node) {
				registry.set(id, node);
				observer?.observe(node);
				const mutationObserver = new MutationObserver(() => {
					if (!isScrollingRef.current) scheduleMeasure();
				});
				mutationObserver.observe(node, { childList: true, subtree: true });
				mutationObserversRef.current.set(id, mutationObserver);
			} else {
				registry.delete(id);
			}

			scheduleMeasure();
		},
		[scheduleMeasure],
	);

	React.useLayoutEffect(() => {
		if (typeof window === 'undefined') return;

		const mq = window.matchMedia(TABLET_EQUAL_HEIGHT_MQ);
		const observer = new ResizeObserver(() => scheduleMeasure());
		observerRef.current = observer;

		for (const node of registryRef.current.values()) {
			observer.observe(node);
		}

		const onMqChange = () => scheduleMeasure();
		const onScroll = () => {
			isScrollingRef.current = true;
			if (scrollIdleTimerRef.current != null) {
				window.clearTimeout(scrollIdleTimerRef.current);
			}
			scrollIdleTimerRef.current = window.setTimeout(() => {
				isScrollingRef.current = false;
			}, SCROLL_MEASURE_BLOCK_MS);
		};

		mq.addEventListener('change', onMqChange);
		window.addEventListener('orientationchange', onMqChange);
		window.addEventListener('scroll', onScroll, { passive: true, capture: true });

		const layoutAttrObserver = new MutationObserver(() => scheduleMeasure());
		layoutAttrObserver.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ['data-krona-layout'],
		});

		scheduleMeasure();

		return () => {
			observer.disconnect();
			observerRef.current = null;
			layoutAttrObserver.disconnect();
			for (const mutationObserver of mutationObserversRef.current.values()) {
				mutationObserver.disconnect();
			}
			mutationObserversRef.current.clear();
			mq.removeEventListener('change', onMqChange);
			window.removeEventListener('orientationchange', onMqChange);
			window.removeEventListener('scroll', onScroll, { capture: true });
			if (measureRafRef.current != null) {
				cancelAnimationFrame(measureRafRef.current);
			}
			if (scrollIdleTimerRef.current != null) {
				window.clearTimeout(scrollIdleTimerRef.current);
			}
		};
	}, [scheduleMeasure]);

	const value = React.useMemo(
		() => ({ height, registerWidget }),
		[height, registerWidget],
	);

	return (
		<DashboardMobileSecondaryWidgetHeightsContext.Provider value={value}>
			{children}
		</DashboardMobileSecondaryWidgetHeightsContext.Provider>
	);
}

export function useDashboardMobileSecondaryWidgetHeightsOptional() {
	return React.useContext(DashboardMobileSecondaryWidgetHeightsContext);
}

export function isMobileSecondaryEqualHeightWidget(id: DashboardWidgetId) {
	return MOBILE_SECONDARY_WIDGET_ID_SET.has(id);
}

function mergeRefs<T>(
	...refs: Array<React.Ref<T> | undefined>
): React.RefCallback<T> {
	return (node) => {
		for (const ref of refs) {
			if (!ref) continue;
			if (typeof ref === 'function') {
				ref(node);
			} else {
				ref.current = node;
			}
		}
	};
}

export { mergeRefs as mergeDashboardWidgetShellRefs };
