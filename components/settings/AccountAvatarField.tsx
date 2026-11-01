'use client';

import * as React from 'react';
import { Avatar, Box, Button, Typography } from '@mui/joy';
import { defaultAvatarUrl } from '@/lib/defaultAvatar';
import { showKronaError, showKronaSuccess } from '@/lib/kronaToast';
import {
	isCustomAvatarUrl,
	loadProfileAvatarUrl,
	resolveUserAvatarUrl,
	revertUserAvatarToGoogle,
	syncGoogleAvatarToProfile,
	uploadUserAvatar,
} from '@/lib/userAvatar';
import { localData } from '@/lib/localData';
import { kronaSecondaryButtonSx } from '@/lib/kronaStyles';

export default function AccountAvatarField() {
	const [userId, setUserId] = React.useState<string | null>(null);
	const [email, setEmail] = React.useState('');
	const [metadata, setMetadata] = React.useState<Record<string, unknown> | null>(
		null,
	);
	const [avatarUrl, setAvatarUrl] = React.useState<string | undefined>();
	const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
	const [busy, setBusy] = React.useState(false);
	const custom = isCustomAvatarUrl(avatarUrl);

	React.useEffect(() => {
		return () => {
			if (previewUrl?.startsWith('blob:')) {
				URL.revokeObjectURL(previewUrl);
			}
		};
	}, [previewUrl]);

	React.useEffect(() => {
		void (async () => {
			const { data: userRes } = await localData.auth.getUser();
			const user = userRes.user;
			if (!user) return;
			const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
			setUserId(user.id);
			setEmail(user.email || '');
			setMetadata(meta);
			const synced = await syncGoogleAvatarToProfile({
				userId: user.id,
				metadata: meta,
			});
			const profileUrl = synced ?? (await loadProfileAvatarUrl(user.id));
			setAvatarUrl(
				resolveUserAvatarUrl({
					userId: user.id,
					email: user.email,
					profileAvatarUrl: profileUrl,
					metadata: meta,
				}),
			);
		})();
	}, []);

	const onFile = async (file: File | null) => {
		if (!file || !userId) return;
		const localPreview = URL.createObjectURL(file);
		setPreviewUrl((prev) => {
			if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
			return localPreview;
		});
		setBusy(true);
		try {
			const result = await uploadUserAvatar(userId, file);
			if ('error' in result) {
				showKronaError(result.error);
				setPreviewUrl((prev) => {
					if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
					return null;
				});
				return;
			}
			setPreviewUrl((prev) => {
				if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
				return null;
			});
			setAvatarUrl(result.url);
			showKronaSuccess('Profile photo updated.');
		} finally {
			setBusy(false);
		}
	};

	const onRevert = async () => {
		if (!userId) return;
		setBusy(true);
		try {
			const result = await revertUserAvatarToGoogle({ userId, metadata });
			if ('error' in result) {
				showKronaError(result.error);
				return;
			}
			setAvatarUrl(
				resolveUserAvatarUrl({
					userId,
					email,
					profileAvatarUrl: result.url,
					metadata,
				}),
			);
			showKronaSuccess(
				result.url
					? 'Restored your Google photo.'
					: 'Profile photo removed.',
			);
		} finally {
			setBusy(false);
		}
	};

	return (
		<Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
			<Avatar
				src={previewUrl || avatarUrl || defaultAvatarUrl(email || userId || 'krona')}
				alt=""
				sx={{
					width: 72,
					height: 72,
					border: '1px solid var(--krona-surface-border)',
					bgcolor: 'var(--krona-secondary-bg)',
				}}
				slotProps={{
					img: {
						onError: () => {
							if (previewUrl) return;
							showKronaError(
								'Profile photo could not be loaded. Try uploading again.',
							);
						},
					},
				}}
			/>
			<Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
				<Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
					<Button component="label" disabled={busy} sx={kronaSecondaryButtonSx}>
						{custom ? 'Replace photo' : 'Upload photo'}
						<input
							type="file"
							accept="image/png,image/jpeg,image/webp"
							hidden
							onChange={(event) => {
								void onFile(event.target.files?.[0] ?? null);
								event.target.value = '';
							}}
						/>
					</Button>
					{custom ? (
						<Button
							disabled={busy}
							onClick={() => void onRevert()}
							sx={kronaSecondaryButtonSx}
						>
							Use Google photo
						</Button>
					) : null}
				</Box>
				<Typography level="body-xs" sx={{ color: 'var(--krona-text-muted)' }}>
					PNG, JPEG, or WebP up to 2 MB. You can replace a Gmail photo anytime.
				</Typography>
			</Box>
		</Box>
	);
}