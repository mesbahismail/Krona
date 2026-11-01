'use client';

import { Box, Button, IconButton, Modal, ModalDialog, Typography } from '@mui/joy';
import { X } from 'lucide-react';
import {
	kronaDeleteButtonSx,
	kronaModalCloseButtonSx,
	kronaModalDialogSx,
	kronaSecondaryButtonSx,
} from '@/lib/kronaStyles';

export default function TaskDailyChallengeDeleteModal({
	open,
	taskName,
	onClose,
	onConfirm,
}: {
	open: boolean;
	taskName: string;
	onClose: () => void;
	onConfirm: () => void;
}) {
	const label = taskName.trim() || 'This task';

	return (
		<Modal open={open} onClose={onClose}>
			<ModalDialog
				sx={{
					...kronaModalDialogSx,
					position: 'relative',
					px: { xs: '20px', sm: '24px' },
					py: '18px',
				}}
			>
				<IconButton
					size="sm"
					aria-label="Close"
					onClick={onClose}
					sx={kronaModalCloseButtonSx}
				>
					<X size={18} />
				</IconButton>
				<Typography
					level="h4"
					sx={{ mb: 1, pr: 4, color: 'var(--krona-text)' }}
				>
					Remove from daily challenges?
				</Typography>
				<Typography
					level="body-md"
					sx={{
						mb: 2,
						color: 'var(--krona-text-muted)',
						lineHeight: 1.5,
					}}
				>
					<strong style={{ color: 'var(--krona-text)' }}>{label}</strong> is
					part of today’s daily challenges. Deleting it will also remove it from
					those challenges.
				</Typography>
				<Box sx={{ display: 'flex', gap: 1 }}>
					<Button
						type="button"
						fullWidth
						onClick={onClose}
						sx={kronaSecondaryButtonSx}
					>
						Cancel
					</Button>
					<Button
						type="button"
						fullWidth
						onClick={(event) => {
							event.preventDefault();
							event.stopPropagation();
							onConfirm();
						}}
						sx={kronaDeleteButtonSx}
					>
						Delete task
					</Button>
				</Box>
			</ModalDialog>
		</Modal>
	);
}
