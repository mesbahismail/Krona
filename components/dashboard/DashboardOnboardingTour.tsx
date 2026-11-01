'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { useRouter, useSearchParams } from 'next/navigation';
import { Box, Button, Typography } from '@mui/joy';
import {
	BarChart3,
	Bell,
	Cake,
	CalendarDays,
	ClipboardList,
	FolderKanban,
	Menu as MenuIcon,
	Palette,
	Sparkles,
	Timer,
	Trophy,
	User,
	Users,
	type LucideIcon,
} from 'lucide-react';
import {
	kronaPrimaryButtonSx,
	kronaSecondaryButtonSx,
} from '@/lib/kronaStyles';
import { useTeamMode } from '@/components/teams/TeamModeContext';
import {
	EMPLOYEE_ONBOARDING_STEPS,
	markOnboardingDone,
	ONBOARDING_QUERY_PARAM,
	ONBOARDING_STEPS,
	requestOnboardingAccountMenu,
	shouldLaunchOnboarding,
	type OnboardingPlacement,
	type OnboardingStep,
	type OnboardingStepIcon,
} from '@/lib/onboarding';

const STEP_ICONS: Record<OnboardingStepIcon, LucideIcon> = {
	sparkles: Sparkles,
	folderKanban: FolderKanban,
	timer: Timer,
	calendar: CalendarDays,
	barChart: BarChart3,
	trophy: Trophy,
	menu: MenuIcon,
	user: User,
	palette: Palette,
	users: Users,
	bell: Bell,
	clipboardList: ClipboardList,
	cake: Cake,
};

const SPOTLIGHT_PAD = 10;
const CARD_GAP = 14;
const CARD_WIDTH = 340;
const TARGET_RETRY_FRAMES = 12;

type SpotlightRect = {
	top: number;
	left: number;
	width: number;
	height: number;
	radius: number;
};

function readRadius(el: Element): number {
	const raw = getComputedStyle(el).borderRadius.split(' ')[0] || '16px';
	const n = Number.parseFloat(raw);
	return Number.isFinite(n) ? n : 16;
}

function findVisibleTarget(selector: string | undefined): Element | null {
	if (!selector || typeof document === 'undefined') return null;
	return (
		Array.from(document.querySelectorAll(selector)).find((element) => {
			const rect = element.getBoundingClientRect();
			const style = getComputedStyle(element);
			return (
				rect.width >= 2 &&
				rect.height >= 2 &&
				style.display !== 'none' &&
				style.visibility !== 'hidden'
			);
		}) ?? null
	);
}

function measureTarget(selector: string | undefined): SpotlightRect | null {
	const el = findVisibleTarget(selector);
	if (!el) return null;
	const r = el.getBoundingClientRect();
	if (r.width < 2 || r.height < 2) return null;
	return {
		top: r.top - SPOTLIGHT_PAD,
		left: r.left - SPOTLIGHT_PAD,
		width: r.width + SPOTLIGHT_PAD * 2,
		height: r.height + SPOTLIGHT_PAD * 2,
		radius: Math.min(readRadius(el) + 6, 28),
	};
}

function resolveStepTarget(step: OnboardingStep): string | undefined {
	if (!step.target) return undefined;
	if (typeof document === 'undefined') return step.target;
	if (findVisibleTarget(step.target)) return step.target;
	/* Mobile / compact chrome fallbacks when nav targets are not mounted. */
	if (step.id === 'challenges') {
		const alt = '[data-tour="widget-work-hours"]';
		if (findVisibleTarget(alt)) return alt;
	}
	if (step.id === 'team-activity') {
		const alt = '[data-tour="dashboard-profile-thumbnail"]';
		if (findVisibleTarget(alt)) return alt;
	}
	return step.target;
}

