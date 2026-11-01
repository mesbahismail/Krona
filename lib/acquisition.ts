/** First-touch acquisition attribution for Krona signups. */

export const ACQUISITION_COOKIE = 'krona_acq';
export const ACQUISITION_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 90; // 90 days

/** Shared across apex + www so ads landing on getkrona.app still attribute on www. */
export function kronaSharedCookieDomain(hostname?: string | null): string | undefined {
	const host = (
		hostname ??
		(typeof window !== 'undefined' ? window.location.hostname : '')
	)
		.toLowerCase()
		.replace(/:\d+$/, '')
		.trim();
	if (!host) return undefined;
	if (
		host === 'localhost' ||
		host === '127.0.0.1' ||
		host === '[::1]' ||
		host.endsWith('.localhost')
	) {
		return undefined;
	}
	if (host === 'getkrona.app' || host.endsWith('.getkrona.app')) {
		return '.getkrona.app';
	}
	return undefined;
}

export function getKronaCookieDomain(): string | null {
	return kronaSharedCookieDomain() ?? null;
}

/** Server Set-Cookie Domain: production apex+www only. Never on localhost / Vercel preview. */
export function kronaServerCookieDomain(): string | undefined {
	if (typeof window !== 'undefined') {
		return kronaSharedCookieDomain(window.location.hostname);
	}
	return undefined;
}

export function kronaClientCookieSuffix(maxAgeSec: number): string {
	const domain = getKronaCookieDomain();
	const domainPart = domain ? `; Domain=${domain}` : '';
	const secure =
		typeof window !== 'undefined' && window.location.protocol === 'https:'
			? '; Secure'
			: '';
	return `; path=/; max-age=${maxAgeSec}; SameSite=Lax${domainPart}${secure}`;
}

export type AcquisitionAttribution = {
	/** Canonical display source: Direct, Instagram, X, Reddit, … */
	source: string;
	medium: string | null;
	campaign: string | null;
	content: string | null;
	term: string | null;
	referrer: string | null;
	landingPath: string | null;
	capturedAt: string;
};

type RawCaptureInput = {
	utmSource?: string | null;
	utmMedium?: string | null;
	utmCampaign?: string | null;
	utmContent?: string | null;
	utmTerm?: string | null;
	gclid?: string | null;
	fbclid?: string | null;
	twclid?: string | null;
	referrer?: string | null;
	landingPath?: string | null;
};

const SOURCE_ALIASES: Record<string, string> = {
	ig: 'Instagram',
	instagram: 'Instagram',
	insta: 'Instagram',
	x: 'X',
	twitter: 'X',
	reddit: 'Reddit',
	yt: 'YouTube',
	youtube: 'YouTube',
	fb: 'Facebook',
	facebook: 'Facebook',
	meta: 'Facebook',
	tiktok: 'TikTok',
	tt: 'TikTok',
	linkedin: 'LinkedIn',
	li: 'LinkedIn',
	google: 'Google',
	bing: 'Bing',
	newsletter: 'Newsletter',
	email: 'Email',
	producthunt: 'Product Hunt',
	product_hunt: 'Product Hunt',
	ph: 'Product Hunt',
	share: 'Share',
	referral: 'Referral',
	website: 'Website',
	direct: 'Direct',
	ads: 'Ads',
	ad: 'Ads',
};

const PAID_MEDIA = new Set([
	'cpc',
	'ppc',
	'paid',
	'paid_social',
	'paidsocial',
	'paid-social',
	'display',
	'retargeting',
]);

function cleanParam(raw: string | null | undefined): string | null {
	const trimmed = raw?.trim();
	if (!trimmed) return null;
	return trimmed.slice(0, 120);
}

function titleCaseToken(raw: string): string {
	return raw
		.replace(/[_-]+/g, ' ')
		.split(/\s+/)
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
		.join(' ');
}

function normalizeSourceToken(raw: string | null | undefined): string | null {
	const cleaned = cleanParam(raw)?.toLowerCase();
	if (!cleaned) return null;
	return SOURCE_ALIASES[cleaned] ?? titleCaseToken(cleaned);
}

function hostFromReferrer(referrer: string | null | undefined): string | null {
	if (!referrer) return null;
	try {
		const host = new URL(referrer).hostname.replace(/^www\./i, '').toLowerCase();
		return host || null;
	} catch {
		return null;
	}
}

function sourceFromReferrerHost(host: string | null): string | null {
	if (!host) return null;
	if (host === 't.co' || host.endsWith('.twitter.com') || host === 'twitter.com' || host === 'x.com') {
		return 'X';
	}
	if (host.includes('instagram.com') || host === 'l.instagram.com') return 'Instagram';
	if (host.includes('reddit.com') || host === 'redd.it') return 'Reddit';
	if (host.includes('youtube.com') || host === 'youtu.be') return 'YouTube';
	if (host.includes('facebook.com') || host === 'fb.me' || host === 'm.facebook.com' || host === 'l.facebook.com') {
		return 'Facebook';
	}
	if (host.includes('tiktok.com')) return 'TikTok';
	if (host.includes('linkedin.com') || host === 'lnkd.in') return 'LinkedIn';
	if (host.includes('google.')) return 'Google';
	if (host.includes('bing.com')) return 'Bing';
	if (host.includes('producthunt.com')) return 'Product Hunt';
	if (host.endsWith('getkrona.app') || host === 'localhost' || host === '127.0.0.1') {
		return null; // same-site — treat as Direct unless UTM present
	}
	return titleCaseToken(host.split('.')[0] || host);
}

