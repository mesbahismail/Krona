/**
 * Krona Office — owner-only control center (analytics later).
 * Keep this allowlist separate from general admin emails.
 */
const KRONA_OFFICE_OWNER_EMAILS = ['mesbahismailone@gmail.com'] as const;

function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}

/** True only for the Krona Office owner account. */
export function isKronaOfficeOwner(email: string | null | undefined): boolean {
	if (!email) return false;
	const normalized = normalizeEmail(email);
	return KRONA_OFFICE_OWNER_EMAILS.some((allowed) => allowed === normalized);
}
