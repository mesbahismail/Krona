'use client';

import * as React from 'react';
import { TASK_DELETE_UNDO_MS } from '@/lib/taskDeleteCommit';

type UseTaskDeleteUndoOptions<T> = {
	onCommit: (item: T) => void | Promise<void>;
	onRevert: (item: T) => void;
	undoMs?: number;
};

export function useTaskDeleteUndo<T>({
	onCommit,
	onRevert,
	undoMs = TASK_DELETE_UNDO_MS,
}: UseTaskDeleteUndoOptions<T>) {
	const [open, setOpen] = React.useState(false);
	const [pending, setPending] = React.useState<T | null>(null);
	const pendingRef = React.useRef<T | null>(null);
	const timerRef = React.useRef<number | null>(null);
	const onCommitRef = React.useRef(onCommit);
	const onRevertRef = React.useRef(onRevert);

	React.useEffect(() => {
		onCommitRef.current = onCommit;
	}, [onCommit]);

	React.useEffect(() => {
		onRevertRef.current = onRevert;
	}, [onRevert]);

	React.useEffect(() => {
		pendingRef.current = pending;
	}, [pending]);

	const clearTimer = React.useCallback(() => {
		if (timerRef.current) {
			clearTimeout(timerRef.current);
			timerRef.current = null;
		}
	}, []);

	const flushPendingCommit = React.useCallback(async () => {
		const item = pendingRef.current;
		if (!item) return;
		clearTimer();
		pendingRef.current = null;
		setPending(null);
		setOpen(false);
		await onCommitRef.current(item);
	}, [clearTimer]);

	// If the user navigates away during the undo window, still commit the delete.
	React.useEffect(() => {
		const flush = () => {
			const item = pendingRef.current;
			if (!item) return;
			clearTimer();
			pendingRef.current = null;
			setPending(null);
			setOpen(false);
			void onCommitRef.current(item);
		};

		const onPageHide = () => flush();
		window.addEventListener('pagehide', onPageHide);
		return () => {
			window.removeEventListener('pagehide', onPageHide);
			flush();
		};
	}, [clearTimer]);

	const stage = React.useCallback(
		async (item: T, onStage: () => void) => {
			if (pendingRef.current) {
				await flushPendingCommit();
			}

			onStage();
			setPending(item);
			setOpen(true);
			clearTimer();

			timerRef.current = window.setTimeout(() => {
				timerRef.current = null;
				const current = pendingRef.current;
				if (!current) return;
				void (async () => {
					pendingRef.current = null;
					setPending(null);
					setOpen(false);
					await onCommitRef.current(current);
				})();
			}, undoMs);
		},
		[clearTimer, flushPendingCommit, undoMs],
	);

	const revert = React.useCallback(() => {
		const item = pendingRef.current;
		if (!item) return;
		clearTimer();
		pendingRef.current = null;
		setPending(null);
		setOpen(false);
		onRevertRef.current(item);
	}, [clearTimer]);

	const handleClose = React.useCallback(
		(_event: React.SyntheticEvent | Event | null, reason?: string) => {
			if (reason === 'clickaway') return;
			const item = pendingRef.current;
			clearTimer();
			pendingRef.current = null;
			setPending(null);
			setOpen(false);
			if (item) {
				void onCommitRef.current(item);
			}
		},
		[clearTimer],
	);

	return {
		open,
		pending,
		stage,
		revert,
		handleClose,
	};
}
