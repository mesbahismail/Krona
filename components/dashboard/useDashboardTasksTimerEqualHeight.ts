'use client';

import * as React from 'react';
import { KRONA_DESKTOP_MIN_PX } from '@/lib/kronaBreakpoints';

const HEIGHT_EPSILON_PX = 2;
export const DASHBOARD_TASKS_TIMER_MIN_HEIGHT_PX = 360;

/** Phone + tablet; desktop uses CSS grid fill instead. */
const BELOW_DESKTOP_MQ = `(max-width: ${KRONA_DESKTOP_MIN_PX - 1}px)`;

/** Prefer content-width layout mode (AI panel aware) over viewport media queries. */
function isBelowDesktopContentLayout(): boolean {
	const mode = document.documentElement.dataset.kronaLayout;
	if (mode) return mode !== 'desktop';
	return window.matchMedia(BELOW_DESKTOP_MQ).matches;
}

/** Clears below-desktop inline locks so desktop CSS (flex / align-self) can apply. */
function clearLockedHeight(node: HTMLElement) {
	node.style.removeProperty('height');
	node.style.removeProperty('min-height');
	node.style.removeProperty('max-height');
	node.style.removeProperty('align-self');
	node.style.removeProperty('flex');
}

function lockHeight(node: HTMLElement, px: number) {
	const value = `${px}px`;
	node.style.setProperty('height', value);
	node.style.setProperty('min-height', value);
	node.style.setProperty('max-height', value);
}

/**
 * Intrinsic height of the timer card.
 * Temporarily clears any locked sizing / stretch so we read content height only.
 */
function readTimerContentHeight(timerNode: HTMLElement): number {
	const prev = {
		height: timerNode.style.height,
		minHeight: timerNode.style.minHeight,
		maxHeight: timerNode.style.maxHeight,
		alignSelf: timerNode.style.alignSelf,
		flex: timerNode.style.flex,
	};
	timerNode.style.height = 'auto';
	timerNode.style.minHeight = '0';
	timerNode.style.maxHeight = 'none';
	timerNode.style.alignSelf = 'start';
	timerNode.style.flex = '0 0 auto';
	// Force layout, then read.
	const height = Math.ceil(timerNode.getBoundingClientRect().height);
	timerNode.style.height = prev.height;
	timerNode.style.minHeight = prev.minHeight;
	timerNode.style.maxHeight = prev.maxHeight;
	timerNode.style.alignSelf = prev.alignSelf;
	timerNode.style.flex = prev.flex;
	return height;
}

/**
 * Rule: Timer sizes to its content. Tasks is forced to that same height.
 * Desktop returns null — CSS grid row span keeps them equal.
 */
export function useDashboardTasksTimerEqualHeight(
	tasksRef: React.RefObject<HTMLElement | null>,
	timerRef: React.RefObject<HTMLElement | null>,
	remeasureKey: unknown,
): number | null {
	const [height, setHeight] = React.useState<number | null>(null);
	const rafRef = React.useRef<number | null>(null);
	const lastAppliedRef = React.useRef<number | null>(null);

	const measure = React.useCallback(() => {
		if (typeof window === 'undefined') return;

		const timerNode = timerRef.current;
		const tasksNode = tasksRef.current;

		if (!isBelowDesktopContentLayout()) {
			if (tasksNode) clearLockedHeight(tasksNode);
			if (timerNode) clearLockedHeight(timerNode);
			lastAppliedRef.current = null;
			setHeight(null);
			return;
		}

		if (!timerNode || !tasksNode) return;

		// Measure the timer intrinsically, then lock both cards to the same
		// usable height so the ring cannot collapse in compact two-column views.
		clearLockedHeight(timerNode);
		timerNode.style.alignSelf = 'start';
		timerNode.style.flex = '0 0 auto';

		const next = Math.max(
			DASHBOARD_TASKS_TIMER_MIN_HEIGHT_PX,
			readTimerContentHeight(timerNode),
		);
		if (next <= 0) return;

		lockHeight(tasksNode, next);
		lockHeight(timerNode, next);
		tasksNode.style.alignSelf = 'start';
		tasksNode.style.flex = '0 0 auto';
		timerNode.style.alignSelf = 'start';
		timerNode.style.flex = '0 0 auto';
		lastAppliedRef.current = next;

		setHeight((prev) =>
			prev != null && Math.abs(prev - next) <= HEIGHT_EPSILON_PX ? prev : next,
		);
	}, [tasksRef, timerRef]);

	const scheduleMeasure = React.useCallback(() => {
		if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
		rafRef.current = requestAnimationFrame(() => {
			rafRef.current = requestAnimationFrame(() => {
				rafRef.current = null;
				measure();
			});
		});
	}, [measure]);

	React.useLayoutEffect(() => {
		if (typeof window === 'undefined') return;

		const mq = window.matchMedia(BELOW_DESKTOP_MQ);
		const timerNode = timerRef.current;
		const tasksNode = tasksRef.current;

		// Only observe the timer — tasks height is derived from timer, so watching
		// tasks would feedback-loop when we lock its height.
		const observer = new ResizeObserver(() => scheduleMeasure());
		if (timerNode) observer.observe(timerNode);

		const mutationObserver = timerNode
			? new MutationObserver(() => scheduleMeasure())
			: null;
		mutationObserver?.observe(timerNode!, {
			childList: true,
			subtree: true,
			characterData: true,
		});

		const layoutAttrObserver = new MutationObserver(() => scheduleMeasure());
		layoutAttrObserver.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ['data-krona-layout'],
		});

		const onViewportChange = () => scheduleMeasure();
		mq.addEventListener('change', onViewportChange);
		window.addEventListener('orientationchange', onViewportChange);
		window.addEventListener('resize', onViewportChange);

		scheduleMeasure();
		const retries = [0, 50, 150, 400].map((ms) =>
			window.setTimeout(scheduleMeasure, ms),
		);

		return () => {
			observer.disconnect();
			mutationObserver?.disconnect();
			layoutAttrObserver.disconnect();
			mq.removeEventListener('change', onViewportChange);
			window.removeEventListener('orientationchange', onViewportChange);
			window.removeEventListener('resize', onViewportChange);
			for (const id of retries) window.clearTimeout(id);
			if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
			if (tasksNode) clearLockedHeight(tasksNode);
			if (timerNode) clearLockedHeight(timerNode);
			lastAppliedRef.current = null;
		};
	}, [tasksRef, timerRef, scheduleMeasure, remeasureKey]);

	return height;
}
