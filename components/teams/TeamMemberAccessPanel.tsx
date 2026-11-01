'use client';

import * as React from 'react';
import { Box, Typography } from '@mui/joy';
import KronaTaskCheckbox from '@/components/krona/KronaTaskCheckbox';
import {
	DEFAULT_TEAM_EMPLOYEE_PERMISSIONS,
	TEAM_MEMBER_ACCESS_OPTIONS,
	type TeamEmployeePermissions,
} from '@/lib/teams/employeePermissions';
import { kronaTaskListCheckboxContentGap } from '@/lib/kronaStyles';

type Props = {
	value?: TeamEmployeePermissions;
	onChange?: (next: TeamEmployeePermissions) => void;
	onSave?: (next: TeamEmployeePermissions) => Promise<void> | void;
	disabled?: boolean;
	idPrefix?: string;
};

export default function TeamMemberAccessPanel({
	value,
	onChange,
	onSave,
	disabled = false,
	idPrefix = 'member-access',
}: Props) {
	const [draft, setDraft] = React.useState<TeamEmployeePermissions>(
		value ?? DEFAULT_TEAM_EMPLOYEE_PERMISSIONS,
	);
	const [busy, setBusy] = React.useState(false);

	React.useEffect(() => {
		if (value) setDraft(value);
	}, [value]);

	const apply = async (next: TeamEmployeePermissions) => {
		setDraft(next);
		onChange?.(next);
		if (!onSave) return;
		setBusy(true);
		try {
			await onSave(next);
		} finally {
			setBusy(false);
		}
	};

	return (
		<Box sx={{ mt: 2, pt: 2, borderTop: '1px solid var(--krona-surface-border)' }}>
			<Typography
				level="title-sm"
				sx={{ color: 'var(--krona-text)', fontWeight: 600, mb: 1.25 }}
			>
				Member access
			</Typography>
			<Box sx={{ display: 'grid', gap: 1 }}>
				{TEAM_MEMBER_ACCESS_OPTIONS.map((item) => {
					const checked = draft[item.key];
					return (
						<Box
							key={`${idPrefix}-${item.key}`}
							sx={{
								display: 'flex',
								alignItems: 'center',
								gap: kronaTaskListCheckboxContentGap,
								opacity: disabled || busy ? 0.72 : 1,
							}}
						>
							<KronaTaskCheckbox
								checked={checked}
								disabled={disabled || busy}
								aria-label={item.label}
								onChange={() => {
									void apply({ ...draft, [item.key]: !checked });
								}}
							/>
							<Typography
								level="body-sm"
								sx={{ color: 'var(--krona-text)', fontWeight: 600 }}
							>
								{item.label}
							</Typography>
						</Box>
					);
				})}
			</Box>
		</Box>
	);
}
