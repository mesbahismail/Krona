'use client';

import { IconButton, Tooltip } from '@mui/joy';
import { Repeat2 } from 'lucide-react';
import { kronaToggleIconButtonSx } from '@/lib/kronaStyles';

export default function RepeatableTaskToggleButton({
	active,
	onToggle,
	size = 'sm',
}: {
	active: boolean;
	onToggle: () => void;
	size?: 'sm' | 'md';
}) {
	return (
		<Tooltip title={active ? 'Repeatable daily (on)' : 'Repeatable daily (off)'}>
			<IconButton
				size={size}
				aria-label={active ? 'Repeatable daily (on)' : 'Repeatable daily (off)'}
				aria-pressed={active}
				onClick={onToggle}
				sx={kronaToggleIconButtonSx(active)}
			>
				<Repeat2 size={size === 'md' ? 18 : 16} />
			</IconButton>
		</Tooltip>
	);
}
