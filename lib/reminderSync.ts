import { localData } from '@/lib/localData';
import { notifyRemindersUpdated, notifyTasksUpdated } from '@/lib/kronaDataEvents';
import { localDateKey } from '@/lib/localDate';

function todayDateKey(): string {
	return localDateKey();
}

function deadlineIso(deadline: Date | string): string {
	return typeof deadline === 'string' ? deadline : deadline.toISOString();
}

/** Build a /projects URL that opens a project and optionally highlights a task. */
export function projectsDeepLink(projectId: string, taskId?: string | null): string {
	const params = new URLSearchParams({ project: projectId });
	if (taskId) params.set('task', taskId);
	return `/projects?${params.toString()}`;
}

/** Build a /team/projects URL that opens a team project. */
export function teamProjectsDeepLink(
	projectId?: string | null,
	taskId?: string | null,
): string {
	const params = new URLSearchParams();
	if (projectId) params.set('project', projectId);
	if (taskId) params.set('task', taskId);
	const query = params.toString();
	return query ? `/team/projects?${query}` : '/team/projects';
}

/** Deep link to a task on the projects page when it belongs to a project. */
export function taskDeepLink(
	projectId: string | null | undefined,
	taskId: string,
): string | null {
	if (!projectId) return null;
	return projectsDeepLink(projectId, taskId);
}

/** Create or update a reminder row linked to a task deadline. */
export async function upsertReminderForTask(
	userId: string,
	input: {
		taskId: string;
		projectId?: string | null;
		name: string;
		deadline: Date | string;
	},
): Promise<void> {
	const { data: existing } = await localData
		.from('reminders')
		.select('id')
		.eq('user_id', userId)
		.eq('task_id', input.taskId)
		.maybeSingle();

	const payload = {
		name: input.name,
		type: 'task',
		due_date: deadlineIso(input.deadline),
		date_created: todayDateKey(),
		occurrence: 'none' as const,
		task_id: input.taskId,
		project_id: input.projectId ?? null,
	};

	if (existing?.id) {
		const { error } = await localData
			.from('reminders')
			.update(payload)
			.eq('id', existing.id)
			.eq('user_id', userId);
		if (error) throw new Error(error.message);
		return;
	}

	const { error } = await localData.from('reminders').insert({
		user_id: userId,
		...payload,
	});
	if (error) throw new Error(error.message);
}

/** Create or update a reminder row linked to a project deadline. */
export async function upsertReminderForProject(
	userId: string,
	input: {
		projectId: string;
		name: string;
		deadline: Date | string;
	},
): Promise<void> {
	const { data: existing } = await localData
		.from('reminders')
		.select('id')
		.eq('user_id', userId)
		.eq('project_id', input.projectId)
		.is('task_id', null)
		.maybeSingle();

	const payload = {
		name: input.name,
		type: 'project',
		due_date: deadlineIso(input.deadline),
		date_created: todayDateKey(),
		occurrence: 'none' as const,
		project_id: input.projectId,
		task_id: null,
	};

	if (existing?.id) {
		const { error } = await localData
			.from('reminders')
			.update(payload)
			.eq('id', existing.id)
			.eq('user_id', userId);
		if (error) throw new Error(error.message);
		return;
	}

	const { error } = await localData.from('reminders').insert({
		user_id: userId,
		...payload,
	});
	if (error) throw new Error(error.message);
}

/** Remove reminders tied to a deleted or deadline-cleared task. */
export async function deleteRemindersForTask(
	userId: string,
	taskId: string,
): Promise<void> {
	const { error } = await localData
		.from('reminders')
		.delete()
		.eq('user_id', userId)
		.eq('task_id', taskId);
	if (error) throw new Error(error.message);
}

/** Remove project-level reminders (not task-linked). */
export async function deleteRemindersForProject(
	userId: string,
	projectId: string,
): Promise<void> {
	const { error } = await localData
		.from('reminders')
		.delete()
		.eq('user_id', userId)
		.eq('project_id', projectId)
		.is('task_id', null);
	if (error) throw new Error(error.message);
}

/** Sync task reminder when deadline changes on projects/dashboard. */
export async function syncTaskDeadlineReminder(
	userId: string,
	input: {
		taskId: string;
		projectId?: string | null;
		name: string;
		deadline: Date | string | null;
		scheduleMode?: string | null;
		reminderEnabled?: boolean;
	},
): Promise<void> {
	const hasDeadline =
		input.scheduleMode !== 'manual' &&
		input.deadline != null &&
		!Number.isNaN(new Date(input.deadline).getTime());

	let reminderEnabled = input.reminderEnabled;
	if (reminderEnabled === undefined) {
		const { data } = await localData
			.from('tasks')
			.select('reminder')
			.eq('id', input.taskId)
			.eq('user_id', userId)
			.maybeSingle();
		reminderEnabled = Boolean(data?.reminder);
	}

	if (hasDeadline && reminderEnabled) {
		await upsertReminderForTask(userId, {
			taskId: input.taskId,
			projectId: input.projectId,
			name: input.name,
			deadline: input.deadline!,
		});
	} else {
		await deleteRemindersForTask(userId, input.taskId);
	}
	notifyRemindersUpdated();
}

