import { localData } from '@/lib/localData';
import { notifyRemindersUpdated } from '@/lib/kronaDataEvents';
import {
	isMissingReminderColumnError,
	REMINDER_SCHEMA_MIGRATION_HINT,
	reminderCreateErrorMessage,
} from '@/lib/reminderSchema';
import { notifyManagersOfMemberCalendarItem } from '@/lib/teams/org';

export function toDbOccurrence(value: string) {
	switch (value.toLowerCase()) {
		case 'weekly':
			return 'weekly';
		case 'monthly':
			return 'monthly';
		case 'yearly':
			return 'yearly';
		case 'quarterly':
			return 'custom';
		default:
			return 'none';
	}
}

export type UserReminderInput = {
	name: string;
	type: string;
	date: string;
	created: string;
	occurrence: string;
	subscriptionValue?: number | null;
	vacationEndDate?: string | null;
	activateVacationMode?: boolean;
	emailNotify?: boolean;
};

/** Insert a personal reminder and refresh dashboard / reminders listeners. */
export async function createUserReminder(
	reminder: UserReminderInput,
): Promise<{ id: string; schemaHint?: string }> {
	const { data: userRes } = await localData.auth.getUser();
	const userId = userRes.user?.id;
	if (!userId) throw new Error('Sign in to add a reminder.');

	const payload: Record<string, unknown> = {
		user_id: userId,
		name: reminder.name,
		type: reminder.type,
		date_created: reminder.created.slice(0, 10),
		due_date: reminder.date,
		occurrence: toDbOccurrence(reminder.occurrence),
		email_notify: Boolean(reminder.emailNotify),
	};
	if (reminder.type === 'Subscription') {
		payload.subscription_value = reminder.subscriptionValue ?? null;
	}
	if (reminder.type === 'Vacation') {
		payload.vacation_end_date = reminder.vacationEndDate ?? null;
		payload.activate_vacation_mode = reminder.activateVacationMode !== false;
	}

	const needsExtended =
		reminder.type === 'Subscription' ||
		reminder.type === 'Vacation' ||
		Boolean(reminder.emailNotify);

	let { data, error } = await localData
		.from('reminders')
		.insert([payload])
		.select('id')
		.single();

	let schemaHint: string | undefined;
	if (error && isMissingReminderColumnError(error)) {
		const basePayload = { ...payload };
		delete basePayload.subscription_value;
		delete basePayload.vacation_end_date;
		delete basePayload.activate_vacation_mode;
		delete basePayload.email_notify;
		({ data, error } = await localData
			.from('reminders')
			.insert([basePayload])
			.select('id')
			.single());
		if (!error && needsExtended) schemaHint = REMINDER_SCHEMA_MIGRATION_HINT;
	}

	if (error || !data?.id) {
		throw new Error(reminderCreateErrorMessage(error, needsExtended));
	}

	notifyRemindersUpdated();
	void notifyManagersOfMemberCalendarItem({
		actorUserId: userId,
		reminderId: String(data.id),
		name: reminder.name,
		type: reminder.type,
		dueAt: reminder.date,
		vacationEndDate: reminder.vacationEndDate,
	});
	return { id: String(data.id), schemaHint };
}
