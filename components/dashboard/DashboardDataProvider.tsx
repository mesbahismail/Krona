'use client';

import * as React from 'react';
import { loadDashboardBundle } from '@/lib/dashboard/loadDashboardData';
import type { DashboardBundle } from '@/lib/dashboard/loadDashboardData';
import type { DashboardProject, DashboardTask } from '@/components/dashboard/useDashboardTasks';
import type { NoteRow } from '@/lib/notes';
import type { DashboardReminderRow } from '@/lib/reminders';
import type { RoutineItem } from '@/lib/routine';
import type { DailyChallenge } from '@/lib/challenges';
import { localData } from '@/lib/localData';
import {
	applyTaskStatusToDashboardTasks,
	removeTaskFromProjectList,
} from '@/lib/crossPageTaskSync';
import {
	KRONA_TASK_PENDING_DELETE,
	KRONA_TASK_STATUS_CHANGED,
	KRONA_TASKS_UPDATED,
	type TaskPendingDeleteDetail,
	type TaskStatusChangedDetail,
} from '@/lib/kronaDataEvents';
import { localDateKey } from '@/lib/localDate';
import { filterOutPendingTaskDeletes } from '@/lib/pendingTaskDeletes';
import { flushPendingTaskDeletes } from '@/lib/taskDeleteCommit';

export type DashboardDataKey =
	| 'all'
	| 'tasks'
	| 'notes'
	| 'reminders'
	| 'routine'
	| 'challenges';

type DashboardDataState = {
	userId: string | null;
	firstName: string | null;
	projects: DashboardProject[];
	tasks: DashboardTask[];
	notes: NoteRow[];
	reminders: DashboardReminderRow[];
	routine: RoutineItem[];
	challenges: DailyChallenge[];
	challengeProgress: number;
	tasksFinishedToday: number;
	loading: boolean;
	refetch: (key?: DashboardDataKey) => Promise<void>;
	patchTask: (taskId: string, patch: Partial<DashboardTask>) => void;
};

const DashboardDataContext = React.createContext<DashboardDataState | null>(null);

const EMPTY_PROJECTS: DashboardProject[] = [];
const EMPTY_TASKS: DashboardTask[] = [];
const EMPTY_NOTES: NoteRow[] = [];
const EMPTY_REMINDERS: DashboardReminderRow[] = [];
const EMPTY_ROUTINE: RoutineItem[] = [];
const EMPTY_CHALLENGES: DailyChallenge[] = [];

function normalizeDashboardBundle(raw: DashboardBundle): DashboardBundle {
	return {
		...raw,
		tasks: filterOutPendingTaskDeletes(
			raw.tasks.map((task) => ({
				...task,
				createdAt:
					task.createdAt instanceof Date
						? task.createdAt
						: new Date(task.createdAt as unknown as string),
			})),
		),
	};
}

export function useDashboardData(): DashboardDataState {
	const ctx = React.useContext(DashboardDataContext);
	if (!ctx) {
		throw new Error('useDashboardData must be used within DashboardDataProvider');
	}
	return ctx;
}

export function useDashboardDataOptional(): DashboardDataState | null {
	return React.useContext(DashboardDataContext);
}

