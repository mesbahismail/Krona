'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { localData } from '@/lib/localData';
import { logEventSync } from '@/lib/telemetry';
import { createReminderForTask, deleteRemindersForTask } from '@/lib/createTaskReminder';
import { notifyRemindersUpdated, notifyTasksUpdated, notifyChallengesSyncNow, notifyTaskPendingDelete, notifyTaskStatusChanged } from '@/lib/kronaDataEvents';
import { persistTaskCompletion } from '@/lib/persistTaskCompletion';
import {
	persistSelectedTimerTask,
	syncSelectedTimerTaskName,
} from '@/lib/selectedTimerTask';
import {
	clearTaskPrioritized,
	isTaskPrioritized,
	setTaskPrioritized,
	sortTasksWithPriorityFirst,
} from '@/lib/taskPriority';
import { useDashboardDataOptional } from '@/components/dashboard/DashboardDataProvider';
import { isDeadlineInPast } from '@/lib/localDate';
import { removeTaskFromTodayDailyChallenges } from '@/lib/challenges';
import {
	filterOutPendingTaskDeletes,
	pruneCommittedDeletesNotInFetch,
} from '@/lib/pendingTaskDeletes';
import { flushPendingTaskDeletes } from '@/lib/taskDeleteCommit';
import {
	compareDashboardTasksBySortKey,
	readDashboardTaskSort,
	writeDashboardTaskSort,
	type DashboardTaskSortKey,
} from '@/lib/dashboardTaskSort';
import { resetStaleRepeatableTasks } from '@/lib/repeatableTasks';
export type TaskSortKey = 'newest' | 'oldest' | 'name' | 'timeWorked';

export type { DashboardTaskSortKey };

export type DashboardTask = {
	id: string;
	name: string;
	projectId: string | null;
	project: string;
	totalTime: number;
	assignedSeconds?: number;
	deadline?: string | null;
	createdAt: Date;
	status: string;
	prioritized?: boolean;
	repeatable?: boolean;
};

type TaskRow = {
	id: string;
	name: string;
	time_assigned_minutes: number | null;
	total_time_worked_minutes: number | null;
	deadline?: string | null;
	created_at: string;
	project_id: string | null;
	status: string | null;
	prioritized?: boolean | null;
	repeatable?: boolean | null;
};

export type DashboardProject = {
	id: string;
	name: string;
	isUnassignedFolder: boolean;
};

