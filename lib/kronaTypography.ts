/** Shared medium weight for page, section, and widget headings. */
export const KRONA_TITLE_FONT_WEIGHT = 500;

/** Identical labels for the dashboard performance and peak-work chart axes. */
export const kronaChartAxisTick = {
	fill: 'var(--krona-text-muted)',
	fontSize: 10,
	fontWeight: 400,
};

/** Compact app-wide type scale; rem units preserve browser zoom and text sizing. */
export const kronaFontSizes = {
	xs: '0.6875rem',
	sm: '0.8125rem',
	md: '0.875rem',
	lg: '1rem',
	xl: '1.125rem',
	xl2: '1.375rem',
	xl3: '1.6875rem',
	xl4: '2rem',
};

export const kronaTypography = {
	h1: { fontSize: kronaFontSizes.xl4, fontWeight: KRONA_TITLE_FONT_WEIGHT },
	h2: { fontSize: kronaFontSizes.xl3, fontWeight: KRONA_TITLE_FONT_WEIGHT },
	h3: { fontSize: kronaFontSizes.xl2, fontWeight: KRONA_TITLE_FONT_WEIGHT },
	h4: { fontSize: kronaFontSizes.xl, fontWeight: KRONA_TITLE_FONT_WEIGHT },
	'title-lg': { fontSize: kronaFontSizes.lg, fontWeight: KRONA_TITLE_FONT_WEIGHT },
	'title-md': { fontSize: kronaFontSizes.md, fontWeight: KRONA_TITLE_FONT_WEIGHT },
	'title-sm': { fontSize: kronaFontSizes.sm, fontWeight: KRONA_TITLE_FONT_WEIGHT },
	'body-lg': { fontSize: kronaFontSizes.lg },
	'body-md': { fontSize: kronaFontSizes.md },
	'body-sm': { fontSize: kronaFontSizes.sm },
	'body-xs': { fontSize: kronaFontSizes.xs },
};