function placeCard(
	rect: SpotlightRect | null,
	placement: OnboardingPlacement | undefined,
	cardH: number,
	cardWidth: number,
): React.CSSProperties {
	const vw = window.innerWidth;
	const vh = window.innerHeight;
	const margin = 16;
	const actualCardWidth = Math.min(cardWidth, vw - margin * 2);

	if (!rect || placement === 'center') {
		return {
			position: 'fixed',
			left: '50%',
			top: '50%',
			transform: 'translate(-50%, -50%)',
			width: `min(${cardWidth}px, calc(100vw - 32px))`,
		};
	}

	const prefer = placement ?? 'bottom';
	let top = rect.top + rect.height + CARD_GAP;
	let left = rect.left + rect.width / 2 - actualCardWidth / 2;

	if (prefer === 'top') {
		top = rect.top - cardH - CARD_GAP;
	} else if (prefer === 'left') {
		top = rect.top + rect.height / 2 - cardH / 2;
		left = rect.left - actualCardWidth - CARD_GAP;
	} else if (prefer === 'right') {
		top = rect.top + rect.height / 2 - cardH / 2;
		left = rect.left + rect.width + CARD_GAP;
	}

	/* Keep on screen; flip if needed. */
	if (prefer === 'bottom' && top + cardH > vh - margin) {
		top = rect.top - cardH - CARD_GAP;
	}
	if (prefer === 'top' && top < margin) {
		top = rect.top + rect.height + CARD_GAP;
	}
	if (prefer === 'right' && left + actualCardWidth > vw - margin) {
		left = rect.left - actualCardWidth - CARD_GAP;
	}
	if (prefer === 'left' && left < margin) {
		left = rect.left + rect.width + CARD_GAP;
	}

	left = Math.min(Math.max(margin, left), vw - actualCardWidth - margin);
	top = Math.min(Math.max(margin, top), Math.max(margin, vh - cardH - margin));

	return {
		position: 'fixed',
		top,
		left,
		width: `min(${cardWidth}px, calc(100vw - 32px))`,
	};
}

