'use client';

import * as React from 'react';
import { Box } from '@mui/joy';
import type { SxProps } from '@mui/joy/styles/types';
import { MoveHorizontal } from 'lucide-react';
import {
	KRONA_SIDE_LIST_DEFAULT_LEFT_PCT,
	KRONA_SIDE_LIST_DETAIL_PL,
	KRONA_SIDE_LIST_MAX_LEFT_PCT,
	KRONA_SIDE_LIST_MAX_WIDTH_PX,
	KRONA_SIDE_LIST_MIN_LEFT_PCT,
	KRONA_SIDE_LIST_MIN_WIDTH_PX,
	KRONA_SIDE_LIST_SIDEBAR_PR,
} from '@/lib/kronaStyles';

type PanelDisplay = {
	xs?: string;
	md?: string;
	lg?: string;
};

export type KronaResizableSplitLayoutProps = {
	sidebar: React.ReactNode;
	detail: React.ReactNode;
	dividerAriaLabel?: string;
	defaultLeftPct?: number;
	sidebarDisplay?: PanelDisplay;
	detailDisplay?: PanelDisplay;
	/** Hide the resize divider (e.g. when the sidebar is collapsed). */
	dividerDisplay?: PanelDisplay;
	/** Resize from the sidebar edge without a separate divider or handle. */
	resizeAtSidebarEdge?: boolean;
	containerSx?: SxProps;
	sidebarSx?: SxProps;
	detailSx?: SxProps;
};

