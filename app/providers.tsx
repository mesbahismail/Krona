'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import ThemeRegistry from '@/components/ThemeRegistry/ThemeRegistry';

const queryClient = new QueryClient();

/** Lightweight UI providers shared by marketing, auth, and app routes. */
export default function Providers({ children }: { children: React.ReactNode }) {
	return (
		<QueryClientProvider client={queryClient}>
			<ThemeRegistry options={{ key: 'joy' }}>
				{children}
				<Toaster
					position="bottom-center"
					reverseOrder={false}
					gutter={8}
					containerStyle={{
						left: 16,
						right: 16,
						bottom: 'max(24px, env(safe-area-inset-bottom))',
						maxWidth: 'calc(100vw - 32px)',
					}}
					toastOptions={{
						duration: 5000,
						style: {
							background: 'var(--krona-dropdown-bg)',
							border: '1px solid var(--krona-surface-border)',
							color: 'var(--krona-text, #fff)',
							backdropFilter: 'blur(32px) saturate(200%)',
							WebkitBackdropFilter: 'blur(32px) saturate(200%)',
							boxShadow: '0 12px 40px rgba(0, 0, 0, 0.18)',
							borderRadius: '20px',
							padding: '12px 16px',
							fontSize: '14px',
							fontFamily: 'Poppins, sans-serif',
						},
					}}
				/>
			</ThemeRegistry>
		</QueryClientProvider>
	);
}
