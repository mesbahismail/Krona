import type { Editor } from '@tiptap/react';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { NOTE_SOFT_BREAK } from '@/lib/noteProseRichText';
import { parseNoteProseBlock } from '@/lib/noteProseDisplay';

const BULLET_LINE_RE = /^- (?!(\[[ x]\]|\[[xX]\]))/;
const ORDERED_LINE_RE = /^\d+\.\s+/;
const DIVIDER_LINE_RE = /^(-{3,}|\*{3,}|_{3,})$/;

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

type InlineToken = {
	text: string;
	bold?: boolean;
	italic?: boolean;
	strike?: boolean;
};

function tokenizeInline(text: string): InlineToken[] {
	const tokens: InlineToken[] = [];
	let i = 0;

	while (i < text.length) {
		if (text.startsWith('**', i)) {
			const close = text.indexOf('**', i + 2);
			if (close !== -1) {
				tokens.push({ text: text.slice(i + 2, close), bold: true });
				i = close + 2;
				continue;
			}
		}
		if (text.startsWith('~~', i)) {
			const close = text.indexOf('~~', i + 2);
			if (close !== -1) {
				tokens.push({ text: text.slice(i + 2, close), strike: true });
				i = close + 2;
				continue;
			}
		}
		if (text[i] === '*' && text[i + 1] !== '*') {
			const close = text.indexOf('*', i + 1);
			if (close !== -1) {
				tokens.push({ text: text.slice(i + 1, close), italic: true });
				i = close + 1;
				continue;
			}
		}

		let next = text.length;
		const boldAt = text.indexOf('**', i);
		const strikeAt = text.indexOf('~~', i);
		const italicAt = text.indexOf('*', i);
		for (const at of [boldAt, strikeAt, italicAt]) {
			if (at !== -1 && at < next) next = at;
		}

		tokens.push({ text: text.slice(i, next) });
		i = next === i ? i + 1 : next;
	}

	return tokens.filter((token) => token.text.length > 0);
}

function inlineTokensToHtml(tokens: InlineToken[]): string {
	return tokens
		.map((token) => {
			let html = escapeHtml(token.text);
			if (token.bold) html = `<strong>${html}</strong>`;
			if (token.italic) html = `<em>${html}</em>`;
			if (token.strike) html = `<s>${html}</s>`;
			return html;
		})
		.join('');
}

function renderInlineContent(content: string): string {
	return content
		.split(NOTE_SOFT_BREAK)
		.map((segment) => inlineTokensToHtml(tokenizeInline(segment)))
		.join('<br>');
}

function isBulletLine(line: string): boolean {
	return BULLET_LINE_RE.test(line);
}

function isOrderedLine(line: string): boolean {
	return ORDERED_LINE_RE.test(line);
}

function orderedLineContent(line: string): string {
	return line.replace(ORDERED_LINE_RE, '');
}

function isDividerLine(line: string): boolean {
	return DIVIDER_LINE_RE.test(line.trim());
}

function bulletLineContent(line: string): string {
	return line.slice(2);
}

function lineToTiptapBlockHtml(line: string): string {
	const { kind, content } = parseNoteProseBlock(line);
	const inner = renderInlineContent(content);
	const fallback = inner || '<br>';
	if (kind === 'header') return `<h1>${fallback}</h1>`;
	if (kind === 'subheader1') return `<h2>${fallback}</h2>`;
	if (kind === 'subheader2') return `<h3>${fallback}</h3>`;
	return `<p>${fallback}</p>`;
}

/** Collapse runs of 3+ newlines down to a single blank line. */
export function collapseExcessiveBlankLines(markdown: string): string {
	return markdown.replace(/\n{3,}/g, '\n\n');
}

/**
 * Remove TipTap's automatic trailing empty paragraph on persist.
 * A single trailing `\n` is editor chrome; intentional blank lines use `\n\n+`.
 */
