'use client';

import * as React from 'react';
import {
	Box,
	Checkbox,
	Dropdown,
	IconButton,
	Menu,
	MenuButton,
	MenuItem,
	Tooltip,
	Typography,
} from '@mui/joy';
import { ListFilter } from 'lucide-react';
import {
	kronaMenuItemSx,
	kronaMenuSx,
	kronaSecondaryIconButtonSx,
	kronaSelectedMenuItemProps,
	kronaToggleIconButtonSx,
} from '@/lib/kronaStyles';
import type {
	DashboardTaskSortKey,
	TaskListFilters,
} from '@/lib/dashboardTaskSort';

const SORT_OPTIONS: { key: DashboardTaskSortKey; label: string }[] = [
	{ key: 'newest', label: 'Date · newest first' },
	{ key: 'oldest', label: 'Date · oldest first' },
	{ key: 'name', label: 'Alphabetic · A–Z' },
	{ key: 'nameDesc', label: 'Alphabetic · Z–A' },
];

export default function TaskSortToggleButton({
	sortBy,
	onSortChange,
	filters,
	onFiltersChange,
	size = 'sm',
	disabled = false,
}: {
	sortBy: DashboardTaskSortKey;
	onSortChange: (next: DashboardTaskSortKey) => void;
	filters: TaskListFilters;
	onFiltersChange: (next: TaskListFilters) => void;
	size?: 'sm' | 'md';
	disabled?: boolean;
}) {
	const iconSize = size === 'md' ? 18 : 16;
	const filtersActive = filters.repeatableOnly || filters.favoritesOnly;
	const [menuOpen, setMenuOpen] = React.useState(false);
	const [tooltipOpen, setTooltipOpen] = React.useState(false);
	const keepMenuOpenRef = React.useRef(false);

	const toggleFilter = (key: keyof TaskListFilters) => {
		onFiltersChange({
			...filters,
			[key]: !filters[key],
		});
	};

	return (
		<Dropdown
			open={menuOpen}
			onOpenChange={(_, next) => {
				if (!next && keepMenuOpenRef.current) {
					keepMenuOpenRef.current = false;
					return;
				}
				setMenuOpen(next);
				if (next) setTooltipOpen(false);
			}}
		>
			<Tooltip
				title="Sort and filter"
				open={tooltipOpen}
				onOpen={() => {
					if (!menuOpen) setTooltipOpen(true);
				}}
				onClose={() => setTooltipOpen(false)}
				disableHoverListener={menuOpen}
				disableFocusListener={menuOpen}
				disableTouchListener
			>
				<MenuButton
					slots={{ root: IconButton }}
					slotProps={{
						root: {
							size,
							disabled,
							'aria-label': 'Sort and filter tasks',
							sx: filtersActive
								? kronaToggleIconButtonSx(true)
								: kronaSecondaryIconButtonSx,
						},
					}}
				>
					<ListFilter size={iconSize} />
				</MenuButton>
			</Tooltip>
			<Menu
				placement="bottom-end"
				sx={{
					...kronaMenuSx,
					minWidth: 220,
					maxWidth: 280,
				}}
			>
				<MenuItem disabled sx={kronaMenuItemSx}>
					<Typography
						level="body-xs"
						sx={{ fontWeight: 700, color: 'var(--krona-text-muted)' }}
					>
						Sort
					</Typography>
				</MenuItem>
				{SORT_OPTIONS.map((option) => (
					<MenuItem
						key={option.key}
						{...kronaSelectedMenuItemProps(sortBy === option.key)}
						onClick={() => onSortChange(option.key)}
					>
						{option.label}
					</MenuItem>
				))}
				<MenuItem disabled sx={kronaMenuItemSx}>
					<Typography
						level="body-xs"
						sx={{ fontWeight: 700, color: 'var(--krona-text-muted)' }}
					>
						Filter
					</Typography>
				</MenuItem>
				<MenuItem
					sx={kronaMenuItemSx}
					onMouseDown={() => {
						keepMenuOpenRef.current = true;
					}}
					onClick={() => toggleFilter('repeatableOnly')}
				>
					<Box
						sx={{
							display: 'flex',
							alignItems: 'center',
							gap: 1,
							width: '100%',
						}}
					>
						<Checkbox
							size="sm"
							checked={filters.repeatableOnly}
							tabIndex={-1}
							onClick={(e) => e.preventDefault()}
							sx={{ color: 'var(--krona-text)', pointerEvents: 'none' }}
						/>
						Repeatable
					</Box>
				</MenuItem>
				<MenuItem
					sx={kronaMenuItemSx}
					onMouseDown={() => {
						keepMenuOpenRef.current = true;
					}}
					onClick={() => toggleFilter('favoritesOnly')}
				>
					<Box
						sx={{
							display: 'flex',
							alignItems: 'center',
							gap: 1,
							width: '100%',
						}}
					>
						<Checkbox
							size="sm"
							checked={filters.favoritesOnly}
							tabIndex={-1}
							onClick={(e) => e.preventDefault()}
							sx={{ color: 'var(--krona-text)', pointerEvents: 'none' }}
						/>
						Favorites
					</Box>
				</MenuItem>
			</Menu>
		</Dropdown>
	);
}