export function useDashboardTasks() {
	const dashboard = useDashboardDataOptional();
	const [localTasks, setLocalTasks] = useState<DashboardTask[]>([]);
	const [localLoading, setLocalLoading] = useState(true);
	const [localProjects, setLocalProjects] = useState<DashboardProject[]>([]);
	const tasks = dashboard ? dashboard.tasks : localTasks;
	const projects = dashboard ? dashboard.projects : localProjects;
	const loading = dashboard ? dashboard.loading : localLoading;
	const [selectedTaskId, setSelectedTaskId] = useState<string | null>(() => {
		if (typeof window === 'undefined') return null;
		try {
			return window.localStorage.getItem('krona:selectedTaskId');
		} catch {
			return null;
		}
	});
	const [sortBy, setSortBy] = useState<DashboardTaskSortKey>(() => readDashboardTaskSort());
	const [priorityTick, setPriorityTick] = useState(0);
	const userIdRef = useRef<string | null>(dashboard?.userId ?? null);
	const skipNextTasksUpdatedReloadRef = useRef(false);

	useEffect(() => {
		if (dashboard?.userId) {
			userIdRef.current = dashboard.userId;
		}
	}, [dashboard?.userId]);

	const mapRows = useCallback(
		(rows: TaskRow[], projectMap: Map<string, string>) =>
			rows.map((t) => ({
				id: t.id,
				name: t.name,
				projectId: t.project_id,
				project: t.project_id
					? projectMap.get(t.project_id) || 'Project'
					: 'Unassigned',
				totalTime: Number(t.total_time_worked_minutes || 0) * 60,
				assignedSeconds:
					Number(t.time_assigned_minutes || 0) > 0
						? Number(t.time_assigned_minutes) * 60
						: undefined,
				deadline: t.deadline ?? null,
				createdAt: new Date(t.created_at),
				status: t.status || 'pending',
				prioritized: isTaskPrioritized(t.id, t.prioritized),
				repeatable: Boolean(t.repeatable),
			})),
		[],
	);

	const reloadTasks = useCallback(async (options?: { skipRepeatableReset?: boolean }) => {
		if (dashboard) {
			await dashboard.refetch('all');
			return;
		}
		try {
			const { data: userRes } = await localData.auth.getUser();
			const user = userRes.user;
			if (!user) {
				setLocalTasks([]);
				setLocalProjects([]);
				return;
			}
			userIdRef.current = user.id;
			void flushPendingTaskDeletes(user.id);
			if (!options?.skipRepeatableReset) {
				await resetStaleRepeatableTasks(user.id, localData, { notify: false });
			}

			const [{ data: projectRows }, { data: taskRows, error }] = await Promise.all([
				localData
					.from('projects')
					.select('id,name,is_unassigned_folder')
					.eq('user_id', user.id),
				localData
					.from('tasks')
					.select(
						'id,name,time_assigned_minutes,total_time_worked_minutes,deadline,created_at,project_id,status,prioritized,repeatable',
					)
					.eq('user_id', user.id)
					.order('created_at', { ascending: false }),
			]);

			if (error) {
				const fallback = await localData
					.from('tasks')
					.select(
						'id,name,time_assigned_minutes,total_time_worked_minutes,deadline,created_at,project_id,status,repeatable',
					)
					.eq('user_id', user.id)
					.order('created_at', { ascending: false });
				if (fallback.error) return;
				pruneCommittedDeletesNotInFetch(
					((fallback.data as TaskRow[]) || []).map((row) => row.id),
				);
				setLocalProjects(
					(projectRows || []).map((p) => ({
						id: p.id,
						name: p.name,
						isUnassignedFolder: Boolean(p.is_unassigned_folder),
					})),
				);
				const projectMap = new Map(
					(projectRows || []).map((p) => [p.id, p.name] as const),
				);
				setLocalTasks(
					filterOutPendingTaskDeletes(
						mapRows((fallback.data as TaskRow[]) || [], projectMap),
					),
				);
				return;
			}
			pruneCommittedDeletesNotInFetch(
				((taskRows as TaskRow[]) || []).map((row) => row.id),
			);
			setLocalProjects(
				(projectRows || []).map((p) => ({
					id: p.id,
					name: p.name,
					isUnassignedFolder: Boolean(p.is_unassigned_folder),
				})),
			);
			const projectMap = new Map(
				(projectRows || []).map((p) => [p.id, p.name] as const),
			);
			setLocalTasks(
				filterOutPendingTaskDeletes(mapRows((taskRows as TaskRow[]) || [], projectMap)),
			);
		} catch {
			/* ignore */
		} finally {
			setLocalLoading(false);
		}
	}, [mapRows, dashboard]);

	useEffect(() => {
		if (dashboard) return;
		void reloadTasks();
		const onFocus = () => void reloadTasks();
		const onPageShow = (e: PageTransitionEvent) => {
			if (e.persisted) void reloadTasks();
		};
		const onTasksUpdated = () => {
			if (skipNextTasksUpdatedReloadRef.current) {
				skipNextTasksUpdatedReloadRef.current = false;
				return;
			}
			void reloadTasks();
		};
		const onTaskPendingDelete = (event: Event) => {
			const taskId = (event as CustomEvent<{ taskId: string }>).detail?.taskId;
			if (!taskId) return;
			setLocalTasks((prev) => prev.filter((task) => task.id !== taskId));
		};
		const onTaskStatusChanged = (event: Event) => {
			const detail = (event as CustomEvent<{ taskId: string; status: 'done' | 'pending' }>)
				.detail;
			if (!detail?.taskId) return;
			setLocalTasks((prev) =>
				prev.map((task) =>
					task.id === detail.taskId ? { ...task, status: detail.status } : task,
				),
			);
		};
		window.addEventListener('focus', onFocus);
		window.addEventListener('pageshow', onPageShow);
		window.addEventListener('krona:tasks-updated', onTasksUpdated);
		window.addEventListener('krona:task-pending-delete', onTaskPendingDelete);
		window.addEventListener('krona:task-status-changed', onTaskStatusChanged);
		return () => {
			window.removeEventListener('focus', onFocus);
			window.removeEventListener('pageshow', onPageShow);
			window.removeEventListener('krona:tasks-updated', onTasksUpdated);
			window.removeEventListener('krona:task-pending-delete', onTaskPendingDelete);
			window.removeEventListener('krona:task-status-changed', onTaskStatusChanged);
		};
	}, [reloadTasks, dashboard]);

	useEffect(() => {
		if (!selectedTaskId) return;
		const task = tasks.find((t) => t.id === selectedTaskId);
		if (task?.status === 'done') {
			setSelectedTaskId(null);
		}
	}, [tasks, selectedTaskId]);

	const selectedTaskMeta = useMemo(() => {
		if (!selectedTaskId) return { name: null as string | null, projectId: null as string | null };
		const task = tasks.find((t) => t.id === selectedTaskId);
		return {
			name: task?.name ?? null,
			projectId: task?.projectId ?? null,
		};
	}, [selectedTaskId, tasks]);

	useEffect(() => {
		if (selectedTaskId && !tasks.some((task) => task.id === selectedTaskId)) {
			return;
		}
		persistSelectedTimerTask(
			selectedTaskId,
			selectedTaskMeta.name,
			selectedTaskMeta.projectId,
		);
		if (selectedTaskId) {
			logEventSync('task_select', { task_id: selectedTaskId });
		}
	}, [selectedTaskId, selectedTaskMeta.name, selectedTaskMeta.projectId, tasks]);

	const enrichedTasks = useMemo(
		() =>
			tasks.map((task) => ({
				...task,
				prioritized: isTaskPrioritized(task.id, task.prioritized),
			})),
		[tasks, priorityTick],
	);

	const sortedTasks = useMemo(() => {
		const compareSecondary = (a: DashboardTask, b: DashboardTask) =>
			compareDashboardTasksBySortKey(a, b, sortBy);
		const pending = enrichedTasks.filter((task) => !isDashboardTaskDone(task.status));
		const done = enrichedTasks.filter((task) => isDashboardTaskDone(task.status));
		return [
			...sortTasksWithPriorityFirst(pending, compareSecondary),
			...sortTasksWithPriorityFirst(done, compareSecondary),
		];
	}, [enrichedTasks, sortBy]);

	const setTaskSortBy = useCallback((next: DashboardTaskSortKey) => {
		setSortBy(next);
		writeDashboardTaskSort(next);
	}, []);

	const resolveUserId = useCallback(async (): Promise<string | null> => {
		if (userIdRef.current) return userIdRef.current;
		if (dashboard?.userId) {
			userIdRef.current = dashboard.userId;
			return dashboard.userId;
		}
		const { data: userRes } = await localData.auth.getUser();
		const uid = userRes.user?.id ?? null;
		if (uid) userIdRef.current = uid;
		return uid;
	}, [dashboard?.userId]);

	const updateTask = useCallback(
		async (
			taskId: string,
			input: {
				name: string;
				projectId: string | null;
				assignedHours: number | null;
				repeatable?: boolean;
			},
		) => {
			const uid = await resolveUserId();
			if (!uid || !input.name.trim()) return false;
			const hasAssigned =
				input.assignedHours != null && input.assignedHours > 0;
			const { error } = await localData
				.from('tasks')
				.update({
					name: input.name.trim(),
					project_id: input.projectId || null,
					time_assigned_minutes: hasAssigned
						? Math.round(input.assignedHours! * 60)
						: 0,
					...(typeof input.repeatable === 'boolean'
						? { repeatable: input.repeatable }
						: {}),
				})
				.eq('id', taskId)
				.eq('user_id', uid);
			if (error) return false;
			const trimmedName = input.name.trim();
			syncSelectedTimerTaskName(taskId, trimmedName);
			dashboard?.patchTask(taskId, {
				name: trimmedName,
				projectId: input.projectId || null,
			});
			await reloadTasks({ skipRepeatableReset: true });
			notifyTasksUpdated();
			return true;
		},
		[dashboard, reloadTasks, resolveUserId],
	);

	const deleteTask = useCallback(
		async (taskId: string) => {
			const uid = await resolveUserId();
			if (!uid) return false;
			const { error } = await localData
				.from('tasks')
				.delete()
				.eq('id', taskId)
				.eq('user_id', uid);
			if (error) return false;
			clearTaskPrioritized(taskId);
			try {
				await deleteRemindersForTask(uid, taskId);
			} catch {
				/* task already deleted; orphan reminder cleanup is best-effort */
			}
			await removeTaskFromTodayDailyChallenges(taskId);
			setSelectedTaskId((prev) => (prev === taskId ? null : prev));
			await reloadTasks();
			notifyTasksUpdated();
			notifyRemindersUpdated();
			return true;
		},
		[reloadTasks, resolveUserId],
	);

	const setTaskCompleted = useCallback(
		async (taskId: string, completed: boolean) => {
			const uid = await resolveUserId();
			if (!uid) return false;

			const result = await persistTaskCompletion({
				taskId,
				completed,
				userId: uid,
			});
			if (!result.ok) {
				await reloadTasks();
				return false;
			}
			// Notify before clearing selection so the timer can flush time to this task.
			notifyTaskStatusChanged(taskId, result.status);
			if (completed) {
				setSelectedTaskId((prev) => (prev === taskId ? null : prev));
			}
			skipNextTasksUpdatedReloadRef.current = true;
			await reloadTasks({ skipRepeatableReset: true });
			notifyTasksUpdated();
			notifyChallengesSyncNow();
			return true;
		},
		[reloadTasks, resolveUserId],
	);

	const createTask = useCallback(
		async (input: {
			name: string;
			projectId: string | null;
			assignedHours: number | null;
			deadline: Date | null;
			addToReminders: boolean;
			repeatable?: boolean;
		}) => {
			const uid = await resolveUserId();
			if (!uid || !input.name.trim()) return null;
			if (isDeadlineInPast(input.deadline)) return null;
			const hasAssigned =
				input.assignedHours != null && input.assignedHours > 0;
			const hasDeadline = input.deadline != null;
			const projectId = input.projectId;
			const { data, error } = await localData
				.from('tasks')
				.insert([
					{
						user_id: uid,
						project_id: projectId || null,
						name: input.name.trim(),
						time_assigned_minutes: hasAssigned
							? Math.round(input.assignedHours! * 60)
							: 0,
						deadline: hasDeadline ? input.deadline!.toISOString() : null,
						status: 'pending',
						schedule_mode: hasDeadline ? 'deadline' : 'manual',
						daily_goal_minutes: 0,
						reminder: hasDeadline,
						repeatable: Boolean(input.repeatable),
					},
				])
				.select('id')
				.single();
			if (error || !data?.id) return null;
			if (hasDeadline) {
				try {
					await createReminderForTask(
						uid,
						data.id as string,
						input.name.trim(),
						input.deadline!,
						projectId,
					);
				} catch {
					/* ignore */
				}
			}
			await reloadTasks({ skipRepeatableReset: true });
			notifyTasksUpdated();
			return data.id as string;
		},
		[reloadTasks, resolveUserId],
	);

	const toggleTaskPriority = useCallback(
		(taskId: string) => {
			const task = tasks.find((item) => item.id === taskId);
			if (!task || isDashboardTaskDone(task.status)) return;

			const nextPrioritized = !isTaskPrioritized(task.id, task.prioritized);
			setTaskPrioritized(task.id, nextPrioritized);
			setPriorityTick((tick) => tick + 1);

			if (dashboard) {
				dashboard.patchTask(taskId, { prioritized: nextPrioritized });
			} else {
				setLocalTasks((prev) =>
					prev.map((item) =>
						item.id === taskId ? { ...item, prioritized: nextPrioritized } : item,
					),
				);
			}

			void (async () => {
				const uid = await resolveUserId();
				if (!uid) return;
				await localData
					.from('tasks')
					.update({ prioritized: nextPrioritized })
					.eq('id', taskId)
					.eq('user_id', uid);
			})();
		},
		[tasks, dashboard, resolveUserId],
	);

	const setTaskRepeatable = useCallback(
		async (taskId: string, repeatable: boolean) => {
			const uid = await resolveUserId();
			if (!uid) return false;

			if (dashboard) {
				dashboard.patchTask(taskId, { repeatable });
			} else {
				setLocalTasks((prev) =>
					prev.map((item) =>
						item.id === taskId ? { ...item, repeatable } : item,
					),
				);
			}

			const { error } = await localData
				.from('tasks')
				.update({ repeatable })
				.eq('id', taskId)
				.eq('user_id', uid);
			if (error) {
				await reloadTasks({ skipRepeatableReset: true });
				return false;
			}
			notifyTasksUpdated();
			return true;
		},
		[dashboard, reloadTasks, resolveUserId],
	);

	const selectedTask = enrichedTasks.find((t) => t.id === selectedTaskId);

	return {
		tasks: enrichedTasks,
		loading,
		projects,
		sortedTasks,
		selectedTask,
		selectedTaskId,
		setSelectedTaskId,
		sortBy,
		setSortBy: setTaskSortBy,
		createTask,
		updateTask,
		deleteTask,
		setTaskCompleted,
		toggleTaskPriority,
		setTaskRepeatable,
		reloadTasks,
	};
}

export function isDashboardTaskDone(status: string) {
	return status === 'done';
}
