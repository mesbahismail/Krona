import toast, { type ToastOptions } from 'react-hot-toast';
import type { ReactElement } from 'react';

const kronaToastBaseStyle: Record<string, string | number> = {
	background: 'var(--krona-dropdown-bg)',
	border: '1px solid var(--krona-surface-border)',
	color: 'var(--krona-text, #fff)',
	backdropFilter: 'blur(32px) saturate(200%)',
	WebkitBackdropFilter: 'blur(32px) saturate(200%)',
	boxShadow: '0 12px 40px rgba(0, 0, 0, 0.18)',
	borderRadius: '20px',
	padding: '12px 16px',
	fontSize: '14px',
	fontFamily: 'Poppins, sans-serif',
	maxWidth: 420,
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
	return toast.success(message, {
		...defaultOptions,
		...options,
		style: { ...successStyle, ...options?.style },
	});
}

export function showKronaError(message: string, options?: ToastOptions) {
	return toast.error(message, {
		...defaultOptions,
		...options,
		style: { ...errorStyle, ...options?.style },
	});
}

export function showKronaToast(message: string, options?: ToastOptions) {
	return toast(message, {
		...defaultOptions,
		...options,
		style: { ...kronaToastBaseStyle, ...options?.style },
	});
}

export function showKronaAiToast(
	render: (t: { id: string }) => ReactElement,
	options?: ToastOptions,
) {
	return toast.custom((t) => render({ id: t.id }), {
		duration: 12_000,
		position: 'bottom-center',
		...options,
	});
}
