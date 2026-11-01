import { collapseExcessiveBlankLines, sanitizeProseOnPersist } from '@/lib/noteTiptap';

export type NoteRow = {
	id: string;
	title: string;
	body: string;
	created_at: string;
	updated_at: string;
};

export function notePreview(body: string, maxLen = 120): string {
	const plain = body.replace(/\s+/g, ' ').trim();
	if (!plain) return 'No content yet';
	return plain.length > maxLen ? `${plain.slice(0, maxLen)}…` : plain;
}

/** Default title from the first words of note prose (ignores checklist lines). */
export function deriveNoteTitleFromBody(body: string, maxWords = 8): string {
	const prose = getProseBody(body).trim();
	if (!prose) return '';

	const oneLine = prose.replace(/\s+/g, ' ').trim();
	const words = oneLine.split(' ').filter(Boolean).slice(0, maxWords);
	if (words.length === 0) return '';

	const derived = words.join(' ');
	return derived.length > 80 ? `${derived.slice(0, 80)}…` : derived;
}

export function noteTitle(title: string, body: string): string {
	const t = title.trim();
	if (t) return t;
	return deriveNoteTitleFromBody(body) || 'Untitled';
}

export type NoteGroup = {
	label: string;
	notes: NoteRow[];
};

/** Sidebar section labels (Apple Notes–style). */
export function groupNotesByDate(
	notes: NoteRow[],
	now = new Date(),
): NoteGroup[] {
	const today = new Date(now);
	today.setHours(0, 0, 0, 0);

	const buckets = new Map<string, NoteRow[]>();
	const order: string[] = [];

	const labelFor = (updatedAt: string) => {
		const d = new Date(updatedAt);
		const day = new Date(d);
		day.setHours(0, 0, 0, 0);
		const daysAgo = Math.floor((today.getTime() - day.getTime()) / 86400000);

		if (daysAgo === 0) return 'Today';
		if (daysAgo === 1) return 'Yesterday';
		if (daysAgo <= 7) return 'Previous 7 Days';
		if (daysAgo <= 30) return 'Previous 30 Days';

		const sameYear = d.getFullYear() === today.getFullYear();
		if (sameYear) {
			return d.toLocaleDateString(undefined, { month: 'long' });
		}
		return String(d.getFullYear());
	};

	for (const note of notes) {
		const label = labelFor(note.updated_at);
		if (!buckets.has(label)) {
			buckets.set(label, []);
			order.push(label);
		}
		buckets.get(label)!.push(note);
	}

	return order.map((label) => ({ label, notes: buckets.get(label)! }));
}

export function formatNoteListMeta(updatedAt: string): string {
	const d = new Date(updatedAt);
	const now = new Date();
	const sameDay =
		d.getDate() === now.getDate() &&
		d.getMonth() === now.getMonth() &&
		d.getFullYear() === now.getFullYear();

	if (sameDay) {
		return d.toLocaleTimeString(undefined, {
			hour: 'numeric',
			minute: '2-digit',
		});
	}
	return d.toLocaleDateString(undefined, {
		day: 'numeric',
		month: 'short',
		year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
	});
}

export function formatNoteEditorTimestamp(updatedAt: string): string {
	const d = new Date(updatedAt);
	if (Number.isNaN(d.getTime())) return '';

	const now = new Date();
	const sameDay =
		d.getDate() === now.getDate() &&
		d.getMonth() === now.getMonth() &&
		d.getFullYear() === now.getFullYear();

	const time = d.toLocaleTimeString(undefined, {
		hour: 'numeric',
		minute: '2-digit',
	});

	if (sameDay) {
		return `today at ${time}`;
	}

	const date = d.toLocaleDateString(undefined, {
		day: 'numeric',
		month: 'long',
		year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
	});
	return `${date} at ${time}`;
}

