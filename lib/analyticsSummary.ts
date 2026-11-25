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
	const activeBuckets = (metrics.chartDays ?? []).filter((day) => day.workHours > 0);
	const busiestBucket = activeBuckets.reduce<(typeof activeBuckets)[number] | null>(
		(best, day) => !best || day.workHours > best.workHours ? day : best, null,
	);
	const dayParts = [
		{ label: 'Morning', range: '06:00–12:00', start: 6, end: 12 },
		{ label: 'Afternoon', range: '12:00–18:00', start: 12, end: 18 },
		{ label: 'Evening', range: '18:00–00:00', start: 18, end: 24 },
		{ label: 'Overnight', range: '00:00–06:00', start: 0, end: 6 },
	].map((part) => {
		const buckets = (metrics.activityByHour ?? []).filter((bucket) => {
			const hour = Number(bucket.label.split(':')[0]);
			return hour >= part.start && hour < part.end;
		});
		return {
			label: part.label,
			range: part.range,
			workHours: buckets.reduce((sum, bucket) => sum + bucket.workHours, 0),
			restHours: buckets.reduce((sum, bucket) => sum + bucket.restHours, 0),
		};
	});
	const dailyWork = dayParts.reduce((sum, part) => sum + part.workHours, 0);
	return {
		activeBuckets: activeBuckets.length,
		totalBuckets: metrics.chartDays?.length ?? 0,
		busiestBucket,
		averageTaskHours: tasks.length ? taskHours / tasks.length : 0,
		breakMinutesPerWorkHour: metrics.totalWorkHours > 0
			? metrics.totalRestHours * 60 / metrics.totalWorkHours : null,
		dayParts: dayParts.map((part) => ({
			...part, share: dailyWork > 0 ? part.workHours / dailyWork * 100 : 0,
		})),
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
