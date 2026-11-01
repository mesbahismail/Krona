'use client';

import * as React from 'react';
import type { Modifier, ModifierArguments } from '@popperjs/core';
import {
	Avatar,
	Box,
	Divider,
	IconButton,
	Menu,
	MenuItem,
	Typography,
} from '@mui/joy';
import {
	Briefcase,
	ChevronDown,
	CircleHelp,
	MessageSquare,
	Settings,
	Users,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import FeedbackModal from '@/components/FeedbackModal';
import { showKronaError } from '@/lib/kronaToast';
import KronaSwitch from '@/components/krona/KronaSwitch';
import { useVacationMode } from '@/components/VacationModeContext';
import { useTeamMode } from '@/components/teams/TeamModeContext';
import { localData } from '@/lib/localData';
import {
	KRONA_AVATAR_UPDATED,
	KRONA_PROFILE_IDENTITY_UPDATED,
} from '@/lib/kronaDataEvents';
import { composeFullName } from '@/lib/profileIdentity';
import {
	loadProfileAvatarUrl,
	resolveUserAvatarUrl,
	syncGoogleAvatarToProfile,
} from '@/lib/userAvatar';
import { isKronaOfficeOwner } from '@/lib/kronaOffice';
import {
	kronaMenuItemSx,
	kronaMenuSx,
	kronaTabBarSx,
	kronaTabButtonSx,
} from '@/lib/kronaStyles';
import { useKronaLayoutMode } from '@/components/KronaLayoutModeProvider';
import { ONBOARDING_ACCOUNT_MENU_EVENT } from '@/lib/onboarding';

const kronaMobileAccountMenuModifier: Modifier<
	'kronaMobileAccountMenu',
	Record<string, unknown>
> = {
	name: 'kronaMobileAccountMenu',
	enabled: true,
	phase: 'beforeWrite',
	fn({ state }: ModifierArguments<Record<string, unknown>>) {
		const popper = state.styles.popper;
		const rootStyles = getComputedStyle(document.documentElement);
		const topHeight = parseInt(
			rootStyles.getPropertyValue('--krona-top-height') || '60',
			10,
		);
		const aiPanelWidth =
			rootStyles.getPropertyValue('--krona-ai-panel-width').trim() || '0px';
		popper.position = 'fixed';
		popper.left = 'calc(var(--krona-sidebar-width) + 16px)';
		// Stay within the content column — never cover the AI sidebar.
		popper.right = `calc(${aiPanelWidth} + 16px)`;
		popper.width = 'auto';
		popper.maxWidth = 'none';
		popper.top = `${topHeight + 8}px`;
		popper.transform = 'none';
	},
};

export default function UserAccountControls({
	tourId = 'dashboard-account',
	onboardingTourEnabled = true,
}: {
	tourId?: string;
	/** Only the currently visible top-bar instance should react to tour events. */
	onboardingTourEnabled?: boolean;
}) {
	const router = useRouter();
	const { mode } = useKronaLayoutMode();
	/* Full-bleed menu only on the phone layout — tablet keeps a compact menu even
	 * with compact navigation. */
	const stretchAccountMenu = mode === 'mobile';
	const { active: vacationActive, setActive: setVacationActive } =
		useVacationMode();
	const {
		hasTeam,
		organization,
		canUseIndividualMode,
		mode: workspaceMode,
		setMode,
	} = useTeamMode();
	const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);
	const open = Boolean(anchorEl);
	const [feedbackOpen, setFeedbackOpen] = React.useState(false);
	const [label, setLabel] = React.useState('Alex Morgan');
	const firstName = label.trim().split(/\s+/)[0] || 'Alex';
	const [jobTitle, setJobTitle] = React.useState('');
	const [avatarUrl, setAvatarUrl] = React.useState<string | undefined>();
	const [showOffice, setShowOffice] = React.useState(false);
	const buttonRef = React.useRef<HTMLButtonElement>(null);
	const close = React.useCallback(() => setAnchorEl(null), []);

	const roleLabel = workspaceMode === 'team' ? 'Manager' : 'Employee';

	React.useEffect(() => {
		if (!onboardingTourEnabled) close();
	}, [close, onboardingTourEnabled]);

	React.useEffect(() => {
		if (!onboardingTourEnabled) return;
		const onTourMenu = (event: Event) => {
			const detail = (event as CustomEvent<{ open?: boolean }>).detail;
			if (detail?.open) {
				if (buttonRef.current) setAnchorEl(buttonRef.current);
			} else {
				close();
			}
		};
		window.addEventListener(ONBOARDING_ACCOUNT_MENU_EVENT, onTourMenu);
		return () =>
			window.removeEventListener(ONBOARDING_ACCOUNT_MENU_EVENT, onTourMenu);
	}, [close, onboardingTourEnabled]);

	React.useEffect(() => {
		if (!open) return;
		const onPointerDown = (e: PointerEvent) => {
			const target = e.target as HTMLElement | null;
			if (!target) return;
			if (anchorEl?.contains(target)) return;
			if (target.closest('[role="menu"]')) return;
			/* Keep menu open while the onboarding spotlight is active. */
			if (document.documentElement.dataset.kronaOnboarding === 'true') return;
			close();
		};
		document.addEventListener('pointerdown', onPointerDown, true);
		return () =>
			document.removeEventListener('pointerdown', onPointerDown, true);
	}, [open, anchorEl, close]);

	React.useEffect(() => {
		const loadAccount = async () => {
			try {
				const {
					data: { user },
				} = await localData.auth.getUser();
				if (!user) return;
				const meta = user.user_metadata as Record<string, unknown> | undefined;
				const email = user.email ?? '';
				setShowOffice(isKronaOfficeOwner(email));

				const synced = await syncGoogleAvatarToProfile({
					userId: user.id,
					metadata: meta,
				});
				const profileUrl = synced ?? (await loadProfileAvatarUrl(user.id));
				setAvatarUrl(
					resolveUserAvatarUrl({
						userId: user.id,
						email,
						profileAvatarUrl: profileUrl,
						metadata: meta,
					}),
				);

				const [{ data: personal }, { data: profile }, { data: membership }] =
					await Promise.all([
						localData
							.from('personal')
							.select('first_name, last_name, profession')
							.eq('user_id', user.id)
							.maybeSingle(),
						localData
							.from('profiles')
							.select('full_name, first_name, last_name')
							.eq('id', user.id)
							.maybeSingle(),
						organization?.id
							? localData
									.from('organization_members')
									.select('job_title')
									.eq('organization_id', organization.id)
									.eq('user_id', user.id)
									.eq('status', 'active')
									.maybeSingle()
							: Promise.resolve({ data: null }),
					]);

				const fromPersonalName = composeFullName(
					personal?.first_name,
					personal?.last_name,
				);
				const fromProfileName = composeFullName(
					profile?.first_name,
					profile?.last_name,
					profile?.full_name,
				);
				const fromMeta =
					(typeof meta?.full_name === 'string' && meta.full_name) ||
					(typeof meta?.name === 'string' && meta.name) ||
					composeFullName(
						typeof meta?.first_name === 'string' ? meta.first_name : '',
						typeof meta?.last_name === 'string' ? meta.last_name : '',
					);
				setLabel(
					fromPersonalName ||
						fromProfileName ||
						fromMeta ||
						email.split('@')[0] ||
						'Account',
				);

				const fromMembership =
					typeof membership?.job_title === 'string'
						? membership.job_title.trim()
						: '';
				const fromPersonal =
					typeof personal?.profession === 'string'
						? personal.profession.trim()
						: '';
				const fromMetaJob =
					(typeof meta?.job === 'string' && meta.job.trim()) ||
					(typeof meta?.profession === 'string' && meta.profession.trim()) ||
					'';
				setJobTitle(fromMembership || fromPersonal || fromMetaJob);
			} catch {
				/* ignore */
			}
		};
		void loadAccount();
		const onAvatar = (event: Event) => {
			const url = (event as CustomEvent<{ url?: string | null }>).detail?.url;
			if (url) setAvatarUrl(url);
			else void loadAccount();
		};
		const onIdentity = () => {
			void loadAccount();
		};
		window.addEventListener(KRONA_AVATAR_UPDATED, onAvatar);
		window.addEventListener(KRONA_PROFILE_IDENTITY_UPDATED, onIdentity);
		return () => {
			window.removeEventListener(KRONA_AVATAR_UPDATED, onAvatar);
			window.removeEventListener(KRONA_PROFILE_IDENTITY_UPDATED, onIdentity);
		};
	}, [organization?.id]);

	const goTo = (path: string) => {
		close();
		router.push(path);
	};

	return (
		<Box
			data-tour={onboardingTourEnabled ? tourId : undefined}
			className="krona-header-account"
			sx={{ display: 'inline-flex', flexShrink: 0 }}
		>
			<Box
				sx={{
					position: 'relative',
					display: 'inline-flex',
					flexShrink: 0,
					lineHeight: 0,
				}}
			>
				<IconButton
					className="krona-profile-trigger"
					ref={buttonRef}
					data-tour={
						onboardingTourEnabled ? 'dashboard-profile-thumbnail' : undefined
					}
					variant="plain"
					size="sm"
					aria-haspopup="menu"
					aria-expanded={open}
					aria-label={`${firstName}, account menu`}
					onClick={(event) =>
						setAnchorEl(anchorEl ? null : event.currentTarget)
					}
					sx={{
						display: 'inline-flex',
						alignItems: 'center',
						gap: 0.75,
						borderRadius: '999px',
						pl: '3px',
						pr: 1,
						height: 'var(--krona-control-height)',
						minHeight: 'var(--krona-control-height)',
						width: 'max-content',
						maxWidth: 'none',
						minWidth: 0,
						flexShrink: 0,
						border: '1px solid var(--krona-secondary-border)',
						background: 'var(--krona-secondary-bg)',
						color: 'var(--krona-text)',
						'&:hover': {
							background: 'var(--krona-secondary-bg)',
							opacity: 0.92,
						},
					}}
				>
					<Avatar
						src={avatarUrl}
						alt=""
						size="sm"
						sx={{ width: 24, height: 24, flexShrink: 0 }}
					/>
					<Typography
						component="span"
						level="body-sm"
						sx={{
							display: 'block',
							flexShrink: 0,
							maxWidth: { xs: 48, sm: 80 },
							overflow: 'hidden',
							textOverflow: 'ellipsis',
							whiteSpace: 'nowrap',
							fontSize: 13,
							fontWeight: 500,
							color: 'inherit',
						}}
					>
						{firstName}
					</Typography>
					<ChevronDown
						size={14}
						aria-hidden="true"
						style={{
							flexShrink: 0,
							transition: 'transform 150ms ease',
							transform: open ? 'rotate(180deg)' : undefined,
						}}
					/>
				</IconButton>
			</Box>
			<Menu
				anchorEl={anchorEl}
				open={open}
				onClose={() => close()}
				placement={stretchAccountMenu ? 'bottom' : 'bottom-end'}
				modifiers={[
					{
						name: 'offset',
						options: { offset: [0, stretchAccountMenu ? 8 : 20] },
					},
					...(stretchAccountMenu ? [kronaMobileAccountMenuModifier] : []),
				]}
				sx={{
					...kronaMenuSx,
					minWidth: stretchAccountMenu
						? 'calc(100vw - var(--krona-sidebar-width) - var(--krona-ai-panel-width, 0px) - 32px)'
						: Math.round(264 * 1.15),
					...(stretchAccountMenu
						? {
								width:
									'calc(100vw - var(--krona-sidebar-width) - var(--krona-ai-panel-width, 0px) - 32px)',
								maxWidth:
									'calc(100vw - var(--krona-sidebar-width) - var(--krona-ai-panel-width, 0px) - 32px)',
							}
						: {}),
					'--List-padding': '8px',
				}}
			>
				<Box sx={{ px: 2, py: 1.25 }}>
					<Typography
						level="title-md"
						sx={{
							color: 'var(--krona-text)',
							fontWeight: 600,
							fontSize: '1.125rem',
							lineHeight: 1.3,
						}}
					>
						{label || '—'}
					</Typography>
					{jobTitle ? (
						<Typography
							level="body-sm"
							sx={{
								color: 'var(--krona-text-muted)',
								mt: 0.25,
								lineHeight: 1.35,
							}}
						>
							{jobTitle}
						</Typography>
					) : null}
					{roleLabel ? (
						<Box
							component="span"
							sx={{
								display: 'flex',
								alignItems: 'center',
								width: 'fit-content',
								maxWidth: '100%',
								mt: '4px',
								px: 0.75,
								py: 0.2,
								borderRadius: '999px',
								fontSize: '0.6875rem',
								fontWeight: 600,
								lineHeight: 1.3,
								color: '#fff',
								background: 'var(--krona-accent-gradient)',
							}}
						>
							{roleLabel}
						</Box>
					) : null}
					{hasTeam && canUseIndividualMode ? (
						<Box
							sx={{ mt: 1.25 }}
							data-tour="dashboard-workspace"
							onClick={(e) => e.stopPropagation()}
						>
							<Box role="group" aria-label="Workspace" sx={kronaTabBarSx}>
								{(
									[
										{ id: 'team' as const, label: 'Manager' },
										{ id: 'individual' as const, label: 'Employee' },
									] as const
								).map((opt) => {
									const selected = workspaceMode === opt.id;
									return (
										<Box
											key={opt.id}
											component="button"
											type="button"
											aria-pressed={selected}
											onClick={() => {
												void setMode(opt.id)
													.then(() => close())
													.catch(() =>
														showKronaError(
															'Could not switch the preview view. Please try again.',
														),
													);
											}}
											sx={kronaTabButtonSx(selected)}
										>
											{opt.label}
										</Box>
									);
								})}
							</Box>
						</Box>
					) : null}
				</Box>
				<Divider sx={{ borderColor: 'var(--krona-surface-border)' }} />
				<MenuItem
					onClick={() => goTo('/settings?tab=account')}
					sx={{
						...kronaMenuItemSx,
						color: 'var(--krona-text)',
						fontSize: '14px',
					}}
				>
					<Settings size={14} style={{ marginRight: 8 }} />
					Account Settings
				</MenuItem>
				{showOffice ? (
					<MenuItem
						onClick={() => goTo('/office')}
						sx={{
							...kronaMenuItemSx,
							color: 'var(--krona-text)',
							fontSize: '14px',
						}}
					>
						<Briefcase size={14} style={{ marginRight: 8 }} />
						Krona Office
					</MenuItem>
				) : null}
				{!hasTeam ? (
					<MenuItem
						onClick={() => goTo('/teams/get-started')}
						sx={{
							...kronaMenuItemSx,
							color: 'var(--krona-text)',
							fontSize: '14px',
						}}
					>
						<Users size={14} style={{ marginRight: 8 }} />
						Start Krona Teams
					</MenuItem>
				) : null}
				<MenuItem
					onClick={() => goTo('/help')}
					sx={{
						...kronaMenuItemSx,
						color: 'var(--krona-text)',
						fontSize: '14px',
					}}
				>
					<CircleHelp size={14} style={{ marginRight: 8 }} />
					Help Center
				</MenuItem>
				<MenuItem
					onClick={() => {
						close();
						setFeedbackOpen(true);
					}}
					sx={{
						...kronaMenuItemSx,
						color: 'var(--krona-text)',
						fontSize: '14px',
					}}
				>
					<MessageSquare size={14} style={{ marginRight: 8 }} />
					Feedback
				</MenuItem>
				<Divider sx={{ borderColor: 'var(--krona-surface-border)' }} />
				<Box
					sx={{
						px: 2,
						py: 1.25,
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'space-between',
						gap: 2,
					}}
					onClick={(e) => e.stopPropagation()}
				>
					<Typography
						level="body-sm"
						sx={{ color: 'var(--krona-text)', fontSize: '14px' }}
					>
						Vacation mode
					</Typography>
					<KronaSwitch
						checked={vacationActive}
						onChange={(next) => void setVacationActive(next)}
						aria-label="Vacation mode"
					/>
				</Box>
			</Menu>
			<FeedbackModal
				open={feedbackOpen}
				onClose={() => setFeedbackOpen(false)}
			/>
		</Box>
	);
}
