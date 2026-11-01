import { kronaServerCookieDomain } from '@/lib/acquisition';

export const ONBOARDING_DONE_KEY = 'krona-onboarding-done';
export const TEAM_ONBOARDING_DONE_KEY = 'krona-team-onboarding-done';
const ONBOARDING_TOUR_PENDING_KEY = 'krona-onboarding-tour-pending';
const TEAM_TOUR_PENDING_KEY = 'krona-team-tour-pending';
export const ONBOARDING_PENDING_COOKIE = 'krona_pending_onboarding';
export const ONBOARDING_QUERY_PARAM = 'onboarding';
/** Marks a confirmed signup redirect for GA4 `sign_up`. */
export const SIGNUP_CONVERSION_QUERY_PARAM = 'ga_signup';
/** Survives redirects that drop query params (e.g. /complete-profile). */
export const GA_SIGNUP_PENDING_COOKIE = 'krona_pending_ga_signup';

/** Cookie lifetime for pending get-started guide (7 days). */
export const ONBOARDING_PENDING_MAX_AGE_SEC = 60 * 60 * 24 * 7;

/** Opens the account menu during the themes onboarding step. */
export const ONBOARDING_ACCOUNT_MENU_EVENT = 'krona:onboarding-account-menu';

export const GA_SIGNUP_PENDING_COOKIE_OPTIONS = {
	path: '/',
	maxAge: 60 * 60,
	sameSite: 'lax' as const,
	httpOnly: false,
	...(kronaServerCookieDomain() ? { domain: kronaServerCookieDomain() } : {}),
};

export type OnboardingStepIcon =
	| 'sparkles'
	| 'folderKanban'
	| 'timer'
	| 'calendar'
	| 'barChart'
	| 'trophy'
	| 'menu'
	| 'user'
	| 'palette'
	| 'users'
	| 'bell'
	| 'clipboardList'
	| 'cake';

export type OnboardingPlacement = 'top' | 'bottom' | 'left' | 'right' | 'center';

export type OnboardingStep = {
	id: string;
	title: string;
	body: string;
	icon: OnboardingStepIcon;
	/** CSS selector for spotlight target. Omit for centered welcome card. */
	target?: string;
	placement?: OnboardingPlacement;
	/** Open the profile menu so nested targets (themes) are visible. */
	openAccountMenu?: boolean;
};

