import {
	deleteRemindersForTask,
	syncTaskDeadlineReminder,
	upsertReminderForTask,
} from '@/lib/reminderSync';

export type CreateTaskReminderParams = {
	userId: string;
	taskId: string;
	taskName: string;
	deadline: Date;
};

/** Create or update a reminders row linked to a task deadline. */
export async function createReminderForTask(
	userId: string,
	taskId: string,
	taskName: string,
	deadline: Date,
	projectId?: string | null,
): Promise<void> {
	await syncTaskDeadlineReminder(userId, {
		taskId,
		projectId,
		name: taskName,
		deadline,
		scheduleMode: 'deadline',
		reminderEnabled: true,
	});
}

export { deleteRemindersForTask, upsertReminderForTask };
