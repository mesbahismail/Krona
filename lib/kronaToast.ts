import toast, { type ToastOptions } from 'react-hot-toast';
import { createElement, type ReactElement } from 'react';
import KronaToastContent from '@/components/krona/KronaToastContent';

const kronaToastBaseStyle: Record<string, string | number> = {
	background: 'color-mix(in srgb, var(--krona-dropdown-bg) 76%, transparent)',
	border: '1px solid var(--krona-surface-border)',
	color: 'var(--krona-text, #fff)',
	backdropFilter: 'blur(32px) saturate(200%)',
	WebkitBackdropFilter: 'blur(32px) saturate(200%)',
	boxShadow: '0 12px 40px rgba(0, 0, 0, 0.18)',
	borderRadius: '20px',
	padding: '16px',
	fontSize: '14px',
	fontFamily: 'Poppins, sans-serif',
	maxWidth: 'min(440px, calc(100vw - 32px))',
};

const successStyle: Record<string, string | number> = {
	...kronaToastBaseStyle,
	borderColor: 'rgba(74, 222, 128, 0.4)',
};

const errorStyle: Record<string, string | number> = {
	...kronaToastBaseStyle,
	borderColor: 'rgba(248, 113, 113, 0.45)',
};

const defaultOptions: ToastOptions = {
	duration: 5000,
	position: 'bottom-center',
};

export function showKronaSuccess(message: string, options?: ToastOptions) {
	toast.remove();
	return toast(createElement(KronaToastContent, { message, kind: 'success' }), {
		...defaultOptions,
		...options,
		style: { ...successStyle, ...options?.style },
	});
}

export function showKronaError(message: string, options?: ToastOptions) {
	toast.remove();
	return toast(createElement(KronaToastContent, { message, kind: 'error' }), {
		...defaultOptions,
		...options,
		style: { ...errorStyle, ...options?.style },
	});
}

export function showKronaToast(message: string, options?: ToastOptions) {
	toast.remove();
	return toast(createElement(KronaToastContent, { message, kind: 'info' }), {
		...defaultOptions,
		...options,
		style: { ...kronaToastBaseStyle, ...options?.style },
	});
}

export function showKronaAiToast(
	render: (t: { id: string }) => ReactElement,
	options?: ToastOptions,
) {
	toast.remove();
	return toast.custom((t) => render({ id: t.id }), {
		duration: 12_000,
		position: 'bottom-center',
		...options,
	});
}
