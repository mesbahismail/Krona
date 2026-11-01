/** Brand hex for email/marketing and Joy palette channels. */
export const KRONA_ACCENT = '#495dfd';

export const KRONA_ACCENT_RGB = '73, 93, 253' as const;

export function kronaAccentRgba(alpha: number): string {
	return kronaAccentColorMix(Math.round(alpha * 100));
}

export function kronaAccentColorMix(percent: number, base = 'transparent'): string {
	return `color-mix(in srgb, var(--krona-accent) ${percent}%, ${base})`;
}

/**
 * Joy primary palette must use concrete colors — Joy derives channels/contrast
 * from these and will crash if given CSS `var(...)` strings.
 * Season UI still follows `--krona-accent` via component `sx` tokens.
 */
export const KRONA_JOY_PRIMARY = {
	50: '#f0f4ff',
	100: '#e0e9ff',
	200: '#c7d7fe',
	300: '#a5b8fc',
	400: '#8491f8',
	500: KRONA_ACCENT,
	600: KRONA_ACCENT,
	700: '#4338ca',
	800: '#3730a3',
	900: '#312e81',
} as const;
