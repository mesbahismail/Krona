import type { PomodoroPreferences } from '@/lib/pomodoroPreferences';
import { localData } from '@/lib/localData';
import { applyNameAndJob } from '@/lib/profileIdentity';
import { notifyProfileIdentityUpdated } from '@/lib/kronaDataEvents';

export type NotificationPreferences = {
	allowAll: boolean;
	notifyReminders: boolean;
	notifyRoutine: boolean;
	notifyDeadlines: boolean;
	notifyTaskComplete?: boolean;
};

export type TimerDurationSettings = {
	workMinutes: number;
	breakMinutes: number;
	longBreakMinutes: number;
	/** Pomodoro cycles vs simpler work/rest (Work free). */
	style?: 'pomodoro' | 'workFree';
};

export type VacationSettings = {
	active: boolean;
	/** Local calendar days (YYYY-MM-DD) recorded as vacation. */
	days: string[];
	startedAt?: string;
	/** Days currently supplied by scheduled Vacation reminders. */
	scheduledDays?: string[];
	/** True when Vacation Mode was automatically enabled by a reminder range. */
	activatedBySchedule?: boolean;
	/**
	 * User chose “Back to work” (or toggled off) while a vacation reminder still
	 * covers today. Prevents hydrate from immediately turning mode back on.
	 * Cleared once today is no longer in the scheduled range.
	 */
	suppressScheduledActivation?: boolean;
};

export type AiAssistantSettings = {
	/** Display name for the assistant (e.g. Carmen). */
	assistantName?: string;
	/** Free-form preferences the AI should remember across chats. */
	preferences?: string;
	/** Prefer concise vs detailed replies. */
	tone?: 'concise' | 'detailed';
	/** Default voice input preference. */
	voiceEnabled?: boolean;
	/** Listen for “Hey {name}” to open chat and take a command. */
	wakeWordEnabled?: boolean;
	/** Proactive daily tip toasts (max 3/day). */
	hintsEnabled?: boolean;
	/** OpenAI TTS voice id (coral, onyx, nova, …). */
	voiceId?: string;
};

export type WorkspaceModeSetting = 'team' | 'individual';

export type UserAppSettings = {
	pomodoro?: Partial<PomodoroPreferences>;
	timer?: Partial<TimerDurationSettings>;
	notifications?: Partial<NotificationPreferences>;
	theme?: 'light' | 'dark';
	onboardingDone?: boolean;
	vacation?: VacationSettings;
	ai?: AiAssistantSettings;
	/** Owners/managers may switch workspaces; employees remain individual. */
	workspaceMode?: WorkspaceModeSetting;
};

const DEFAULT_NOTIFICATIONS: NotificationPreferences = {
	allowAll: true,
	notifyReminders: true,
	notifyRoutine: true,
	notifyDeadlines: true,
	notifyTaskComplete: true,
};

function mergeSettings(raw: unknown): UserAppSettings {
	if (!raw || typeof raw !== 'object') return {};
	return raw as UserAppSettings;
}

export async function loadUserAppSettings(
	userId: string,
): Promise<UserAppSettings> {
	const { data } = await localData
		.from('personal')
		.select('app_settings')
		.eq('user_id', userId)
		.maybeSingle();

	return mergeSettings(data?.app_settings);
}

export async function saveUserAppSettings(
	userId: string,
	patch: UserAppSettings,
	email?: string | null,
): Promise<UserAppSettings | null> {
	const current = await loadUserAppSettings(userId);
	const next: UserAppSettings = {
		...current,
		...patch,
		pomodoro: { ...current.pomodoro, ...patch.pomodoro },
		timer: { ...current.timer, ...patch.timer },
		notifications: { ...current.notifications, ...patch.notifications },
		vacation: patch.vacation ?? current.vacation,
		ai: { ...current.ai, ...patch.ai },
	};

	const { error } = await localData.from('personal').upsert(
		{
			user_id: userId,
			...(email != null ? { email_address: email } : {}),
			app_settings: next,
		},
		{ onConflict: 'user_id' },
	);

	if (error) {
		console.warn('[userAppSettings] save failed', error.message);
		return null;
	}

	return next;
}

export function resolveNotificationPreferences(
	settings: UserAppSettings,
): NotificationPreferences {
	return {
		...DEFAULT_NOTIFICATIONS,
		...settings.notifications,
	};
}

export type PersonalProfileRow = {
	first_name: string;
	last_name: string;
	email_address: string;
	profession: string | null;
	country: string | null;
	work_hours_target_daily: number;
	birthday: string | null;
};

export async function loadPersonalProfile(
	userId: string,
): Promise<PersonalProfileRow | null> {
	const { data } = await localData
		.from('personal')
		.select(
			'first_name, last_name, email_address, profession, country, work_hours_target_daily, birthday',
		)
		.eq('user_id', userId)
		.maybeSingle();

	if (!data) return null;
	return data as PersonalProfileRow;
}

export async function savePersonalProfile(
	userId: string,
	input: {
		firstName: string;
		lastName: string;
		email: string;
		profession?: string;
		country?: string;
		workHoursTargetDaily?: number;
	},
): Promise<boolean> {
	const settings = await loadUserAppSettings(userId);
	const workHours =
		typeof input.workHoursTargetDaily === 'number' &&
		Number.isFinite(input.workHoursTargetDaily)
			? Math.min(24, Math.max(0, input.workHoursTargetDaily))
			: 0;
	const { error } = await localData.from('personal').upsert(
		{
			user_id: userId,
			first_name: input.firstName,
			last_name: input.lastName,
			email_address: input.email,
			profession: input.profession?.trim() || null,
			country: input.country?.trim() || null,
			work_hours_target_daily: workHours,
			app_settings: settings,
		},
		{ onConflict: 'user_id' },
	);

	if (error) return false;

	await applyNameAndJob({
		db: localData,
		userId,
		email: input.email,
		fullName: `${input.firstName} ${input.lastName}`.trim(),
		jobTitle: input.profession ?? '',
		markUserSet: true,
		auth: {
			kind: 'self',
			updateUser: (args) => localData.auth.updateUser(args),
		},
	});
	notifyProfileIdentityUpdated();

	return true;
}
