/** In-memory + session-persisted task delete state. */

const COMMITTED_STORAGE_KEY = 'krona:committed-task-deletes';
const RETRY_STORAGE_KEY = 'krona:retry-task-deletes';
const DELETED_NAME_KEYS_STORAGE = 'krona:deleted-task-name-keys';

/** Staged for undo — in-memory only so a refetch cannot commit early. */
const pendingTaskDeleteIds = new Set<string>();
/** Successfully deleted; hide until prune confirms row is gone. */
const committedTaskDeleteIds = new Set<string>();
/** Commit attempted but failed — retry on next load. */
const retryTaskDeleteIds = new Set<string>();
/** Block note→project sync from re-inserting by name. */
const deletedTaskNameKeys = new Set<string>();

function readStoredIds(key: string): string[] {
	if (typeof window === 'undefined') return [];
	try {
		const raw = window.sessionStorage.getItem(key);
		if (!raw) return [];
		const parsed = JSON.parse(raw) as unknown;
		return Array.isArray(parsed)
			? parsed.filter((id): id is string => typeof id === 'string' && id.length > 0)
			: [];
	} catch {
		return [];
	}
}

function writeStoredIds(key: string, ids: Set<string>) {
	if (typeof window === 'undefined') return;
	try {
		window.sessionStorage.setItem(key, JSON.stringify([...ids]));
	} catch {
		/* ignore */
	}
}

function hydrateFromStorage() {
	if (typeof window === 'undefined') return;
	for (const id of readStoredIds(COMMITTED_STORAGE_KEY)) {
		committedTaskDeleteIds.add(id);
	}
	for (const id of readStoredIds(RETRY_STORAGE_KEY)) {
		retryTaskDeleteIds.add(id);
	}
	for (const key of readStoredIds(DELETED_NAME_KEYS_STORAGE)) {
		deletedTaskNameKeys.add(key);
	}
	// Migrate legacy pending key into retry so unfinished deletes still finish.
	for (const id of readStoredIds('krona:pending-task-deletes')) {
		retryTaskDeleteIds.add(id);
	}
	if (retryTaskDeleteIds.size > 0) {
		writeStoredIds(RETRY_STORAGE_KEY, retryTaskDeleteIds);
	}
	try {
		window.sessionStorage.removeItem('krona:pending-task-deletes');
	} catch {
		/* ignore */
	}
}

hydrateFromStorage();

export function taskDeleteNameKey(
	projectId: string | null | undefined,
	taskName: string,
): string {
	return `${projectId ?? ''}::${taskName.trim().toLowerCase()}`;
}

export function markDeletedTaskNameKey(
	projectId: string | null | undefined,
	taskName: string,
) {
	const key = taskDeleteNameKey(projectId, taskName);
	if (!key.endsWith('::')) {
		deletedTaskNameKeys.add(key);
		writeStoredIds(DELETED_NAME_KEYS_STORAGE, deletedTaskNameKeys);
	}
}

export function wasTaskNameRecentlyDeleted(
	projectId: string | null | undefined,
	taskName: string,
): boolean {
	return deletedTaskNameKeys.has(taskDeleteNameKey(projectId, taskName));
}

export function markTaskDeletePending(taskId: string) {
	if (!taskId) return;
	pendingTaskDeleteIds.add(taskId);
}

export function clearTaskDeletePending(taskId: string) {
	if (!taskId) return;
	pendingTaskDeleteIds.delete(taskId);
}

export function markTaskDeleteNeedsRetry(taskId: string) {
	if (!taskId) return;
	retryTaskDeleteIds.add(taskId);
	writeStoredIds(RETRY_STORAGE_KEY, retryTaskDeleteIds);
}

export function clearTaskDeleteNeedsRetry(taskId: string) {
	if (!taskId) return;
	retryTaskDeleteIds.delete(taskId);
	writeStoredIds(RETRY_STORAGE_KEY, retryTaskDeleteIds);
}

export function markTaskDeleteCommitted(taskId: string) {
	if (!taskId) return;
	committedTaskDeleteIds.add(taskId);
	pendingTaskDeleteIds.delete(taskId);
	retryTaskDeleteIds.delete(taskId);
	writeStoredIds(COMMITTED_STORAGE_KEY, committedTaskDeleteIds);
	writeStoredIds(RETRY_STORAGE_KEY, retryTaskDeleteIds);
}

export function clearTaskDeleteCommitted(taskId: string) {
	if (!taskId) return;
	committedTaskDeleteIds.delete(taskId);
	writeStoredIds(COMMITTED_STORAGE_KEY, committedTaskDeleteIds);
}

export function isTaskDeletePending(taskId: string): boolean {
	return Boolean(taskId) && pendingTaskDeleteIds.has(taskId);
}

export function isTaskDeleteCommitted(taskId: string): boolean {
	return Boolean(taskId) && committedTaskDeleteIds.has(taskId);
}

export function shouldHideDeletedTask(taskId: string | null | undefined): boolean {
	if (!taskId) return false;
	return (
		pendingTaskDeleteIds.has(taskId) ||
		committedTaskDeleteIds.has(taskId) ||
		retryTaskDeleteIds.has(taskId)
	);
}

export function filterOutPendingTaskDeletes<T extends { id?: string | null }>(
	tasks: T[],
): T[] {
	if (
		pendingTaskDeleteIds.size === 0 &&
		committedTaskDeleteIds.size === 0 &&
		retryTaskDeleteIds.size === 0
	) {
		return tasks;
	}
	return tasks.filter((task) => !task.id || !shouldHideDeletedTask(task.id));
}

/** Drop committed ids that no longer exist in a fresh fetch. */
export function pruneCommittedDeletesNotInFetch(fetchedIds: Iterable<string>) {
	const present = new Set(fetchedIds);
	let changed = false;
	for (const id of [...committedTaskDeleteIds]) {
		if (!present.has(id)) {
			committedTaskDeleteIds.delete(id);
			changed = true;
		}
	}
	if (changed) {
		writeStoredIds(COMMITTED_STORAGE_KEY, committedTaskDeleteIds);
	}
}

/** Ids whose permanent delete still needs to succeed. */
export function getPendingTaskDeleteIds(): string[] {
	return [...retryTaskDeleteIds];
}
