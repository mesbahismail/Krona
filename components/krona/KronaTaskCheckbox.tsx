'use client';

import * as React from 'react';
import { Box } from '@mui/joy';
import type { SxProps } from '@mui/joy/styles/types';
import { Check } from 'lucide-react';

const baseSx: SxProps = {
	width: 26,
	height: 26,
	minWidth: 26,
	minHeight: 26,
	flexShrink: 0,
	borderRadius: '10px',
	p: 0,
	border: '1.5px solid var(--krona-input-border)',
	bgcolor: 'transparent',
	color: '#fff',
	display: 'inline-flex',
	alignItems: 'center',
	justifyContent: 'center',
	cursor: 'pointer',
	transition: 'background 0.2s ease, border-color 0.2s ease',
	'&:hover': {
		bgcolor: 'color-mix(in srgb, var(--krona-text) 6%, transparent)',
	},
	'&:disabled': {
		opacity: 0.5,
		cursor: 'not-allowed',
	},
};

const checkedSx: SxProps = {
	boxSizing: 'border-box',
	background: 'var(--krona-accent-gradient)',
	bgcolor: 'transparent',
	border: 'none',
	'&:hover': {
		background: 'var(--krona-accent-gradient-hover)',
		bgcolor: 'transparent',
		border: 'none',
	},
};

type KronaTaskCheckboxProps = {
	checked: boolean;
	onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
	onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
	disabled?: boolean;
	'aria-label'?: string;
	sx?: SxProps;
};

/** Task completion toggle — plain button + Lucide check (avoids MUI checkbox SVG bugs). */
export default function KronaTaskCheckbox({
	checked,
	onChange,
	onClick,
	disabled,
	'aria-label': ariaLabel,
	sx,
}: KronaTaskCheckboxProps) {
	const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
		onClick?.(event);
		if (event.defaultPrevented) return;
		onChange?.({
			target: { checked: !checked },
		} as React.ChangeEvent<HTMLInputElement>);
	};

	const mergedSx: SxProps = [
		baseSx,
		checked ? checkedSx : {},
		...(sx ? (Array.isArray(sx) ? sx : [sx]) : []),
	];

	return (
		<Box
			component="button"
			type="button"
			className="krona-task-checkbox"
			role="checkbox"
			aria-checked={checked}
			aria-label={ariaLabel ?? (checked ? 'Mark incomplete' : 'Mark complete')}
			disabled={disabled}
			onClick={handleClick}
			sx={mergedSx}
		>
			{checked ? (
				<Check size={16} strokeWidth={3} color="#fff" aria-hidden />
			) : null}
		</Box>
	);
}
