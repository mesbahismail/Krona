'use client';

import { localData } from '@/lib/localData';
import { defaultAvatarUrl } from '@/lib/defaultAvatar';
import { notifyAvatarUpdated } from '@/lib/kronaDataEvents';

const CUSTOM_AVATAR_MARKER = 'data:image/';

export function isCustomAvatarUrl(url: string | null | undefined): boolean {
	return Boolean(url?.includes(CUSTOM_AVATAR_MARKER));
}

export function googleAvatarFromMetadata(
	meta: Record<string, unknown> | null | undefined,
): string | null {
	const candidates = [
		typeof meta?.google_picture === 'string' ? meta.google_picture.trim() : '',
		typeof meta?.picture === 'string' ? meta.picture.trim() : '',
		typeof meta?.avatar_url === 'string' ? meta.avatar_url.trim() : '',
	];
	for (const url of candidates) {
		if (url && !isCustomAvatarUrl(url)) return url;
	}
	return null;
}

export function resolveUserAvatarUrl(input: {
	userId?: string | null;
	email?: string | null;
	profileAvatarUrl?: string | null;
	metadata?: Record<string, unknown> | null;
}): string {
	const profile = input.profileAvatarUrl?.trim();
	if (profile) return profile;
	const fromMeta = googleAvatarFromMetadata(input.metadata);
	if (fromMeta) return fromMeta;
	return defaultAvatarUrl(input.email || input.userId || 'krona');
}

export async function loadProfileAvatarUrl(userId: string): Promise<string | null> {
	const { data } = await localData
		.from('profiles')
		.select('avatar_url')
		.eq('id', userId)
		.maybeSingle();
	const url = typeof data?.avatar_url === 'string' ? data.avatar_url.trim() : '';
	return url || null;
}

/** Copy the Gmail/Google photo onto the profile when the user has not uploaded one. */
export async function syncGoogleAvatarToProfile(input: {
	userId: string;
	metadata?: Record<string, unknown> | null;
}): Promise<string | null> {
	const current = await loadProfileAvatarUrl(input.userId);
	if (isCustomAvatarUrl(current)) return current;
	const google = googleAvatarFromMetadata(input.metadata);
	if (!google) return current;
	if (current === google) return current;
	await localData
		.from('profiles')
		.update({ avatar_url: google, updated_at: new Date().toISOString() })
		.eq('id', input.userId);
	return google;
}

export async function uploadUserAvatar(
	userId: string,
	file: File,
): Promise<{ url: string } | { error: string }> {
	if (!file.type.startsWith('image/')) {
		return { error: 'Please upload a PNG, JPEG, or WebP image.' };
	}
	if (file.size > 2 * 1024 * 1024) {
		return { error: 'Photo must be under 2 MB.' };
	}

	const ext =
		file.type === 'image/png'
			? 'png'
			: file.type === 'image/webp'
				? 'webp'
				: 'jpg';
	const path = `${userId}/avatar.${ext}`;
	const { error: uploadError } = await localData.storage
		.from('avatars')
		.upload(path, file, { upsert: true, contentType: file.type });
	if (uploadError) return { error: uploadError.message };

	const { data } = localData.storage.from('avatars').getPublicUrl(path);
	const url = data.publicUrl?.trim();
	if (!url) return { error: 'Could not resolve profile photo URL.' };

	const { data: updated, error: profileError } = await localData
		.from('profiles')
		.update({ avatar_url: url, updated_at: new Date().toISOString() })
		.eq('id', userId)
		.select('avatar_url')
		.maybeSingle();
	if (profileError) return { error: profileError.message };
	if (!updated?.avatar_url?.trim()) {
		return { error: 'Could not save profile photo.' };
	}

	const { error: authError } = await localData.auth.updateUser({
		data: { avatar_url: url, krona_custom_avatar: true },
	});
	if (authError) return { error: authError.message };

	const displayUrl = url;
	notifyAvatarUpdated(displayUrl);
	return { url: displayUrl };
}

export async function revertUserAvatarToGoogle(input: {
	userId: string;
	metadata?: Record<string, unknown> | null;
}): Promise<{ url: string | null } | { error: string }> {
	try {
		const { data: files } = await localData.storage.from('avatars').list(input.userId);
		if (files?.length) {
			await localData.storage
				.from('avatars')
				.remove(files.map((file) => `${input.userId}/${file.name}`));
		}
	} catch {
		/* profile row is the source of truth */
	}

	const googleRaw =
		(typeof input.metadata?.google_picture === 'string' &&
			input.metadata.google_picture.trim()) ||
		(typeof input.metadata?.picture === 'string' &&
			input.metadata.picture.trim()) ||
		'';
	const next = googleRaw && !isCustomAvatarUrl(googleRaw) ? googleRaw : null;

	const { error } = await localData
		.from('profiles')
		.update({ avatar_url: next, updated_at: new Date().toISOString() })
		.eq('id', input.userId);
	if (error) return { error: error.message };

	await localData.auth.updateUser({
		data: {
			avatar_url: next,
			krona_custom_avatar: false,
		},
	});
	notifyAvatarUpdated(next);
	return { url: next };
}
