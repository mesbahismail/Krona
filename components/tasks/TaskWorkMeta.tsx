'use client';

import * as React from 'react';
import { Box, Typography } from '@mui/joy';
import {
	formatHoursLeftLabel,
	formatHoursWorkLabel,
	formatTaskDeadlineLabel,
} from '@/lib/taskTime';

function TaskMetaDot() {
	return (
		<Box
			aria-hidden
			sx={{
				width: 6,
				height: 6,
				borderRadius: '50%',
				flexShrink: 0,
				bgcolor: 'var(--krona-text)',
				opacity: 0.36,
			}}
		/>
	);
}

export default function TaskWorkMeta({
	leading,
	workedSeconds,
	assignedHours,
	deadline,
}: {
	leading?: string | null;
	workedSeconds: number;
	assignedHours?: number | null;
	deadline?: string | null;
}) {
	const workedHours = workedSeconds / 3600;
	const assigned =
		assignedHours != null && Number.isFinite(assignedHours) && assignedHours > 0
			? assignedHours
			: null;
	const leftHours = assigned != null ? assigned - workedHours : null;
	const deadlineLabel = formatTaskDeadlineLabel(deadline);
	const parts = [
		leading?.trim() || null,
		formatHoursWorkLabel(workedHours),
		leftHours != null ? formatHoursLeftLabel(leftHours) : null,
		deadlineLabel,
	].filter((part): part is string => Boolean(part));

	if (parts.length === 0) return null;

	return (
		<Box
			sx={{
				display: 'flex',
				alignItems: 'center',
				flexWrap: 'nowrap',
				gap: 0.75,
				minWidth: 0,
				...(leading ? { mt: 0.25 } : null),
				color: 'var(--krona-text-muted)',
			}}
		>
			{parts.map((part, index) => (
				<React.Fragment key={`${part}-${index}`}>
					{index > 0 ? <TaskMetaDot /> : null}
					<Typography
						level="body-xs"
						sx={{
							color: 'inherit',
							overflow: 'hidden',
							textOverflow: 'ellipsis',
							whiteSpace: 'nowrap',
						}}
					>
						{part}
					</Typography>
				</React.Fragment>
			))}
		</Box>
	);
}
