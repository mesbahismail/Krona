import type { BillingInterval } from '@/lib/billingPlans';

/** Per-seat list prices (USD) — match Lemon Squeezy Teams unit prices. */
export const TEAMS_SEAT_MONTHLY_USD = 9;
export const TEAMS_SEAT_YEARLY_USD = 76;
export const TEAMS_MIN_SEATS = 3;
export const TEAMS_MAX_SEATS = 100;
export const TEAMS_DEFAULT_SEATS = 5;
export const TEAMS_TRIAL_DAYS = 7;
export const TEAMS_LOGO_SIZE_PX = 512;

/** Team Mode requires paid/trialing org billing — not merely membership. */
export function isTeamBillingActive(
	billingStatus: string | null | undefined,
): boolean {
	return billingStatus === 'active' || billingStatus === 'trialing';
}

export const TEAMS_BILLING = {
	monthly: {
		interval: 'monthly' as const,
		label: 'Monthly',
		perSeatLabel: `$${TEAMS_SEAT_MONTHLY_USD}`,
		priceSuffix: 'per seat / month',
	},
	yearly: {
		interval: 'yearly' as const,
		label: 'Yearly',
		perSeatLabel: `$${TEAMS_SEAT_YEARLY_USD}`,
		priceSuffix: 'per seat / year',
		perMonthEquivalent: `$${Math.round((TEAMS_SEAT_YEARLY_USD / 12) * 100) / 100}/seat/mo`,
	},
} as const;

export function clampTeamSeats(raw: number): number {
	if (!Number.isFinite(raw)) return TEAMS_DEFAULT_SEATS;
	return Math.min(TEAMS_MAX_SEATS, Math.max(TEAMS_MIN_SEATS, Math.round(raw)));
}

export function teamsTotalPriceUsd(
	seats: number,
	interval: BillingInterval,
): number {
	const n = clampTeamSeats(seats);
	return interval === 'yearly'
		? n * TEAMS_SEAT_YEARLY_USD
		: n * TEAMS_SEAT_MONTHLY_USD;
}

export function formatTeamsPrice(seats: number, interval: BillingInterval): string {
	const total = teamsTotalPriceUsd(seats, interval);
	return `$${total}`;
}

