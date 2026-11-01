'use client';

import * as React from 'react';
import { Box, Button, Input, Typography } from '@mui/joy';
import { useTeamMode } from '@/components/teams/TeamModeContext';
import { TEAMS_LOGO_SIZE_PX } from '@/lib/teams/billing';
import { removeTeamLogo, uploadTeamLogo } from '@/lib/teams/logo';
import { updateOrganization } from '@/lib/teams/org';
import { showKronaError, showKronaSuccess } from '@/lib/kronaToast';
import {
	kronaPrimaryButtonSx,
	kronaSecondaryButtonSx,
	kronaSettingsButtonSx,
	kronaSettingsInputSx,
} from '@/lib/kronaStyles';

type TeamSettingsPanelProps = {
	SettingsField: React.ComponentType<{
		label: string;
		children: React.ReactNode;
	}>;
};

export default function TeamSettingsPanel({
	SettingsField,
}: TeamSettingsPanelProps) {
	const { organization, isOwner, refresh } = useTeamMode();
	const [loaded, setLoaded] = React.useState(false);
	const [saving, setSaving] = React.useState(false);
	const [uploading, setUploading] = React.useState(false);
	const [teamName, setTeamName] = React.useState('');
	const [logoUrl, setLogoUrl] = React.useState<string | null>(null);

	React.useEffect(() => {
		if (!organization) {
			setLoaded(true);
			return;
		}
		setTeamName(organization.name);
		setLogoUrl(organization.logoUrl);
		setLoaded(true);
	}, [organization]);

	if (!organization) {
		return (
			<Typography level="body-sm" sx={{ color: 'var(--krona-text-muted)' }}>
				Team Settings are available after you set up a team.
			</Typography>
		);
	}

	const canEdit = isOwner;

	const onLogoFile = async (file: File | null) => {
		if (!file || !canEdit) return;
		setUploading(true);
		try {
			const result = await uploadTeamLogo(organization.id, file);
			if ('error' in result) {
				showKronaError(result.error);
				return;
			}
			setLogoUrl(result.url);
			await refresh();
			showKronaSuccess('Team logo updated.');
		} finally {
			setUploading(false);
		}
	};

	const onRemoveLogo = async () => {
		if (!canEdit || !logoUrl) return;
		setUploading(true);
		try {
			const result = await removeTeamLogo(organization.id);
			if ('error' in result) {
				showKronaError(result.error);
				return;
			}
			setLogoUrl(null);
			await refresh();
			showKronaSuccess('Team logo removed.');
		} finally {
			setUploading(false);
		}
	};

	const handleSave = async () => {
		if (!canEdit) return;
		const name = teamName.trim();
		if (!name) {
			showKronaError('Enter a team name.');
			return;
		}
		setSaving(true);
		try {
			const ok = await updateOrganization(organization.id, { name });
			if (!ok) {
				showKronaError('Could not save team settings.');
				return;
			}
			await refresh();
			showKronaSuccess('Team settings saved.');
		} finally {
			setSaving(false);
		}
	};

	return (
		<>
			<Typography level="h4" sx={{ mb: 0.5, color: 'var(--krona-text)' }}>
				Team Settings
			</Typography>
			<Typography
				level="body-sm"
				sx={{ color: 'var(--krona-text-muted)', mb: 2, width: '100%' }}
			>
				Update your team name and company logo.
			</Typography>

			<Box
				sx={{
					display: 'flex',
					flexDirection: 'column',
					gap: 2,
					width: '100%',
					alignItems: 'stretch',
				}}
			>
				<SettingsField label="Team name">
					<Input
						value={teamName}
						onChange={(e) => setTeamName(e.target.value)}
						placeholder="Acme Product"
						disabled={!canEdit || !loaded}
						sx={kronaSettingsInputSx}
					/>
				</SettingsField>

				<SettingsField label={`Company logo (${TEAMS_LOGO_SIZE_PX}×${TEAMS_LOGO_SIZE_PX})`}>
					<Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
						<Box
							component="img"
							src={logoUrl || '/logo.svg'}
							alt={logoUrl ? 'Team logo' : 'Krona logo'}
							sx={{
								width: 72,
								height: 72,
								borderRadius: '16px',
								objectFit: 'cover',
								border: '1px solid var(--krona-surface-border)',
								bgcolor: 'var(--krona-secondary-bg)',
							}}
						/>
						{canEdit ? (
							<Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
								<Button
									component="label"
									disabled={uploading}
									sx={kronaSecondaryButtonSx}
								>
									{logoUrl ? 'Replace logo' : 'Upload logo'}
									<input
										type="file"
										accept="image/png,image/jpeg,image/webp"
										hidden
										onChange={(e) => {
											void onLogoFile(e.target.files?.[0] ?? null);
											e.target.value = '';
										}}
									/>
								</Button>
								{logoUrl ? (
									<Button
										disabled={uploading}
										onClick={() => void onRemoveLogo()}
										sx={kronaSecondaryButtonSx}
									>
										Remove
									</Button>
								) : null}
							</Box>
						) : null}
					</Box>
				</SettingsField>

				{canEdit ? (
					<Button
						variant="solid"
						loading={saving}
						disabled={!loaded}
						onClick={() => void handleSave()}
						sx={{
							...kronaPrimaryButtonSx,
							...kronaSettingsButtonSx,
							mt: 1,
						}}
					>
						Save Changes
					</Button>
				) : (
					<Typography level="body-sm" sx={{ color: 'var(--krona-text-muted)' }}>
						Only the team owner can edit team settings.
					</Typography>
				)}
			</Box>
		</>
	);
}
