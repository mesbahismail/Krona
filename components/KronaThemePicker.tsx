'use client';

import * as React from 'react';
import { Moon, Sun } from 'lucide-react';
import KronaSwitch from '@/components/krona/KronaSwitch';
import {
	applyKronaTheme,
	getKronaTheme,
	KRONA_THEME_CHANGE_EVENT,
	type KronaThemeMode,
} from '@/lib/kronaTheme';

export default function KronaThemePicker() {
	const [mode, setMode] = React.useState<KronaThemeMode>('dark');
	React.useEffect(() => {
		const sync = () => setMode(getKronaTheme());
		sync();
		window.addEventListener(KRONA_THEME_CHANGE_EVENT, sync);
		return () => window.removeEventListener(KRONA_THEME_CHANGE_EVENT, sync);
	}, []);
	return (
		<div
			className="krona-theme-picker"
			data-tour="dashboard-themes"
			onClick={(event) => event.stopPropagation()}
		>
			<span>Appearance</span>
			<KronaSwitch
				checked={mode === 'dark'}
				onChange={dark => applyKronaTheme(dark ? 'dark' : 'light')}
				aria-label="Dark mode"
				checkedIcon={<Moon size={13} aria-hidden="true" />}
				uncheckedIcon={<Sun size={13} aria-hidden="true" />}
			/>
		</div>
	);
}
