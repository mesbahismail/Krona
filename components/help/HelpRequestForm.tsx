'use client';

import { localService } from '@/lib/localService';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { kronaPlaceholders } from '@/lib/kronaPlaceholders';
import { showKronaError, showKronaSuccess } from '@/lib/kronaToast';

export default function HelpRequestForm() {
	const [subject, setSubject] = React.useState('');
	const [message, setMessage] = React.useState('');
	const [submitting, setSubmitting] = React.useState(false);

	const canSubmit =
		subject.trim().length > 0 && message.trim().length > 0 && !submitting;

	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const trimmedSubject = subject.trim();
		const trimmedMessage = message.trim();

		if (!trimmedSubject) {
			showKronaError('Please enter a subject.');
			return;
		}
		if (!trimmedMessage) {
			showKronaError('Please describe what you need help with.');
			return;
		}

		setSubmitting(true);
		try {
			const res = await localService('help', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					subject: trimmedSubject,
					message: trimmedMessage,
				}),
			});

			const payload = (await res.json().catch(() => null)) as {
				error?: string;
			} | null;

			if (res.status === 401) {
				showKronaError('You must be signed in to send a help request.');
				return;
			}

			if (!res.ok) {
				showKronaError(
					payload?.error ?? 'Could not send your request. Please try again.',
				);
				return;
			}

			showKronaSuccess('Help request saved on this device. It has not been sent.');
			setSubject('');
			setMessage('');
		} catch {
			showKronaError('Could not send your request. Please try again.');
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<form className="mt-4 space-y-2" onSubmit={handleSubmit}>
			<input
				type="text"
				value={subject}
				onChange={(event) => setSubject(event.target.value)}
				placeholder={kronaPlaceholders.help.subject}
				maxLength={200}
				disabled={submitting}
				className="w-full rounded-2xl border border-[var(--krona-surface-border)] bg-[var(--krona-widget-bg)] px-3 py-2 text-[var(--krona-text)] shadow-[var(--krona-widget-item-shadow)] outline-none transition-[border-color] duration-200 focus:border-[var(--krona-widget-border-hover)] disabled:opacity-60"
			/>
			<textarea
				rows={4}
				value={message}
				onChange={(event) => setMessage(event.target.value)}
				placeholder={kronaPlaceholders.help.message}
				maxLength={5000}
				disabled={submitting}
				className="w-full rounded-2xl border border-[var(--krona-surface-border)] bg-[var(--krona-widget-bg)] px-3 py-2 text-[var(--krona-text)] shadow-[var(--krona-widget-item-shadow)] outline-none transition-[border-color] duration-200 focus:border-[var(--krona-widget-border-hover)] disabled:opacity-60"
			/>
			<div className="flex justify-end">
				<Button
					type="submit"
					variant="krona"
					disabled={!canSubmit}
					className="w-auto min-w-[9.5rem]"
				>
					{submitting ? 'Saving…' : 'Save draft'}
				</Button>
			</div>
		</form>
	);
}