export function KronaResizableSplitLayout({
	sidebar,
	detail,
	dividerAriaLabel = 'Resize panels',
	defaultLeftPct = KRONA_SIDE_LIST_DEFAULT_LEFT_PCT,
	sidebarDisplay,
	detailDisplay,
	dividerDisplay,
	resizeAtSidebarEdge = false,
	containerSx,
	sidebarSx,
	detailSx,
}: KronaResizableSplitLayoutProps) {
	const containerRef = React.useRef<HTMLDivElement | null>(null);
	const dividerRef = React.useRef<HTMLDivElement | null>(null);
	const [leftPct, setLeftPct] = React.useState<number>(defaultLeftPct);
	const [dragging, setDragging] = React.useState<boolean>(false);

	const updateLeftPctFromClientX = React.useCallback((clientX: number) => {
		const el = containerRef.current;
		if (!el) return;
		const rect = el.getBoundingClientRect();
		const x = Math.max(rect.left, Math.min(clientX, rect.right));
		const pct = ((x - rect.left) / rect.width) * 100;
		setLeftPct(
			Math.max(KRONA_SIDE_LIST_MIN_LEFT_PCT, Math.min(KRONA_SIDE_LIST_MAX_LEFT_PCT, pct)),
		);
	}, []);

	const endDividerDrag = React.useCallback(() => {
		setDragging(false);
		document.body.style.userSelect = '';
		document.body.style.cursor = '';
		document.body.style.touchAction = '';
	}, []);

	const onDividerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
		if (e.button !== 0) return;
		e.preventDefault();
		e.stopPropagation();
		dividerRef.current?.setPointerCapture(e.pointerId);
		setDragging(true);
		updateLeftPctFromClientX(e.clientX);
		document.body.style.userSelect = 'none';
		document.body.style.cursor = 'col-resize';
		document.body.style.touchAction = 'none';
	};

	const onDividerPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
		if (!dividerRef.current?.hasPointerCapture(e.pointerId)) return;
		e.preventDefault();
		updateLeftPctFromClientX(e.clientX);
	};

	const onDividerPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
		if (!dividerRef.current?.hasPointerCapture(e.pointerId)) return;
		dividerRef.current.releasePointerCapture(e.pointerId);
		endDividerDrag();
	};

	return (
		<Box
			ref={containerRef}
			sx={
				[
					{
						flex: 1,
						display: 'flex',
						flexDirection: { xs: 'column', md: 'row' },
						minHeight: 0,
						minWidth: 0,
						overflow: 'hidden',
					},
					...(containerSx ? [containerSx] : []),
				] as SxProps
			}
		>
			<Box
				sx={
					[
						{
							width: { xs: '100%', md: `${leftPct}%` },
							minWidth: { xs: 0, md: KRONA_SIDE_LIST_MIN_WIDTH_PX },
							maxWidth: { md: KRONA_SIDE_LIST_MAX_WIDTH_PX },
							flex: { xs: 'unset', md: `0 0 ${leftPct}%` },
							display: sidebarDisplay ?? { xs: 'flex', md: 'flex' },
							flexDirection: 'column',
							minHeight: 0,
							overflow: 'hidden',
							pr: { xs: 0, md: KRONA_SIDE_LIST_SIDEBAR_PR },
						},
						...(sidebarSx ? [sidebarSx] : []),
					] as SxProps
				}
			>
				{sidebar}
			</Box>

			<Box
				ref={dividerRef}
				role="separator"
				aria-orientation="vertical"
				aria-valuenow={Math.round(leftPct)}
				aria-valuemin={KRONA_SIDE_LIST_MIN_LEFT_PCT}
				aria-valuemax={KRONA_SIDE_LIST_MAX_LEFT_PCT}
				aria-label={dividerAriaLabel}
				onPointerDown={onDividerPointerDown}
				onPointerMove={onDividerPointerMove}
				onPointerUp={onDividerPointerUp}
				onPointerCancel={onDividerPointerUp}
				onLostPointerCapture={endDividerDrag}
				tabIndex={0}
				onKeyDown={(event) => {
					if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
					event.preventDefault();
					const step = event.key === 'ArrowLeft' ? -2 : 2;
					setLeftPct((value) => Math.max(
						KRONA_SIDE_LIST_MIN_LEFT_PCT,
						Math.min(KRONA_SIDE_LIST_MAX_LEFT_PCT, value + step),
					));
				}}
				sx={{
					position: 'relative',
					flex: { xs: '0 0 0', md: resizeAtSidebarEdge ? '0 0 0' : '0 0 12px' },
					width: { xs: 0, md: resizeAtSidebarEdge ? 0 : 12 },
					alignSelf: 'stretch',
					display: dividerDisplay ?? { xs: 'none', md: 'block' },
					flexShrink: 0,
					zIndex: 2,
					touchAction: 'none',
					cursor: 'col-resize',
					'&:hover .krona-panel-divider-handle, &:active .krona-panel-divider-handle': {
						opacity: 1,
					},
					'&::before': {
						display: resizeAtSidebarEdge ? 'none' : 'block',
						content: '""',
						position: 'absolute',
						left: '50%',
						top: 0,
						bottom: 0,
						width: '1px',
						transform: 'translateX(-50%)',
						backgroundColor: dragging
							? 'var(--krona-widget-border-hover)'
							: 'var(--krona-surface-border)',
						transition: dragging ? 'none' : 'background-color 0.2s ease',
						pointerEvents: 'none',
					},
					'&:hover::before': {
						backgroundColor: 'var(--krona-widget-border-hover)',
					},
					'&::after': {
						content: '""',
						position: 'absolute',
						top: resizeAtSidebarEdge ? 16 : 0,
						bottom: resizeAtSidebarEdge ? 16 : 0,
						left: resizeAtSidebarEdge ? -6 : -10,
						right: resizeAtSidebarEdge ? -6 : -10,
						cursor: 'col-resize',
					},
					'&:focus-visible::after': {
						outline: '2px solid var(--krona-accent)',
						borderRadius: '4px',
					},
				}}
			>
				{!resizeAtSidebarEdge && <Box
					className="krona-panel-divider-handle"
					sx={{
						position: 'absolute',
						top: '50%',
						left: '50%',
						transform: 'translate(-50%, -50%)',
						background: 'var(--krona-secondary-bg)',
						border: '1px solid var(--krona-surface-border)',
						borderRadius: '999px',
						padding: '4px 6px',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						opacity: dragging ? 1 : 0,
						transition: 'opacity 0.2s ease',
						pointerEvents: 'none',
						color: 'var(--krona-text)',
					}}
				>
					<MoveHorizontal size={14} />
				</Box>}
			</Box>

			<Box
				sx={
					[
						{
							flex: { xs: 'unset', md: '1 1 0' },
							width: { xs: '100%', md: 'auto' },
							display: detailDisplay ?? { xs: 'flex', md: 'flex' },
							flexDirection: 'column',
							minHeight: 0,
							minWidth: 0,
							overflow: 'hidden',
							pl: { xs: 0, md: KRONA_SIDE_LIST_DETAIL_PL },
						},
						...(detailSx ? [detailSx] : []),
					] as SxProps
				}
			>
				{detail}
			</Box>
		</Box>
	);
}

export default KronaResizableSplitLayout;
