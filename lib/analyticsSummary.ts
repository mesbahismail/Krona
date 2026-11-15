import type {
	PerformanceMetrics,
	TeamPerformanceChartMember,
} from './performanceData';

export function buildAnalyticsSummary(
	metrics: PerformanceMetrics,
	members?: TeamPerformanceChartMember[],
) {
	const tasks = metrics.taskBreakdown ?? [];
	const tracked = metrics.totalWorkHours + metrics.totalRestHours;
	const projects = new Map<string, number>();
	const contributors = new Map<
		string,
		{ name: string; hours: number; tasks: number }
	>();
	for (const member of members ?? [])
		contributors.set(member.userId, { name: member.label, hours: 0, tasks: 0 });
	for (const task of tasks) {
		const project = task.projectName || 'Unassigned';
		projects.set(project, (projects.get(project) ?? 0) + task.hours);
		for (const worker of task.workers ?? []) {
			const previous = contributors.get(worker.userId) ?? {
				name: worker.name,
				hours: 0,
				tasks: 0,
			};
			contributors.set(worker.userId, {
				...previous,
				hours: previous.hours + worker.hours,
				tasks: previous.tasks + 1,
			});
		}
	}
	const taskHours = tasks.reduce((sum, task) => sum + task.hours, 0);
	return {
		workShare:
			tracked > 0 ? Math.round((metrics.totalWorkHours / tracked) * 100) : 0,
		trackedHours: tracked,
		projectCount: projects.size,
		taskCount: tasks.length,
		taskHours,
		projects: [...projects].sort((a, b) => b[1] - a[1]),
		contributors: [...contributors]
			.map(([id, person]) => ({
				id,
				...person,
				share: taskHours > 0 ? (person.hours / taskHours) * 100 : 0,
			}))
			.sort((a, b) => b.hours - a.hours),
	};
}
