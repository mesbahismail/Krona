export type DashboardReminderRow = {
	id: string;
	name: string;
	type: string;
	due_date: string | null;
	date_created: string;
};

export function reminderDueIso(row: {
	due_date: string | null;
	date_created: string;
}): string {
	return row.due_date ?? row.date_created;
}

/** True when the due date is today or later (local calendar day). */
export function isUpcomingReminderDue(
	dateIso: string,
	now: Date = new Date(),
): boolean {
	const due = new Date(dateIso);
	if (Number.isNaN(due.getTime())) return false;
	const startOfToday = new Date(now);
	startOfToday.setHours(0, 0, 0, 0);
	return due.getTime() >= startOfToday.getTime();
}

export function filterUpcomingReminders<T extends DashboardReminderRow>(
	rows: T[],
	limit?: number,
	now: Date = new Date(),
): T[] {
	const upcoming = rows
		.filter((row) => isUpcomingReminderDue(reminderDueIso(row), now))
		.sort(
			(a, b) =>
				new Date(reminderDueIso(a)).getTime() -
				new Date(reminderDueIso(b)).getTime(),
		);
	return typeof limit === 'number' ? upcoming.slice(0, limit) : upcoming;
}

export function daysUntilLabel(dateIso: string): string {
	const now = new Date();
	const due = new Date(dateIso);
	if (Number.isNaN(due.getTime())) return 'Overdue';

	const startOfToday = new Date(now);
	startOfToday.setHours(0, 0, 0, 0);
	const startOfDue = new Date(due);
	startOfDue.setHours(0, 0, 0, 0);

	const days = Math.round(
		(startOfDue.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24),
	);
	if (days < 0) return 'Overdue';
	if (days === 0) return 'Today';
	if (days === 1) return '1 day left';
	return `${days} days left`;
}

export function formatReminderDue(dateIso: string): string {
	return new Date(dateIso).toLocaleDateString('en-US', {
		weekday: 'short',
		month: 'short',
		day: 'numeric',
	});
}