/** Permanently delete a reminder and stop linked task/project from recreating it. */
export async function deleteUserReminder(
	userId: string,
	input: {
		id: string;
		taskId?: string | null;
		projectId?: string | null;
	},
): Promise<void> {
	const { error } = await localData
		.from('reminders')
		.delete()
		.eq('id', input.id)
		.eq('user_id', userId);
	if (error) throw new Error(error.message);

	if (input.taskId) {
		const { error: taskError } = await localData
			.from('tasks')
			.update({ reminder: false })
			.eq('id', input.taskId)
			.eq('user_id', userId);
		if (taskError) throw new Error(taskError.message);
	} else if (input.projectId) {
		const { error: projectError } = await localData
			.from('projects')
			.update({ reminder: false })
			.eq('id', input.projectId)
			.eq('user_id', userId);
		if (projectError) throw new Error(projectError.message);
	}

	notifyRemindersUpdated();
	if (input.taskId || input.projectId) {
		notifyTasksUpdated();
	}
}

/** Restore a reminder row after undo (re-enables linked task/project reminders). */
export async function restoreUserReminder(
	userId: string,
	input: {
		name: string;
		type: string;
		dateCreated: string;
		dueDate: string;
		occurrence: string;
		subscriptionValue?: number | null;
		vacationEndDate?: string | null;
		activateVacationMode?: boolean;
		emailNotify?: boolean;
		taskId?: string | null;
		projectId?: string | null;
	},
): Promise<string | undefined> {
	const payload: Record<string, unknown> = {
		user_id: userId,
		name: input.name,
		type: input.type,
		date_created: input.dateCreated,
		due_date: input.dueDate,
		occurrence: input.occurrence,
		task_id: input.taskId ?? null,
		project_id: input.projectId ?? null,
		email_notify: Boolean(input.emailNotify),
	};
	if (input.type === 'Subscription') {
		payload.subscription_value = input.subscriptionValue ?? null;
	}
	if (input.type === 'Vacation') {
		payload.vacation_end_date = input.vacationEndDate ?? null;
		payload.activate_vacation_mode = input.activateVacationMode !== false;
	}
	let { data, error } = await localData
		.from('reminders')
		.insert([payload])
		.select('id')
		.single();
	if (
		error &&
		(error.code === '42703' ||
			error.code === 'PGRST204' ||
			/subscription_value|vacation_end_date|activate_vacation_mode|email_notify|schema cache|does not exist/i.test(
				error.message,
			))
	) {
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
	}
	if (error) throw new Error(error.message);

	if (input.taskId) {
		await localData
			.from('tasks')
			.update({ reminder: true })
			.eq('id', input.taskId)
			.eq('user_id', userId);
	} else if (input.projectId) {
		await localData
			.from('projects')
			.update({ reminder: true })
			.eq('id', input.projectId)
			.eq('user_id', userId);
	}

	notifyRemindersUpdated();
	if (input.taskId || input.projectId) {
		notifyTasksUpdated();
	}
	return data?.id as string | undefined;
}

/** Sync project reminder when deadline/reminder flag changes. */
export async function syncProjectDeadlineReminder(
	userId: string,
	input: {
		projectId: string;
		name: string;
		deadline: Date | string | null;
		reminderEnabled: boolean;
	},
): Promise<void> {
	const hasDeadline =
		input.reminderEnabled &&
		input.deadline != null &&
		!Number.isNaN(new Date(input.deadline).getTime());

	if (hasDeadline) {
		await upsertReminderForProject(userId, {
			projectId: input.projectId,
			name: input.name,
			deadline: input.deadline!,
		});
	} else {
		await deleteRemindersForProject(userId, input.projectId);
	}
	notifyRemindersUpdated();
}

/** Rename linked reminders after task/project name edits. */
export async function renameTaskReminder(
	userId: string,
	taskId: string,
	name: string,
): Promise<void> {
	await localData
		.from('reminders')
		.update({ name })
		.eq('user_id', userId)
		.eq('task_id', taskId);
	notifyRemindersUpdated();
}

export async function renameProjectReminder(
	userId: string,
	projectId: string,
	name: string,
): Promise<void> {
	await localData
		.from('reminders')
		.update({ name })
		.eq('user_id', userId)
		.eq('project_id', projectId)
		.is('task_id', null);
	notifyRemindersUpdated();
}

/** Apply reminder edits from the reminders page back to linked project/task rows. */
export async function updateLinkedReminderFromRemindersPage(
	userId: string,
	input: {
		id: string;
		name: string;
		dueDate: string;
		taskId?: string | null;
		projectId?: string | null;
	},
): Promise<void> {
	const trimmedName = input.name.trim();
	const dueDate = deadlineIso(input.dueDate);

	const { error: reminderError } = await localData
		.from('reminders')
		.update({
			name: trimmedName,
			due_date: dueDate,
		})
		.eq('id', input.id)
		.eq('user_id', userId);
	if (reminderError) throw new Error(reminderError.message);

	if (input.taskId) {
		const { error: taskError } = await localData
			.from('tasks')
			.update({
				name: trimmedName,
				deadline: dueDate,
				reminder: true,
			})
			.eq('id', input.taskId)
			.eq('user_id', userId);
		if (taskError) throw new Error(taskError.message);
	} else if (input.projectId) {
		const { error: projectError } = await localData
			.from('projects')
			.update({
				name: trimmedName,
				deadline: dueDate,
				reminder: true,
			})
			.eq('id', input.projectId)
			.eq('user_id', userId);
		if (projectError) throw new Error(projectError.message);
	}

	notifyRemindersUpdated();
	if (input.taskId || input.projectId) {
		notifyTasksUpdated();
	}
}
