'use client';

import * as React from 'react';
import { localData } from '@/lib/localData';
import {
	filterUpcomingReminders,
	type DashboardReminderRow,
} from '@/lib/reminders';
import {
	fetchAssigneeTeamReminders,
	mergeDashboardReminderRows,
	teamRemindersToDashboardRows,
} from '@/lib/teams/assigneeReminders';
import { useDashboardDataOptional } from '@/components/dashboard/DashboardDataProvider';

const WIDGET_LIMIT = 4;
const FETCH_LIMIT = 40;

export function useDashboardReminders() {
	const dashboard = useDashboardDataOptional();
	const [localReminders, setLocalReminders] = React.useState<DashboardReminderRow[]>([]);
	const [localLoading, setLocalLoading] = React.useState(true);
	const rawReminders = dashboard ? dashboard.reminders : localReminders;
	const reminders = React.useMemo(
		() =>
			dashboard
				? rawReminders
				: filterUpcomingReminders(rawReminders, WIDGET_LIMIT),
		[dashboard, rawReminders],
	);
	const loading = dashboard ? dashboard.loading : localLoading;

	const reload = React.useCallback(async () => {
		if (dashboard) return;
		try {
			const { data: userRes } = await localData.auth.getUser();
			const user = userRes.user;
			if (!user) {
				setLocalReminders([]);
				return;
			}

			const [{ data }, teamRows] = await Promise.all([
				localData
					.from('reminders')
					.select('id, name, type, due_date, date_created')
					.eq('user_id', user.id)
					.order('due_date', { ascending: true, nullsFirst: false })
					.limit(FETCH_LIMIT),
				fetchAssigneeTeamReminders(localData, user.id),
			]);

			setLocalReminders(
				mergeDashboardReminderRows(
					(data as DashboardReminderRow[]) || [],
					teamRemindersToDashboardRows(teamRows),
				),
			);
		} catch {
			/* ignore */
		} finally {
			setLocalLoading(false);
		}
	}, [dashboard]);

	React.useEffect(() => {
		if (dashboard) return;
		void reload();
		const onRefresh = () => void reload();
		const onPageShow = (e: PageTransitionEvent) => {
			if (e.persisted) void reload();
		};
		window.addEventListener('focus', onRefresh);
		window.addEventListener('pageshow', onPageShow);
		window.addEventListener('krona:reminders-updated', onRefresh);
		window.addEventListener('krona:tasks-updated', onRefresh);
		return () => {
			window.removeEventListener('focus', onRefresh);
			window.removeEventListener('pageshow', onPageShow);
			window.removeEventListener('krona:reminders-updated', onRefresh);
			window.removeEventListener('krona:tasks-updated', onRefresh);
		};
	}, [reload, dashboard]);

	return { reminders, loading };
}
