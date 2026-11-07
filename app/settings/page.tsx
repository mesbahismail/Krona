'use client';

import * as React from 'react';
import { Suspense, useEffect } from 'react';
import { CssVarsProvider, extendTheme } from '@mui/joy/styles';
import CssBaseline from '@mui/joy/CssBaseline';
import Box from '@mui/joy/Box';
import Typography from '@mui/joy/Typography';
import Button from '@mui/joy/Button';
import Sheet from '@mui/joy/Sheet';
import IconButton from '@mui/joy/IconButton';
import Input from '@mui/joy/Input';
import Divider from '@mui/joy/Divider';
import Modal from '@mui/joy/Modal';
import KronaSwitch from '@/components/krona/KronaSwitch';
import ModalDialog from '@mui/joy/ModalDialog';

import { SettingsPageSkeleton } from '@/components/krona/KronaPageSkeletons';
import Background from '@/components/Background';
import Top from '@/components/Top';
import { usePomodoroTimer } from '@/components/PomodoroContext';
import {
	hydratePomodoroPreferencesFromDb,
	persistPomodoroPreferences,
	readPomodoroPreferences,
} from '@/lib/pomodoroPreferences';
import {
	hydrateNotificationPreferencesFromDb,
	persistNotificationPreferences,
	readNotificationPreferences,
} from '@/lib/notificationPreferences';
import { kronaPlaceholders } from '@/lib/kronaPlaceholders';
import {
	playTimerPeriodBell,
	primeTimerAlertAudio,
} from '@/lib/timerAlertSound';
import { ensureBrowserNotificationPermission } from '@/lib/browserNotifications';
import {
	playNotificationSoundPreview,
	primeNotificationAudio,
} from '@/lib/notificationSound';
import {
	kronaModalCloseButtonSx,
	kronaModalDialogSx,
	kronaPrimaryButtonSx,
	kronaSecondaryButtonSx,
	kronaSettingsButtonSx,
	kronaSettingsFieldSx,
	kronaSettingsInputSx,
	kronaSettingsPanelSx,
	kronaSettingsTabButtonSx,
} from '@/lib/kronaStyles';
import { localData } from '@/lib/localData';
import { useRouter, useSearchParams } from 'next/navigation';
import {
	loadPersonalProfile,
	savePersonalProfile,
} from '@/lib/userAppSettings';
import {
	showKronaError,
	showKronaSuccess,
	showKronaToast,
} from '@/lib/kronaToast';
import { KRONA_JOY_PRIMARY } from '@/lib/kronaAccent';
import TeamSettingsPanel from '@/components/settings/TeamSettingsPanel';
import { useTeamMode } from '@/components/teams/TeamModeContext';
import AccountAvatarField from '@/components/settings/AccountAvatarField';
import KronaThemePicker from '@/components/KronaThemePicker';
import {
	Building2,
	User,
	X,
	Clock3,
	SlidersHorizontal,
} from 'lucide-react';

// Rename the MUI theme constant to avoid conflict
const joyTheme = extendTheme({
	colorSchemes: {
		light: {
			palette: {
				primary: KRONA_JOY_PRIMARY,
			},
		},
		dark: {
			palette: {
				primary: KRONA_JOY_PRIMARY,
			},
		},
	},
	fontFamily: {
		display: 'Poppins, sans-serif',
		body: 'Poppins, sans-serif',
	},
});

const SETTINGS_TABS = [
	{
		label: 'General',
		mobileLabel: 'General',
		icon: <SlidersHorizontal size={18} />,
	},
	{
		label: 'Account Settings',
		mobileLabel: 'Account',
		icon: <User size={18} />,
	},
	{
		label: 'Team Settings',
		mobileLabel: 'Team',
		icon: <Building2 size={18} />,
	},
	{ label: 'Timer', mobileLabel: 'Timer', icon: <Clock3 size={18} /> },
];

const SETTINGS_ACCOUNT_TAB_INDEX = 1;
const SETTINGS_TEAM_TAB_INDEX = 2;
const SETTINGS_TIMER_TAB_INDEX = 3;

const SETTINGS_TAB_QUERY_PARAMS = [
	'general',
	'account',
	'team',
	'timer',
] as const;

function settingsTabIndexFromQuery(tabParam: string | null): number | null {
	if (!tabParam) return null;
	// Keep old notification links working after moving them into General.
	if (tabParam === 'general' || tabParam === 'notifications') return 0;
	if (tabParam === 'account' || tabParam === 'profile')
		return SETTINGS_ACCOUNT_TAB_INDEX;
	if (tabParam === 'timer') return SETTINGS_TIMER_TAB_INDEX;
	if (tabParam === 'team' || tabParam === 'teams') return SETTINGS_TEAM_TAB_INDEX;
	return null;
}

type AccountBaseline = {
	name: string;
	email: string;
	job: string;
	country: string;
	workHoursDaily: string;
};
type AccountUnsavedAction = 'tab' | 'leave';

