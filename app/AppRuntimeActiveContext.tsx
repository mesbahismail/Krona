'use client';

import * as React from 'react';

const AppRuntimeActiveContext = React.createContext(true);

export function AppRuntimeActiveProvider({
	active,
	children,
}: {
	active: boolean;
	children: React.ReactNode;
}) {
	return (
		<AppRuntimeActiveContext.Provider value={active}>
			{children}
		</AppRuntimeActiveContext.Provider>
	);
}

/** False on public/auth routes until a session activates the app runtime. */
export function useAppRuntimeActive(): boolean {
	return React.useContext(AppRuntimeActiveContext);
}
