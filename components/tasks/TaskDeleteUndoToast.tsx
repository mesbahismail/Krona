'use client';

import { Box, Button, Snackbar, Typography } from '@mui/joy';
import { Undo2 } from 'lucide-react';
import { TASK_DELETE_UNDO_MS } from '@/lib/taskDeleteCommit';

type TaskDeleteUndoToastProps = {
	open: boolean;
	onClose: (event: React.SyntheticEvent | Event | null, reason?: string) => void;
	onRevert: () => void;
	message?: string;
	bottomOffset?: number | string;
};

export default function TaskDeleteUndoToast({
	open,
	onClose,
	onRevert,
	message = 'Task deleted',
	bottomOffset = 24,
}: TaskDeleteUndoToastProps) {
	return (
		<Snackbar
			open={open}
			autoHideDuration={TASK_DELETE_UNDO_MS}
			onClose={onClose}
			anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
			sx={{
				bottom: `${
					typeof bottomOffset === 'number' ? `${bottomOffset}px` : bottomOffset
				} !important`,
				left: '50% !important',
				right: 'auto !important',
				transform: 'translateX(-50%) !important',
				width: 'max-content',
				maxWidth: 'calc(100vw - 32px)',
				'& .MuiSnackbar-root': {
					backgroundColor: 'transparent',
				},
			}}
			slotProps={{
				root: {
					sx: {
						backgroundColor: 'transparent',
						border: 'none',
						boxShadow: 'none',
					},
				},
			}}
		>
			<Box
				sx={{
					display: 'flex',
					alignItems: 'center',
					gap: 2,
					px: 2,
					py: 1.5,
					background: 'var(--krona-dropdown-bg)',
					borderRadius: '20px',
					border: '1px solid var(--krona-surface-border)',
					boxShadow: '0 12px 40px rgba(0, 0, 0, 0.18)',
					color: 'var(--krona-text)',
				}}
			>
				<Typography
					level="body-sm"
					sx={{ color: 'var(--krona-text)', fontWeight: 500, fontSize: '14px' }}
				>
					{message}
				</Typography>
				<Button
					variant="plain"
					size="sm"
					startDecorator={<Undo2 size={16} />}
					onClick={onRevert}
					sx={{
						color: 'var(--krona-text)',
						minHeight: '32px',
						px: 1.5,
						borderRadius: '999px',
						fontWeight: 500,
						fontSize: '14px',
						textTransform: 'none',
						'&:hover': {
							bgcolor: 'var(--krona-secondary-bg)',
						},
					}}
				>
					Revert
				</Button>
			</Box>
		</Snackbar>
	);
}
