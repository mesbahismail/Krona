'use client';

import { localData } from './localData';

type Payload = Record<string, unknown> | null | undefined;

export async function logEvent(eventName: string, payload?: Payload) {
	try {
		// Best-effort: do not block UI
		const { data } = await localData.auth.getUser();
		const userId = data?.user?.id ?? null;
		if (!userId) return; // skip if not authenticated

		await localData.from('events').insert([
			{
				user_id: userId,
				event_name: eventName,
				payload: payload ?? null,
			},
		]);
	} catch (err) {
		// Silent fail in client; avoid throwing in UI
		if (process.env.NODE_ENV !== 'production') {
			console.debug('telemetry logEvent failed', err);
		}
	}
}

export function logEventSync(eventName: string, payload?: Payload) {
	// Fire-and-forget wrapper (no await) for UI handlers
	// eslint-disable-next-line @typescript-eslint/no-floating-promises
	logEvent(eventName, payload);
}
