/** Deterministic default avatar when the user has no uploaded picture. */
export function defaultAvatarUrl(seed: string): string {
	const safe = encodeURIComponent((seed || 'krona').trim() || 'krona');
	return `https://api.dicebear.com/9.x/notionists/svg?seed=${safe}&backgroundColor=495dfd,6320de,15a1f1`;
}
