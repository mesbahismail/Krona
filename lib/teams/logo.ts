'use client';

import { TEAMS_LOGO_SIZE_PX } from '@/lib/teams/billing';
import { localData } from '@/lib/localData';
import { updateOrganization } from '@/lib/teams/org';

/** Validate and upload a 512×512 team logo; returns public URL. */
export async function uploadTeamLogo(
	organizationId: string,
	file: File,
): Promise<{ url: string } | { error: string }> {
	if (!file.type.startsWith('image/')) {
		return { error: 'Please upload a PNG, JPEG, or WebP image.' };
	}
	if (file.size > 2 * 1024 * 1024) {
		return { error: 'Logo must be under 2 MB.' };
	}

	const dims = await readImageDimensions(file);
	if (
		dims &&
		(dims.width !== TEAMS_LOGO_SIZE_PX || dims.height !== TEAMS_LOGO_SIZE_PX)
	) {
		return {
			error: `Logo must be exactly ${TEAMS_LOGO_SIZE_PX}×${TEAMS_LOGO_SIZE_PX} px.`,
		};
	}

	const ext =
		file.type === 'image/png'
			? 'png'
			: file.type === 'image/webp'
				? 'webp'
				: 'jpg';
	const path = `${organizationId}/logo-${Date.now()}.${ext}`;
	const { error: uploadError } = await localData.storage
		.from('team-logos')
		.upload(path, file, { upsert: true, contentType: file.type });
	if (uploadError) return { error: uploadError.message };

	const { data } = localData.storage.from('team-logos').getPublicUrl(path);
	const url = data.publicUrl;
	await updateOrganization(organizationId, { logoUrl: url });
	return { url };
}

/** Clear the custom team logo so the app falls back to the Krona mark. */
export async function removeTeamLogo(
	organizationId: string,
): Promise<{ ok: true } | { error: string }> {
	try {
		const { data: files } = await localData.storage
			.from('team-logos')
			.list(organizationId);
		if (files?.length) {
			await localData.storage
				.from('team-logos')
				.remove(files.map((file) => `${organizationId}/${file.name}`));
		}
	} catch {
		/* column clear still restores the default mark */
	}

	const ok = await updateOrganization(organizationId, { logoUrl: null });
	if (!ok) return { error: 'Could not remove logo.' };
	return { ok: true };
}

function readImageDimensions(
	file: File,
): Promise<{ width: number; height: number } | null> {
	return new Promise((resolve) => {
		const url = URL.createObjectURL(file);
		const img = new Image();
		img.onload = () => {
			resolve({ width: img.naturalWidth, height: img.naturalHeight });
			URL.revokeObjectURL(url);
		};
		img.onerror = () => {
			URL.revokeObjectURL(url);
			resolve(null);
		};
		img.src = url;
	});
}
