'use client';

import { useServerInsertedHTML } from 'next/navigation';
import { KRONA_THEME_INIT_SCRIPT } from '@/lib/kronaTheme';

/**
 * Injects the theme bootstrap script into the SSR HTML stream outside the
 * client React tree — prevents FOUC without React 19 script-in-component warnings.
 */
export default function KronaThemeInit() {
	useServerInsertedHTML(() => (
		<script
			id="krona-theme-init"
			dangerouslySetInnerHTML={{ __html: KRONA_THEME_INIT_SCRIPT }}
		/>
	));
	return null;
}
