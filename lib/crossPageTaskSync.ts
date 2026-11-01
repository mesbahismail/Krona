import type { DashboardTask } from '@/components/dashboard/useDashboardTasks';

type ProjectTask = {
	id?: string;
	prioritized?: boolean;
	text: string;
	time?: {
		mode: 'manual' | 'deadline';
		manualHours?: number;
		deadline?: Date;
		trackedHours?: number;
		dailyGoal?: number;
	};
};

type ProjectShape = {
	id?: string;
	name: string;
	tasks: {
		pending: ProjectTask[];
		done: ProjectTask[];
	};
};

export function removeTaskFromProjectList<T extends ProjectShape>(
	projects: T[],
	taskId: string,
): T[] {
	return projects.map((project) => ({
		...project,
		tasks: {
			pending: project.tasks.pending.filter((task) => task.id !== taskId),
			done: project.tasks.done.filter((task) => task.id !== taskId),
		},
	}));
}

export function applyTaskStatusToProjectList<T extends ProjectShape>(
	projects: T[],
	taskId: string,
	status: 'done' | 'pending',
	sortPending: (tasks: ProjectTask[]) => ProjectTask[],
): T[] {
	return projects.map((project) => {
		const pendingTask = project.tasks.pending.find((task) => task.id === taskId);
		const doneTask = project.tasks.done.find((task) => task.id === taskId);

		if (status === 'done' && pendingTask) {
			return {
				...project,
				tasks: {
					pending: project.tasks.pending.filter((task) => task.id !== taskId),
					done: [pendingTask, ...project.tasks.done],
				},
			};
		}

		if (status === 'pending' && doneTask) {
			return {
				...project,
				tasks: {
					pending: sortPending([...project.tasks.pending, doneTask]),
					done: project.tasks.done.filter((task) => task.id !== taskId),
				},
			};
		}

		return project;
	});
}

export function applyTaskStatusToDashboardTasks(
	tasks: DashboardTask[],
	taskId: string,
	status: 'done' | 'pending',
): DashboardTask[] {
	return tasks.map((task) =>
		task.id === taskId ? { ...task, status } : task,
	);
}
