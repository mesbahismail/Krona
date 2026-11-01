'use client';

import * as React from 'react';
import { Box } from '@mui/joy';
import type { SxProps } from '@mui/joy/styles/types';
import { kronaShadowBleedSx } from '@/lib/kronaStyles';

function useHorizontalScrollFades(
	ref: React.RefObject<HTMLElement | null>,
	enabled: boolean,
) {
	const [fadeStart, setFadeStart] = React.useState(false);
	const [fadeEnd, setFadeEnd] = React.useState(false);

	const update = React.useCallback(() => {
		if (!enabled) {
			setFadeStart(false);
			setFadeEnd(false);
			return;
		}
		const el = ref.current;
		if (!el) return;

		const { scrollLeft, scrollWidth, clientWidth } = el;
		const hasOverflow = scrollWidth > clientWidth + 1;
		setFadeStart(hasOverflow && scrollLeft > 2);
		setFadeEnd(hasOverflow && scrollLeft + clientWidth < scrollWidth - 2);
	}, [enabled, ref]);

	React.useEffect(() => {
		const el = ref.current;
		if (!el) return;

		update();
		el.addEventListener('scroll', update, { passive: true });
		const ro = new ResizeObserver(update);
		ro.observe(el);
		const mo = new MutationObserver(update);
		mo.observe(el, { childList: true, subtree: true });

		return () => {
			el.removeEventListener('scroll', update);
			ro.disconnect();
			mo.disconnect();
		};
	}, [ref, update]);

	return { fadeStart, fadeEnd };
}

type KronaHorizontalScrollStripProps = {
	children: React.ReactNode;
	sx?: SxProps;
	/** Edge gradient masks — off for date strips where chips should stay fully visible. */
	showEdgeFade?: boolean;
} & Omit<React.ComponentProps<typeof Box>, 'children' | 'sx' | 'ref'>;

const KronaHorizontalScrollStrip = React.forwardRef<
	HTMLDivElement,
	KronaHorizontalScrollStripProps
>(function KronaHorizontalScrollStrip(
	{ children, sx, showEdgeFade = true, ...boxProps },
	forwardedRef,
) {
	const scrollRef = React.useRef<HTMLDivElement>(null);
	const { fadeStart, fadeEnd } = useHorizontalScrollFades(scrollRef, showEdgeFade);

	const setRef = React.useCallback(
		(node: HTMLDivElement | null) => {
			scrollRef.current = node;
			if (typeof forwardedRef === 'function') forwardedRef(node);
			else if (forwardedRef) forwardedRef.current = node;
		},
		[forwardedRef],
	);

	const fadeClass =
		showEdgeFade && fadeStart && fadeEnd
			? 'krona-widget-scroll-fade-x-both'
			: showEdgeFade && fadeStart
				? 'krona-widget-scroll-fade-start-x'
				: showEdgeFade && fadeEnd
					? 'krona-widget-scroll-fade-end-x'
					: '';

	return (
		<Box
			ref={setRef}
			className={`krona-widget-scroll ${fadeClass}`.trim()}
			sx={{
				display: 'flex',
				minWidth: 0,
				overflowX: 'auto',
				overflowY: 'hidden',
				WebkitOverflowScrolling: 'touch',
				touchAction: 'pan-x',
				overscrollBehaviorX: 'contain',
				scrollSnapType: 'x proximity',
				...sx,
				// Applied last: card shadows must clear the scroll box even if a
				// caller sets its own padding.
				...kronaShadowBleedSx,
			}}
			{...boxProps}
		>
			{children}
		</Box>
	);
});

export default KronaHorizontalScrollStrip;
