'use client';

import { Palmtree } from 'lucide-react';
import { useVacationMode } from '@/components/VacationModeContext';

/**
 * Full-width vacation notice — used on dashboard, reminders, performance, challenges.
 * Theme tokens so light seasons stay readable (no pale-on-pale yellow).
 */
export default function VacationModeBanner() {
	const { active, setActive } = useVacationMode();
	if (!active) return null;

	return (
		<div
			data-krona-vacation-banner
			role="status"
			aria-live="polite"
			style={{
				position: 'relative',
				zIndex: 2,
				width: '100%',
				boxSizing: 'border-box',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'space-between',
				gap: 12,
				paddingLeft: 16,
				paddingRight: 16,
				paddingTop: 8,
				paddingBottom: 8,
				marginBottom: 16,
				borderRadius: 16,
				border: '1px solid var(--krona-vacation-border)',
				backgroundColor: 'var(--krona-vacation-day-bg)',
				// Warm wash across the full strip so the empty middle (between the
				// title and the CTA) still reads as amber, not as a widget surface.
				backgroundImage:
					'linear-gradient(90deg, color-mix(in srgb, var(--krona-vacation-cta-bg) 12%, transparent) 0%, color-mix(in srgb, var(--krona-vacation-cta-bg) 5%, transparent) 100%)',
				boxShadow:
					'0 8px 24px -16px color-mix(in srgb, var(--krona-vacation-cta-bg) 60%, transparent)',
				flex: '0 0 auto',
				alignSelf: 'stretch',
			}}
		>
			<div
				style={{
					display: 'flex',
					alignItems: 'center',
					gap: 10,
					minWidth: 0,
					flex: '1 1 auto',
				}}
			>
				<Palmtree
					aria-hidden
					size={18}
					strokeWidth={2.25}
					style={{
						color: 'var(--krona-vacation-icon)',
						flexShrink: 0,
					}}
				/>
				<div
					style={{
						minWidth: 0,
						fontSize: 14,
						fontWeight: 700,
						lineHeight: 1.2,
						color: 'var(--krona-vacation-text)',
						fontFamily: 'Poppins, system-ui, sans-serif',
						whiteSpace: 'nowrap',
						overflow: 'hidden',
						textOverflow: 'ellipsis',
					}}
				>
					Vacation mode is on
				</div>
			</div>
			<button
				type="button"
				onClick={() => void setActive(false)}
				style={{
					flexShrink: 0,
					marginLeft: 'auto',
					border: '1px solid var(--krona-vacation-border)',
					borderRadius: 9999,
					padding: '8px 18px',
					minHeight: 34,
					fontSize: 13,
					fontWeight: 600,
					lineHeight: 1,
					cursor: 'pointer',
					color: 'var(--krona-vacation-cta-text)',
					backgroundColor: 'var(--krona-vacation-cta-bg)',
					fontFamily: 'Poppins, system-ui, sans-serif',
					boxShadow:
						'0 4px 14px color-mix(in srgb, var(--krona-vacation-cta-bg) 28%, transparent)',
				}}
			>
				Back to work
			</button>
		</div>
	);
}
