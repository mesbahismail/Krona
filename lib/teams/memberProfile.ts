import {
	DEFAULT_TEAM_EMPLOYEE_PERMISSIONS,
	FULL_TEAM_MEMBER_PERMISSIONS,
	type TeamEmployeePermissions,
} from '@/lib/teams/employeePermissions';

export type OnboardingMemberRole = 'member' | 'manager';

export type OnboardingMemberDraft = {
	firstName: string;
	lastName: string;
	email: string;
	position: string;
	role: OnboardingMemberRole;
	dateJoined: string;
	birthday: string;
	hourlyRate: string;
	dailyWorkingHours: string;
	accessPermissions: TeamEmployeePermissions;
};

export type StoredMemberProfile = {
	firstName?: string;
	lastName?: string;
	position?: string;
	dateJoined?: string;
	birthday?: string;
	hourlyRate?: string;
	dailyWorkingHours?: string;
	/** Manager-provided context for Krona AI when this member joins. */
	aiInstructions?: string;
};

/** Local calendar day as YYYY-MM-DD (onboarding default for date joined). */
export function todayLocalIsoDate(now = new Date()): string {
	const y = now.getFullYear();
	const m = String(now.getMonth() + 1).padStart(2, '0');
	const d = String(now.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

/** Date joined may be today or earlier — never a future day. */
export function clampDateJoined(iso: string, today = todayLocalIsoDate()): string {
	const value = iso.trim();
	if (!value) return today;
	return value > today ? today : value;
}

export function emptyMemberDraft(): OnboardingMemberDraft {
	return {
		firstName: '',
		lastName: '',
		email: '',
		position: '',
		role: 'member',
		dateJoined: todayLocalIsoDate(),
		birthday: '',
		hourlyRate: '',
		dailyWorkingHours: '',
		accessPermissions: { ...DEFAULT_TEAM_EMPLOYEE_PERMISSIONS },
	};
}

export function defaultAccessForRole(
	role: OnboardingMemberRole,
): TeamEmployeePermissions {
	return {
		...(role === 'manager'
			? FULL_TEAM_MEMBER_PERMISSIONS
			: DEFAULT_TEAM_EMPLOYEE_PERMISSIONS),
	};
}

export function isValidEmail(email: string): boolean {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function memberDraftIsComplete(draft: OnboardingMemberDraft): boolean {
	return (
		!!draft.firstName.trim() &&
		!!draft.lastName.trim() &&
		isValidEmail(draft.email) &&
		!!draft.position.trim() &&
		(draft.role === 'member' || draft.role === 'manager')
	);
}

export function allMemberDraftsComplete(drafts: OnboardingMemberDraft[]): boolean {
	return drafts.length > 0 && drafts.every(memberDraftIsComplete);
}

/** Card counts if the user entered an email. */
export function memberDraftIsActive(draft: OnboardingMemberDraft): boolean {
	return draft.email.trim().length > 0;
}

export function validateMemberDraft(draft: OnboardingMemberDraft): string | null {
	if (!draft.email.trim()) return null;
	if (!isValidEmail(draft.email)) return 'Enter a valid email for each member.';
	if (!draft.firstName.trim()) return 'First name is required for each member.';
	if (!draft.lastName.trim()) return 'Last name is required for each member.';
	if (!draft.position.trim()) return 'Position is required for each member.';
	return null;
}

export function activeMemberDrafts(
	drafts: OnboardingMemberDraft[],
): OnboardingMemberDraft[] {
	return drafts.filter(memberDraftIsActive);
}

/** Parse optional daily hours from onboarding (e.g. "8", "7.5"). */
export function parseDailyWorkingHours(raw: string | null | undefined): number | null {
	if (raw == null) return null;
	const trimmed = String(raw).trim();
	if (!trimmed) return null;
	const hours = Number(trimmed);
	if (!Number.isFinite(hours) || hours <= 0) return null;
	return Math.min(24, Math.round(hours * 2) / 2);
}

export function memberDraftToStoredProfile(
	draft: OnboardingMemberDraft,
): StoredMemberProfile {
	return {
		firstName: draft.firstName.trim(),
		lastName: draft.lastName.trim(),
		position: draft.position.trim(),
		...(draft.dateJoined.trim()
			? { dateJoined: clampDateJoined(draft.dateJoined) }
			: {}),
		...(draft.birthday.trim() ? { birthday: draft.birthday.trim() } : {}),
		...(draft.hourlyRate.trim() ? { hourlyRate: draft.hourlyRate.trim() } : {}),
		...(draft.dailyWorkingHours.trim()
			? { dailyWorkingHours: draft.dailyWorkingHours.trim() }
			: {}),
	};
}

export function formatMemberForAiContext(
	draft: OnboardingMemberDraft,
): string {
	const name = [draft.firstName, draft.lastName].filter(Boolean).join(' ').trim();
	const roleLabel = draft.role === 'manager' ? 'Manager' : 'Employee';
	let line = `${name} (${draft.email.trim()}) — ${draft.position.trim()}, ${roleLabel}`;
	const extras: string[] = [];
	if (draft.dateJoined.trim()) extras.push(`joined ${draft.dateJoined.trim()}`);
	if (draft.birthday.trim()) extras.push(`birthday ${draft.birthday.trim()}`);
	if (draft.hourlyRate.trim()) extras.push(`$${draft.hourlyRate.trim()}/hr`);
	if (draft.dailyWorkingHours.trim()) {
		extras.push(`${draft.dailyWorkingHours.trim()}h/day`);
	}
	if (extras.length) line += ` (${extras.join(', ')})`;
	return line;
}

export function buildOnboardingAiContext(input: {
	members: OnboardingMemberDraft[];
	instructions: string;
}): string {
	const lines: string[] = [];
	const active = activeMemberDrafts(input.members);
	if (active.length) {
		lines.push('Pending team members:');
		for (const m of active) {
			lines.push(`- ${formatMemberForAiContext(m)}`);
		}
	}
	if (input.instructions.trim()) {
		if (lines.length) lines.push('');
		lines.push('Notes for AI about these onboardings:');
		lines.push(input.instructions.trim());
	}
	return lines.join('\n');
}
