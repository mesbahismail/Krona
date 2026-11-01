'use client';

import * as React from 'react';
import createCache, { type Options as EmotionCacheOptions } from '@emotion/cache';
import { useServerInsertedHTML } from 'next/navigation';
import { CacheProvider } from '@emotion/react';
import { CssVarsProvider } from '@mui/joy/styles';
import CssBaseline from '@mui/joy/CssBaseline';
import theme from './theme';

// https://mui.com/joy-ui/integrations/next-js-app-router/
// https://github.com/emotion-js/emotion/issues/2928#issuecomment-1319747902
export default function ThemeRegistry({
	options,
	children,
}: {
	options: EmotionCacheOptions;
	children: React.ReactNode;
}) {
	const [{ cache, flush }] = React.useState(() => {
		const cache = createCache(options);
		cache.compat = true;
		const prevInsert = cache.insert;
		let inserted: string[] = [];
		cache.insert = (...args) => {
			const serialized = args[1];
			if (serialized.name !== undefined && cache.inserted[serialized.name] === undefined) {
				inserted.push(serialized.name);
			}
			return prevInsert(...args);
		};
		const flush = () => {
			const prevInserted = inserted;
			inserted = [];
			return prevInserted;
		};
		return { cache, flush };
	});

	useServerInsertedHTML(() => {
		const names = flush();
		if (names.length === 0) {
			return null;
		}
		let styles = '';
		for (const name of names) {
			const rule = cache.inserted[name];
			if (typeof rule === 'string') {
				styles += rule;
			}
		}
		return (
			<style
				key={cache.key}
				data-emotion={`${cache.key} ${names.join(' ')}`}
				dangerouslySetInnerHTML={{
					__html: styles,
				}}
			/>
		);
	});

	return (
		<CacheProvider value={cache}>
			<CssVarsProvider theme={theme} defaultMode="dark">
				<CssBaseline />
				{children}
			</CssVarsProvider>
		</CacheProvider>
	);
}