const CHECKLIST_STRICT_RE = /^- \[([ xX])\] (.*)$/;
const CHECKLIST_LOOSE_RE = /^- \[([ xX]?)\]\s*(.*)$/;
const CHECKLIST_TIME_SUFFIX_RE = / · (\d+(?:\.\d+)?)h$/;
export const PROJECT_TASKS_HEADER_PREFIX = '### Tasks · ';
export const PROJECT_TASKS_NOTE_ONLY_SUFFIX = 'note-only';
export const PROJECT_TASKS_FOLDER_SUFFIX = 'folder';
const PROJECT_TASKS_UUID_SUFFIX_RE =
	/^(.+?) · ([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

export type ChecklistLine = {
	/** Stable index within the checklist (not raw body line number). */
	id: number;
	checked: boolean;
	text: string;
	assignedHours?: number | null;
};

export type ChecklistGroup = {
	projectName: string | null;
	projectId: string | null;
	/** Note-only cards are not linked or synced to the Projects page. */
	noteOnly: boolean;
	/** Local tasks folder in the note (not a project). */
	isTaskFolder: boolean;
	items: ChecklistLine[];
};

export type NoteProseBodyBlock = {
	type: 'prose';
	text: string;
};

export type NoteChecklistBodyBlock = {
	type: 'checklist';
	group: ChecklistGroup;
};

export type NoteBodyBlock = NoteProseBodyBlock | NoteChecklistBodyBlock;

export function isProjectTasksHeader(line: string): boolean {
	return line.trim().startsWith(PROJECT_TASKS_HEADER_PREFIX);
}

export function parseProjectTasksHeader(line: string): {
	projectName: string | null;
	projectId: string | null;
	noteOnly: boolean;
	isTaskFolder: boolean;
} {
	const trimmed = line.trim();
	if (!trimmed.startsWith(PROJECT_TASKS_HEADER_PREFIX)) {
		return { projectName: null, projectId: null, noteOnly: false, isTaskFolder: false };
	}
	const rest = trimmed.slice(PROJECT_TASKS_HEADER_PREFIX.length);
	const folderSuffix = ` · ${PROJECT_TASKS_FOLDER_SUFFIX}`;
	if (rest.endsWith(folderSuffix)) {
		return {
			projectName: rest.slice(0, -folderSuffix.length).trim(),
			projectId: null,
			noteOnly: true,
			isTaskFolder: true,
		};
	}
	const noteOnlySuffix = ` · ${PROJECT_TASKS_NOTE_ONLY_SUFFIX}`;
	if (rest.endsWith(noteOnlySuffix)) {
		return {
			projectName: rest.slice(0, -noteOnlySuffix.length).trim(),
			projectId: null,
			noteOnly: true,
			isTaskFolder: false,
		};
	}
	const idMatch = rest.match(PROJECT_TASKS_UUID_SUFFIX_RE);
	if (idMatch) {
		return {
			projectName: idMatch[1].trim(),
			projectId: idMatch[2],
			noteOnly: false,
			isTaskFolder: false,
		};
	}
	return { projectName: rest.trim(), projectId: null, noteOnly: false, isTaskFolder: false };
}

export function projectNameFromHeader(line: string): string | null {
	return parseProjectTasksHeader(line).projectName;
}

export function formatProjectTasksHeader(
	projectName: string,
	options?: {
		projectId?: string | null;
		noteOnly?: boolean;
		isTaskFolder?: boolean;
	},
): string {
	const name = projectName.trim();
	if (options?.projectId) {
		return `${PROJECT_TASKS_HEADER_PREFIX}${name} · ${options.projectId}`;
	}
	if (options?.isTaskFolder) {
		return `${PROJECT_TASKS_HEADER_PREFIX}${name} · ${PROJECT_TASKS_FOLDER_SUFFIX}`;
	}
	if (options?.noteOnly) {
		return `${PROJECT_TASKS_HEADER_PREFIX}${name} · ${PROJECT_TASKS_NOTE_ONLY_SUFFIX}`;
	}
	return `${PROJECT_TASKS_HEADER_PREFIX}${name}`;
}

export function isChecklistLine(line: string): boolean {
	return CHECKLIST_LOOSE_RE.test(line.trim());
}

function parseChecklistItemPayload(raw: string): {
	text: string;
	assignedHours: number | null;
} {
	const trimmed = raw.trimEnd();
	const match = trimmed.match(CHECKLIST_TIME_SUFFIX_RE);
	if (match) {
		const hours = Number(match[1]);
		return {
			text: trimmed.slice(0, match.index).trimEnd(),
			assignedHours: hours > 0 ? hours : null,
		};
	}
	return { text: trimmed, assignedHours: null };
}

function formatChecklistLine(
	checked: boolean,
	text: string,
	assignedHours?: number | null,
) {
	const suffix =
		assignedHours != null && assignedHours > 0 ? ` · ${assignedHours}h` : '';
	return `- [${checked ? 'x' : ' '}] ${text}${suffix}`;
}

/** Fix malformed lines like `- []` so the checklist parser can read them. */
export function normalizeNoteBody(body: string): string {
	return body
		.split('\n')
		.map((line) => {
			const match = line.match(CHECKLIST_LOOSE_RE);
			if (!match) return line;
			const payload = parseChecklistItemPayload(match[2] ?? '');
			return formatChecklistLine(
				match[1].toLowerCase() === 'x',
				payload.text,
				payload.assignedHours,
			);
		})
		.join('\n');
}

export function parseChecklistGroups(body: string): ChecklistGroup[] {
	const lines = normalizeNoteBody(body).split('\n');
	const groups: ChecklistGroup[] = [];
	let current: ChecklistGroup = {
		projectName: null,
		projectId: null,
		noteOnly: false,
		isTaskFolder: false,
		items: [],
	};
	let itemId = 0;

	const flush = () => {
		if (current.items.length > 0 || current.projectName !== null) {
			groups.push(current);
			current = {
				projectName: null,
				projectId: null,
				noteOnly: false,
				isTaskFolder: false,
				items: [],
			};
		}
	};

	for (const line of lines) {
		if (isProjectTasksHeader(line)) {
			flush();
			const parsed = parseProjectTasksHeader(line);
			current = {
				projectName: parsed.projectName,
				projectId: parsed.projectId,
				noteOnly: parsed.noteOnly,
				isTaskFolder: parsed.isTaskFolder,
				items: [],
			};
			continue;
		}
		const match = line.match(CHECKLIST_STRICT_RE);
		if (!match) continue;
		const payload = parseChecklistItemPayload(match[2]);
		current.items.push({
			id: itemId++,
			checked: match[1].toLowerCase() === 'x',
			text: payload.text,
			assignedHours: payload.assignedHours,
		});
	}
	flush();
	return groups;
}

export function parseChecklistLines(body: string): ChecklistLine[] {
	return parseChecklistGroups(body).flatMap((group) => group.items);
}

function nextChecklistItemId(body: string): number {
	const items = parseChecklistLines(body);
	return items.reduce((max, item) => Math.max(max, item.id), -1) + 1;
}

/** Note prose only — checklist and project header lines are edited in the task panel. */
export function getProseBody(body: string): string {
	const texts = parseNoteBodyBlocks(body)
		.filter((block): block is NoteProseBodyBlock => block.type === 'prose')
		.map((block) => block.text.trim())
		.filter(Boolean);
	return texts.join('\n\n').replace(/\n{3,}/g, '\n\n');
}

/** Split note body into interleaved prose and checklist/project blocks. */
export function parseNoteBodyBlocks(body: string): NoteBodyBlock[] {
	const lines = normalizeNoteBody(body).split('\n');
	const blocks: NoteBodyBlock[] = [];
	const proseBuffer: string[] = [];
	let currentGroup: ChecklistGroup | null = null;
	let itemId = 0;

	const flushProse = () => {
		if (proseBuffer.length === 0) return;
		const text = proseBuffer.join('\n').replace(/\n{3,}/g, '\n\n');
		proseBuffer.length = 0;
		// Trailing newlines after a task card must not become a second prose editor.
		if (text.trim().length === 0) return;
		blocks.push({ type: 'prose', text });
	};

	const flushGroup = () => {
		if (!currentGroup) return;
		if (currentGroup.projectName !== null || currentGroup.items.length > 0) {
			blocks.push({ type: 'checklist', group: currentGroup });
		}
		currentGroup = null;
	};

	for (const line of lines) {
		if (isProjectTasksHeader(line)) {
			flushProse();
			flushGroup();
			const parsed = parseProjectTasksHeader(line);
			currentGroup = {
				projectName: parsed.projectName,
				projectId: parsed.projectId,
				noteOnly: parsed.noteOnly,
				isTaskFolder: parsed.isTaskFolder,
				items: [],
			};
			continue;
		}

		const match = line.match(CHECKLIST_STRICT_RE);
		if (match) {
			if (!currentGroup) {
				flushProse();
				currentGroup = {
					projectName: null,
					projectId: null,
					noteOnly: false,
					isTaskFolder: false,
					items: [],
				};
			}
			const payload = parseChecklistItemPayload(match[2]);
			currentGroup.items.push({
				id: itemId++,
				checked: match[1].toLowerCase() === 'x',
				text: payload.text,
				assignedHours: payload.assignedHours,
			});
			continue;
		}

		if (currentGroup) {
			flushGroup();
		}
		proseBuffer.push(line);
	}

	flushGroup();
	flushProse();

	if (blocks.length === 0) {
		return [{ type: 'prose', text: '' }];
	}
	return blocks;
}

/** Note body blocks for rendering — ensures a prose editor follows task/project cards. */
export function getNoteBodyBlocksForEditor(body: string): NoteBodyBlock[] {
	const blocks = filterSandwichedEmptyProse(parseNoteBodyBlocks(body));
	return ensureEditorTrailingProse(blocks);
}

function filterSandwichedEmptyProse(blocks: NoteBodyBlock[]): NoteBodyBlock[] {
	return blocks.filter((block, index, all) => {
		if (block.type !== 'prose' || block.text.trim().length > 0) return true;
		const prev = all[index - 1];
		const next = all[index + 1];
		return !(prev?.type === 'checklist' && next?.type === 'checklist');
	});
}

function ensureEditorTrailingProse(blocks: NoteBodyBlock[]): NoteBodyBlock[] {
	const last = blocks[blocks.length - 1];
	if (!last || last.type === 'checklist') {
		return [...blocks, { type: 'prose', text: '' }];
	}
	return blocks;
}

/** Drop UI-only empty prose slots before persisting note body. */
function blocksForStorage(editorBlocks: NoteBodyBlock[]): NoteBodyBlock[] {
	return editorBlocks.filter((block, index, all) => {
		if (block.type !== 'prose') return true;
		if (block.text.length > 0) return true;
		const prev = all[index - 1];
		const next = all[index + 1];
		if (index === 0 && next?.type === 'checklist') return false;
		if (!next && prev?.type === 'checklist') return false;
		return false;
	});
}

function pruneEmptyProseBlocks(blocks: NoteBodyBlock[]): NoteBodyBlock[] {
	const hasChecklists = blocks.some((block) => block.type === 'checklist');
	if (!hasChecklists) return blocks;
	return blocks.filter(
		(block) => block.type !== 'prose' || block.text.length > 0,
	);
}

function isChecklistBlockVisible(block: NoteBodyBlock): boolean {
	return (
		block.type !== 'checklist' ||
		block.group.projectName !== null ||
		block.group.items.length > 0
	);
}

export function composeNoteBodyFromBlocks(blocks: NoteBodyBlock[]): string {
	const parts: string[] = [];

	for (const block of blocks) {
		if (block.type === 'prose') {
			if (block.text.length === 0) continue;
			parts.push(sanitizeProseOnPersist(block.text));
			continue;
		}

		const group = block.group;
		const groupLines: string[] = [];
		if (group.projectName !== null) {
			groupLines.push(
				formatProjectTasksHeader(group.projectName, {
					projectId: group.projectId,
					noteOnly: group.noteOnly,
					isTaskFolder: group.isTaskFolder,
				}),
			);
		}
		groupLines.push(...checklistLinesFromItems(group.items));
		const joined = groupLines.join('\n').trimEnd();
		if (joined) parts.push(joined);
	}

	if (parts.length === 0) return '';
	return `${parts.join('\n\n')}\n`;
}

export function sanitizeNoteBodyForSave(body: string): string {
	return composeNoteBodyFromBlocks(
		pruneEmptyProseBlocks(parseNoteBodyBlocks(body)),
	);
}

export function updateNoteBodyBlocks(
	body: string,
	mapper: (blocks: NoteBodyBlock[]) => NoteBodyBlock[],
): string {
	return composeNoteBodyFromBlocks(
		pruneEmptyProseBlocks(mapper(parseNoteBodyBlocks(body))),
	);
}

/** Insert a prose block at a body block index (e.g. 0 for space above project cards). */
export function insertProseBlockAt(
	body: string,
	blockIndex: number,
	text = '',
): string {
	const blocks = parseNoteBodyBlocks(body);
	const insertAt = Math.max(0, Math.min(blockIndex, blocks.length));
	const next = [...blocks];
	next.splice(insertAt, 0, { type: 'prose', text });
	return composeNoteBodyFromBlocks(next);
}

export function reorderNoteBodyBlocks(
	body: string,
	fromIndex: number,
	toIndex: number,
): string {
	return updateNoteBodyBlocks(body, (blocks) => {
		if (
			fromIndex < 0 ||
			fromIndex >= blocks.length ||
			toIndex < 0 ||
			toIndex >= blocks.length ||
			fromIndex === toIndex
		) {
			return blocks;
		}
		const next = [...blocks];
		const [moved] = next.splice(fromIndex, 1);
		next.splice(toIndex, 0, moved);
		return next;
	});
}

export function updateProseBlockAt(
	body: string,
	blockIndex: number,
	text: string,
): string {
	const editorBlocks = getNoteBodyBlocksForEditor(body);
	if (blockIndex < 0 || blockIndex >= editorBlocks.length) return body;
	if (editorBlocks[blockIndex]?.type !== 'prose') return body;
	const updated = editorBlocks.map((block, index) =>
		index === blockIndex && block.type === 'prose'
			? { ...block, text: collapseExcessiveBlankLines(text) }
			: block,
	);
	return composeNoteBodyFromBlocks(blocksForStorage(updated));
}

function checklistLinesFromItems(items: ChecklistLine[]): string[] {
	return items.map((item) =>
		formatChecklistLine(item.checked, item.text, item.assignedHours),
	);
}

export function composeNoteBodyFromGroups(
	prose: string,
	groups: ChecklistGroup[],
): string {
	const blocks: NoteBodyBlock[] = [];
	const proseText = prose.trimEnd();
	if (proseText) {
		blocks.push({ type: 'prose', text: proseText });
	}
	for (const group of groups) {
		if (group.projectName !== null || group.items.length > 0) {
			blocks.push({ type: 'checklist', group });
		}
	}
	if (blocks.length === 0) return proseText;
	return composeNoteBodyFromBlocks(blocks);
}

/** Rebuild stored note body from prose + checklist items. */
export function composeNoteBody(
	prose: string,
	items: Pick<ChecklistLine, 'checked' | 'text'>[],
): string {
	if (items.length === 0) return prose;
	const withIds = items.map((item, id) => ({ ...item, id }));
	return composeNoteBodyFromGroups(prose, [
		{
			projectName: null,
			projectId: null,
			noteOnly: false,
			isTaskFolder: false,
			items: withIds as ChecklistLine[],
		},
	]);
}

/** Merge prose edits with checklist lines already in `body`. */
export function mergeProseIntoBody(prose: string, body: string): string {
	const blocks = parseNoteBodyBlocks(body);
	const proseBlockIndices = blocks
		.map((block, index) => (block.type === 'prose' ? index : -1))
		.filter((index) => index >= 0);
	if (proseBlockIndices.length === 0) {
		return composeNoteBodyFromBlocks([
			{ type: 'prose', text: prose },
			...blocks.filter((block): block is NoteChecklistBodyBlock => block.type === 'checklist'),
		]);
	}
	return updateProseBlockAt(body, proseBlockIndices[0]!, prose);
}

function upsertProjectTaskGroup(
	body: string,
	projectName: string,
	taskNames: string[],
	projectId: string | null = null,
): string {
	const name = projectName.trim();
	if (!name) return body;

	const prose = getProseBody(body);
	const groups = parseChecklistGroups(body);
	let group = groups.find(
		(entry) =>
			(projectId && entry.projectId === projectId) || entry.projectName === name,
	);
	if (!group) {
		group = {
			projectName: name,
			projectId,
			noteOnly: false,
			isTaskFolder: false,
			items: [],
		};
		groups.push(group);
	} else if (projectId && !group.projectId && !group.noteOnly) {
		group.projectId = projectId;
	}

	let nextId = nextChecklistItemId(body);
	for (const text of taskNames) {
		group.items.push({ id: nextId++, checked: false, text });
	}

	return composeNoteBodyFromGroups(prose, groups);
}

export function insertProjectTasksIntoNote(
	body: string,
	projectName: string,
	taskNames: string[],
	projectId: string | null = null,
): string {
	const trimmedTasks = taskNames.map((task) => task.trim()).filter(Boolean);
	if (trimmedTasks.length === 0) return body;
	return upsertProjectTaskGroup(body, projectName, trimmedTasks, projectId);
}

/** Insert an empty project task card (user can add tasks inside the card). */
export function insertProjectTaskGroup(
	body: string,
	projectName: string,
	projectId: string | null = null,
	noteOnly = false,
): string {
	const name = projectName.trim();
	if (!name) return body;
	return updateNoteBodyBlocks(body, (blocks) => {
		if (
			blocks.some(
				(block) =>
					block.type === 'checklist' &&
					((projectId && block.group.projectId === projectId) ||
						block.group.projectName === name),
			)
		) {
			return blocks;
		}
		return [
			...blocks,
			{
				type: 'checklist' as const,
				group: {
					projectName: name,
					projectId: noteOnly ? null : projectId,
					noteOnly,
					isTaskFolder: false,
					items: [],
				},
			},
		];
	});
}

/** Insert a note-only tasks folder (not linked to Projects). */
export function insertTaskFolder(body: string, folderName: string): string {
	const name = folderName.trim();
	if (!name) return body;
	return updateNoteBodyBlocks(body, (blocks) => {
		if (
			blocks.some(
				(block) =>
					block.type === 'checklist' && block.group.projectName === name,
			)
		) {
			return blocks;
		}
		return [
			...blocks,
			{
				type: 'checklist' as const,
				group: {
					projectName: name,
					projectId: null,
					noteOnly: true,
					isTaskFolder: true,
					items: [],
				},
			},
		];
	});
}

/** Insert a note-only to-do list card (not linked to Projects). */
export function insertTodoListGroup(body: string): string {
	const groups = parseChecklistGroups(body);
	const base = 'To-do';
	let name = base;
	let i = 2;
	while (groups.some((group) => group.isTaskFolder && group.projectName === name)) {
		name = `${base} ${i}`;
		i += 1;
	}
	return updateNoteBodyBlocks(body, (blocks) => [
		...blocks,
		{
			type: 'checklist' as const,
			group: {
				projectName: name,
				projectId: null,
				noteOnly: true,
				isTaskFolder: true,
				items: [],
			},
		},
	]);
}

function mapChecklistGroups(
	body: string,
	mapper: (groups: ChecklistGroup[]) => ChecklistGroup[],
): string {
	const blocks = parseNoteBodyBlocks(body);
	const checklistIndices: number[] = [];
	const groups: ChecklistGroup[] = [];

	for (let index = 0; index < blocks.length; index += 1) {
		const block = blocks[index]!;
		if (block.type === 'checklist') {
			checklistIndices.push(index);
			groups.push(block.group);
		}
	}

	const updated = mapper(groups);

	if (updated.length === groups.length) {
		const nextBlocks = blocks.map((block, index) => {
			const checklistPos = checklistIndices.indexOf(index);
			if (checklistPos < 0) return block;
			return { type: 'checklist' as const, group: updated[checklistPos]! };
		});
		return composeNoteBodyFromBlocks(nextBlocks.filter(isChecklistBlockVisible));
	}

	let nextGroupIdx = 0;
	const remapped = blocks
		.map((block) => {
			if (block.type !== 'checklist') return block;
			if (nextGroupIdx >= updated.length) return null;
			const next = { type: 'checklist' as const, group: updated[nextGroupIdx]! };
			nextGroupIdx += 1;
			return next;
		})
		.filter(
			(block): block is NoteBodyBlock =>
				block != null && isChecklistBlockVisible(block),
		);

	if (updated.length > groups.length) {
		const extraGroups = updated.slice(groups.length);
		return composeNoteBodyFromBlocks([
			...remapped,
			...extraGroups.map((group) => ({ type: 'checklist' as const, group })),
		]);
	}

	return composeNoteBodyFromBlocks(remapped);
}

export function attachProjectIdsToGroups(
	body: string,
	links: Record<string, string>,
): string {
	if (Object.keys(links).length === 0) return body;
	return mapChecklistGroups(body, (groups) =>
		groups.map((group) => {
			if (group.projectId || group.noteOnly || !group.projectName) return group;
			const linkedId = links[group.projectName];
			return linkedId ? { ...group, projectId: linkedId } : group;
		}),
	);
}

export function toggleChecklistLine(body: string, itemId: number): string {
	if (!parseChecklistLines(body).some((item) => item.id === itemId)) return body;
	return mapChecklistGroups(body, (groups) =>
		groups.map((group) => ({
			...group,
			items: group.items.map((item) =>
				item.id === itemId ? { ...item, checked: !item.checked } : item,
			),
		})),
	);
}

export function setChecklistItemText(
	body: string,
	itemId: number,
	text: string,
): string {
	if (!parseChecklistLines(body).some((item) => item.id === itemId)) return body;
	return mapChecklistGroups(body, (groups) =>
		groups.map((group) => ({
			...group,
			items: group.items.map((item) =>
				item.id === itemId ? { ...item, text } : item,
			),
		})),
	);
}

export function removeChecklistLine(body: string, itemId: number): string {
	return mapChecklistGroups(body, (groups) =>
		groups
			.map((group) => ({
				...group,
				items: group.items.filter((item) => item.id !== itemId),
			}))
			.filter((group) => group.projectName !== null || group.items.length > 0),
	);
}

/**
 * Remove checklist rows that match a deleted task name so note→project sync
 * cannot recreate the task.
 */
export function removeChecklistItemsMatchingTask(
	body: string,
	input: { taskName: string; projectId?: string | null },
): string {
	const nameKey = input.taskName.trim().toLowerCase();
	if (!nameKey) return body;

	return mapChecklistGroups(body, (groups) =>
		groups
			.map((group) => {
				const projectMatches = input.projectId
					? group.projectId === input.projectId
					: !group.projectId;
				if (!projectMatches) return group;
				return {
					...group,
					items: group.items.filter(
						(item) => item.text.trim().toLowerCase() !== nameKey,
					),
				};
			})
			.filter((group) => group.projectName !== null || group.items.length > 0),
	);
}

export function renameProjectTaskGroupAt(
	body: string,
	groupIndex: number,
	newName: string,
): string {
	return mapChecklistGroups(body, (groups) => {
		if (groupIndex < 0 || groupIndex >= groups.length) return groups;
		if (groups[groupIndex].projectName === null) return groups;
		return groups.map((group, index) =>
			index === groupIndex ? { ...group, projectName: newName } : group,
		);
	});
}

export function removeProjectTaskGroupAt(body: string, groupIndex: number): string {
	if (groupIndex < 0) return body;
	return updateNoteBodyBlocks(body, (blocks) => {
		let checklistIdx = 0;
		return blocks.filter((block) => {
			if (block.type !== 'checklist') return true;
			const keep = checklistIdx !== groupIndex;
			checklistIdx += 1;
			return keep;
		});
	});
}

export function addChecklistItemAtGroup(
	body: string,
	groupIndex: number,
	text = '',
	assignedHours: number | null = null,
): string {
	if (groupIndex < 0) return body;
	const nextId = nextChecklistItemId(body);
	const hours = assignedHours != null && assignedHours > 0 ? assignedHours : null;
	return mapChecklistGroups(body, (groups) => {
		if (groupIndex >= groups.length) return groups;
		const group = groups[groupIndex]!;
		return groups.map((entry, index) =>
			index === groupIndex
				? {
						...entry,
						items: [
							...group.items,
							{ id: nextId, checked: false, text, assignedHours: hours },
						],
					}
				: entry,
		);
	});
}

export function addChecklistItem(
	body: string,
	text = '',
	projectName: string | null = null,
): string {
	const nextId = nextChecklistItemId(body);
	return mapChecklistGroups(body, (groups) => {
		let groupIndex = groups.findIndex((group) => group.projectName === projectName);
		const nextGroups = [...groups];
		if (groupIndex < 0) {
			nextGroups.push({
				projectName,
				projectId: null,
				noteOnly: false,
				isTaskFolder: false,
				items: [],
			});
			groupIndex = nextGroups.length - 1;
		}
		return nextGroups.map((group, index) =>
			index === groupIndex
				? {
						...group,
						items: [...group.items, { id: nextId, checked: false, text }],
					}
				: group,
		);
	});
}

export function insertChecklistAtCursor(
	body: string,
	cursorLine: number,
): string {
	const lines = body.split('\n');
	const insert = formatChecklistLine(false, '');
	if (cursorLine < 0 || cursorLine >= lines.length) {
		return addChecklistItem(body);
	}
	lines.splice(cursorLine, 0, insert);
	return lines.join('\n');
}

/** Sidebar preview from prose only (skips checklist lines). */
export function noteListPreview(body: string, maxLen = 72): string {
	return notePreview(getProseBody(body), maxLen);
}

function stripNoteListPrefix(line: string): string {
	return line.replace(/^-\s*(\[[ xX]\]\s*)?/, '').trim();
}

function resolveProseSelectionLines(
	text: string,
	selectionStart: number,
	selectionEnd: number,
): { start: number; end: number; lines: string[] } {
	if (selectionStart !== selectionEnd) {
		const lineStart = text.lastIndexOf('\n', Math.max(0, selectionStart - 1)) + 1;
		const lineEndRaw = text.indexOf('\n', selectionEnd);
		const lineEnd = lineEndRaw === -1 ? text.length : lineEndRaw;
		const region = text.slice(lineStart, lineEnd);
		const lines = region
			.split('\n')
			.map(stripNoteListPrefix)
			.filter((line) => line.length > 0);
		return { start: lineStart, end: lineEnd, lines };
	}

	const lineStart = text.lastIndexOf('\n', Math.max(0, selectionStart - 1)) + 1;
	const lineEndRaw = text.indexOf('\n', selectionStart);
	const lineEnd = lineEndRaw === -1 ? text.length : lineEndRaw;
	const line = stripNoteListPrefix(text.slice(lineStart, lineEnd));
	return {
		start: lineStart,
		end: lineEnd,
		lines: line ? [line] : [''],
	};
}

/** Turn selected prose lines into checklist tasks below the prose block. */
export function convertProseSelectionToChecklist(
	body: string,
	proseBlockIndex: number,
	selectionStart: number,
	selectionEnd: number,
): string {
	return updateNoteBodyBlocks(body, (blocks) => {
		const block = blocks[proseBlockIndex];
		if (block?.type !== 'prose') return blocks;

		const { start, end, lines } = resolveProseSelectionLines(
			block.text,
			selectionStart,
			selectionEnd,
		);
		if (lines.length === 0) return blocks;

		const before = block.text.slice(0, start);
		const after = block.text.slice(end);
		let newProse = `${before}${after}`.replace(/\n{3,}/g, '\n\n').trimEnd();

		const updated = [...blocks];
		updated[proseBlockIndex] = { type: 'prose', text: newProse };

		let nextId = nextChecklistItemId(body);
		const newItems = lines.map((text) => ({
			id: nextId++,
			checked: false,
			text,
		}));

		const nextIdx = proseBlockIndex + 1;
		const nextBlock = updated[nextIdx];
		if (
			nextBlock?.type === 'checklist' &&
			nextBlock.group.projectName === null &&
			!nextBlock.group.isTaskFolder
		) {
			updated[nextIdx] = {
				type: 'checklist',
				group: {
					...nextBlock.group,
					items: [...nextBlock.group.items, ...newItems],
				},
			};
		} else {
			updated.splice(nextIdx, 0, {
				type: 'checklist',
				group: {
					projectName: null,
					projectId: null,
					noteOnly: false,
					isTaskFolder: false,
					items: newItems,
				},
			});
		}

		return updated.filter(
			(entry) => entry.type !== 'prose' || entry.text.trim().length > 0,
		);
	});
}