export function stripSpuriousTrailingNewlines(markdown: string): string {
	const collapsed = collapseExcessiveBlankLines(markdown);
	if (!collapsed || !collapsed.endsWith('\n') || collapsed.endsWith('\n\n')) {
		return collapsed;
	}
	return collapsed.slice(0, -1);
}

/** Normalize prose before saving, reordering, or leaving the editor. */
export function sanitizeProseOnPersist(markdown: string): string {
	return stripSpuriousTrailingNewlines(markdown);
}

/** Render stored note markdown as TipTap-compatible HTML. */
export function noteMarkdownToTiptapHtml(markdown: string): string {
	if (!markdown) return '<p></p>';

	const lines = markdown.split('\n');
	const parts: string[] = [];
	let index = 0;

	while (index < lines.length) {
		const line = lines[index]!;
		if (isDividerLine(line)) {
			parts.push('<hr>');
			index += 1;
			continue;
		}
		if (isBulletLine(line)) {
			const items: string[] = [];
			while (index < lines.length && isBulletLine(lines[index]!)) {
				const content = bulletLineContent(lines[index]!);
				const inner = renderInlineContent(content);
				items.push(`<li><p>${inner || '<br>'}</p></li>`);
				index += 1;
			}
			parts.push(`<ul>${items.join('')}</ul>`);
			continue;
		}

		if (isOrderedLine(line)) {
			const items: string[] = [];
			while (index < lines.length && isOrderedLine(lines[index]!)) {
				const content = orderedLineContent(lines[index]!);
				const inner = renderInlineContent(content);
				items.push(`<li><p>${inner || '<br>'}</p></li>`);
				index += 1;
			}
			parts.push(`<ol>${items.join('')}</ol>`);
			continue;
		}

		parts.push(lineToTiptapBlockHtml(line));
		index += 1;
	}

	return parts.join('') || '<p></p>';
}

function wrapWithMarks(text: string, marks: readonly { type: { name: string } }[]): string {
	let out = text;
	for (const mark of marks) {
		if (mark.type.name === 'bold') out = `**${out}**`;
		else if (mark.type.name === 'italic') out = `*${out}*`;
		else if (mark.type.name === 'strike') out = `~~${out}~~`;
	}
	return out;
}

function serializeInlineNode(
	node: ProseMirrorNode,
	baseDocPos: number,
	map: Map<number, number>,
): string {
	let md = '';
	let docCursor = baseDocPos;

	node.forEach((child, offset) => {
		const childPos = docCursor + offset + 1;
		if (child.isText) {
			const text = child.text ?? '';
			const wrapped = wrapWithMarks(text, child.marks);
			const openLen = wrapped.length - text.length;
			const openHalf = Math.floor(openLen / 2);
			for (let i = 0; i <= text.length; i += 1) {
				map.set(childPos + i, md.length + openHalf + i);
			}
			md += wrapped;
			return;
		}
		if (child.type.name === 'hardBreak') {
			map.set(childPos, md.length);
			md += NOTE_SOFT_BREAK;
		}
	});

	return md;
}

function serializeListItem(node: ProseMirrorNode, baseDocPos: number, map: Map<number, number>): string {
	const paragraph = node.firstChild;
	if (!paragraph) return '';
	const content = serializeInlineNode(paragraph, baseDocPos + 2, map);
	return content;
}

function serializeBulletListItem(
	node: ProseMirrorNode,
	baseDocPos: number,
	map: Map<number, number>,
): string {
	const content = serializeListItem(node, baseDocPos, map);
	return content.length > 0 ? `- ${content}` : '- ';
}

function serializeOrderedListItem(
	node: ProseMirrorNode,
	index: number,
	baseDocPos: number,
	map: Map<number, number>,
): string {
	const content = serializeListItem(node, baseDocPos, map);
	return `${index + 1}. ${content}`;
}

