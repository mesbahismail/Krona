import type { LocalDataClient } from '@/lib/localData';
import type { DailyChallenge } from '@/lib/challenges';
import { fetchTasksFinishedTodayCount } from '@/lib/dashboard/countTasksFinishedOnDay';
import type { DashboardProject, DashboardTask } from '@/components/dashboard/useDashboardTasks';
import { isTaskPrioritized } from '@/lib/taskPriority';
import type { NoteRow } from '@/lib/notes';
import type { DashboardReminderRow } from '@/lib/reminders';
import { filterUpcomingReminders } from '@/lib/reminders';
import {
	fetchAssigneeTeamReminders,
	mergeDashboardReminderRows,
	teamRemindersToDashboardRows,
} from '@/lib/teams/assigneeReminders';
import {
	fetchUserRoutineRows,
	getRoutineRowsForDay,
	mapDbRowsToRoutineItems,
} from '@/lib/routineDb';
import type { RoutineItem } from '@/lib/routine';
import {
	filterOutPendingTaskDeletes,
	pruneCommittedDeletesNotInFetch,
} from '@/lib/pendingTaskDeletes';
import { resetStaleRepeatableTasks } from '@/lib/repeatableTasks';

const NOTES_LIMIT = 8;
const REMINDERS_LIMIT = 4;
/** Fetch extra rows so overdue items can be dropped while still filling the widget. */
const REMINDERS_FETCH_LIMIT = 40;
const TASKS_LIMIT = 300;

const TASK_SELECT_BASE =
	'id,name,time_assigned_minutes,total_time_worked_minutes,deadline,created_at,project_id,status,updated_at,completed_at,repeatable';

async function fetchDashboardTaskRows(
	localData: LocalDataClient,
	userId: string,
): Promise<TaskRow[]> {
	const withPriority = await localData
		.from('tasks')
		.select(`${TASK_SELECT_BASE},prioritized`)
		.eq('user_id', userId)
		.order('created_at', { ascending: false })
		.limit(TASKS_LIMIT);

	if (!withPriority.error) {
		return (withPriority.data as TaskRow[]) || [];
	}

	const fallback = await localData
		.from('tasks')
		.select(TASK_SELECT_BASE)
		.eq('user_id', userId)
		.order('created_at', { ascending: false })
		.limit(TASKS_LIMIT);

	if (fallback.error) {
		console.warn('[dashboard] task load failed', fallback.error.message);
		return [];
	}

	return (fallback.data as TaskRow[]) || [];
}

type TaskRow = {
	id: string;
	name: string;
	time_assigned_minutes: number | null;
	total_time_worked_minutes: number | null;
	deadline?: string | null;
	created_at: string;
	project_id: string | null;
	status: string | null;
	updated_at?: string | null;
	completed_at?: string | null;
	prioritized?: boolean | null;
	repeatable?: boolean | null;
};

function mapTaskRows(rows: TaskRow[], projectMap: Map<string, string>): DashboardTask[] {
	return rows.map((t) => ({
		id: t.id,
		name: t.name,
		projectId: t.project_id,
		project: t.project_id ? projectMap.get(t.project_id) || 'Project' : 'Unassigned',
		totalTime: Number(t.total_time_worked_minutes || 0) * 60,
		assignedSeconds:
			Number(t.time_assigned_minutes || 0) > 0
				? Number(t.time_assigned_minutes) * 60
				: undefined,
		deadline: t.deadline ?? null,
		createdAt: new Date(t.created_at),
		status: t.status || 'pending',
		prioritized: isTaskPrioritized(t.id, t.prioritized),
		repeatable: Boolean(t.repeatable),
	}));
}

export type DashboardBundle = {
	userId: string;
	firstName: string | null;
	projects: DashboardProject[];
	tasks: DashboardTask[];
	notes: NoteRow[];
	reminders: DashboardReminderRow[];
	routine: RoutineItem[];
	challenges: DailyChallenge[];
	challengeProgress: number;
	tasksFinishedToday: number;
};

export async function loadDashboardBundle(
	localData: LocalDataClient,
	userId: string,
): Promise<DashboardBundle> {
	await resetStaleRepeatableTasks(userId, localData, { notify: false });

	const [personalRes, projectRes, taskRows, notesRes, remindersRes, teamReminderRows, routineRows, tasksFinishedToday] =
		await Promise.all([
			localData.from('personal').select('first_name').eq('user_id', userId).maybeSingle(),
			localData
				.from('projects')
				.select('id,name,is_unassigned_folder')
				.eq('user_id', userId),
			fetchDashboardTaskRows(localData, userId),
			localData
				.from('notes')
				.select('id, title, body, created_at, updated_at')
				.eq('user_id', userId)
				.order('updated_at', { ascending: false })
				.limit(NOTES_LIMIT),
			localData
				.from('reminders')
				.select('id, name, type, due_date, date_created')
				.eq('user_id', userId)
				.order('due_date', { ascending: true, nullsFirst: false })
				.limit(REMINDERS_FETCH_LIMIT),
			fetchAssigneeTeamReminders(localData, userId).catch(() => []),
			fetchUserRoutineRows(userId, localData).catch((error) => {
				console.warn('[dashboard] routine load failed', error);
				return [];
			}),
			fetchTasksFinishedTodayCount(localData, userId),
		]);

	const projects = (projectRes.data || []).map((p) => ({
		id: p.id,
		name: p.name,
		isUnassignedFolder: Boolean(p.is_unassigned_folder),
	}));
	const projectMap = new Map(projects.map((p) => [p.id, p.name] as const));
	pruneCommittedDeletesNotInFetch(taskRows.map((row) => row.id));
	const tasks = filterOutPendingTaskDeletes(mapTaskRows(taskRows, projectMap));

	const reminders = filterUpcomingReminders(
		mergeDashboardReminderRows(
			(remindersRes.data as DashboardReminderRow[]) || [],
			teamRemindersToDashboardRows(teamReminderRows),
		),
		REMINDERS_LIMIT,
	);

	const dow = new Date().getDay();
	const routine =
		routineRows.length > 0
			? mapDbRowsToRoutineItems(getRoutineRowsForDay(routineRows, dow))
			: [];

	const firstName = personalRes.data?.first_name?.trim() || null;

	return {
		userId,
		firstName,
		projects,
		tasks,
		notes: (notesRes.data as NoteRow[]) || [],
		reminders,
		routine,
		challenges: [],
		challengeProgress: 0,
		tasksFinishedToday,
	};
}
