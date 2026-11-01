export const KRONA_THEME_SEASONS = ['light', 'dark'] as const;
export type KronaThemeSeason = (typeof KRONA_THEME_SEASONS)[number];
export type KronaThemeMode = KronaThemeSeason;
export const KRONA_THEME_STORAGE_KEY = 'krona-theme';
export const KRONA_THEME_SEASON_ATTR = 'data-krona-season';
export const KRONA_THEME_LABELS = { light: 'Light', dark: 'Dark' } as const;
export const KRONA_THEME_BACKGROUNDS = {
	light:
		'linear-gradient(135deg, #faf8ff 0%, #f3effc 24%, #ebe4f8 48%, #e4edf8 72%, #dce8f4 100%)',
	dark: 'linear-gradient(135deg, #1c1c1c 0%, #101010 100%)',
} as const;
export const KRONA_THEME_PREVIEWS = KRONA_THEME_BACKGROUNDS;
export const KRONA_THEME_PRIMARIES = {
	light: 'linear-gradient(145deg, #ffffff, #e4edf8)',
	dark: 'linear-gradient(145deg, #303030, #101010)',
} as const;
export const KRONA_THEME_TRANSITION_MS = 400;
export const KRONA_THEME_CHANGE_EVENT = 'krona:theme-changed';
export type KronaThemeChangeDetail = {
	theme: KronaThemeSeason;
	previous: KronaThemeSeason;
};
let themeSettleTimer = 0;

export function isKronaThemeSeason(value: string): value is KronaThemeSeason {
	return value === 'light' || value === 'dark';
}

/** Migrate saved seasonal choices to the two supported modes. */
export function resolveKronaTheme(
	value: string | null | undefined,
): KronaThemeSeason {
	const stored = value?.toLowerCase().trim();
	return stored === 'light' || stored === 'summer' ? 'light' : 'dark';
}

// Runs before paint, and still applies the default if browser storage is blocked.
export const KRONA_THEME_INIT_SCRIPT = `(function(){var t='dark';try{var s=localStorage.getItem('${KRONA_THEME_STORAGE_KEY}');if(s==='light'||s==='summer')t='light';}catch(e){}var r=document.documentElement;r.setAttribute('${KRONA_THEME_SEASON_ATTR}',t);r.classList.toggle('dark',t==='dark');r.style.colorScheme=t;r.setAttribute('data-joy-color-scheme',t);try{localStorage.setItem('${KRONA_THEME_STORAGE_KEY}',t);localStorage.setItem('joy-mode',t);}catch(e){}})();`;

export function getKronaTheme(): KronaThemeSeason {
	if (typeof document === 'undefined') return 'dark';
	const applied = document.documentElement.getAttribute(
		KRONA_THEME_SEASON_ATTR,
	);
	if (applied) return resolveKronaTheme(applied);
	try {
		return resolveKronaTheme(
			window.localStorage.getItem(KRONA_THEME_STORAGE_KEY),
		);
	} catch {
		return 'dark';
	}
}

export function isKronaThemeDark(): boolean {
	return getKronaTheme() === 'dark';
}

export function applyKronaTheme(mode: KronaThemeMode): void {
	if (typeof document === 'undefined') return;
	const previous = getKronaTheme();
	const theme = resolveKronaTheme(mode);
	const root = document.documentElement;
	root.classList.add('krona-theme-settle');
	root.classList.toggle('dark', theme === 'dark');
	root.style.colorScheme = theme;
	root.setAttribute('data-joy-color-scheme', theme);
	root.setAttribute(KRONA_THEME_SEASON_ATTR, theme);
	try {
		window.localStorage.setItem(KRONA_THEME_STORAGE_KEY, theme);
		window.localStorage.setItem('joy-mode', theme);
	} catch {
		/* Storage can be disabled; the applied mode still works. */
	}
	window.clearTimeout(themeSettleTimer);
	themeSettleTimer = window.setTimeout(
		() => root.classList.remove('krona-theme-settle'),
		KRONA_THEME_TRANSITION_MS,
	);
	window.dispatchEvent(
		new CustomEvent<KronaThemeChangeDetail>(KRONA_THEME_CHANGE_EVENT, {
			detail: { theme, previous },
		}),
	);
}

export function toggleKronaTheme(): KronaThemeSeason {
	const next = getKronaTheme() === 'dark' ? 'light' : 'dark';
	applyKronaTheme(next);
	return next;
}
