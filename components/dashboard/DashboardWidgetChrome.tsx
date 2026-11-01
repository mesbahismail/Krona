'use client';

import * as React from 'react';
import NextLink from 'next/link';
import { Box, IconButton, Tooltip, Typography } from '@mui/joy';
import type { SxProps } from '@mui/joy/styles/types';
import { ArrowUpRight, GripVertical } from 'lucide-react';
import {
	kronaMenuSx,
	kronaSecondaryIconButtonSx,
	kronaTitleSx,
	kronaWidgetCardSx,
	kronaWidgetNavHintRevealSx,
	kronaWidgetNavHintSx,
	kronaWidgetPaddingSx,
} from '@/lib/kronaStyles';
import {
	canSwapWidgets,
	parseDragWidgetId,
	resolveDashboardPlacementForLayout,
	resolveDashboardWidgetNavHint,
	type DashboardWidgetId,
} from '@/lib/dashboardLayout';
import {
	DASHBOARD_DRAG_MIME,
	useDashboardLayout,
	useDashboardWidgetPlacement,
} from '@/components/dashboard/DashboardLayoutContext';
import {
	isMobileSecondaryEqualHeightWidget,
	mergeDashboardWidgetShellRefs,
	useDashboardMobileSecondaryWidgetHeightsOptional,
} from '@/components/dashboard/DashboardMobileSecondaryWidgetHeights';
import { useKronaLayoutMode } from '@/components/KronaLayoutModeProvider';
const EMPTY_DRAG_IMAGE =
	typeof document !== 'undefined'
		? (() => {
				const el = document.createElement('div');
				el.style.width = '1px';
				el.style.height = '1px';
				el.style.opacity = '0';
				el.style.position = 'fixed';
				el.style.top = '-1000px';
				return el;
			})()
		: null;

export function DashboardWidgetDragHandle({ id }: { id: DashboardWidgetId }) {
	const { beginDrag, endDrag } = useDashboardLayout();

	return (
		<Tooltip title="Move widget">
			<IconButton
				className="krona-widget-drag-handle"
				size="sm"
				variant="plain"
				aria-label="Move widget"
				draggable
				onDragStart={(e) => {
					e.dataTransfer.effectAllowed = 'move';
					e.dataTransfer.setData(DASHBOARD_DRAG_MIME, id);
					e.dataTransfer.setData('text/plain', id);
					beginDrag(id);

					if (EMPTY_DRAG_IMAGE) {
						document.body.appendChild(EMPTY_DRAG_IMAGE);
						e.dataTransfer.setDragImage(EMPTY_DRAG_IMAGE, 0, 0);
						requestAnimationFrame(() => EMPTY_DRAG_IMAGE.remove());
					}
				}}
				onDragEnd={() => {
					endDrag();
				}}
				sx={{
					...kronaSecondaryIconButtonSx,
					opacity: 0,
					visibility: 'hidden',
					pointerEvents: 'none',
					cursor: 'grab',
					transition: 'opacity 0.15s ease, visibility 0.15s ease',
					'&:focus-visible': {
						opacity: 1,
						visibility: 'visible',
						pointerEvents: 'auto',
					},
					'&:active': { cursor: 'grabbing' },
				}}
			>
				<GripVertical size={16} aria-hidden />
			</IconButton>
		</Tooltip>
	);
}