/** Individual Mode get-started guide (home dashboard after personal onboarding). */
export const ONBOARDING_STEPS: OnboardingStep[] = [
	{
		id: 'welcome',
		icon: 'sparkles',
		title: 'Welcome to Krona',
		body: 'Your all-in-one productivity workspace. Let’s take a quick tour of the home screen — and what’s new for Teams.',
		target: '[data-tour="dashboard-logo"]',
		placement: 'bottom',
	},
	{
		id: 'projects',
		icon: 'folderKanban',
		title: 'Projects & tasks',
		body: 'Organize work into projects, add tasks, set priorities, and check things off as you go.',
		target: '[data-tour="widget-tasks"]',
		placement: 'right',
	},
	{
		id: 'timer',
		icon: 'timer',
		title: 'Focus timer',
		body: 'Run Pomodoro sessions here — start, pause, and skip. The same timer stays available in the top bar on every page.',
		target: '[data-tour="widget-timer"]',
		placement: 'left',
	},
	{
		id: 'performance',
		icon: 'barChart',
		title: 'Performance',
		body: 'See how your focus time is trending week over week, then open Performance for the full breakdown.',
		target: '[data-tour="widget-performance"]',
		placement: 'left',
	},
	{
		id: 'challenges',
		icon: 'trophy',
		title: 'Daily Challenges',
		body: 'Today’s Daily Challenges live in the trophy progress in the top bar. Open it to see what’s assigned, your progress, and when you finish.',
		target: '[data-tour="dashboard-challenges"]',
		placement: 'bottom',
	},
	{
		id: 'menu',
		icon: 'menu',
		title: 'Page menu',
		body: 'Open the menu next to your greeting to jump between Projects, Performance, Reminders, and more.',
		target: '[data-tour="dashboard-page-menu"]',
		placement: 'bottom',
	},
	{
		id: 'team-mode',
		icon: 'users',
		title: 'Team Mode',
		body: 'With a team, switch Workspace to Team in your profile menu. Managers see Team Effort, Performance, Projects, Reminders, and Members — employees see the work assigned to them.',
		placement: 'center',
	},
	{
		id: 'team-activity',
		icon: 'bell',
		title: 'Activity alerts',
		body: 'In Team Mode, the bell opens today’s Activity. You’ll get alerts for assignments, completed tasks, deadlines, due reminders, birthdays, overtime, and performance skips — scoped to your role.',
		placement: 'center',
	},
	{
		id: 'team-projects',
		icon: 'clipboardList',
		title: 'Assign team work',
		body: 'Managers create projects with all employees selected by default, then pick who is on each project. Add tasks inline and assign one or more project members with the people checklist (count badge on the icon).',
		placement: 'center',
	},
	{
		id: 'team-birthdays',
		icon: 'cake',
		title: 'Birthdays & reminders',
		body: 'Invite cards can include birthday and date joined. Birthdays are added to the team reminders calendar automatically, and Activity notifies the team when someone’s day arrives.',
		placement: 'center',
	},
	{
		id: 'profile',
		icon: 'user',
		title: 'Your profile',
		body: 'Open your avatar for account settings, vacation mode, feedback, and sign out. Managers in Team Mode also see a TEAM badge under the thumbnail, plus Workspace switching when Individual Mode is allowed.',
		target: '[data-tour="dashboard-profile-thumbnail"]',
		placement: 'bottom',
	},
	{
		id: 'themes',
		icon: 'palette',
		title: 'Themes',
		body: 'Choose Light or Dark in your profile menu, or switch modes using the sun and moon button in the side menu.',
		target: '[data-tour="dashboard-themes"]',
		placement: 'left',
		openAccountMenu: true,
	},
];

/** Individual workspace guide for employees; Team Mode is not available to this role. */
const employeeOnboardingBase: OnboardingStep[] = ONBOARDING_STEPS.filter(
	(step) =>
		!['team-mode', 'team-projects', 'team-birthdays'].includes(step.id),
).map((step) => {
	if (step.id === 'welcome') {
		return {
			...step,
			body: 'Your all-in-one productivity workspace. Let’s take a quick tour of your home screen.',
		};
	}
	if (step.id === 'challenges') {
		return {
			...step,
			body: 'Today’s Daily Challenges live in the trophy progress in the top bar. Open it to see what’s assigned, your progress, and when you finish.',
		};
	}
	if (step.id === 'team-activity') {
		return {
			...step,
			title: 'Activity',
			body: 'The bell shows work your manager assigned — tasks, projects, daily challenges, deadlines, and reminders.',
			target: '[data-tour="team-activity-bell"]',
			placement: 'bottom',
		};
	}
	if (step.id === 'profile') {
		return {
			...step,
			body: 'Open your avatar for account settings, vacation mode, feedback, and sign out.',
		};
	}
	return step;
});

const employeeActivityStep = employeeOnboardingBase.find(
	(step) => step.id === 'team-activity',
);
export const EMPLOYEE_ONBOARDING_STEPS: OnboardingStep[] = employeeActivityStep
	? employeeOnboardingBase.reduce<OnboardingStep[]>((steps, step) => {
			if (step.id === 'team-activity') return steps;
			steps.push(step);
			if (step.id === 'challenges') steps.push(employeeActivityStep);
			return steps;
		}, [])
	: employeeOnboardingBase;

