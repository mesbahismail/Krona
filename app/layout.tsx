import type { Metadata } from 'next';
import type { CSSProperties, ReactNode } from 'react';
import Providers from '@/app/providers';
import AppRuntime from '@/app/AppRuntime';
import KronaThemeInit from '@/components/KronaThemeInit';
import '@/app/globals.css';

const fontVariables: CSSProperties & Record<string, string> = {
	'--font-geist-sans':
		'Poppins, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
	'--font-geist-mono':
		'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace',
};

export const metadata: Metadata = {
	title: {
		default: 'Krona — HR & Time Management',
		template: '%s — Krona',
	},
	description:
		'Free React template for HR and time management: team dashboard, projects, tasks, reminders, focus timer and performance reports.',
	applicationName: 'Krona',
};

export default function RootLayout({
	children,
}: Readonly<{
	children: ReactNode;
}>) {
	return (
		<html
			className="dark"
			data-krona-season="dark"
			lang="en"
			suppressHydrationWarning
			style={fontVariables}
		>
			<body className="antialiased" suppressHydrationWarning>
				<KronaThemeInit />
				<Providers>
					<AppRuntime>
						<div className="flex min-h-screen flex-col">
							<main className="flex flex-1 flex-col">
								<div className="w-full flex-1">{children}</div>
							</main>
						</div>
					</AppRuntime>
				</Providers>
			</body>
		</html>
	);
}
