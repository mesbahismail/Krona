'use client';

import * as React from 'react';
import { useTeamMode } from '@/components/teams/TeamModeContext';
import {
	fetchMyAssignedTeamTasks,
	fetchTeamProjects,
	fetchTeamProjectsByIds,
	fetchTeamReminders,
	type TeamProjectRow,
	type TeamReminderRow,
	type TeamTaskRow,
} from '@/lib/teams/dashboard';
import { localData } from '@/lib/localData';
import {
	mergeReminders,
	mergeTeamProjects,
	mergeTeamTasks,
} from '@/lib/teams/stableLists';

export function useMyTeamWork() {
	const team = useTeamMode();
	const organizationId = team.organization?.id ?? null;
	const mode = team.mode;
	const [userId, setUserId] = React.useState<string | null>(null);
	const [tasks, setTasks] = React.useState<TeamTaskRow[]>([]);
	const [projects, setProjects] = React.useState<TeamProjectRow[]>([]);
	const [reminders, setReminders] = React.useState<TeamReminderRow[]>([]);
	const [loading, setLoading] = React.useState(false);
	const loadedOnceRef = React.useRef(false);

	const reload = React.useCallback(async (options?: { silent?: boolean }) => {
		if (!organizationId || mode !== 'individual') {
			setTasks([]);
			setProjects([]);
			setReminders([]);
			loadedOnceRef.current = false;
			return;
		}
		const showSpinner = !options?.silent && !loadedOnceRef.current;
		if (showSpinner) setLoading(true);
		try {
			const { data } = await localData.auth.getUser();
			const uid = data.user?.id ?? null;
			setUserId(uid);
			if (!uid) return;
			const [nextProjects, nextReminders] = await Promise.all([
				fetchTeamProjects(organizationId, { assigneeUserId: uid }),
				fetchTeamReminders(organizationId, {
					assigneeUserId: uid,
					includeDone: true,
				}),
			]);
			const nextTasks = await fetchMyAssignedTeamTasks(
				organizationId,
				uid,
				nextProjects,
			);
			const knownProjectIds = new Set(nextProjects.map((project) => project.id));
			const missingProjectIds = [
				...new Set(
					nextTasks
						.map((task) => task.project_id)
						.filter((id): id is string => Boolean(id && !knownProjectIds.has(id))),
				),
			];
			const extraProjects = await fetchTeamProjectsByIds(
				organizationId,
				missingProjectIds,
			);
			const projectsForUi =
				extraProjects.length > 0
					? [...nextProjects, ...extraProjects]
					: nextProjects;
			setTasks((prev) => mergeTeamTasks(prev, nextTasks));
			setProjects((prev) => mergeTeamProjects(prev, projectsForUi));
			setReminders((prev) => mergeReminders(prev, nextReminders));
			loadedOnceRef.current = true;
		} finally {
			if (showSpinner) setLoading(false);
		}
	}, [mode, organizationId]);

	React.useEffect(() => {
		void reload();
	}, [reload]);

	React.useEffect(() => {
		let debounce: ReturnType<typeof setTimeout> | null = null;
		const onSessions = () => {
			if (debounce) clearTimeout(debounce);
			debounce = setTimeout(() => {
				debounce = null;
				void reload({ silent: true });
			}, 1500);
		};
		window.addEventListener('krona:sessions-updated', onSessions);
		return () => {
			if (debounce) clearTimeout(debounce);
			window.removeEventListener('krona:sessions-updated', onSessions);
		};
	}, [reload]);

	return {
		...team,
		userId,
		tasks,
		projects,
		reminders,
		loading,
		reload,
	};
}
