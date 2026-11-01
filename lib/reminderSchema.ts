export const REMINDER_BASE_SELECT =
	'id, name, type, date_created, due_date, occurrence, task_id, project_id, sort_order, tasks(project_id)';

export const REMINDER_EXTENDED_SELECT =
	'id, name, type, date_created, due_date, occurrence, task_id, project_id, sort_order, subscription_value, vacation_end_date, activate_vacation_mode, email_notify, email_notified_at, tasks(project_id)';

export type ReminderSelectRow = {
	id: string;
	name: string;
	type: string;
	date_created: string;
	due_date: string | null;
	occurrence: string | null;
	task_id?: string | null;
	project_id?: string | null;
	sort_order?: number | null;
	subscription_value?: number | string | null;
	vacation_end_date?: string | null;
	activate_vacation_mode?: boolean | null;
	email_notify?: boolean | null;
	email_notified_at?: string | null;
	tasks?: { project_id: string | null } | { project_id: string | null }[] | null;
};

export const REMINDER_SCHEMA_MIGRATION_HINT =
	'Could not save this reminder on your device. Email delivery is unavailable in the local template.';

export function isMissingReminderColumnError(
	error: { message?: string; code?: string } | Error | null | undefined,
): boolean {
	if (!error) return false;
	const message = 'message' in error ? String(error.message ?? '') : String(error);
	const code = 'code' in error ? String(error.code ?? '') : '';
	return (
		code === '42703' ||
		code === 'PGRST204' ||
		/subscription_value|vacation_end_date|activate_vacation_mode|email_notify|email_notified_at|column .* does not exist/i.test(
			message,
		)
	);
}

export function reminderCreateErrorMessage(
	error: { message?: string; code?: string } | Error | null | undefined,
	needsExtendedColumns: boolean,
): string {
	if (isMissingReminderColumnError(error) && needsExtendedColumns) {
		return REMINDER_SCHEMA_MIGRATION_HINT;
	}
	if (error && 'message' in error && error.message) {
		return String(error.message);
	}
	return 'Could not create reminder.';
}