/** Team Mode get-started guide (Team Effort after team setup / join). */
export const TEAM_ONBOARDING_STEPS: OnboardingStep[] = [
	{
		id: 'team-welcome',
		icon: 'users',
		title: 'Welcome to Team Mode',
		body: 'This is your team workspace. Managers run the roster and assignments; employees focus on work assigned to them.',
		target: '[data-tour="dashboard-logo"]',
		placement: 'bottom',
	},
	{
		id: 'team-activity',
		icon: 'bell',
		title: 'Activity',
		body: 'Tap the bell for today’s Activity. Unread items show a solid accent dot. Alerts cover completed tasks, assignments, deadlines, reminders, birthdays, overtime, and performance dips.',
		target: '[data-tour="team-activity-bell"]',
		placement: 'bottom',
	},
	{
		id: 'team-effort',
		icon: 'users',
		title: 'My team',
		body: 'Track how teammates are progressing. Admins can open Members from here to invite seats and set employee limits.',
		target: '[data-tour="team-widget-effort"]',
		placement: 'right',
	},
	{
		id: 'team-tasks',
		icon: 'clipboardList',
		title: 'Team tasks',
		body: 'Assign tasks to people and projects. On project pages, managers add tasks inline, pick assignees from project members, and see who each task belongs to under the title.',
		target: '[data-tour="team-widget-tasks"]',
		placement: 'left',
	},
	{
		id: 'team-reminders',
		icon: 'calendar',
		title: 'Reminders & birthdays',
		body: 'Team reminders keep shared due dates visible. Birthdays from profiles are added to the reminders calendar and show up in Activity.',
		target: '[data-tour="team-widget-reminders"]',
		placement: 'left',
	},
	{
		id: 'team-projects-nav',
		icon: 'folderKanban',
		title: 'Projects',
		body: 'Create projects with everyone selected by default, then refine the roster. Only people on the project appear in the task assignee checklist.',
		target: '[data-tour="dashboard-page-menu"]',
		placement: 'bottom',
	},
	{
		id: 'team-profile',
		icon: 'user',
		title: 'Team badge & workspace',
		body: 'Managers see a TEAM badge under the avatar while in Team Mode. Open your profile to switch to Individual Mode when your team allows it.',
		target: '[data-tour="dashboard-profile-thumbnail"]',
		placement: 'bottom',
	},
	{
		id: 'team-workspace',
		icon: 'users',
		title: 'Switch workspace',
		body: 'Use Team / Individual here anytime. Team Mode keeps the bell and team pages; Individual Mode brings back your personal dashboard and challenges.',
		target: '[data-tour="dashboard-workspace"]',
		placement: 'left',
		openAccountMenu: true,
	},
];

export function readOnboardingDone(): boolean {
	if (typeof window === 'undefined') return true;
	return localStorage.getItem(ONBOARDING_DONE_KEY) === '1';
}

export function readTeamOnboardingDone(): boolean {
	if (typeof window === 'undefined') return true;
	return localStorage.getItem(TEAM_ONBOARDING_DONE_KEY) === '1';
}

/** Clear local "done" so a new signup in the same browser can see the tour again. */
export function clearOnboardingDone() {
	if (typeof window === 'undefined') return;
	localStorage.removeItem(ONBOARDING_DONE_KEY);
}

export function clearTeamOnboardingDone() {
	if (typeof window === 'undefined') return;
	localStorage.removeItem(TEAM_ONBOARDING_DONE_KEY);
}

export function markOnboardingTourPending() {
	if (typeof window === 'undefined') return;
	sessionStorage.setItem(ONBOARDING_TOUR_PENDING_KEY, '1');
}

export function markTeamTourPending() {
	if (typeof window === 'undefined') return;
	sessionStorage.setItem(TEAM_TOUR_PENDING_KEY, '1');
}

export function hasOnboardingTourPending(): boolean {
	if (typeof window === 'undefined') return false;
	return sessionStorage.getItem(ONBOARDING_TOUR_PENDING_KEY) === '1';
}

export function hasTeamTourPending(): boolean {
	if (typeof window === 'undefined') return false;
	return sessionStorage.getItem(TEAM_TOUR_PENDING_KEY) === '1';
}