export const DashboardWidgetShell = React.forwardRef(function DashboardWidgetShell(
	{
		id,
		children,
		sx,
	}: {
		id: DashboardWidgetId;
		children: React.ReactNode;
		sx?: SxProps;
	},
	ref: React.ForwardedRef<HTMLDivElement>,
) {
	const placement = useDashboardWidgetPlacement(id);
	const { mode, isTabletDashboard, isDesktopDashboard } = useKronaLayoutMode();
	const resolvedPlacement = resolveDashboardPlacementForLayout(placement, mode);
	const mobileSecondaryHeights = useDashboardMobileSecondaryWidgetHeightsOptional();
	const registerSecondaryWidget = mobileSecondaryHeights?.registerWidget;
	const { draggingId, commitDrag, setHoverTargetId, hoverTargetId } =
		useDashboardLayout();
	const [dropActive, setDropActive] = React.useState(false);
	const dragEnterCountRef = React.useRef(0);
	// Must stay identity-stable: a new ref callback detaches and re-registers the
	// widget on every render, and these widgets re-render on every timer tick.
	const mergedRef = React.useMemo(
		() =>
			mergeDashboardWidgetShellRefs(ref, (node) => {
				registerSecondaryWidget?.(id, node);
			}),
		[ref, registerSecondaryWidget, id],
	);

	const isDragging = draggingId === id;
	const isValidDropTarget =
		draggingId != null && draggingId !== id && canSwapWidgets(draggingId, id);
	const isPreviewTarget = isValidDropTarget && dropActive && hoverTargetId === id;

	const clearDropHighlight = React.useCallback(() => {
		dragEnterCountRef.current = 0;
		setDropActive(false);
		if (hoverTargetId === id) setHoverTargetId(null);
	}, [hoverTargetId, id, setHoverTargetId]);

	React.useEffect(() => {
		if (!draggingId) clearDropHighlight();
	}, [draggingId, clearDropHighlight]);

	const equalHeight =
		isMobileSecondaryEqualHeightWidget(id) &&
		isTabletDashboard &&
		mobileSecondaryHeights?.height
			? mobileSecondaryHeights.height
			: null;
	return (
		<Box
			ref={mergedRef}
			className="krona-dashboard-widget"
			data-tour={`widget-${id}`}
			data-widget-id={id}
			onDragEnter={(e: React.DragEvent) => {
				if (!draggingId || draggingId === id || !canSwapWidgets(draggingId, id)) return;
				e.preventDefault();
				dragEnterCountRef.current += 1;
				if (dragEnterCountRef.current === 1) {
					setDropActive(true);
					setHoverTargetId(id);
				}
			}}
			onDragOver={(e: React.DragEvent) => {
				if (!draggingId || draggingId === id) return;
				if (!canSwapWidgets(draggingId, id)) return;
				e.preventDefault();
				e.stopPropagation();
				e.dataTransfer.dropEffect = 'move';
				if (hoverTargetId !== id) setHoverTargetId(id);
			}}
			onDragLeave={(e: React.DragEvent) => {
				const related = e.relatedTarget as Node | null;
				if (related && e.currentTarget.contains(related)) return;
				dragEnterCountRef.current = Math.max(0, dragEnterCountRef.current - 1);
				if (dragEnterCountRef.current === 0) clearDropHighlight();
			}}
			onDrop={(e: React.DragEvent) => {
				e.preventDefault();
				e.stopPropagation();
				clearDropHighlight();
				const source =
					parseDragWidgetId(e.dataTransfer.getData(DASHBOARD_DRAG_MIME)) ||
					parseDragWidgetId(e.dataTransfer.getData('text/plain'));
				if (source && source !== id) {
					commitDrag(id);
				}
			}}
			sx={[
				kronaWidgetCardSx,
				kronaWidgetPaddingSx,
				{
					gridColumn: resolvedPlacement.gridColumn,
					gridRow: resolvedPlacement.gridRow,
					order: resolvedPlacement.order,
					position: 'relative',
					transition: draggingId
						? 'opacity 0.15s ease, outline 0.15s ease'
						: 'grid-column 0.22s ease, grid-row 0.22s ease, opacity 0.15s ease, outline 0.15s ease',
					opacity: isDragging ? 0.45 : 1,
					outline: isPreviewTarget
						? '2px solid var(--krona-accent-70)'
						: isDragging
							? '2px dashed color-mix(in srgb, var(--krona-text) 28%, transparent)'
							: 'none',
					outlineOffset: -2,
					'&:hover .krona-widget-drag-handle': {
						opacity: 1,
						visibility: 'visible',
						pointerEvents: 'auto',
					},
					'&:hover .krona-widget-nav-hint, &:focus-within .krona-widget-nav-hint':
						kronaWidgetNavHintRevealSx,
				},
				...(sx ? [sx] : []),
				equalHeight != null
					? {
							height: equalHeight,
							maxHeight: isDesktopDashboard ? 'none' : equalHeight,
							minHeight: equalHeight,
						}
					: null,
			] as SxProps}
		>
			{children}
		</Box>
	);
});

