'use client';

import * as React from 'react';
import {
	KRONA_COMPACT_TITLE_MIN_PX,
	kronaContentLayoutFromWidth,
	type KronaContentLayout,
} from '@/lib/kronaBreakpoints';

// SSR and the first client render must use the same layout. The effect below
// measures the available content width after hydration, including the AI dock.
const DEFAULT_LAYOUT: KronaContentLayout = kronaContentLayoutFromWidth(1200);

const KronaLayoutModeContext =
	React.createContext<KronaContentLayout>(DEFAULT_LAYOUT);

/** Main-chrome layout based on available content width (not viewport alone). */
export function useKronaLayoutMode(): KronaContentLayout {
	return React.useContext(KronaLayoutModeContext);
}

type KronaLayoutModeProviderProps = {
	children: React.ReactNode;
	/** Element whose inline size drives layout mode (AI-padded shell). */
	contentRef: React.RefObject<HTMLElement | null>;
	/** Desktop AI dock open — forces compact nav below full desktop content width. */
	aiDockOpen?: boolean;
};

/**
 * Observes the main content shell and publishes layout mode.
 * Also mirrors `data-krona-layout` on `<html>` for CSS consumers.
 */
export function KronaLayoutModeProvider({
	children,
	contentRef,
	aiDockOpen = false,
}: KronaLayoutModeProviderProps) {
	const [layout, setLayout] = React.useState<KronaContentLayout>(DEFAULT_LAYOUT);
	const aiDockOpenRef = React.useRef(aiDockOpen);
	React.useEffect(() => {
		aiDockOpenRef.current = aiDockOpen;
	}, [aiDockOpen]);

	/**
	 * Re-render only when a tier flips. The AI dock animates the content width
	 * for ~360ms, so comparing raw `contentWidth` here would re-render the whole
	 * app on every animation frame.
	 */
	const sameTier = (a: KronaContentLayout, b: KronaContentLayout) =>
		a.mode === b.mode &&
		(a.contentWidth >= KRONA_COMPACT_TITLE_MIN_PX) ===
			(b.contentWidth >= KRONA_COMPACT_TITLE_MIN_PX) &&
		a.isMobileNav === b.isMobileNav &&
		a.isTabletDashboard === b.isTabletDashboard &&
		a.isDesktopDashboard === b.isDesktopDashboard;

	const publish = React.useCallback((next: KronaContentLayout) => {
		setLayout((prev) => (sameTier(prev, next) ? prev : next));
		const root = document.documentElement;
		if (root.dataset.kronaLayout !== next.mode) {
			root.dataset.kronaLayout = next.mode;
		}
		if (next.isMobileNav) {
			if (root.dataset.kronaMobileNav !== 'true') {
				root.dataset.kronaMobileNav = 'true';
			}
		} else if (root.dataset.kronaMobileNav) {
			delete root.dataset.kronaMobileNav;
		}
	}, []);

	React.useEffect(() => {
		const el = contentRef.current;
		if (!el) return;

		publish(
			kronaContentLayoutFromWidth(el.getBoundingClientRect().width, {
				aiDockOpen: aiDockOpenRef.current,
			}),
		);

		let frame = 0;
		const observer = new ResizeObserver((entries) => {
			const entry = entries[0];
			if (!entry) return;
			const width = entry.contentRect.width;
			// Coalesce to one measurement per frame during dock/resize animations.
			if (frame) cancelAnimationFrame(frame);
			frame = requestAnimationFrame(() => {
				frame = 0;
				publish(
					kronaContentLayoutFromWidth(width, {
						aiDockOpen: aiDockOpenRef.current,
					}),
				);
			});
		});
		observer.observe(el);

		return () => {
			if (frame) cancelAnimationFrame(frame);
			observer.disconnect();
			delete document.documentElement.dataset.kronaLayout;
			delete document.documentElement.dataset.kronaMobileNav;
		};
	}, [contentRef, publish]);

	/* Recompute when AI dock opens/closes without waiting for a resize. */
	React.useEffect(() => {
		const el = contentRef.current;
		if (!el) return;
		publish(
			kronaContentLayoutFromWidth(el.getBoundingClientRect().width, {
				aiDockOpen,
			}),
		);
	}, [aiDockOpen, contentRef, publish]);

	return (
		<KronaLayoutModeContext.Provider value={layout}>
			{children}
		</KronaLayoutModeContext.Provider>
	);
}
