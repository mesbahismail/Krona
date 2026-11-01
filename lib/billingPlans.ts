export type BillingInterval = 'monthly' | 'yearly';

export const BILLING_INTERVALS = ['monthly', 'yearly'] as const;

export function isBillingInterval(value: unknown): value is BillingInterval {
	return value === 'monthly' || value === 'yearly';
}

/** Lemon Squeezy list prices (USD). */
export const MONTHLY_PRICE_USD = 9;
export const YEARLY_PRICE_USD = 76;
/** Yearly ÷ 12, rounded to cents. */
export const YEARLY_PER_MONTH_USD = 6.33;
export const YEARLY_SAVINGS_PER_MONTH_USD = 2.67;
export const YEARLY_SAVINGS_PERCENT = 30;

/** Display copy for Pro checkout (matches Lemon Squeezy prices). */
export const BILLING_PLANS = {
	monthly: {
		interval: 'monthly' as const,
		label: 'Monthly',
		priceLabel: '$9',
		priceSuffix: 'monthly',
		/** Short line under the Pro title */
		priceLine: '$9 monthly',
	},
	yearly: {
		interval: 'yearly' as const,
		label: 'Yearly',
		priceLabel: '$76',
		priceSuffix: 'yearly',
		priceLine: '$76 yearly',
		/** Yearly price shown as a monthly rate. */
		perMonthLine: '$6.33/month',
		billedLine: 'Billed $76 yearly',
		compareLine: '$2.67 less than monthly',
	},
} as const;

/** Default Lemon Squeezy API variant id for Krona Pro monthly. */
export const DEFAULT_MONTHLY_VARIANT_ID = '1993100';

/** Default Lemon Squeezy API variant id for Krona Pro yearly. */
export const DEFAULT_YEARLY_VARIANT_ID = '1778511';

/** Preferred default billing tab on upgrade. */
export const DEFAULT_BILLING_INTERVAL: BillingInterval = 'monthly';
