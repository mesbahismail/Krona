'use client';

import * as React from 'react';
import { localData } from '@/lib/localData';

const LIVE_EVENTS = [
	'krona:challenges-updated',
	'krona:tasks-updated',
	'krona:reminders-updated',
] as const;

/**
 * Keep a manager view in sync when org data actually changes.
 * Realtime + in-app events are the signal; no polling.
 */
export function useTeamLiveRefresh(
	organizationId: string | null | undefined,
	refresh: () => void | Promise<void>,
	options?: { enabled?: boolean; intervalMs?: number },
) {
	const enabled = Boolean(organizationId) && (options?.enabled ?? true);
	const refreshRef = React.useRef(refresh);
	refreshRef.current = refresh;

	React.useEffect(() => {
		if (!enabled || !organizationId) return;

		let debounce: ReturnType<typeof setTimeout> | null = null;
		let inFlight = false;
		let queued = false;

		const run = async () => {
			if (inFlight) {
				queued = true;
				return;
			}
			inFlight = true;
			try {
				await refreshRef.current();
			} finally {
				inFlight = false;
				if (queued) {
					queued = false;
					void run();
				}
			}
		};

		const kick = () => {
			if (debounce) clearTimeout(debounce);
			debounce = setTimeout(() => {
				void run();
			}, 600);
		};
		const onVisible = () => {
			if (document.visibilityState === 'visible') kick();
		};

		for (const eventName of LIVE_EVENTS) {
			window.addEventListener(eventName, kick);
		}
		window.addEventListener('focus', kick);
		document.addEventListener('visibilitychange', onVisible);

		const channel = localData
			.channel(`team-live:${organizationId}`)
			.on(
				'postgres_changes',
				{
					event: '*',
					schema: 'public',
					table: 'team_tasks',
					filter: `organization_id=eq.${organizationId}`,
				},
				kick,
			)
			.on(
				'postgres_changes',
				{
					event: '*',
					schema: 'public',
					table: 'team_reminders',
					filter: `organization_id=eq.${organizationId}`,
				},
				kick,
			)
			.on(
				'postgres_changes',
				{
					event: '*',
					schema: 'public',
					table: 'organization_members',
					filter: `organization_id=eq.${organizationId}`,
				},
				kick,
			)
			.subscribe();

		return () => {
			if (debounce) clearTimeout(debounce);
			for (const eventName of LIVE_EVENTS) {
				window.removeEventListener(eventName, kick);
			}
			window.removeEventListener('focus', kick);
			document.removeEventListener('visibilitychange', onVisible);
			void localData.removeChannel(channel);
		};
	}, [enabled, organizationId]);
}
