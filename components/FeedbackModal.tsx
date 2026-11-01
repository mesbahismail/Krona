'use client';

import { localService } from '@/lib/localService';

import * as React from 'react';
import {
	Box,
	Button,
	IconButton,
	Modal,
	ModalDialog,
	Typography,
} from '@mui/joy';
import { X } from 'lucide-react';
import {
	kronaModalCloseButtonSx,
	kronaModalDialogSx,
	kronaPrimaryButtonSx,
} from '@/lib/kronaStyles';
import { kronaPlaceholders } from '@/lib/kronaPlaceholders';
import { showKronaError, showKronaSuccess } from '@/lib/kronaToast';

type FeedbackModalProps = {
	open: boolean;
	onClose: () => void;
};

export default function FeedbackModal({ open, onClose }: FeedbackModalProps) {
	const [message, setMessage] = React.useState('');
	const [submitting, setSubmitting] = React.useState(false);
	const textareaRef = React.useRef<HTMLTextAreaElement>(null);

	const MIN_TEXTAREA_HEIGHT = 240;
	const MAX_TEXTAREA_HEIGHT = 420;

	const syncTextareaHeight = React.useCallback(() => {
		const el = textareaRef.current;
		if (!el) return;
		el.style.height = 'auto';
		const contentHeight = el.scrollHeight;
		const next = Math.min(
			Math.max(contentHeight, MIN_TEXTAREA_HEIGHT),
			MAX_TEXTAREA_HEIGHT,
		);
		el.style.height = `${next}px`;
		el.style.overflowY = contentHeight > MAX_TEXTAREA_HEIGHT ? 'auto' : 'hidden';
	}, []);

	React.useEffect(() => {
		if (!open) return;
		syncTextareaHeight();
	}, [open, message, syncTextareaHeight]);

	const handleClose = () => {
		if (submitting) return;
		setMessage('');
		onClose();
	};

	const handleSubmit = async () => {
		const trimmed = message.trim();
		if (!trimmed) {
			showKronaError('Please enter your feedback before submitting.');
			return;
		}
		setSubmitting(true);
		try {
			const res = await localService('feedback', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ message: trimmed }),
			});

			const payload = (await res.json().catch(() => null)) as {
				error?: string;
			} | null;

			if (res.status === 401) {
				showKronaError('You must be signed in to send feedback.');
				return;
			}

			if (!res.ok) {
				showKronaError(
					payload?.error ?? 'Could not send feedback. Please try again.',
				);
				return;
			}

			showKronaSuccess('Feedback saved on this device. It has not been sent.');
			setMessage('');
			onClose();
		} catch {
			showKronaError('Could not send feedback. Please try again.');
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<Modal open={open} onClose={handleClose}>
			<ModalDialog
				sx={{
					...kronaModalDialogSx,
					position: 'relative',
					width: { xs: 'min(92vw, 420px)', sm: '30vw' },
					minWidth: { xs: 280, sm: 280 },
					maxWidth: { xs: 420, sm: '30vw' },
					maxHeight: '90vh',
					overflowY: 'auto',
				}}
			>
				<IconButton
					size="sm"
					aria-label="Close feedback"
					onClick={handleClose}
					sx={kronaModalCloseButtonSx}
				>
					<X size={18} />
				</IconButton>
				<Typography level="h4" sx={{ color: 'var(--krona-text)', mb: 0.5, pr: 4 }}>
					Save feedback draft
				</Typography>
				<Typography level="body-sm" sx={{ color: 'var(--krona-text-muted)', mb: 2 }}>
					Share bugs, ideas, or anything that would make Krona better for you.
				</Typography>
				<Box
					component="textarea"
					ref={textareaRef}
					placeholder={kronaPlaceholders.feedback.message}
					value={message}
					rows={1}
					onChange={(e) => setMessage(e.target.value)}
					onInput={syncTextareaHeight}
					sx={{
						display: 'block',
						mb: 2,
						width: '100%',
						minHeight: MIN_TEXTAREA_HEIGHT,
						maxHeight: MAX_TEXTAREA_HEIGHT,
						height: MIN_TEXTAREA_HEIGHT,
						resize: 'none',
						overflowY: 'hidden',
						boxSizing: 'border-box',
						borderRadius: '20px',
						bgcolor: 'color-mix(in srgb, var(--krona-text) 6%, transparent)',
						border: '1px solid var(--krona-surface-border)',
						color: 'var(--krona-text)',
						lineHeight: 1.5,
						px: 1.75,
						py: 1.5,
						fontFamily: 'inherit',
						fontSize: 'var(--joy-fontSize-md, 0.875rem)',
						'&::placeholder': {
							color: 'var(--krona-text-muted)',
							opacity: 1,
							transition: 'opacity 0.15s ease',
						},
						'&:not(:placeholder-shown)::placeholder': {
							opacity: 0,
						},
						'&:focus-visible': {
							outline: 'none',
							borderColor: 'var(--krona-widget-border-hover)',
						},
					}}
				/>
				<Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
					<Button
						variant="plain"
						onClick={handleClose}
						disabled={submitting}
						sx={{ borderRadius: '999px', color: 'var(--krona-text-muted)' }}
					>
						Cancel
					</Button>
					<Button
						onClick={() => void handleSubmit()}
						loading={submitting}
						sx={kronaPrimaryButtonSx}
					>
						Save draft
					</Button>
				</Box>
			</ModalDialog>
		</Modal>
	);
}