function SettingsField({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<Box sx={kronaSettingsFieldSx}>
			<Typography
				level="body-sm"
				sx={{ color: 'var(--krona-text-muted)', fontWeight: 500 }}
			>
				{label}
			</Typography>
			{children}
		</Box>
	);
}

function OpenSettingsTabFromQuery({
	applyTabFromUrlRef,
}: {
	applyTabFromUrlRef: React.MutableRefObject<(n: number) => void>;
}) {
	const searchParams = useSearchParams();
	useEffect(() => {
		const idx = settingsTabIndexFromQuery(searchParams.get('tab'));
		if (idx != null) {
			applyTabFromUrlRef.current(idx);
		}
	}, [searchParams, applyTabFromUrlRef]);
	return null;
}

export default function App() {
	const router = useRouter();
	const {
		hasTeam,
		isOwner,
		organization,
		loading: teamLoading,
	} = useTeamMode();
	const canSeeTeamSettings = isOwner;
	const emailLockedByOwner = hasTeam && !isOwner;
	const [tab, setTab] = React.useState(0);
	const [name, setName] = React.useState('John Doe');
	const [email, setEmail] = React.useState('john@example.com');
	const [job, setJob] = React.useState('');
	const [country, setCountry] = React.useState('');
	const [workHoursDaily, setWorkHoursDaily] = React.useState('');
	const [background, setBackground] = React.useState('default');
	const { durations, setDurations, timerStyle, setTimerStyle } =
		usePomodoroTimer();

	// Notification settings
	// Notification preferences (moved to tab 0)
	const [allowAllNotifications, setAllowAllNotifications] =
		React.useState(true);
	const [allowSound, setAllowSound] = React.useState(true);
	const [notifyTimer, setNotifyTimer] = React.useState(true);
	const [notifyReminders, setNotifyReminders] = React.useState(true);
	const [notifyDeadlines, setNotifyDeadlines] = React.useState(true);
	const [notifyTaskComplete, setNotifyTaskComplete] = React.useState(true);
	const [workMinutes, setWorkMinutes] = React.useState(durations.workMinutes);
	const [shortBreakMinutes, setShortBreakMinutes] = React.useState(
		durations.breakMinutes,
	);
	const [longBreakMinutes, setLongBreakMinutes] = React.useState(
		durations.longBreakMinutes,
	);
	const [timerModeDraft, setTimerModeDraft] = React.useState(timerStyle);
	const [timerSaved, setTimerSaved] = React.useState(false);
	const [autoAdvance, setAutoAdvance] = React.useState(true);
	const [accountSaving, setAccountSaving] = React.useState(false);
	const [accountLoaded, setAccountLoaded] = React.useState(false);
	const [accountBaseline, setAccountBaseline] = React.useState<AccountBaseline>(
		{
			name: '',
			email: '',
			job: '',
			country: '',
			workHoursDaily: '',
		},
	);
	const [unsavedModalOpen, setUnsavedModalOpen] = React.useState(false);
	const [unsavedAction, setUnsavedAction] =
		React.useState<AccountUnsavedAction>('tab');
	const [pendingTab, setPendingTab] = React.useState<number | null>(null);
	const accountDirtyToastShownRef = React.useRef(false);

	React.useEffect(() => {
		void (async () => {
			try {
				const {
					data: { user },
				} = await localData.auth.getUser();
				if (!user) return;

				await hydratePomodoroPreferencesFromDb();
				await hydrateNotificationPreferencesFromDb();
				const prefs = readPomodoroPreferences();
				setAllowSound(prefs.allowSound);
				setNotifyTimer(prefs.notifyTimer);
				setAutoAdvance(prefs.autoAdvance);

				const notifPrefs = readNotificationPreferences();
				setAllowAllNotifications(notifPrefs.allowAll);
				setNotifyReminders(notifPrefs.notifyReminders);
				setNotifyDeadlines(notifPrefs.notifyDeadlines);
				setNotifyTaskComplete(notifPrefs.notifyTaskComplete);

				const profile = await loadPersonalProfile(user.id);
				const { data: membership } = organization?.id
					? await localData
							.from('organization_members')
							.select('job_title')
							.eq('organization_id', organization.id)
							.eq('user_id', user.id)
							.eq('status', 'active')
							.maybeSingle()
					: { data: null };
				const meta = user.user_metadata as Record<string, unknown> | undefined;
				let loadedName = '';
				let loadedEmail = user.email || '';
				let loadedJob = '';
				let loadedCountry = '';
				let loadedWorkHours = '';
				if (profile) {
					const full = `${profile.first_name} ${profile.last_name}`.trim();
					loadedName = full || user.email?.split('@')[0] || '';
					loadedEmail = profile.email_address || user.email || '';
					loadedJob = profile.profession?.trim() || '';
					loadedCountry = profile.country?.trim() || '';
					const hours = Number(profile.work_hours_target_daily);
					loadedWorkHours =
						Number.isFinite(hours) && hours > 0 ? String(hours) : '';
				}
				if (!loadedName) {
					loadedName =
						(typeof meta?.full_name === 'string' && meta.full_name.trim()) ||
						user.email?.split('@')[0] ||
						'';
				}
				if (!loadedJob) {
					loadedJob =
						(typeof membership?.job_title === 'string' &&
							membership.job_title.trim()) ||
						(typeof meta?.job === 'string' && meta.job.trim()) ||
						(typeof meta?.profession === 'string' && meta.profession.trim()) ||
						'';
				}
				setName(loadedName);
				setEmail(loadedEmail);
				setJob(loadedJob);
				setCountry(loadedCountry);
				setWorkHoursDaily(loadedWorkHours);
				setAccountBaseline({
					name: loadedName,
					email: loadedEmail,
					job: loadedJob,
					country: loadedCountry,
					workHoursDaily: loadedWorkHours,
				});
				accountDirtyToastShownRef.current = false;
			} catch {
				/* ignore */
			} finally {
				setAccountLoaded(true);
			}
		})();
	}, [organization?.id]);

	const persistNotificationSettings = React.useCallback(
		(patch: {
			allowAll?: boolean;
			notifyReminders?: boolean;
			notifyDeadlines?: boolean;
			notifyTaskComplete?: boolean;
		}) => {
			persistNotificationPreferences(patch);
		},
		[],
	);

	const handleSaveAccount = async () => {
		setAccountSaving(true);
		try {
			const {
				data: { user },
			} = await localData.auth.getUser();
			if (!user) {
				showKronaError('You must be signed in to save account settings.');
				return;
			}

			const parts = name.trim().split(/\s+/);
			const firstName = parts[0] || '';
			const lastName = parts.slice(1).join(' ') || '';

			const workHoursRaw = workHoursDaily.trim();
			let workHoursTargetDaily = 0;
			if (workHoursRaw) {
				const parsed = Number(workHoursRaw);
				if (Number.isNaN(parsed) || parsed < 0 || parsed > 24) {
					showKronaError('Daily work hours must be between 0 and 24.');
					return;
				}
				workHoursTargetDaily = parsed;
			}

			const savedJob = job.trim();
			const savedCountry = country.trim();
			const savedWorkHours =
				workHoursTargetDaily > 0 ? String(workHoursTargetDaily) : '';

			const savedEmail = emailLockedByOwner
				? accountBaseline.email.trim() || user.email || ''
				: email.trim();

			const saved = await savePersonalProfile(user.id, {
				firstName,
				lastName,
				email: savedEmail,
				profession: savedJob,
				country: savedCountry,
				workHoursTargetDaily,
			});
			if (!saved) {
				showKronaError('Could not save profile. Please try again.');
				return;
			}

			if (
				!emailLockedByOwner &&
				savedEmail &&
				savedEmail !== user.email
			) {
				const { error } = await localData.auth.updateUser({
					email: savedEmail,
				});
				if (error) {
					showKronaError(error.message);
					return;
				}
			}

			const savedName = name.trim();
			setEmail(savedEmail);
			setJob(savedJob);
			setCountry(savedCountry);
			setWorkHoursDaily(savedWorkHours);
			setAccountBaseline({
				name: savedName,
				email: savedEmail,
				job: savedJob,
				country: savedCountry,
				workHoursDaily: savedWorkHours,
			});
			accountDirtyToastShownRef.current = false;
			showKronaSuccess('Account settings saved.');
		} finally {
			setAccountSaving(false);
		}
	};

	const accountDirty = React.useMemo(() => {
		if (!accountLoaded) return false;
		return (
			name.trim() !== accountBaseline.name.trim() ||
			email.trim() !== accountBaseline.email.trim() ||
			job.trim() !== accountBaseline.job.trim() ||
			country.trim() !== accountBaseline.country.trim() ||
			workHoursDaily.trim() !== accountBaseline.workHoursDaily.trim()
		);
	}, [
		accountLoaded,
		name,
		email,
		job,
		country,
		workHoursDaily,
		accountBaseline,
	]);

	const resetAccountForm = React.useCallback(() => {
		setName(accountBaseline.name);
		setEmail(accountBaseline.email);
		setJob(accountBaseline.job);
		setCountry(accountBaseline.country);
		setWorkHoursDaily(accountBaseline.workHoursDaily);
		accountDirtyToastShownRef.current = false;
	}, [accountBaseline]);

	React.useEffect(() => {
		if (!accountDirty) {
			accountDirtyToastShownRef.current = false;
			return;
		}
		if (accountDirtyToastShownRef.current) return;
		accountDirtyToastShownRef.current = true;
		showKronaToast('You have unsaved account changes.');
	}, [accountDirty]);

	React.useEffect(() => {
		const onBeforeUnload = (event: BeforeUnloadEvent) => {
			if (!accountDirty) return;
			event.preventDefault();
			event.returnValue = '';
		};
		window.addEventListener('beforeunload', onBeforeUnload);
		return () => window.removeEventListener('beforeunload', onBeforeUnload);
	}, [accountDirty]);

	const applyTabChange = React.useCallback(
		(nextTab: number) => {
			setTab(nextTab);
			const param = SETTINGS_TAB_QUERY_PARAMS[nextTab];
			if (param) {
				router.replace(`/settings?tab=${param}`, { scroll: false });
			}
		},
		[router],
	);

	const applyTabFromUrlRef = React.useRef(applyTabChange);
	applyTabFromUrlRef.current = applyTabChange;

	React.useEffect(() => {
		if (teamLoading) return;
		if (tab === SETTINGS_TEAM_TAB_INDEX && !canSeeTeamSettings) {
			setTab(0);
		}
	}, [canSeeTeamSettings, tab, teamLoading]);

	const requestTabChange = React.useCallback(
		(nextTab: number) => {
			if (
				tab === SETTINGS_ACCOUNT_TAB_INDEX &&
				accountDirty &&
				nextTab !== SETTINGS_ACCOUNT_TAB_INDEX
			) {
				setUnsavedAction('tab');
				setPendingTab(nextTab);
				setUnsavedModalOpen(true);
				return;
			}
			applyTabChange(nextTab);
		},
		[tab, accountDirty, applyTabChange],
	);

	const requestLeaveSettings = React.useCallback(() => {
		if (tab === SETTINGS_ACCOUNT_TAB_INDEX && accountDirty) {
			setUnsavedAction('leave');
			setPendingTab(null);
			setUnsavedModalOpen(true);
			return;
		}
		router.push('/');
	}, [tab, accountDirty, router]);

	const confirmDiscardAccountChanges = () => {
		setUnsavedModalOpen(false);
		resetAccountForm();

		if (unsavedAction === 'tab' && pendingTab != null) {
			applyTabChange(pendingTab);
			setPendingTab(null);
			return;
		}

		if (unsavedAction === 'leave') {
			router.push('/');
			return;
		}
	};

	React.useEffect(() => {
		setWorkMinutes(durations.workMinutes);
		setShortBreakMinutes(durations.breakMinutes);
		setLongBreakMinutes(durations.longBreakMinutes);
	}, [
		durations.workMinutes,
		durations.breakMinutes,
		durations.longBreakMinutes,
	]);

	React.useEffect(() => {
		setTimerModeDraft(timerStyle);
	}, [timerStyle]);

	const handleSaveTimerSettings = () => {
		setTimerStyle(timerModeDraft);
		if (timerModeDraft === 'pomodoro') {
			setDurations({
				workMinutes: Math.max(1, Number(workMinutes) || 1),
				breakMinutes: Math.max(1, Number(shortBreakMinutes) || 1),
				longBreakMinutes: Math.max(1, Number(longBreakMinutes) || 1),
			});
			persistPomodoroPreferences({ autoAdvance });
		}
		setTimerSaved(true);
		window.setTimeout(() => setTimerSaved(false), 1500);
	};

	const handleAllowSoundChange = (checked: boolean) => {
		setAllowSound(checked);
		persistPomodoroPreferences({ allowSound: checked });
	};

	const handleNotifyTimerChange = (checked: boolean) => {
		setNotifyTimer(checked);
		persistPomodoroPreferences({ notifyTimer: checked });
		if (checked && allowAllNotifications) {
			void ensureBrowserNotificationPermission();
		}
	};

	const handleAutoAdvanceChange = (checked: boolean) => {
		setAutoAdvance(checked);
		persistPomodoroPreferences({ autoAdvance: checked });
	};

	const handleAllowAllNotificationsChange = (checked: boolean) => {
		setAllowAllNotifications(checked);
		persistNotificationSettings({ allowAll: checked });
		if (checked) {
			void ensureBrowserNotificationPermission();
		}
	};

	const handleNotifyRemindersChange = (checked: boolean) => {
		setNotifyReminders(checked);
		persistNotificationSettings({ notifyReminders: checked });
		if (checked && allowAllNotifications) {
			void ensureBrowserNotificationPermission();
		}
	};

	const handleNotifyDeadlinesChange = (checked: boolean) => {
		setNotifyDeadlines(checked);
		persistNotificationSettings({ notifyDeadlines: checked });
	};

	const handleNotifyTaskCompleteChange = (checked: boolean) => {
		setNotifyTaskComplete(checked);
		persistNotificationSettings({ notifyTaskComplete: checked });
	};

	const handleToggle = (
		setter: React.Dispatch<React.SetStateAction<boolean>>,
	) => setter((v) => !v);

	const backgrounds = [
		{ id: 'default', name: 'Default', preview: '/backgrounds/default.jpg' },
		{
			id: 'gradient1',
			name: 'Purple Gradient',
			preview: '/backgrounds/gradient1.jpg',
		},
		{
			id: 'gradient2',
			name: 'Blue Gradient',
			preview: '/backgrounds/gradient2.jpg',
		},
		{ id: 'space', name: 'Space', preview: '/backgrounds/space.jpg' },
		{ id: 'minimal', name: 'Minimal', preview: '/backgrounds/minimal.jpg' },
	];

	// Removed: old notificationOptions in favor of explicit toggles above

	return (
		<CssVarsProvider theme={joyTheme}>
			<CssBaseline />
			<Suspense fallback={null}>
				<OpenSettingsTabFromQuery applyTabFromUrlRef={applyTabFromUrlRef} />
			</Suspense>
			<Box
				sx={{
					display: 'flex',
					minHeight: '100vh',
					bgcolor: 'transparent',
					position: 'relative',
					overflow: 'hidden',
				}}
			>
				{/* Background */}
				<Background />

				{/* Main Content */}
				<Box
					className="krona-main-content"
					sx={{
						flex: 1,
						display: 'flex',
						flexDirection: 'column',
						position: 'relative',
						zIndex: 1,
					}}
				>
					{/* Top Bar */}
					<Top title="Settings" onBack={requestLeaveSettings} />

					{/* Settings Section */}
					<Box
						sx={{
							flex: 1,
							display: 'flex',
							justifyContent: 'flex-start',
							alignItems: 'stretch',
							width: '100%',
							px: 0,
							py: 0,
						}}
					>
						{!accountLoaded ? (
							<SettingsPageSkeleton />
						) : (
							<Box
								sx={{
									display: 'flex',
									flexDirection: 'column',
									width: '100%',
									alignItems: 'stretch',
									gap: { xs: 2, md: 2.5 },
								}}
							>
								{/* Horizontal tabs */}
								<Box
									sx={{
										width: '100%',
										flexShrink: 0,
										display: 'flex',
										justifyContent: 'flex-start',
										alignItems: 'center',
										gap: 1,
										flexWrap: 'wrap',
									}}
								>
									{SETTINGS_TABS.map((tabItem, idx) => (
										(idx === SETTINGS_TEAM_TAB_INDEX && !canSeeTeamSettings) ? null : (
										<Button
											key={tabItem.label}
											size="sm"
											variant={tab === idx ? 'solid' : 'plain'}
											startDecorator={tabItem.icon}
											onClick={() => requestTabChange(idx)}
											sx={{
												...kronaSettingsTabButtonSx(tab === idx),
												'--Button-gap': '8px',
												ml: 0,
											}}
										>
											<Box
												component="span"
												sx={{ display: { xs: 'none', sm: 'inline' } }}
											>
												{tabItem.label}
											</Box>
											<Box
												component="span"
												sx={{ display: { xs: 'inline', sm: 'none' } }}
											>
												{tabItem.mobileLabel}
											</Box>
										</Button>
										)
									))}
								</Box>

								{/* Settings Content */}
								<Sheet
									sx={{
										...kronaSettingsPanelSx,
										flex: 1,
										minWidth: 0,
										width: '100%',
										p: { xs: 2, md: 3 },
										display: 'flex',
										flexDirection: 'column',
										gap: 3,
										alignSelf: 'stretch',
										alignItems: 'stretch',
									}}
								>
									{/* General settings */}
									{tab === 0 && (
										<>
											<Typography
												level="h4"
												sx={{ mb: 2, color: 'var(--krona-text)' }}
											>
												General Settings
											</Typography>

											<Box
												sx={{
													width: '100%',
													maxWidth: { xs: '100%', md: 480 },
													bgcolor: 'var(--krona-widget-bg)',
													borderRadius: '24px',
													border: '1px solid var(--krona-surface-border)',
												}}
											>
												<KronaThemePicker />
											</Box>

											<Divider sx={{ my: 1 }} />

											<Typography
												level="title-md"
												sx={{ color: 'var(--krona-text)', fontWeight: 600 }}
											>
												Notifications
											</Typography>

											{/* Allow Notifications */}
											<Box
												sx={{
													p: 2,
													bgcolor: 'var(--krona-accent-16)',
													borderRadius: '24px',
													border: '1px solid var(--krona-accent-28)',
													display: 'flex',
													justifyContent: 'space-between',
													alignItems: 'center',
													width: '100%',
													maxWidth: { xs: '100%', md: 480 },
												}}
											>
												<Box>
													<Typography
														level="body-md"
														sx={{ color: 'var(--krona-text)', fontWeight: 600 }}
													>
														Allow Notifications
													</Typography>
													<Typography
														level="body-sm"
														sx={{ color: 'var(--krona-text-muted)' }}
													>
														Enable browser alerts, sounds, and in-app toasts
													</Typography>
												</Box>
												<KronaSwitch
													checked={allowAllNotifications}
													onChange={handleAllowAllNotificationsChange}
												/>
											</Box>

											<Divider sx={{ my: 1 }} />

											{/* Toggles */}
											<Box
												sx={{
													display: 'flex',
													flexDirection: 'column',
													gap: 2,
													width: '100%',
													maxWidth: { xs: '100%', md: 480 },
												}}
											>
												{[
													{
														label: 'Allow Sound',
														desc: 'Play notification chimes and timer bells',
														value: allowSound,
														onToggle: () => handleAllowSoundChange(!allowSound),
													},
													{
														label: 'Timer Alerts',
														desc: 'Bell and browser alert when a work or rest period finishes',
														value: notifyTimer,
														onToggle: () =>
															handleNotifyTimerChange(!notifyTimer),
													},
													{
														label: 'Reminders',
														desc: 'Browser alert and chime when a reminder becomes due',
														value: notifyReminders,
														onToggle: () =>
															handleNotifyRemindersChange(!notifyReminders),
													},
													{
														label: 'Deadlines',
														desc: 'Chime when a task deadline is due',
														value: notifyDeadlines,
														onToggle: () =>
															handleNotifyDeadlinesChange(!notifyDeadlines),
													},
													{
														label: 'Task completion',
														desc: 'Chime when you check a task as done',
														value: notifyTaskComplete,
														onToggle: () =>
															handleNotifyTaskCompleteChange(
																!notifyTaskComplete,
															),
													},
												].map((row) => (
													<Box
														key={row.label}
														sx={{
															p: 2,
															bgcolor: 'var(--krona-widget-bg)',
															borderRadius: '24px',
														border: '1px solid var(--krona-surface-border)',
															display: 'flex',
															justifyContent: 'space-between',
															alignItems: 'center',
															opacity: allowAllNotifications ? 1 : 0.5,
															pointerEvents: allowAllNotifications
																? 'auto'
																: 'none',
														}}
													>
														<Box>
															<Typography
																level="body-md"
																sx={{
																	color: 'var(--krona-text)',
																	fontWeight: 600,
																	mb: 0.5,
																}}
															>
																{row.label}
															</Typography>
															<Typography
																level="body-sm"
																sx={{ color: 'var(--krona-text-muted)' }}
															>
																{row.desc}
															</Typography>
														</Box>
														<KronaSwitch
															checked={row.value}
															onChange={() => row.onToggle()}
															disabled={!allowAllNotifications}
														/>
													</Box>
												))}
											</Box>
											<Button
												variant="outlined"
												onClick={() => {
													primeNotificationAudio();
													playNotificationSoundPreview();
												}}
												sx={{
													...kronaSettingsButtonSx,
													mt: 2,
													borderRadius: '999px',
													color: 'var(--krona-text)',
														border: '1px solid var(--krona-surface-border)',
													'&:hover': { bgcolor: 'var(--krona-secondary-bg)' },
												}}
											>
												Test notification sound
											</Button>
										</>
									)}

									{/* Notifications Tab (disabled - moved to first tab) */}
									{tab === -1 && (
										<>
											<Typography
												level="h4"
												sx={{ mb: 2, color: 'var(--krona-text)' }}
											>
												Notifications
											</Typography>

											{/* Allow All Toggle */}
											<Box
												sx={{
													p: 2,
													bgcolor: 'var(--krona-accent-16)',
													borderRadius: '24px', // Fully round
													border: '1px solid var(--krona-accent-28)',
													display: 'flex',
													justifyContent: 'space-between',
													alignItems: 'center',
												}}
											>
												<Box>
													<Typography
														level="body-md"
														sx={{ color: 'var(--krona-text)', fontWeight: 600 }}
													>
														Allow All Notifications
													</Typography>
													<Typography
														level="body-sm"
														sx={{ color: 'var(--krona-text-muted)' }}
													>
														Enable browser alerts, sounds, and in-app toasts
													</Typography>
												</Box>
												<KronaSwitch
													checked={allowAllNotifications}
													onChange={handleAllowAllNotificationsChange}
												/>
											</Box>

											<Divider sx={{ my: 1 }} />

											{/* Disabled old Notifications content */}
											<Box />
										</>
									)}

									{/* Account Tab */}
									{tab === SETTINGS_ACCOUNT_TAB_INDEX && (
										<>
											<Box
												sx={{
													display: 'flex',
													alignItems: 'center',
													justifyContent: 'space-between',
													gap: 1,
													mb: 2,
												}}
											>
												<Typography
													level="h4"
													sx={{ color: 'var(--krona-text)', m: 0 }}
												>
													Account Settings
												</Typography>
											</Box>
											<Box
												sx={{
													display: 'flex',
													flexDirection: 'column',
													gap: 1.5,
													width: '100%',
												}}
											>
												<SettingsField label="Profile photo">
													<AccountAvatarField />
												</SettingsField>
												<SettingsField label="Name">
													<Input
														placeholder={kronaPlaceholders.settings.name}
														value={name}
														onChange={(e) => setName(e.target.value)}
														sx={{
															...kronaSettingsInputSx,
															color: 'var(--krona-text)',
															'& input': { color: 'var(--krona-text)' },
														}}
													/>
												</SettingsField>
												<SettingsField label="Email">
													<Input
														placeholder={kronaPlaceholders.settings.email}
														value={email}
														disabled={emailLockedByOwner}
														onChange={(e) => {
															if (emailLockedByOwner) return;
															setEmail(e.target.value);
														}}
														sx={{
															...kronaSettingsInputSx,
															color: 'var(--krona-text)',
															'& input': { color: 'var(--krona-text)' },
														}}
													/>
												</SettingsField>
												{emailLockedByOwner ? (
													<Typography
														level="body-sm"
														sx={{
															color: 'var(--krona-text-muted)',
															mt: -0.75,
															maxWidth: { xs: '100%', md: 480 },
														}}
													>
														Only your admin manager can change this email.
														They send a new invite to the new address from
														Edit member.
													</Typography>
												) : null}
												<SettingsField label="Job / role">
													<Input
														placeholder="e.g. Freelance designer"
														value={job}
														onChange={(e) => setJob(e.target.value)}
														sx={{
															...kronaSettingsInputSx,
															color: 'var(--krona-text)',
															'& input': { color: 'var(--krona-text)' },
														}}
													/>
												</SettingsField>
												<SettingsField label="Country">
													<Input
														placeholder="e.g. United States"
														value={country}
														onChange={(e) => setCountry(e.target.value)}
														sx={{
															...kronaSettingsInputSx,
															color: 'var(--krona-text)',
															'& input': { color: 'var(--krona-text)' },
														}}
													/>
												</SettingsField>
												<SettingsField label="Daily work hours needed">
													<Input
														type="number"
														placeholder="e.g. 6"
														value={workHoursDaily}
														slotProps={{
															input: {
																min: 0,
																max: 24,
																step: 0.5,
															},
														}}
														onChange={(e) => setWorkHoursDaily(e.target.value)}
														sx={{
															...kronaSettingsInputSx,
															color: 'var(--krona-text)',
															'& input': { color: 'var(--krona-text)' },
														}}
													/>
												</SettingsField>
												<Typography
													level="body-sm"
													sx={{
														color: 'var(--krona-text-muted)',
														mt: -0.5,
														maxWidth: { xs: '100%', md: 480 },
													}}
												>
													Job, country, and daily hours are used in your
													performance reports.
												</Typography>
												<Button
													variant="solid"
													loading={accountSaving}
													disabled={!accountLoaded}
													onClick={() => void handleSaveAccount()}
													sx={{
														...kronaPrimaryButtonSx,
														...kronaSettingsButtonSx,
														mt: 1,
													}}
												>
													Save Changes
												</Button>
											</Box>
										</>
									)}

									{tab === SETTINGS_TEAM_TAB_INDEX && canSeeTeamSettings ? (
										<TeamSettingsPanel SettingsField={SettingsField} />
									) : null}

									{/* Timer Tab */}
									{tab === SETTINGS_TIMER_TAB_INDEX && (
										<>
											<Typography
												level="h4"
												sx={{ mb: 2, color: 'var(--krona-text)' }}
											>
												Timer Settings
											</Typography>
											<Box
												sx={{
													display: 'flex',
													flexDirection: 'column',
													gap: 1.5,
													width: '100%',
												}}
											>
												<Typography
													level="title-sm"
													sx={{ color: 'var(--krona-text)', fontWeight: 600 }}
												>
													Timer mode
												</Typography>
												<Box
													sx={{
														display: 'grid',
														gridTemplateColumns: {
															xs: '1fr',
															sm: '1fr 1fr',
														},
														gap: 1,
														width: '100%',
														maxWidth: { xs: '100%', md: 480 },
													}}
												>
													{(
														[
															{
																id: 'pomodoro' as const,
																title: 'Pomodoro',
																body: 'Classic work, short break, and long break cycles.',
															},
															{
																id: 'workFree' as const,
																title: 'Work free',
																body: 'Work and rest periods with tracked hours. Turn on or off from Home.',
															},
														] as const
													).map((option) => {
														const active = timerModeDraft === option.id;
														return (
															<Box
																key={option.id}
																component="button"
																type="button"
																onClick={() => setTimerModeDraft(option.id)}
																sx={{
																	textAlign: 'left',
																	cursor: 'pointer',
																	p: 1.75,
																	borderRadius: '20px',
																	border: active
																		? '1px solid var(--krona-accent)'
																		: '1px solid var(--krona-surface-border)',
																	bgcolor: active
																		? 'var(--krona-accent-soft-bg)'
																		: 'var(--krona-widget-bg)',
																	color: 'var(--krona-text)',
																	'&:hover': {
																		bgcolor: active
																			? 'var(--krona-accent-22)'
																			: 'var(--krona-overlay-hover)',
																	},
																}}
															>
																<Typography
																	level="title-sm"
																	sx={{ fontWeight: 700, mb: 0.5 }}
																>
																	{option.title}
																</Typography>
																<Typography
																	level="body-sm"
																	sx={{
																		color: 'var(--krona-text-muted)',
																		lineHeight: 1.45,
																	}}
																>
																	{option.body}
																</Typography>
															</Box>
														);
													})}
												</Box>

												{timerModeDraft === 'pomodoro' ? (
													<>
												<SettingsField label="Work (minutes)">
													<Input
														type="number"
														placeholder={kronaPlaceholders.settings.workMinutes}
														value={workMinutes}
														onChange={(e) =>
															setWorkMinutes(Number(e.target.value))
														}
														slotProps={{ input: { min: 1 } }}
														sx={{
															...kronaSettingsInputSx,
															color: 'var(--krona-text)',
															'& input': { color: 'var(--krona-text)' },
														}}
													/>
												</SettingsField>
												<SettingsField label="Short break (minutes)">
													<Input
														type="number"
														placeholder={
															kronaPlaceholders.settings.shortBreakMinutes
														}
														value={shortBreakMinutes}
														onChange={(e) =>
															setShortBreakMinutes(Number(e.target.value))
														}
														slotProps={{ input: { min: 1 } }}
														sx={{
															...kronaSettingsInputSx,
															color: 'var(--krona-text)',
															'& input': { color: 'var(--krona-text)' },
														}}
													/>
												</SettingsField>
													<SettingsField label="Long break (minutes)">
														<Input
															type="number"
															placeholder={
																kronaPlaceholders.settings.longBreakMinutes
															}
															value={longBreakMinutes}
															onChange={(e) =>
																setLongBreakMinutes(Number(e.target.value))
															}
															slotProps={{ input: { min: 1 } }}
															sx={{
																...kronaSettingsInputSx,
																color: 'var(--krona-text)',
																'& input': { color: 'var(--krona-text)' },
															}}
														/>
													</SettingsField>
													</>
												) : null}
												{timerModeDraft === 'pomodoro' ? (
												<Box
													sx={{
														p: 2,
														bgcolor: 'var(--krona-widget-bg)',
														borderRadius: '24px',
														border: '1px solid var(--krona-surface-border)',
														display: 'flex',
														justifyContent: 'space-between',
														alignItems: 'center',
														gap: 2,
														width: '100%',
														maxWidth: { xs: '100%', md: 480 },
													}}
												>
													<Box sx={{ minWidth: 0 }}>
														<Typography
															level="title-sm"
															sx={{
																color: 'var(--krona-text)',
																fontWeight: 600,
															}}
														>
															Auto-start next period
														</Typography>
														<Typography
															level="body-sm"
															sx={{ color: 'var(--krona-text-muted)', mt: 0.5 }}
														>
															When off, a bell rings at the end of work or rest
															and you press play to begin the next period.
														</Typography>
													</Box>
													<KronaSwitch
														checked={autoAdvance}
														onChange={handleAutoAdvanceChange}
													/>
												</Box>
												) : null}
												{timerModeDraft === 'workFree' ? (
													<Typography
														level="body-sm"
														sx={{
															color: 'var(--krona-text-muted)',
															maxWidth: { xs: '100%', md: 480 },
														}}
													>
														Work free counts up without time limits. Play and
														pause tracking on the Home timer widget, and use skip
														to move between Work and Rest.
													</Typography>
												) : null}
												<Button
													variant="outlined"
													onClick={() => {
														primeTimerAlertAudio();
														playTimerPeriodBell();
													}}
													sx={{
														...kronaSettingsButtonSx,
														borderRadius: '999px',
														color: 'var(--krona-text)',
														border: '1px solid var(--krona-surface-border)',
														'&:hover': { bgcolor: 'var(--krona-secondary-bg)' },
													}}
												>
													Test bell sound
												</Button>
												<Box
													sx={{
														display: 'flex',
														alignItems: 'center',
														gap: 1.5,
														mt: 0.5,
														maxWidth: { xs: '100%', md: 480 },
													}}
												>
													<Button
														variant="solid"
														onClick={handleSaveTimerSettings}
														sx={{
															...kronaPrimaryButtonSx,
															...kronaSettingsButtonSx,
														}}
													>
														Save Timer
													</Button>
													{timerSaved && (
														<Typography
															level="body-sm"
															sx={{ color: 'rgba(134, 239, 172, 0.95)' }}
														>
															Saved
														</Typography>
													)}
												</Box>
											</Box>
										</>
									)}
								</Sheet>
							</Box>
						)}
					</Box>

					<Modal
						open={unsavedModalOpen}
						onClose={() => setUnsavedModalOpen(false)}
					>
						<ModalDialog
							sx={{
								...kronaModalDialogSx,
								position: 'relative',
								px: { xs: '20px', sm: '24px' },
								py: '18px',
							}}
						>
							<IconButton
								size="sm"
								aria-label="Close"
								onClick={() => setUnsavedModalOpen(false)}
								sx={kronaModalCloseButtonSx}
							>
								<X size={18} />
							</IconButton>
							<Typography
								level="h4"
								sx={{ mb: 0.5, pr: 4, color: 'var(--krona-text)' }}
							>
								Unsaved changes
							</Typography>
							<Typography
								level="body-sm"
								sx={{ mb: 2, color: 'var(--krona-text-muted)' }}
							>
								Leaving without saving will discard your account changes.
							</Typography>
							<Box sx={{ display: 'flex', gap: 1 }}>
								<Button
									variant="outlined"
									onClick={() => setUnsavedModalOpen(false)}
									sx={{ ...kronaSecondaryButtonSx, flex: 1 }}
								>
									Keep editing
								</Button>
								<Button
									onClick={confirmDiscardAccountChanges}
									sx={{ ...kronaPrimaryButtonSx, flex: 1 }}
								>
									Leave without saving
								</Button>
							</Box>
						</ModalDialog>
					</Modal>
				</Box>
			</Box>
		</CssVarsProvider>
	);
}
