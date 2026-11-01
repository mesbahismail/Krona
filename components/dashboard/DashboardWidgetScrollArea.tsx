'use client';

import * as React from 'react';
import { Box } from '@mui/joy';
import type { SxProps } from '@mui/joy/styles/types';

function useScrollEndFade(ref: React.RefObject<HTMLElement | null>) {
	const [showFade, setShowFade] = React.useState(false);

	const updateFade = React.useCallback(() => {
		const el = ref.current;
		if (!el) return;

		const { scrollTop, scrollHeight, clientHeight } = el;
		const hasOverflow = scrollHeight > clientHeight + 1;
		const atEnd = scrollTop + clientHeight >= scrollHeight - 2;
		setShowFade(hasOverflow && !atEnd);
	}, [ref]);

	React.useEffect(() => {
		const el = ref.current;
		if (!el) return;

		updateFade();
		el.addEventListener('scroll', updateFade, { passive: true });

		const resizeObserver = new ResizeObserver(updateFade);
		resizeObserver.observe(el);

		const mutationObserver = new MutationObserver(updateFade);
		mutationObserver.observe(el, { childList: true, subtree: true });

		return () => {
			el.removeEventListener('scroll', updateFade);
			resizeObserver.disconnect();
			mutationObserver.disconnect();
		};
	}, [ref, updateFade]);

	return showFade;
}

export default function DashboardWidgetScrollArea({
	children,
	sx,
	topFade = false,
	onScrollTopChange,
}: {
	children: React.ReactNode;
	sx?: SxProps;
	/** Fade rows out at the top once scrolled, for lists under a search bar. */
	topFade?: boolean;
	/** Fires when vertical scroll offset changes (e.g. sticky toolbar edge fade). */
	onScrollTopChange?: (scrollTop: number) => void;
}) {
	const scrollRef = React.useRef<HTMLDivElement>(null);
	const showFade = useScrollEndFade(scrollRef);
	const [scrolled, setScrolled] = React.useState(false);

	React.useEffect(() => {
		const el = scrollRef.current;
		if (!el) return;

		const notify = () => {
			setScrolled(el.scrollTop > 2);
			onScrollTopChange?.(el.scrollTop);
		};
		notify();
		el.addEventListener('scroll', notify, { passive: true });
		const ro = new ResizeObserver(notify);
		ro.observe(el);
		return () => {
			el.removeEventListener('scroll', notify);
			ro.disconnect();
		};
	}, [onScrollTopChange]);

	const showTopFade = topFade && scrolled;
	const fadeClass = showTopFade
		? showFade
			? 'krona-widget-scroll-fade-y'
			: 'krona-widget-scroll-fade-top'
		: showFade
			? 'krona-widget-scroll-fade'
			: '';

	return (
		<Box
			ref={scrollRef}
			className={`krona-widget-scroll${fadeClass ? ` ${fadeClass}` : ''}`}
			sx={
				{
					flex: 1,
					minHeight: 0,
					overflowY: 'auto',
					overflowX: 'hidden',
					overscrollBehavior: 'contain',
					WebkitOverflowScrolling: 'touch',
					...sx,
				} as SxProps
			}
		>
			{children}
		</Box>
	);
}
