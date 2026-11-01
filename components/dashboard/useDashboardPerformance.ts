'use client';

import * as React from 'react';
import { countTasksFinishedOnDay } from '@/lib/dashboard/countTasksFinishedOnDay';
import { localData } from '@/lib/localData';
import { useDashboardDataOptional } from '@/components/dashboard/DashboardDataProvider';

type TaskRow = {
	status?: string | null;
	time_assigned_minutes?: number | null;
	total_time_worked_minutes?: number | null;
	updated_at?: string;
	created_at?: string;
};

async function fetchRecentTasks(
	userId: string,
	startIso: string,
	filterColumn: 'created_at' | 'updated_at' = 'created_at',
) {
	const { data, error } = await localData
		.from('tasks')
		.select(
			'status, time_assigned_minutes, total_time_worked_minutes, created_at, updated_at, completed_at',
		)
		.eq('user_id', userId)
		.gte(filterColumn, startIso);

	if (!error && data) return data as TaskRow[];
	return [];
}

export { countTasksFinishedOnDay } from '@/lib/dashboard/countTasksFinishedOnDay';

export function useTodayTasksFinished() {
	const dashboard = useDashboardDataOptional();
	const [localTasksFinished, setLocalTasksFinished] = React.useState(0);
	const tasksFinished = dashboard ? dashboard.tasksFinishedToday : localTasksFinished;

	React.useEffect(() => {
		if (dashboard) return;
		let cancelled = false;

		(async () => {
			try {
				const { data: userRes } = await localData.auth.getUser();
				const user = userRes.user;
				if (!user) {
					if (!cancelled) setLocalTasksFinished(0);
					return;
				}

				const start = new Date();
				start.setHours(0, 0, 0, 0);
				const rows = await fetchRecentTasks(
					user.id,
					start.toISOString(),
					'updated_at',
				);

				if (!cancelled) {
					setLocalTasksFinished(countTasksFinishedOnDay(rows, new Date()));
				}
			} catch {
				if (!cancelled) setLocalTasksFinished(0);
			}
		})();

		const onTasksUpdated = () => {
			void (async () => {
				const { data: userRes } = await localData.auth.getUser();
				const user = userRes.user;
				if (!user) return;
				const start = new Date();
				start.setHours(0, 0, 0, 0);
				const rows = await fetchRecentTasks(
					user.id,
					start.toISOString(),
					'updated_at',
				);
				if (!cancelled) setLocalTasksFinished(countTasksFinishedOnDay(rows, new Date()));
			})();
		};

		window.addEventListener('krona:tasks-updated', onTasksUpdated);
		return () => {
			cancelled = true;
			window.removeEventListener('krona:tasks-updated', onTasksUpdated);
		};
	}, [dashboard]);

	return tasksFinished;
}