function serializeTopLevelNode(
	node: ProseMirrorNode,
	docPos: number,
	map: Map<number, number>,
): string {
	const contentStart = docPos + 1;
	map.set(docPos + 1, map.get(docPos) ?? 0);

	if (node.type.name === 'heading') {
		const level = Number(node.attrs.level ?? 1);
		const prefix = level === 1 ? '# ' : level === 2 ? '## ' : '### ';
		const body = serializeInlineNode(node, contentStart, map);
		map.set(contentStart, prefix.length);
		return `${prefix}${body}`;
	}

	if (node.type.name === 'horizontalRule') {
		return '---';
	}

	if (node.type.name === 'bulletList') {
		const lines: string[] = [];
		let itemPos = contentStart;
		node.forEach((item, offset) => {
			itemPos = contentStart + offset;
			lines.push(serializeBulletListItem(item, itemPos, map));
		});
		return lines.join('\n');
	}

	if (node.type.name === 'orderedList') {
		const lines: string[] = [];
		let itemPos = contentStart;
		let itemIndex = 0;
		node.forEach((item, offset) => {
			itemPos = contentStart + offset;
			lines.push(serializeOrderedListItem(item, itemIndex, itemPos, map));
			itemIndex += 1;
		});
		return lines.join('\n');
	}

	if (node.type.name === 'paragraph') {
		return serializeInlineNode(node, contentStart, map);
	}

	return node.textContent ?? '';
}

/** Serialize a TipTap document back to stored note markdown. */
export function tiptapDocToNoteMarkdown(doc: ProseMirrorNode): string {
	const map = new Map<number, number>();
	const lines: string[] = [];
	let docPos = 0;

	doc.forEach((node, offset) => {
		docPos = offset;
		map.set(docPos + 1, lines.join('\n').length + (lines.length > 0 ? 0 : 0));
		const line = serializeTopLevelNode(node, docPos, map);
		if (lines.length > 0) {
			const lineStart = lines.join('\n').length + 1;
			map.set(docPos + 1, lineStart);
		}
		lines.push(line);
	});

	return lines.join('\n');
}

function buildMarkdownPositionMap(doc: ProseMirrorNode): Map<number, number> {
	const map = new Map<number, number>();
	map.set(0, 0);
	map.set(1, 0);

	const lines: string[] = [];
	let docPos = 0;

	doc.forEach((node, offset) => {
		docPos = offset;
		const mdBefore = lines.length > 0 ? lines.join('\n').length + 1 : 0;
		map.set(docPos + 1, mdBefore);
		const line = serializeTopLevelNode(node, docPos, map);
		lines.push(line);
	});

	const full = lines.join('\n');
	map.set(doc.content.size, full.length);
	return map;
}

function mapDocPosToMarkdown(map: Map<number, number>, pos: number, fallback: number): number {
	if (map.has(pos)) return map.get(pos)!;
	let bestPos = 0;
	let bestOffset = 0;
	for (const [docP, mdP] of map.entries()) {
		if (docP <= pos && docP >= bestPos) {
			bestPos = docP;
			bestOffset = mdP;
		}
	}
	return bestOffset + Math.max(0, pos - bestPos);
}

export function getNoteMarkdownSelection(
	editor: Editor,
): { start: number; end: number } {
	const { from, to } = editor.state.selection;
	const map = buildMarkdownPositionMap(editor.state.doc);
	const markdown = tiptapDocToNoteMarkdown(editor.state.doc);
	return {
		start: Math.min(mapDocPosToMarkdown(map, from, markdown.length), markdown.length),
		end: Math.min(mapDocPosToMarkdown(map, to, markdown.length), markdown.length),
	};
}

export function tiptapEditorToNoteMarkdown(editor: Editor): string {
	return tiptapDocToNoteMarkdown(editor.state.doc);
}

type BulletListRange = {
	pos: number;
	node: ProseMirrorNode;
};

function findParentBulletList(
	doc: ProseMirrorNode,
	pos: number,
): BulletListRange | null {
	const $pos = doc.resolve(pos);
	for (let depth = $pos.depth; depth > 0; depth -= 1) {
		const node = $pos.node(depth);
		if (node.type.name === 'bulletList') {
			return { pos: $pos.before(depth), node };
		}
	}
	return null;
}

