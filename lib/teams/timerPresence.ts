'use client';

import { localData } from '@/lib/localData';

export type TeamTimerPresenceMode = 'work' | 'rest';

const STALE_MS = 180_000;

export function isFreshTimerPresence(updatedAt: string | null | undefined): boolean {
	if (!updatedAt) return false;
	const at = new Date(updatedAt).getTime();
	return Number.isFinite(at) && Date.now() - at < STALE_MS;
}

export type TeamTimerPresenceRow = {
	mode: TeamTimerPresenceMode;
	startedAt: string;
	updatedAt: string;
};

export async function upsertTimerPresence(
	mode: TeamTimerPresenceMode,
): Promise<void> {
	const { data } = await localData.auth.getUser();
	const userId = data.user?.id;
	if (!userId) return;
	const now = new Date().toISOString();
	const { data: existing } = await localData
		.from('user_timer_presence')
		.select('mode, started_at, updated_at')
		.eq('user_id', userId)
		.maybeSingle();
	const sameModeFresh =
		existing != null &&
		(existing.mode === 'rest' ? 'rest' : 'work') === mode &&
		isFreshTimerPresence(
			existing.updated_at ? String(existing.updated_at) : null,
		);
	if (sameModeFresh) {
		const { error } = await localData
			.from('user_timer_presence')
			.update({ mode, updated_at: now })
			.eq('user_id', userId);
		if (error) {
			console.warn('[timerPresence] upsert failed', error.message);
		}
		return;
	}
	const { error } = await localData.from('user_timer_presence').upsert(
		{
			user_id: userId,
			mode,
			started_at: now,
			updated_at: now,
		},
		{ onConflict: 'user_id' },
	);
	if (error) {
		console.warn('[timerPresence] upsert failed', error.message);
	}
}

export async function heartbeatTimerPresence(
	mode: TeamTimerPresenceMode,
): Promise<void> {
	const { data: auth } = await localData.auth.getUser();
	const userId = auth.user?.id;
	if (!userId) return;
	const { data: updated, error } = await localData
		.from('user_timer_presence')
		.update({
			mode,
			updated_at: new Date().toISOString(),
		})
		.eq('user_id', userId)
		.select('user_id');
	if (error || !updated?.length) {
		await upsertTimerPresence(mode);
	}
}

export async function clearTimerPresence(): Promise<void> {
	const { data } = await localData.auth.getUser();
	const userId = data.user?.id;
	if (!userId) return;
	await localData.from('user_timer_presence').delete().eq('user_id', userId);
}

export async function fetchTimerPresenceDetails(
	userIds: string[],
): Promise<Map<string, TeamTimerPresenceRow>> {
	const map = new Map<string, TeamTimerPresenceRow>();
	if (!userIds.length) return map;
	const { data } = await localData
		.from('user_timer_presence')
		.select('user_id, mode, started_at, updated_at')
		.in('user_id', userIds);
	for (const row of data ?? []) {
		const updatedAt = row.updated_at ? String(row.updated_at) : '';
		if (!isFreshTimerPresence(updatedAt || null)) continue;
		map.set(String(row.user_id), {
			mode: row.mode === 'rest' ? 'rest' : 'work',
			startedAt: row.started_at ? String(row.started_at) : updatedAt,
			updatedAt,
		});
	}
	return map;
}

export async function fetchTimerPresenceByUserIds(
	userIds: string[],
): Promise<Map<string, TeamTimerPresenceMode>> {
	const details = await fetchTimerPresenceDetails(userIds);
	const map = new Map<string, TeamTimerPresenceMode>();
	for (const [userId, row] of details) {
		map.set(userId, row.mode);
	}
	return map;
}