function isPaidMedium(medium: string | null): boolean {
	if (!medium) return false;
	return PAID_MEDIA.has(medium.trim().toLowerCase());
}

/** Resolve a human-readable acquisition source from UTMs + referrer. */
export function resolveAcquisitionSource(input: RawCaptureInput): AcquisitionAttribution {
	const utmSource = cleanParam(input.utmSource);
	const utmMedium = cleanParam(input.utmMedium);
	const utmCampaign = cleanParam(input.utmCampaign);
	const utmContent = cleanParam(input.utmContent);
	const utmTerm = cleanParam(input.utmTerm);
	const gclid = cleanParam(input.gclid);
	const fbclid = cleanParam(input.fbclid);
	const twclid = cleanParam(input.twclid);
	const referrer = cleanParam(input.referrer);
	const landingPath = cleanParam(input.landingPath);
	const refHost = hostFromReferrer(referrer);

	let source: string | null = null;
	let medium = utmMedium;

	if (gclid) {
		source = 'Google Ads';
		medium = medium ?? 'cpc';
	} else if (fbclid) {
		source = 'Facebook Ads';
		medium = medium ?? 'paid_social';
	} else if (twclid) {
		source = 'X Ads';
		medium = medium ?? 'paid_social';
	} else if (utmSource) {
		source = normalizeSourceToken(utmSource);
		if (source && isPaidMedium(utmMedium)) {
			if (source === 'Google') source = 'Google Ads';
			else if (source === 'Facebook' || source === 'Instagram') source = `${source} Ads`;
			else if (source === 'X') source = 'X Ads';
			else if (!/ads$/i.test(source)) source = `${source} Ads`;
		}
	} else {
		source = sourceFromReferrerHost(refHost);
		if (source === 'Google' || source === 'Bing') {
			medium = medium ?? 'organic';
		} else if (source) {
			medium = medium ?? 'referral';
		}
	}

	if (!source) {
		source = 'Direct';
		medium = medium ?? 'none';
	}

	return {
		source,
		medium,
		campaign: utmCampaign,
		content: utmContent,
		term: utmTerm,
		referrer: referrer,
		landingPath,
		capturedAt: new Date().toISOString(),
	};
}

export function parseAcquisitionCookie(
	raw: string | null | undefined,
): AcquisitionAttribution | null {
	if (!raw?.trim()) return null;
	try {
		const parsed = JSON.parse(raw) as Partial<AcquisitionAttribution>;
		const source = cleanParam(parsed.source);
		if (!source) return null;
		return {
			source,
			medium: cleanParam(parsed.medium) ?? null,
			campaign: cleanParam(parsed.campaign) ?? null,
			content: cleanParam(parsed.content) ?? null,
			term: cleanParam(parsed.term) ?? null,
			referrer: cleanParam(parsed.referrer) ?? null,
			landingPath: cleanParam(parsed.landingPath) ?? null,
			capturedAt:
				cleanParam(parsed.capturedAt) ?? new Date().toISOString(),
		};
	} catch {
		return null;
	}
}

export function serializeAcquisitionCookie(value: AcquisitionAttribution): string {
	return JSON.stringify(value);
}

/** Append first-party UTM params for outbound Krona links (share, bio, ads). */
export function withAcquisitionParams(
	baseUrl: string,
	params: {
		source: string;
		medium?: string;
		campaign?: string;
		content?: string;
	},
): string {
	try {
		const url = new URL(baseUrl);
		url.searchParams.set('utm_source', params.source);
		if (params.medium) url.searchParams.set('utm_medium', params.medium);
		if (params.campaign) url.searchParams.set('utm_campaign', params.campaign);
		if (params.content) url.searchParams.set('utm_content', params.content);
		return url.toString();
	} catch {
		return baseUrl;
	}
}

export function isPaidAcquisition(
	source: string,
	medium?: string | null,
): boolean {
	const m = (medium ?? '').toLowerCase();
	if (
		m === 'cpc' ||
		m === 'ppc' ||
		m === 'paid' ||
		m === 'paid_social' ||
		m === 'paidsocial'
	) {
		return true;
	}
	return /ads$/i.test(source.trim());
}

export function acquisitionChannel(
	source: string,
	medium?: string | null,
): 'paid' | 'organic' | 'referral' | 'direct' | 'other' {
	if (source.trim().toLowerCase() === 'direct') return 'direct';
	if (isPaidAcquisition(source, medium)) return 'paid';
	const m = (medium ?? '').toLowerCase();
	if (m === 'organic') return 'organic';
	if (m === 'referral' || m === 'social') return 'referral';
	return 'other';
}

export function acquisitionFromAppSettings(
	appSettings: unknown,
): AcquisitionAttribution | null {
	if (!appSettings || typeof appSettings !== 'object') return null;
	const acquisition = (appSettings as { acquisition?: unknown }).acquisition;
	if (!acquisition || typeof acquisition !== 'object') return null;
	const source = cleanParam((acquisition as { source?: unknown }).source as string);
	if (!source) return null;
	const row = acquisition as Partial<AcquisitionAttribution>;
	return {
		source,
		medium: cleanParam(row.medium) ?? null,
		campaign: cleanParam(row.campaign) ?? null,
		content: cleanParam(row.content) ?? null,
		term: cleanParam(row.term) ?? null,
		referrer: cleanParam(row.referrer) ?? null,
		landingPath: cleanParam(row.landingPath) ?? null,
		capturedAt: cleanParam(row.capturedAt) ?? '',
	};
}