/**
 * True when the selection covers exactly one bullet list (all of its items)
 * and does not include any content outside that list.
 */
export function selectionIsExactBulletList(editor: Editor): boolean {
	const { state } = editor;
	const { from, to, empty } = state.selection;
	if (empty || from === to) return false;

	const sel = state.selection as { node?: ProseMirrorNode };
	if (sel.node?.type.name === 'bulletList') {
		return true;
	}

	const listFrom = findParentBulletList(state.doc, from);
	const listTo = findParentBulletList(state.doc, Math.max(from, to - 1));
	if (!listFrom || !listTo || listFrom.pos !== listTo.pos) {
		// Selection may wrap the list node from outside (block-level select).
		let wrapped: BulletListRange | null = null;
		let hasExtra = false;
		state.doc.nodesBetween(from, to, (node, pos, parent) => {
			if (parent !== state.doc) return undefined;
			if (node.type.name === 'bulletList') {
				if (wrapped && wrapped.pos !== pos) {
					hasExtra = true;
					return false;
				}
				wrapped = { pos, node };
				return false;
			}
			if (node.type.name === 'paragraph' && node.textContent.trim() === '') {
				return false;
			}
			hasExtra = true;
			return false;
		});
		return Boolean(wrapped && !hasExtra);
	}

	const listStart = listFrom.pos;
	const listEnd = listFrom.pos + listFrom.node.nodeSize;
	if (from < listStart || to > listEnd) return false;

	// Every list item must intersect the selection (all list lines selected).
	let allItemsSelected = true;
	listFrom.node.forEach((item, offset) => {
		const itemStart = listStart + 1 + offset;
		const itemEnd = itemStart + item.nodeSize;
		if (to <= itemStart || from >= itemEnd) {
			allItemsSelected = false;
		}
	});
	return allItemsSelected;
}

/** Replace a bullet list with one paragraph per list item, preserving order. */
export function convertBulletListToParagraphs(
	editor: Editor,
	listPos: number,
	listNode: ProseMirrorNode,
): boolean {
	const paragraphType = editor.state.schema.nodes.paragraph;
	if (!paragraphType) return false;

	const paragraphs: ProseMirrorNode[] = [];
	listNode.forEach((listItem) => {
		let added = false;
		listItem.forEach((child) => {
			if (child.type.name === 'paragraph') {
				paragraphs.push(paragraphType.create(null, child.content));
				added = true;
			}
		});
		if (!added) {
			paragraphs.push(
				paragraphType.create(
					null,
					listItem.textContent
						? editor.state.schema.text(listItem.textContent)
						: undefined,
				),
			);
		}
	});

	if (paragraphs.length === 0) {
		paragraphs.push(paragraphType.create());
	}

	return editor
		.chain()
		.focus()
		.command(({ tr, dispatch }) => {
			if (dispatch) {
				tr.replaceWith(listPos, listPos + listNode.nodeSize, paragraphs);
			}
			return true;
		})
		.run();
}

/** Resolve the exact selected bullet list, if the selection matches one fully. */
export function getExactSelectedBulletList(
	editor: Editor,
): BulletListRange | null {
	if (!selectionIsExactBulletList(editor)) return null;

	const { state } = editor;
	const { from, to } = state.selection;
	const sel = state.selection as { node?: ProseMirrorNode; from: number };
	if (sel.node?.type.name === 'bulletList') {
		return { pos: sel.from, node: sel.node };
	}

	const nested = findParentBulletList(state.doc, from);
	if (nested) return nested;

	let found: BulletListRange | null = null;
	state.doc.nodesBetween(from, to, (node, pos, parent) => {
		if (parent === state.doc && node.type.name === 'bulletList') {
			found = { pos, node };
			return false;
		}
		return undefined;
	});
	return found;
}
