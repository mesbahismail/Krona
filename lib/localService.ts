import { localData } from '@/lib/localData';

/** Local handling for forms; remote-only services fail clearly without making requests. */
export async function localService(
	service: string,
	options?: RequestInit,
): Promise<Response> {
	if (service === 'help' || service === 'feedback') {
		try {
			const input = JSON.parse(String(options?.body ?? '{}'));
			const { error } = await localData
				.from('local_drafts')
				.insert({ ...input, kind: service });
			if (error)
				return Response.json({ error: error.message }, { status: 500 });
			return Response.json({ savedLocally: true });
		} catch {
			return Response.json(
				{ error: 'Could not save this draft on your device.' },
				{ status: 500 },
			);
		}
	}
	return Response.json(
		{
			error:
				'This service is unavailable in the local template. No request was sent.',
		},
		{ status: 503 },
	);
}
