import {
	performancePeriodLabel,
	type PerformanceMetrics,
	type PerformancePeriodKey,
} from '@/lib/performanceData';
import { formatDecimalHours } from '@/lib/taskTime';

function trendLabel(value: number | null): string {
	if (value == null || !Number.isFinite(value)) return 'n/a';
	const rounded = Math.round(value * 10) / 10;
	if (rounded === 0) return '0%';
	return `${rounded > 0 ? '+' : ''}${rounded}%`;
}

function downloadTextFile(filename: string, body: string) {
	const blob = new Blob([body], { type: 'text/plain;charset=utf-8' });
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = filename;
	anchor.rel = 'noopener';
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
	URL.revokeObjectURL(url);
}

export function exportTeamPerformanceReview(input: {
	period: PerformancePeriodKey;
	memberLabel: string;
	metrics: PerformanceMetrics;
	insights: string[];
}): void {
	const { period, memberLabel, metrics, insights } = input;
	const periodLabel = performancePeriodLabel(period);
	const generated = new Date();
	const dateStamp = generated.toISOString().slice(0, 10);
	const lines = [
		'Krona Team Performance Review',
		`${periodLabel} · ${memberLabel}`,
		`Generated ${generated.toLocaleString()}`,
		'',
		'Summary',
		`Time worked: ${formatDecimalHours(metrics.totalWorkHours)}h (${trendLabel(metrics.trendWork)} vs previous ${periodLabel.toLowerCase()})`,
		`Time rested: ${formatDecimalHours(metrics.totalRestHours)}h (${trendLabel(metrics.trendRest)} vs previous ${periodLabel.toLowerCase()})`,
		`Average daily work hours: ${formatDecimalHours(metrics.avgDailyWorkHours)}h (${trendLabel(metrics.trendAvgDaily)})`,
		`Average daily rest hours: ${formatDecimalHours(metrics.avgDailyRestHours)}h (${trendLabel(metrics.trendAvgDailyRest)})`,
		`Tasks finished: ${metrics.tasksFinished}`,
		`Best focus time: ${metrics.bestFocusPeriod}`,
		'',
		period === 'today' ? 'Focus time by teammate' : 'Focus time by day',
		...metrics.chartDays.map(
			(day) =>
				`${day.label}: worked ${formatDecimalHours(day.workHours)}h · rested ${formatDecimalHours(day.restHours)}h`,
		),
	];

	if (metrics.taskBreakdown?.length) {
		lines.push('', 'Time by task');
		for (const task of metrics.taskBreakdown) {
			const project = task.projectName ? ` (${task.projectName})` : '';
			const workers = task.workers?.length
				? ` — ${task.workers
						.map(
							(worker) =>
								`${worker.name} ${formatDecimalHours(worker.hours)}h`,
						)
						.join(', ')}`
				: '';
			lines.push(
				`${task.name}${project}: ${formatDecimalHours(task.hours)}h${workers}`,
			);
		}
	}

	if (insights.length) {
		lines.push('', 'Insights');
		insights.forEach((tip, index) => {
			lines.push(`${index + 1}. ${tip}`);
		});
	}

	const slug = memberLabel
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 40);
	downloadTextFile(
		`krona-team-performance-${period}-${slug || 'team'}-${dateStamp}.txt`,
		`${lines.join('\n')}\n`,
	);
}