export function DashboardDataProvider({ children }: { children: React.ReactNode }) {
	const [bundle, setBundle] = React.useState<DashboardBundle | null>(null);
	const [loading, setLoading] = React.useState(true);
	const loadingRef = React.useRef(false);
	const pendingRefetchRef = React.useRef(false);
	const initialLoadRef = React.useRef(true);

	const applyBundle = React.useCallback((next: DashboardBundle) => {
		setBundle(normalizeDashboardBundle(next));
	}, []);

	const patchTask = React.useCallback((taskId: string, patch: Partial<DashboardTask>) => {
		setBundle((prev) =>
			prev
				? {
						...prev,
						tasks: prev.tasks.map((task) =>
							task.id === taskId ? { ...task, ...patch } : task,
						),
					}
				: prev,
		);
	}, []);

	const refetch = React.useCallback(async (_key: DashboardDataKey = 'all') => {
		if (loadingRef.current) {
			pendingRefetchRef.current = true;
			return;
		}
		loadingRef.current = true;
		if (initialLoadRef.current) {
			setLoading(true);
		}
		try {
			const { data: userRes, error: authError } = await localData.auth.getUser();
			if (authError || !userRes.user) {
				console.warn('[dashboard] auth unavailable', authError?.message);
				return;
			}

			await flushPendingTaskDeletes(userRes.user.id);
			const data = await loadDashboardBundle(localData, userRes.user.id);
			applyBundle(data);
		} catch (error) {
			console.warn('[dashboard] load failed', error);
		} finally {
			loadingRef.current = false;
			initialLoadRef.current = false;
			setLoading(false);
			if (pendingRefetchRef.current) {
				pendingRefetchRef.current = false;
				void refetch(_key);
			}
		}
	}, [applyBundle]);

	React.useEffect(() => {
		void refetch('all');
	}, [refetch]);

	// After local midnight, refetch so completed repeatable tasks reset for the new day.
	React.useEffect(() => {
		const lastDateKeyRef = { current: localDateKey() };
		const rematerializeIfDayChanged = () => {
			const nextKey = localDateKey();
			if (nextKey === lastDateKeyRef.current) return;
			lastDateKeyRef.current = nextKey;
			void refetch('all');
		};
		const intervalId = window.setInterval(rematerializeIfDayChanged, 60_000);
		window.addEventListener('focus', rematerializeIfDayChanged);
		return () => {
			window.clearInterval(intervalId);
			window.removeEventListener('focus', rematerializeIfDayChanged);
		};
	}, [refetch]);

	React.useEffect(() => {
		const onTasksUpdated = () => void refetch('all');
		const onNotesUpdated = () => void refetch('all');
		const onRemindersUpdated = () => void refetch('all');
		const onRoutinesUpdated = () => void refetch('all');
		const onTaskPendingDelete = (event: Event) => {
			const taskId = (event as CustomEvent<TaskPendingDeleteDetail>).detail?.taskId;
			if (!taskId) return;
			setBundle((prev) =>
				prev
					? {
							...prev,
							tasks: prev.tasks.filter((task) => task.id !== taskId),
						}
					: prev,
			);
		};
		const onTaskStatusChanged = (event: Event) => {
			const detail = (event as CustomEvent<TaskStatusChangedDetail>).detail;
			if (!detail?.taskId) return;
			setBundle((prev) => {
				if (!prev) return prev;
				const existing = prev.tasks.find((task) => task.id === detail.taskId);
				// Only optimistic-count when the task is in the loaded slice.
				// Missing rows look "not done" and would increment without a matching
				// decrement on reopen until refetch.
				let tasksFinishedToday = prev.tasksFinishedToday;
				if (existing) {
					const wasDone = existing.status === 'done';
					const nextDone = detail.status === 'done';
					if (!wasDone && nextDone) {
						tasksFinishedToday += 1;
					} else if (wasDone && !nextDone) {
						tasksFinishedToday = Math.max(0, tasksFinishedToday - 1);
					}
				}
				return {
					...prev,
					tasksFinishedToday,
					tasks: applyTaskStatusToDashboardTasks(
						prev.tasks,
						detail.taskId,
						detail.status,
					),
				};
			});
		};

		window.addEventListener(KRONA_TASKS_UPDATED, onTasksUpdated);
		window.addEventListener('krona:notes-updated', onNotesUpdated);
		window.addEventListener('krona:reminders-updated', onRemindersUpdated);
		window.addEventListener('krona:routines-updated', onRoutinesUpdated);
		// Challenge progress lives in ChallengesSync — do not refetch the whole
		// dashboard when goals update (Work Free / rest sync made this noisy).
		window.addEventListener(KRONA_TASK_PENDING_DELETE, onTaskPendingDelete);
		window.addEventListener(KRONA_TASK_STATUS_CHANGED, onTaskStatusChanged);

		return () => {
			window.removeEventListener(KRONA_TASKS_UPDATED, onTasksUpdated);
			window.removeEventListener('krona:notes-updated', onNotesUpdated);
			window.removeEventListener('krona:reminders-updated', onRemindersUpdated);
			window.removeEventListener('krona:routines-updated', onRoutinesUpdated);
			window.removeEventListener(KRONA_TASK_PENDING_DELETE, onTaskPendingDelete);
			window.removeEventListener(KRONA_TASK_STATUS_CHANGED, onTaskStatusChanged);
		};
	}, [refetch]);

	const value = React.useMemo<DashboardDataState>(
		() => ({
			userId: bundle?.userId ?? null,
			firstName: bundle?.firstName ?? null,
			projects: bundle?.projects ?? EMPTY_PROJECTS,
			tasks: bundle?.tasks ?? EMPTY_TASKS,
			notes: bundle?.notes ?? EMPTY_NOTES,
			reminders: bundle?.reminders ?? EMPTY_REMINDERS,
			routine: bundle?.routine ?? EMPTY_ROUTINE,
			challenges: bundle?.challenges ?? EMPTY_CHALLENGES,
			challengeProgress: bundle?.challengeProgress ?? 0,
			tasksFinishedToday: bundle?.tasksFinishedToday ?? 0,
			loading,
			refetch,
			patchTask,
		}),
		[bundle, loading, refetch, patchTask],
	);

	return (
		<DashboardDataContext.Provider value={value}>{children}</DashboardDataContext.Provider>
	);
}