function DashboardWidgetTitle({
	href,
	navHint,
	children,
}: {
	href?: string;
	navHint?: string;
	children: React.ReactNode;
}) {
	const inner = (
		<Typography
			level="title-md"
			component={href ? 'span' : 'div'}
			sx={{
				...kronaTitleSx,
				/* Locked home widget headline — 16px. */
				fontSize: '16px',
				color: 'var(--krona-text)',
				fontFamily: 'Poppins, sans-serif',
				lineHeight: 1.2,
				minWidth: 0,
				overflow: 'hidden',
				textOverflow: 'ellipsis',
				whiteSpace: 'nowrap',
				...(href
					? {
							cursor: 'pointer',
							...(navHint
								? {}
								: {
										borderRadius: '14px',
										px: 0.5,
										mx: -0.5,
										transition: 'color 0.2s, background 0.2s',
										'&:hover': {
											background: 'var(--krona-secondary-bg)',
										},
									}),
						}
					: {}),
			}}
		>
			{children}
		</Typography>
	);

	if (!href) return inner;

	return (
		<Box
			component={NextLink}
			href={href}
			sx={{
				display: 'inline-flex',
				alignItems: 'center',
				gap: 0,
				minWidth: 0,
				maxWidth: '100%',
				textDecoration: 'none',
				color: 'inherit',
			}}
		>
			{inner}
			{navHint ? (
				<Box className="krona-widget-nav-hint" sx={kronaWidgetNavHintSx}>
					<Typography level="body-xs" className="krona-widget-nav-hint-label">
						{navHint}
					</Typography>
					<ArrowUpRight className="krona-widget-nav-arrow" size={16} aria-hidden />
				</Box>
			) : null}
		</Box>
	);
}

/** Headline line box: 16px title at 1.2 line-height. */
const WIDGET_TITLE_LINE_BOX = '19.2px';

/**
 * 20px of visible space under the headline text. The header row is as tall as
 * its icon buttons, so subtract that extra leading — otherwise the gap reads
 * ~25px even though the margin says 20px.
 */
export const DASHBOARD_WIDGET_HEADER_GAP = `calc(20px - (var(--krona-control-height, 32px) - ${WIDGET_TITLE_LINE_BOX}) / 2)`;

export function DashboardWidgetHeader({
	widgetId,
	title,
	href,
	navHint,
	leading,
	actions,
	mb = DASHBOARD_WIDGET_HEADER_GAP,
}: {
	widgetId: DashboardWidgetId;
	title: React.ReactNode;
	href?: string;
	navHint?: string;
	leading?: React.ReactNode;
	actions?: React.ReactNode;
	/** Space below the headline before the next control/content. Default 20px. */
	mb?: number | string;
}) {
	const resolvedNavHint = resolveDashboardWidgetNavHint(widgetId, href, navHint);

	return (
		<Box
			sx={{
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'space-between',
				mb,
				gap: 1,
				flexShrink: 0,
				minWidth: 0,
				// Scroll areas reserve 16px of top padding for card shadows and pull
				// back only 8px, which would add hidden space under the headline.
				// Absorb the rest so the gap stays exactly `mb`.
				'& + .krona-widget-scroll': { marginTop: '-16px' },
			}}
		>
			<Box
				sx={{
					minWidth: 0,
					flex: 1,
					overflow: 'hidden',
					display: 'flex',
					alignItems: 'center',
					gap: 0.75,
				}}
			>
				{leading}
				<Box sx={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
					<DashboardWidgetTitle href={href} navHint={resolvedNavHint}>
						{title}
					</DashboardWidgetTitle>
				</Box>
			</Box>
			<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
				<DashboardWidgetDragHandle id={widgetId} />
				{actions}
			</Box>
		</Box>
	);
}