export function markOnboardingDone() {
	if (typeof window === 'undefined') return;
	localStorage.setItem(ONBOARDING_DONE_KEY, '1');
	sessionStorage.removeItem(ONBOARDING_TOUR_PENDING_KEY);
	document.cookie = `${ONBOARDING_PENDING_COOKIE}=; path=/; max-age=0`;
	document.cookie = `${ONBOARDING_PENDING_COOKIE}=; path=/; max-age=0; Domain=.getkrona.app`;
}

export function markTeamOnboardingDone() {
	if (typeof window === 'undefined') return;
	localStorage.setItem(TEAM_ONBOARDING_DONE_KEY, '1');
	sessionStorage.removeItem(TEAM_TOUR_PENDING_KEY);
}

export function hasPendingOnboardingCookie(): boolean {
	if (typeof document === 'undefined') return false;
	return document.cookie.split(';').some((part) => {
		const [name] = part.trim().split('=');
		return name === ONBOARDING_PENDING_COOKIE;
	});
}

function hasFreshSignupSignal(searchParams: URLSearchParams): boolean {
	if (searchParams.get(SIGNUP_CONVERSION_QUERY_PARAM) === '1') return true;
	if (typeof document === 'undefined') return false;
	return document.cookie.split(';').some((part) => {
		const [name] = part.trim().split('=');
		return name === GA_SIGNUP_PENDING_COOKIE;
	});
}

export function shouldLaunchOnboarding(searchParams: URLSearchParams): boolean {
	const requested =
		searchParams.get(ONBOARDING_QUERY_PARAM) === '1' ||
		hasPendingOnboardingCookie();
	if (!requested) return false;
	if (hasFreshSignupSignal(searchParams)) {
		clearOnboardingDone();
		clearTeamOnboardingDone();
		return true;
	}
	if (readOnboardingDone()) return false;
	if (hasPendingOnboardingCookie()) return true;
	return hasOnboardingTourPending();
}

export function shouldLaunchTeamOnboarding(searchParams: URLSearchParams): boolean {
	if (searchParams.get(ONBOARDING_QUERY_PARAM) !== '1') return false;
	if (hasFreshSignupSignal(searchParams)) {
		clearTeamOnboardingDone();
		return true;
	}
	if (readTeamOnboardingDone()) return false;
	return hasTeamTourPending();
}

/**
 * Append ?onboarding=1 (and optionally ?ga_signup=1) when destination is home.
 * Deep links keep their path; the pending cookie still covers those.
 */
export function redirectPathForOnboarding(
	next: string,
	options?: { signupConversion?: boolean },
): string {
	const pathOnly = next.split('?')[0] || '/';
	if (pathOnly !== '/') {
		if (!options?.signupConversion) return next;
		const params = new URLSearchParams(
			next.includes('?') ? next.slice(next.indexOf('?') + 1) : '',
		);
		params.set(SIGNUP_CONVERSION_QUERY_PARAM, '1');
		const qs = params.toString();
		return `${pathOnly}?${qs}`;
	}
	const params = new URLSearchParams(
		next.includes('?') ? next.slice(next.indexOf('?') + 1) : '',
	);
	params.set(ONBOARDING_QUERY_PARAM, '1');
	if (options?.signupConversion) {
		params.set(SIGNUP_CONVERSION_QUERY_PARAM, '1');
	}
	const qs = params.toString();
	return qs ? `/?${qs}` : `/?${ONBOARDING_QUERY_PARAM}=1`;
}

/** Cookie options so the client tour can read the pending flag via document.cookie. */
export const ONBOARDING_PENDING_COOKIE_OPTIONS = {
	path: '/',
	maxAge: ONBOARDING_PENDING_MAX_AGE_SEC,
	sameSite: 'lax' as const,
	httpOnly: false,
	...(kronaServerCookieDomain() ? { domain: kronaServerCookieDomain() } : {}),
};

export function requestOnboardingAccountMenu(open: boolean) {
	if (typeof window === 'undefined') return;
	window.dispatchEvent(
		new CustomEvent(ONBOARDING_ACCOUNT_MENU_EVENT, { detail: { open } }),
	);
}
