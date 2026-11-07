'use client';

import { Bell, Check, CircleAlert, X } from 'lucide-react';
import toast from 'react-hot-toast';

type Props = { message: string; kind: 'info' | 'success' | 'error' };

export default function KronaToastContent({ message, kind }: Props) {
	const separator = message.includes(' — ') ? ' — ' : message.includes(': ') ? ': ' : null;
	const split = separator ? message.indexOf(separator) : -1;
	const title = split > 0 ? message.slice(0, split) : kind === 'success' ? 'All set' : kind === 'error' ? 'Something needs attention' : 'Workspace update';
	const subtitle = split > 0 ? message.slice(split + separator!.length) : message;
	const Icon = kind === 'success' ? Check : kind === 'error' ? CircleAlert : Bell;
	return (
		<div className="krona-toast-content">
			<span className={`krona-toast-icon krona-toast-icon--${kind}`} aria-hidden="true"><Icon size={18} /></span>
			<div className="krona-toast-copy"><strong>{title}</strong><p>{subtitle}</p></div>
			<button className="krona-toast-close" aria-label="Dismiss notification" onClick={() => toast.dismiss()}><X size={16} /></button>
		</div>
	);
}
