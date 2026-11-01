'use client';

import { useEffect, type RefObject } from 'react';

/** Sets --krona-top-width on the top bar element for child max-width calculations. */
export function useTopBarWidth(ref: RefObject<HTMLElement | null | undefined>) {
	useEffect(() => {
		const el = ref.current;
		if (!el) return;

		const update = () => {
			el.style.setProperty('--krona-top-width', `${el.offsetWidth}px`);
		};

		update();
		const observer = new ResizeObserver(update);
		observer.observe(el);
		return () => observer.disconnect();
	}, [ref]);
}
