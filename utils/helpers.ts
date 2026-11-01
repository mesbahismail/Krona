/** Links remain on the current local application. No deployment variables required. */
export function getCanonicalSiteOrigin(): string {
	return typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3003';
}
export function getAuthRedirectOrigin(requestOrigin?: string): string { return requestOrigin || getCanonicalSiteOrigin(); }
export const getOAuthCookieOrigin = getAuthRedirectOrigin;
export function getAuthCallbackURL(requestOrigin?: string): string { return `${getAuthRedirectOrigin(requestOrigin)}/`; }
export const getOAuthCallbackURL = getAuthCallbackURL;
export const getURL = (path = '') => `${getCanonicalSiteOrigin()}/${path.replace(/^\/+/, '')}`;
export function formatAuthNetworkError(message: string): string { return message; }

export const calculateTrialEndUnixTimestamp = (
	trialPeriodDays: number | null | undefined,
) => {
	// Check if trialPeriodDays is null, undefined, or less than 2 days
	if (
		trialPeriodDays === null ||
		trialPeriodDays === undefined ||
		trialPeriodDays < 2
	) {
		return undefined;
	}

	const currentDate = new Date(); // Current date and time
	const trialEnd = new Date(
		currentDate.getTime() + (trialPeriodDays + 1) * 24 * 60 * 60 * 1000,
	); // Add trial days
	return Math.floor(trialEnd.getTime() / 1000); // Convert to Unix timestamp in seconds
};

const toastKeyMap: { [key: string]: string[] } = {
	status: ['status', 'status_description'],
	error: ['error', 'error_description'],
};

const getToastRedirect = (
	path: string,
	toastType: string,
	toastName: string,
	toastDescription: string = '',
	disableButton: boolean = false,
	arbitraryParams: string = '',
): string => {
	const [nameKey, descriptionKey] = toastKeyMap[toastType];

	let redirectPath = `${path}?${nameKey}=${encodeURIComponent(toastName)}`;

	if (toastDescription) {
		redirectPath += `&${descriptionKey}=${encodeURIComponent(
			toastDescription,
		)}`;
	}

	if (disableButton) {
		redirectPath += `&disable_button=true`;
	}

	if (arbitraryParams) {
		redirectPath += `&${arbitraryParams}`;
	}

	return redirectPath;
};

export const getStatusRedirect = (
	path: string,
	statusName: string,
	statusDescription: string = '',
	disableButton: boolean = false,
	arbitraryParams: string = '',
) =>
	getToastRedirect(
		path,
		'status',
		statusName,
		statusDescription,
		disableButton,
		arbitraryParams,
	);

export const getErrorRedirect = (
	path: string,
	errorName: string,
	errorDescription: string = '',
	disableButton: boolean = false,
	arbitraryParams: string = '',
) =>
	getToastRedirect(
		path,
		'error',
		errorName,
		errorDescription,
		disableButton,
		arbitraryParams,
	);
