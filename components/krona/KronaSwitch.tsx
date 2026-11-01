'use client';

import * as React from 'react';

/** Shared Krona toggle — identical size/shape/colors app-wide; only thumb icons may differ. */
export const KRONA_SWITCH_WIDTH = 44;
export const KRONA_SWITCH_HEIGHT = 26;
export const KRONA_SWITCH_THUMB = 22;

export type KronaSwitchProps = {
	checked: boolean;
	onChange: (checked: boolean) => void;
	disabled?: boolean;
	'aria-label'?: string;
	checkedIcon?: React.ReactNode;
	uncheckedIcon?: React.ReactNode;
	className?: string;
};

export default function KronaSwitch({
	checked,
	onChange,
	disabled = false,
	'aria-label': ariaLabel,
	checkedIcon,
	uncheckedIcon,
	className,
}: KronaSwitchProps) {
	return (
		<button
			type="button"
			role="switch"
			aria-checked={checked}
			aria-label={ariaLabel}
			disabled={disabled}
			onClick={() => {
				if (disabled) return;
				onChange(!checked);
			}}
			className={className}
			style={{
				width: KRONA_SWITCH_WIDTH,
				height: KRONA_SWITCH_HEIGHT,
				borderRadius: 9999,
				border: 'none',
				paddingLeft: 2,
				paddingRight: 2,
				paddingTop: 0,
				paddingBottom: 0,
				cursor: disabled ? 'not-allowed' : 'pointer',
				flexShrink: 0,
				opacity: disabled ? 0.48 : 1,
				background: checked
					? 'var(--krona-accent-gradient)'
					: 'var(--krona-secondary-bg)',
				boxShadow: checked ? 'var(--krona-accent-shadow)' : 'none',
				display: 'inline-flex',
				alignItems: 'center',
				justifyContent: checked ? 'flex-end' : 'flex-start',
				transition:
					'justify-content 0.22s ease, background 0.22s ease, box-shadow 0.22s ease, opacity 0.15s ease',
				overflow: 'hidden',
			}}
		>
			<span
				style={{
					width: KRONA_SWITCH_THUMB,
					height: KRONA_SWITCH_THUMB,
					borderRadius: '50%',
					backgroundColor: '#fff',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					color: 'var(--krona-accent)',
					boxShadow: 'none',
					flexShrink: 0,
					pointerEvents: 'none',
				}}
			>
				{checked ? checkedIcon : uncheckedIcon}
			</span>
		</button>
	);
}
