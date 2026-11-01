'use client';

import * as React from 'react';
import { Box } from '@mui/joy';
import {
	KRONA_THEME_BACKGROUNDS,
	KRONA_THEME_CHANGE_EVENT,
	KRONA_THEME_TRANSITION_MS,
	type KronaThemeChangeDetail,
} from '@/lib/kronaTheme';

/** App-wide fixed background; follows `--krona-bg-gradient` (season theme). */
export default function Background() {
	const [overlay, setOverlay] = React.useState<string | null>(null);
	const [overlayVisible, setOverlayVisible] = React.useState(false);

	React.useEffect(() => {
		const onTheme = (event: Event) => {
			const detail = (event as CustomEvent<KronaThemeChangeDetail>).detail;
			if (!detail?.previous || detail.previous === detail.theme) return;
			setOverlay(KRONA_THEME_BACKGROUNDS[detail.previous]);
			setOverlayVisible(true);
			requestAnimationFrame(() => {
				requestAnimationFrame(() => setOverlayVisible(false));
			});
		};
		window.addEventListener(KRONA_THEME_CHANGE_EVENT, onTheme);
		return () => window.removeEventListener(KRONA_THEME_CHANGE_EVENT, onTheme);
	}, []);

	React.useEffect(() => {
		if (overlayVisible || !overlay) return;
		const id = window.setTimeout(() => setOverlay(null), KRONA_THEME_TRANSITION_MS);
		return () => window.clearTimeout(id);
	}, [overlayVisible, overlay]);

	return (
		<Box
			sx={{
				position: 'fixed',
				inset: 0,
				zIndex: 0,
				overflow: 'hidden',
				pointerEvents: 'none',
			}}
		>
			<Box
				sx={{
					position: 'absolute',
					inset: 0,
					background: 'var(--krona-bg-gradient)',
					// Own raster layer, viewport-sized. A fixed-attachment background
					// re-tiles on every repaint, and the widgets' backdrop-filter samples
					// those seams as flickering vertical bands.
					transform: 'translateZ(0)',
					backfaceVisibility: 'hidden',
				}}
			/>
			{overlay ? (
				<Box
					sx={{
						position: 'absolute',
						inset: 0,
						background: overlay,
						transform: 'translateZ(0)',
						backfaceVisibility: 'hidden',
						opacity: overlayVisible ? 1 : 0,
						transition: `opacity ${KRONA_THEME_TRANSITION_MS}ms ease`,
					}}
				/>
			) : null}
		</Box>
	);
}
