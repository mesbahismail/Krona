'use client';

import * as React from 'react';
import { Box, Button, IconButton, Input, Tooltip } from '@mui/joy';
import type { SxProps } from '@mui/joy/styles/types';
import { Plus, Search, X } from 'lucide-react';
import {
	kronaPrimaryIconButtonSx,
	kronaSearchToolbarButtonSx,
	kronaSearchToolbarInputSx,
	kronaToolbarRowSx,
} from '@/lib/kronaStyles';

export type KronaSearchCreateToolbarProps = {
	searchPlaceholder: string;
	searchValue: string;
	onSearchChange: (value: string) => void;
	createLabel?: string;
	/** Icon-only create button (Notes-style) instead of labeled button. */
	createIconOnly?: boolean;
	/** When omitted, only search (+ optional endSlot) is shown. */
	onCreate?: () => void;
	/** Rendered between search and the create action (e.g. sort toggle). */
	beforeCreateSlot?: React.ReactNode;
	endSlot?: React.ReactNode;
	sx?: SxProps;
};

/** Search on the left, primary “Create New” action beside it — shared across Tasks & Projects. */
export default function KronaSearchCreateToolbar({
	searchPlaceholder,
	searchValue,
	onSearchChange,
	createLabel = 'Create New',
	createIconOnly = false,
	onCreate,
	beforeCreateSlot,
	endSlot,
	sx,
}: KronaSearchCreateToolbarProps) {
	const hasSearch = searchValue.trim().length > 0;

	return (
		<Box
			sx={
				[
					{
						position: 'relative',
						width: '100%',
						flexShrink: 0,
					},
					sx,
				] as SxProps
			}
		>
			<Box sx={{ ...kronaToolbarRowSx, ...(createIconOnly ? { flexWrap: 'nowrap', minWidth: 0, '& > button': { flexShrink: 0 } } : {}) }} className="krona-search-toolbar-row">
				<Input
					startDecorator={<Search size={16} aria-hidden />}
					endDecorator={
						hasSearch ? (
							<IconButton
								size="sm"
								variant="plain"
								aria-label="Clear search"
								onClick={() => onSearchChange('')}
								sx={{
									'--IconButton-size': '28px',
									minWidth: 28,
									minHeight: 28,
									borderRadius: '999px',
									color: 'var(--krona-text-muted)',
									mr: -0.5,
									'&:hover': {
										color: 'var(--krona-text)',
										bgcolor: 'var(--krona-overlay-hover)',
									},
								}}
							>
								<X size={14} aria-hidden />
							</IconButton>
						) : null
					}
					placeholder={searchPlaceholder}
					slotProps={{
						input: {
							placeholder: searchPlaceholder,
							'aria-label': searchPlaceholder,
						},
					}}
					value={searchValue}
					onChange={(e) => onSearchChange(e.target.value)}
					sx={{ ...kronaSearchToolbarInputSx, ...(createIconOnly ? { minWidth: 0, flex: '1 1 0', '& input': { minWidth: 0 } } : {}) }}
				/>
				{beforeCreateSlot ? (
					<Box sx={{ flexShrink: 0 }}>{beforeCreateSlot}</Box>
				) : null}
				{onCreate ? (
					createIconOnly ? (
						<Tooltip title={createLabel}>
							<IconButton
								aria-label={createLabel}
								onClick={onCreate}
								sx={kronaPrimaryIconButtonSx}
							>
								<Plus size={16} />
							</IconButton>
						</Tooltip>
					) : (
						<Button
							startDecorator={<Plus size={16} aria-hidden />}
							onClick={onCreate}
							sx={kronaSearchToolbarButtonSx}
						>
							{createLabel}
						</Button>
					)
				) : null}
				{endSlot ? <Box sx={{ flexShrink: 0 }}>{endSlot}</Box> : null}
			</Box>
		</Box>
	);
}