export default function DashboardOnboardingTour({
	steps = ONBOARDING_STEPS,
	shouldLaunch = shouldLaunchOnboarding,
	onMarkDone = markOnboardingDone,
}: {
	steps?: OnboardingStep[];
	shouldLaunch?: (searchParams: URLSearchParams) => boolean;
	onMarkDone?: () => void;
} = {}) {
	const router = useRouter();
	const searchParams = useSearchParams();
	const { role, loading: teamContextLoading } = useTeamMode();
	const usesDefaultSteps = steps === ONBOARDING_STEPS;
	const visibleSteps =
		usesDefaultSteps && role === 'member' ? EMPLOYEE_ONBOARDING_STEPS : steps;
	const [open, setOpen] = React.useState(false);
	const [stepIndex, setStepIndex] = React.useState(0);
	const [mounted, setMounted] = React.useState(false);
	const [rect, setRect] = React.useState<SpotlightRect | null>(null);
	const cardRef = React.useRef<HTMLDivElement>(null);
	const [cardHeight, setCardHeight] = React.useState(220);

	const step = visibleSteps[stepIndex];
	const isFirst = stepIndex <= 0;
	const isLast = stepIndex >= visibleSteps.length - 1;
	const Icon = step ? STEP_ICONS[step.icon] : Sparkles;
	const total = visibleSteps.length;

	const finish = React.useCallback(() => {
		requestOnboardingAccountMenu(false);
		document.documentElement.dataset.kronaOnboarding = '';
		delete document.documentElement.dataset.kronaOnboarding;
		onMarkDone();
		setOpen(false);
		if (searchParams.get(ONBOARDING_QUERY_PARAM) === '1') {
			const url = new URL(window.location.href);
			url.searchParams.delete(ONBOARDING_QUERY_PARAM);
			router.replace(url.pathname + (url.search ? url.search : ''), {
				scroll: false,
			});
		}
	}, [onMarkDone, router, searchParams]);

	const goNext = React.useCallback(() => {
		if (isLast) {
			finish();
			return;
		}
		setStepIndex((i) => Math.min(i + 1, visibleSteps.length - 1));
	}, [finish, isLast, visibleSteps.length]);

	const goPrev = React.useCallback(() => {
		setStepIndex((i) => Math.max(i - 1, 0));
	}, []);

	React.useEffect(() => {
		setMounted(true);
	}, []);

	React.useEffect(() => {
		if (!mounted || (usesDefaultSteps && teamContextLoading)) return;
		const params = new URLSearchParams(searchParams.toString());
		if (!shouldLaunch(params)) {
			setOpen(false);
			if (searchParams.get(ONBOARDING_QUERY_PARAM) === '1') {
				const url = new URL(window.location.href);
				url.searchParams.delete(ONBOARDING_QUERY_PARAM);
				router.replace(url.pathname + (url.search ? url.search : ''), {
					scroll: false,
				});
			}
			return;
		}
		const t = window.setTimeout(() => {
			setStepIndex(0);
			setOpen(true);
		}, 450);
		return () => window.clearTimeout(t);
	}, [
		mounted,
		searchParams,
		shouldLaunch,
		usesDefaultSteps,
		teamContextLoading,
		router,
	]);

	React.useEffect(() => {
		if (!open) {
			delete document.documentElement.dataset.kronaOnboarding;
			requestOnboardingAccountMenu(false);
			return;
		}
		document.documentElement.dataset.kronaOnboarding = 'true';
		return () => {
			delete document.documentElement.dataset.kronaOnboarding;
		};
	}, [open]);

	React.useEffect(() => {
		if (!open || !step) return;

		let cancelled = false;
		let frame = 0;
		let targetElement: Element | null = null;
		let targetObserver: ResizeObserver | null = null;

		requestOnboardingAccountMenu(Boolean(step.openAccountMenu));

		const updateCardHeight = () => {
			if (cardRef.current) {
				setCardHeight(cardRef.current.getBoundingClientRect().height || 220);
			}
		};

		const measure = (attempt = 0) => {
			if (cancelled) return;
			const target = resolveStepTarget(step);
			const el = findVisibleTarget(target);

			// Portalled menu content appears on the next frame. Retry without
			// adding an arbitrary delay to every onboarding step.
			if (target && !el && attempt < TARGET_RETRY_FRAMES) {
				frame = window.requestAnimationFrame(() => measure(attempt + 1));
				return;
			}

			if (el && el !== targetElement) {
				targetObserver?.disconnect();
				targetElement = el;
				targetObserver = new ResizeObserver(() => {
					if (cancelled) return;
					setRect(measureTarget(resolveStepTarget(step)));
				});
				targetObserver.observe(el);
			}

			if (el) {
				const bounds = el.getBoundingClientRect();
				const outsideViewport =
					bounds.top < 0 ||
					bounds.bottom > window.innerHeight ||
					bounds.left < 0 ||
					bounds.right > window.innerWidth;
				if (outsideViewport) {
					el.scrollIntoView({
						block: 'nearest',
						inline: 'nearest',
						behavior: 'auto',
					});
				}
			}

			setRect(measureTarget(target));
			updateCardHeight();
		};

		measure();

		const onResize = () => {
			setRect(measureTarget(resolveStepTarget(step)));
			updateCardHeight();
		};
		window.addEventListener('resize', onResize);
		window.addEventListener('scroll', onResize, true);

		return () => {
			cancelled = true;
			if (frame) window.cancelAnimationFrame(frame);
			targetObserver?.disconnect();
			window.removeEventListener('resize', onResize);
			window.removeEventListener('scroll', onResize, true);
		};
	}, [open, step, stepIndex]);

	React.useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') finish();
			if (e.key === 'ArrowRight' || e.key === 'Enter') goNext();
			if (e.key === 'ArrowLeft') goPrev();
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [open, finish, goNext, goPrev]);

	React.useLayoutEffect(() => {
		if (!open || !cardRef.current) return;
		setCardHeight(cardRef.current.getBoundingClientRect().height || 220);
	}, [open, stepIndex, rect]);

	if (!mounted || !open || !step) return null;

	const cardStyle = placeCard(
		rect,
		step.placement,
		cardHeight,
		CARD_WIDTH,
	);
	const hasSpot = Boolean(rect);

	return createPortal(
		<Box
			role="dialog"
			aria-modal="true"
			aria-labelledby="krona-onboarding-title"
			aria-describedby="krona-onboarding-body"
			sx={{
				position: 'fixed',
				inset: 0,
				zIndex: 2000,
				pointerEvents: 'auto',
			}}
		>
			{/* Dimmed backdrop with spotlight hole */}
			<Box
				aria-hidden
				onClick={finish}
				sx={{
					position: 'absolute',
					inset: 0,
					...(hasSpot && rect
						? {
								background: 'transparent',
								boxShadow: 'none',
							}
						: {
								background: 'rgba(0, 0, 0, 0.62)',
							}),
				}}
			>
				{hasSpot && rect ? (
					<Box
						sx={{
							position: 'fixed',
							top: rect.top,
							left: rect.left,
							width: rect.width,
							height: rect.height,
							borderRadius: `${rect.radius}px`,
							boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.62)',
							outline: '2px solid color-mix(in srgb, var(--krona-accent) 70%, transparent)',
							outlineOffset: 2,
							pointerEvents: 'none',
							transition:
								'top 0.14s ease-out, left 0.14s ease-out, width 0.14s ease-out, height 0.14s ease-out',
						}}
					/>
				) : null}
			</Box>

			{/* Step card */}
			<Box
				ref={cardRef}
				sx={{
					...cardStyle,
					zIndex: 2001,
					boxSizing: 'border-box',
					borderRadius: '24px',
					border: '1px solid var(--krona-surface-border)',
					background: 'var(--krona-dropdown-bg)',
					boxShadow: 'var(--krona-dropdown-shadow)',
					backdropFilter: 'blur(24px) saturate(180%)',
					WebkitBackdropFilter: 'blur(24px) saturate(180%)',
					p: 2.25,
					display: 'flex',
					flexDirection: 'column',
					pointerEvents: 'auto',
					transition: 'top 0.14s ease-out, left 0.14s ease-out',
				}}
				onClick={(e) => e.stopPropagation()}
			>
				<Box
					sx={{
						display: 'flex',
						alignItems: 'flex-start',
						justifyContent: 'space-between',
						gap: 1,
						mb: 1.25,
					}}
				>
					<Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
						<Box
							sx={{
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								width: 40,
								height: 40,
								borderRadius: '14px',
								border: '1px solid var(--krona-surface-border)',
								background: 'var(--krona-secondary-bg)',
								color: 'var(--krona-text)',
								flexShrink: 0,
							}}
						>
							<Icon size={20} strokeWidth={1.75} aria-hidden />
						</Box>
						<Typography
							level="body-xs"
							sx={{
								color: 'var(--krona-text-muted)',
								fontWeight: 600,
								letterSpacing: '0.02em',
							}}
						>
							{stepIndex + 1} of {total}
						</Typography>
					</Box>
					<Button
						size="sm"
						variant="plain"
						onClick={finish}
						sx={{
							minHeight: 24,
							px: 0.75,
							py: 0.25,
							color: 'var(--krona-text-muted)',
							fontSize: '0.7rem',
							fontWeight: 600,
							'&:hover': {
								bgcolor: 'var(--krona-secondary-bg)',
								color: 'var(--krona-text)',
							},
						}}
					>
						Skip
					</Button>
				</Box>

				<Typography
					id="krona-onboarding-title"
					level="title-md"
					sx={{
						color: 'var(--krona-text)',
						fontWeight: 600,
						mb: 0.5,
					}}
				>
					{step.title}
				</Typography>
				<Typography
					id="krona-onboarding-body"
					level="body-sm"
					sx={{
						color: 'var(--krona-text-muted)',
						lineHeight: 1.55,
						mb: 2,
					}}
				>
					{step.body}
				</Typography>

				<Box
					sx={{
						display: 'flex',
						alignItems: 'center',
						gap: 1,
						mt: 'auto',
					}}
				>
					{isFirst ? (
						null
					) : (
						<Button
							variant="outlined"
							onClick={goPrev}
							sx={{ ...kronaSecondaryButtonSx, flex: 1 }}
						>
							Back
						</Button>
					)}
					<Button onClick={goNext} sx={{ ...kronaPrimaryButtonSx, flex: 1 }}>
						{isLast ? 'Get started' : 'Next'}
					</Button>
				</Box>
			</Box>
		</Box>,
		document.body,
	);
}
