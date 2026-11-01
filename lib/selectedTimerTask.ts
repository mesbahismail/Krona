'use client';

import { useCallback, useEffect, useState } from 'react';

export const SELECTED_TASK_ID_KEY = 'krona:selectedTaskId';
export const SELECTED_TASK_NAME_KEY = 'krona:selectedTaskName';
export const SELECTED_TASK_PROJECT_ID_KEY = 'krona:selectedTaskProjectId';
export const SELECTED_TASK_CHANGED_EVENT = 'krona:selected-task-changed';

export type SelectedTimerTask = {
	taskId: string | null;
	taskName: string | null;
	projectId: string | null;
};

function readSelectedTimerTask(): SelectedTimerTask {
	try {
		const taskId = window.localStorage.getItem(SELECTED_TASK_ID_KEY);
		if (!taskId) {
			return { taskId: null, taskName: null, projectId: null };
		}
		return {
			taskId,
			taskName: window.localStorage.getItem(SELECTED_TASK_NAME_KEY),
			projectId: window.localStorage.getItem(SELECTED_TASK_PROJECT_ID_KEY),
		};
	} catch {
		return { taskId: null, taskName: null, projectId: null };
	}
}

export function persistSelectedTimerTask(
	taskId: string | null,
	taskName: string | null,
	projectId: string | null = null,
) {
	try {
		const prev = readSelectedTimerTask();
		const nextName = taskId ? taskName || null : null;
		const nextProjectId = taskId ? projectId || null : null;
		if (
			prev.taskId === taskId &&
			prev.taskName === nextName &&
			prev.projectId === nextProjectId
		) {
			return;
		}

		if (taskId) {
			window.localStorage.setItem(SELECTED_TASK_ID_KEY, taskId);
			if (nextName) {
				window.localStorage.setItem(SELECTED_TASK_NAME_KEY, nextName);
			} else {
				window.localStorage.removeItem(SELECTED_TASK_NAME_KEY);
			}
			if (nextProjectId) {
				window.localStorage.setItem(SELECTED_TASK_PROJECT_ID_KEY, nextProjectId);
			} else {
				window.localStorage.removeItem(SELECTED_TASK_PROJECT_ID_KEY);
			}
		} else {
			window.localStorage.removeItem(SELECTED_TASK_ID_KEY);
			window.localStorage.removeItem(SELECTED_TASK_NAME_KEY);
			window.localStorage.removeItem(SELECTED_TASK_PROJECT_ID_KEY);
		}
		window.dispatchEvent(new Event(SELECTED_TASK_CHANGED_EVENT));
	} catch {
		/* ignore */
	}
}

/** Keep the nav timer label in sync when the selected task is renamed. */
export function syncSelectedTimerTaskName(taskId: string, taskName: string) {
	try {
		const selectedId = window.localStorage.getItem(SELECTED_TASK_ID_KEY);
		if (selectedId !== taskId) return;
		const trimmed = taskName.trim();
		if (!trimmed) return;
		if (window.localStorage.getItem(SELECTED_TASK_NAME_KEY) === trimmed) return;
		window.localStorage.setItem(SELECTED_TASK_NAME_KEY, trimmed);
		window.dispatchEvent(new Event(SELECTED_TASK_CHANGED_EVENT));
	} catch {
		/* ignore */
	}
}

export function useSelectedTimerTask(): SelectedTimerTask {
	const [selected, setSelected] = useState<SelectedTimerTask>({
		taskId: null,
		taskName: null,
		projectId: null,
	});

	const refresh = useCallback(() => {
		setSelected(readSelectedTimerTask());
	}, []);

	useEffect(() => {
		refresh();
		window.addEventListener(SELECTED_TASK_CHANGED_EVENT, refresh);
		window.addEventListener('storage', refresh);
		return () => {
			window.removeEventListener(SELECTED_TASK_CHANGED_EVENT, refresh);
			window.removeEventListener('storage', refresh);
		};
	}, [refresh]);

	return selected;
}
