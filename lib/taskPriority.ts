const STORAGE_KEY = 'krona:task-prioritized-ids';

export function readPrioritizedTaskIds(): Set<string> {
	if (typeof window === 'undefined') return new Set();
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (!raw) return new Set();
		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed)) return new Set();
		return new Set(parsed.filter((id): id is string => typeof id === 'string'));
	} catch {
		return new Set();
	}
}

function writePrioritizedTaskIds(ids: Set<string>) {
	if (typeof window === 'undefined') return;
	try {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
	} catch {
		/* ignore quota errors */
	}
}

export function setTaskPrioritized(taskId: string, prioritized: boolean) {
	const ids = readPrioritizedTaskIds();
	if (prioritized) ids.add(taskId);
	else ids.delete(taskId);
	writePrioritizedTaskIds(ids);
}

export function clearTaskPrioritized(taskId: string) {
	setTaskPrioritized(taskId, false);
}

export function isTaskPrioritized(
	taskId: string | undefined,
	dbPrioritized?: boolean | null,
): boolean {
	if (!taskId) return Boolean(dbPrioritized);
	if (readPrioritizedTaskIds().has(taskId)) return true;
	return Boolean(dbPrioritized);
}

export function sortTasksWithPriorityFirst<T extends { id?: string; prioritized?: boolean }>(
	tasks: T[],
	compareSecondary?: (a: T, b: T) => number,
): T[] {
	return [...tasks].sort((a, b) => {
		const priorityDiff =
			Number(isTaskPrioritized(b.id, b.prioritized)) -
			Number(isTaskPrioritized(a.id, a.prioritized));
		if (priorityDiff !== 0) return priorityDiff;
		return compareSecondary ? compareSecondary(a, b) : 0;
	});
}
