/** Parse birth date from ISO or typed DD/MM/YYYY (also `-` / `.` separators). */
export function parseBirthDateInput(raw: string): string | null {
	const trimmed = raw.trim();
	if (!trimmed) return null;

	if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
		return isValidYmdParts(trimmed) ? trimmed : null;
	}

	// Prefer DD/MM/YYYY to match the birth-date UI.
	const eu = trimmed.match(
		/^(\d{1,2})\s*[\/.-]\s*(\d{1,2})\s*[\/.-]\s*(\d{4})$/,
	);
	if (eu) {
		const day = Number(eu[1]);
		const month = Number(eu[2]);
		const year = Number(eu[3]);
		if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) {
			return null;
		}
		const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
		return isValidYmdParts(iso) ? iso : null;
	}

	return null;
}

function isValidYmdParts(iso: string): boolean {
	const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (!match) return false;
	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	if (month < 1 || month > 12 || day < 1 || day > 31) return false;
	const date = new Date(Date.UTC(year, month - 1, day));
	return (
		date.getUTCFullYear() === year &&
		date.getUTCMonth() === month - 1 &&
		date.getUTCDate() === day
	);
}

/** Normalize birthday from `personal.birthday` or auth `user_metadata.birth_date`. */
export function resolveBirthday(
	personalBirthday: string | null | undefined,
	userMetadata?: Record<string, unknown> | null,
): string {
	if (personalBirthday) {
		const raw = String(personalBirthday);
		if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
	}
	const metaKeys = ['birth_date', 'birthday', 'birthdate', 'date_of_birth'] as const;
	for (const key of metaKeys) {
		const meta = userMetadata?.[key];
		if (typeof meta === 'string') {
			const parsed = parseBirthDateInput(meta) ?? (/^\d{4}-\d{2}-\d{2}/.test(meta) ? meta.slice(0, 10) : '');
			if (parsed) return parsed;
		}
	}
	return '';
}

export function hasBirthday(
	personalBirthday: string | null | undefined,
	_userMetadata?: Record<string, unknown> | null,
): boolean {
	// Gate on the saved profile row only. Auth metadata (e.g. Google People)
	// is used to prefill the form, not to skip it.
	if (!personalBirthday) return false;
	const raw = String(personalBirthday);
	return /^\d{4}-\d{2}-\d{2}/.test(raw);
}
