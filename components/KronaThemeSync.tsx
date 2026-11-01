'use client';

import * as React from 'react';
import { useColorScheme } from '@mui/joy/styles';
import {
	applyKronaTheme,
	isKronaThemeDark,
	KRONA_THEME_CHANGE_EVENT,
	KRONA_THEME_STORAGE_KEY,
	resolveKronaTheme,
} from '@/lib/kronaTheme';

/** Keeps Joy UI color scheme in sync with Krona season — never writes html attrs. */
export default function KronaThemeSync() {
	const { mode, setMode } = useColorScheme();
	const modeRef = React.useRef(mode);
	React.useEffect(() => {
		modeRef.current = mode;
	}, [mode]);

	React.useEffect(() => {
		const syncJoy = () => {
			const next = isKronaThemeDark() ? 'dark' : 'light';
			if (modeRef.current === next) return;
			setMode(next);
		};

		syncJoy();

		window.addEventListener(KRONA_THEME_CHANGE_EVENT, syncJoy);

		const onStorage = (event: StorageEvent) => {
			if (event.key !== KRONA_THEME_STORAGE_KEY || event.newValue == null) {
				return;
			}
			applyKronaTheme(resolveKronaTheme(event.newValue));
		};
		window.addEventListener('storage', onStorage);

		return () => {
			window.removeEventListener(KRONA_THEME_CHANGE_EVENT, syncJoy);
			window.removeEventListener('storage', onStorage);
		};
	}, [setMode]);

	return null;
}
