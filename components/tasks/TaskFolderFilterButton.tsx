'use client';

import { IconButton, Tooltip } from '@mui/joy';
import { Folder, List } from 'lucide-react';
import { kronaSecondaryIconButtonSx } from '@/lib/kronaStyles';

export default function TaskFolderFilterButton({
	active,
	onToggle,
	size = 'sm',
}: {
	/** True when browsing projects/folders (not flat task list). */
	active: boolean;
	onToggle: () => void;
	size?: 'sm' | 'md';
}) {
	const iconSize = size === 'md' ? 18 : 16;
	const label = active ? 'Show all tasks' : 'Browse by project';
	const Icon = active ? List : Folder;

	return (
		<Tooltip title={label}>
			<IconButton
				size={size}
				aria-label={label}
				aria-pressed={active}
				onClick={onToggle}
				sx={kronaSecondaryIconButtonSx}
			>
				<Icon size={iconSize} />
			</IconButton>
		</Tooltip>
	);
}
