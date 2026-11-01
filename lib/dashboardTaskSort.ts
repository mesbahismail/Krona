export type DashboardTaskSortKey = 'newest' | 'oldest' | 'name' | 'nameDesc';

export type TaskListFilters = {
	repeatableOnly: boolean;
	favoritesOnly: boolean;
};

export const DEFAULT_TASK_LIST_FILTERS: TaskListFilters = {
	repeatableOnly: false,
	favoritesOnly: false,
};

const TASK_SORT_STORAGE_KEY = 'krona:dashboard-task-sort';

function parseSortKey(raw: string | null): DashboardTaskSortKey {
	if (raw === 'oldest' || raw === 'name' || raw === 'nameDesc') return raw;
	return 'newest';
}

export function readDashboardTaskSort(): DashboardTaskSortKey {
	if (typeof window === 'undefined') return 'newest';
	try {
		return parseSortKey(window.localStorage.getItem(TASK_SORT_STORAGE_KEY));
	} catch {
		return 'newest';
	}
}

export function writeDashboardTaskSort(sortBy: DashboardTaskSortKey) {
	if (typeof window === 'undefined') return;
	try {
		window.localStorage.setItem(TASK_SORT_STORAGE_KEY, sortBy);
	} catch {
		/* ignore quota errors */
	}
}

export function compareDashboardTasksBySortKey<
	T extends { name: string; createdAt: Date },
>(a: T, b: T, sortBy: DashboardTaskSortKey): number {
	if (sortBy === 'name') {
		return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
	}
	if (sortBy === 'nameDesc') {
		return b.name.localeCompare(a.name, undefined, { sensitivity: 'base' });
	}
	if (sortBy === 'oldest') {
		return a.createdAt.getTime() - b.createdAt.getTime();
	}
	return b.createdAt.getTime() - a.createdAt.getTime();
}

export function taskMatchesListFilters<
	T extends { repeatable?: boolean; prioritized?: boolean },
>(task: T, filters: TaskListFilters): boolean {
	if (filters.repeatableOnly && !task.repeatable) return false;
	if (filters.favoritesOnly && !task.prioritized) return false;
	return true;
}
