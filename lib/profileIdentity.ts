/** Last-write-wins name + profession across auth, personal, profiles, and team. */

export const KRONA_NAME_USER_SET_KEY = 'krona_name_user_set';
export const KRONA_JOB_USER_SET_KEY = 'krona_job_user_set';

type IdentityMeta = Record<string, unknown> | null | undefined;

export function isIdentityFieldUserSet(
	meta: IdentityMeta,
	field: 'name' | 'job',
): boolean {
	const key = field === 'name' ? KRONA_NAME_USER_SET_KEY : KRONA_JOB_USER_SET_KEY;
	return (meta ?? {})[key] === true;
}

export function splitFullName(full: string): {
	firstName: string;
	lastName: string;
} {
	const parts = full.trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) return { firstName: '', lastName: '' };
	if (parts.length === 1) return { firstName: parts[0], lastName: '' };
	return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

export function composeFullName(
	firstName?: string | null,
	lastName?: string | null,
	fallback?: string | null,
): string {
	const fromParts = `${firstName ?? ''} ${lastName ?? ''}`.trim();
	return fromParts || String(fallback ?? '').trim();
}

/** Avoid the generated local storage client — its generics overflow the type checker. */
type IdentityDb = {
	from: (table: string) => any;
};

type SelfAuth = {
	kind: 'self';
	updateUser: (args: { data: Record<string, unknown> }) => Promise<unknown>;
};

type AdminAuth = {
	kind: 'admin';
	getUserById: (id: string) => Promise<{
		data: { user: { user_metadata?: IdentityMeta } | null };
	}>;
	updateUserById: (
		id: string,
		attrs: { user_metadata: Record<string, unknown> },
	) => Promise<unknown>;
};

export type ApplyNameAndJobInput = {
	db: IdentityDb;
	userId: string;
	email?: string | null;
	/** Omit to leave name unchanged. */
	fullName?: string | null;
	/** Omit to leave job unchanged. Empty string clears the job. */
	jobTitle?: string | null;
	/** Owner or member edit — Google must not overwrite afterwards. */
	markUserSet?: boolean;
	auth?: SelfAuth | AdminAuth;
};

export async function applyNameAndJob(
	input: ApplyNameAndJobInput,
): Promise<void> {
	const nameProvided = input.fullName !== undefined;
	const jobProvided = input.jobTitle !== undefined;
	if (!nameProvided && !jobProvided) return;

	const fullName = nameProvided ? String(input.fullName ?? '').trim() : '';
	const { firstName, lastName } = splitFullName(fullName);
	const jobTitle = jobProvided ? String(input.jobTitle ?? '').trim() : '';

	const { data: existingPersonal } = await input.db
		.from('personal')
		.select('email_address, first_name, last_name, profession')
		.eq('user_id', input.userId)
		.maybeSingle();
	const { data: existingProfile } = await input.db
		.from('profiles')
		.select('email, first_name, last_name, full_name')
		.eq('id', input.userId)
		.maybeSingle();

	const email =
		String(input.email ?? '').trim() ||
		String(existingPersonal?.email_address ?? '').trim() ||
		String(existingProfile?.email ?? '').trim();

	const personalRow: Record<string, unknown> = {
		user_id: input.userId,
		email_address: email,
	};
	if (nameProvided) {
		personalRow.first_name = firstName;
		personalRow.last_name = lastName;
	}
	if (jobProvided) {
		personalRow.profession = jobTitle || null;
	}
	await input.db.from('personal').upsert(personalRow, { onConflict: 'user_id' });

	const profileRow: Record<string, unknown> = {
		id: input.userId,
		email,
	};
	if (nameProvided) {
		profileRow.first_name = firstName;
		profileRow.last_name = lastName;
		profileRow.full_name = fullName;
	}
	await input.db.from('profiles').upsert(profileRow, { onConflict: 'id' });

	if (jobProvided) {
		await input.db
			.from('organization_members')
			.update({ job_title: jobTitle || null })
			.eq('user_id', input.userId)
			.eq('status', 'active');
	}

	if (!input.auth) return;

	const data: Record<string, unknown> = {};
	if (nameProvided) {
		data.first_name = firstName;
		data.last_name = lastName;
		data.full_name = fullName;
		data.name = fullName;
		if (input.markUserSet) data[KRONA_NAME_USER_SET_KEY] = true;
	}
	if (jobProvided) {
		data.job = jobTitle;
		data.profession = jobTitle;
		if (input.markUserSet) data[KRONA_JOB_USER_SET_KEY] = true;
	}

	if (input.auth.kind === 'self') {
		await input.auth.updateUser({ data });
		return;
	}

	const { data: authUser } = await input.auth.getUserById(input.userId);
	const current = {
		...((authUser.user?.user_metadata ?? {}) as Record<string, unknown>),
	};
	await input.auth.updateUserById(input.userId, {
		user_metadata: { ...current, ...data },
	});
}
