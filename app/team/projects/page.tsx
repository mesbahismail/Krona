'use client';

import * as React from 'react';
import { Suspense } from 'react';
import { Typography } from '@mui/joy';
import TeamProjectsPageClient from './TeamProjectsPageClient';

function Fallback() {
	return (
		<Typography level="body-sm" sx={{ color: 'var(--krona-text-muted)', p: 2 }}>
			Loading…
		</Typography>
	);
}

export default function TeamProjectsRoute() {
	return (
		<Suspense fallback={<Fallback />}>
			<TeamProjectsPageClient />
		</Suspense>
	);
}
