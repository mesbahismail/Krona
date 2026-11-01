import { parseNoteProseBlock } from '@/lib/noteProseDisplay';
import {
	applyNoteTextFormat,
	type NoteTextFormat,
} from '@/lib/noteFormatting';

export type NoteBlockKind = 'header' | 'subheader1' | 'subheader2' | 'body';

/** In-paragraph line break (Shift+Enter), stored inline within a markdown line. */
export const NOTE_SOFT_BREAK = '\u2028';

const BLOCK_PREFIX: Record<Exclude<NoteBlockKind, 'body'>, string> = {
	header: '# ',
	subheader1: '## ',
	subheader2: '### ',
};

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

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
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

function serializeInlineNode(node: Node): string {
	if (node.nodeType === Node.TEXT_NODE) {
		return node.textContent ?? '';
	}
	if (node.nodeType !== Node.ELEMENT_NODE) return '';

	const el = node as HTMLElement;
	const tag = el.tagName.toLowerCase();
	const inner = Array.from(el.childNodes).map(serializeInlineNode).join('');

	if (tag === 'strong' || tag === 'b') return `**${inner}**`;
	if (tag === 'em' || tag === 'i') return `*${inner}*`;
	if (tag === 's' || tag === 'strike' || tag === 'del') return `~~${inner}~~`;
	if (tag === 'br') return NOTE_SOFT_BREAK;
	return inner;
}

function blockPrefixForKind(kind: NoteBlockKind): string {
	if (kind === 'body') return '';
	return BLOCK_PREFIX[kind];
}

function renderInlineContent(content: string): string {
	return content
		.split(NOTE_SOFT_BREAK)
		.map((segment) => inlineTokensToHtml(tokenizeInline(segment)))
		.join('<br>');
}

function lineToBlockHtml(line: string): string {
	const { kind, content } = parseNoteProseBlock(line);
	const html = renderInlineContent(content);
	return `<div data-kind="${kind}" class="krona-note-block">${html || '<br>'}</div>`;
}

/** Render note markdown as contenteditable HTML. */
export function noteMarkdownToHtml(markdown: string): string {
	if (!markdown) {
		return '<div data-kind="body" class="krona-note-block"><br></div>';
	}
	return markdown.split('\n').map(lineToBlockHtml).join('');
}

function serializeBlockElement(block: HTMLElement): string {
	const kind = (block.getAttribute('data-kind') as NoteBlockKind | null) ?? 'body';
	const content = Array.from(block.childNodes).map(serializeInlineNode).join('');
	return `${blockPrefixForKind(kind)}${content}`;
}

/** Serialize contenteditable root back to markdown. */
export function noteHtmlToMarkdown(root: HTMLElement): string {
	const blocks = Array.from(root.querySelectorAll(':scope > .krona-note-block')) as HTMLElement[];
	if (blocks.length === 0) return '';
	return blocks.map(serializeBlockElement).join('\n');
}

function buildLinePlainToMarkdownMap(line: string): number[] {
	const { content } = parseNoteProseBlock(line);
	const prefixLen = line.length - content.length;
	if (content.length === 0) {
		return [prefixLen];
	}
	const map: number[] = [];
	let md = prefixLen;

	for (const token of tokenizeInline(content)) {
		const marker =
			token.bold ? '**' : token.italic ? '*' : token.strike ? '~~' : '';
		if (marker) {
			md += marker.length;
		}
		for (let i = 0; i < token.text.length; i += 1) {
			map.push(md);
			md += 1;
		}
		if (marker) {
			md += marker.length;
		}
	}

	return map;
}

function buildPlainToMarkdownMap(markdown: string): number[] {
	const lines = markdown.split('\n');
	const map: number[] = [];
	let lineStart = 0;

	for (const line of lines) {
		const lineMap = buildLinePlainToMarkdownMap(line);
		for (const mdOffset of lineMap) {
			map.push(lineStart + mdOffset);
		}
		lineStart += line.length + 1;
	}

	return map;
}

function getPlainTextLength(markdown: string): number {
	return buildPlainToMarkdownMap(markdown).length;
}

function plainOffsetToMarkdownOffset(markdown: string, plainOffset: number): number {
	const map = buildPlainToMarkdownMap(markdown);
	if (map.length === 0) return 0;
	if (plainOffset <= 0) return map[0] ?? 0;
	if (plainOffset >= map.length) return markdown.length;
	return map[plainOffset] ?? markdown.length;
}

function markdownOffsetToPlainOffset(markdown: string, mdOffset: number): number {
	const clamped = Math.min(Math.max(mdOffset, 0), markdown.length);
	const lines = markdown.split('\n');
	let plain = 0;
	let md = 0;

	for (let lineIdx = 0; lineIdx < lines.length; lineIdx += 1) {
		const line = lines[lineIdx]!;
		const { content } = parseNoteProseBlock(line);
		const prefixLen = line.length - content.length;

		if (clamped < md + prefixLen) {
			return plain;
		}
		md += prefixLen;

		for (const token of tokenizeInline(content)) {
			const marker =
				token.bold ? '**' : token.italic ? '*' : token.strike ? '~~' : '';
			if (marker) {
				if (clamped < md + marker.length) return plain;
				md += marker.length;
			}
			for (let i = 0; i < token.text.length; i += 1) {
				if (clamped <= md) return plain;
				plain += 1;
				md += 1;
			}
			if (marker) {
				if (clamped < md + marker.length) return plain;
				md += marker.length;
			}
		}

		if (lineIdx < lines.length - 1) {
			if (clamped <= md) return plain;
			plain += 1;
			md += 1;
		}
	}

	return plain;
}

function isPlaceholderBr(block: HTMLElement, br: HTMLElement): boolean {
	return block.childNodes.length === 1 && br === block.firstChild;
}

function measureBlockPlainLength(block: HTMLElement): number {
	let len = 0;
	for (const child of Array.from(block.childNodes)) {
		if (child.nodeType === Node.TEXT_NODE) {
			len += child.textContent?.length ?? 0;
		} else if (child instanceof HTMLElement && child.tagName === 'BR') {
			if (!isPlaceholderBr(block, child)) {
				len += 1;
			}
		} else if (child instanceof HTMLElement) {
			len += child.textContent?.length ?? 0;
		}
	}
	return len;
}

function getTextPositionWithinBlock(
	block: HTMLElement,
	targetNode: Node,
	targetOffset: number,
	blockStartPlain: number,
): number {
	if (block !== targetNode && !block.contains(targetNode)) return -1;

	let pos = blockStartPlain;
	for (const child of Array.from(block.childNodes)) {
		if (child === targetNode) {
			return pos + targetOffset;
		}
		if (child.nodeType === Node.TEXT_NODE) {
			if (child === targetNode) {
				return pos + targetOffset;
			}
			pos += child.textContent?.length ?? 0;
			continue;
		}
		if (child instanceof HTMLElement && child.tagName === 'BR') {
			const placeholder = isPlaceholderBr(block, child);
			if (child === targetNode) {
				return pos + (placeholder ? 0 : Math.min(targetOffset, 1));
			}
			if (!placeholder) {
				pos += 1;
			}
			continue;
		}
		if (child instanceof HTMLElement) {
			if (child.contains(targetNode)) {
				const walker = document.createTreeWalker(child, NodeFilter.SHOW_TEXT);
				while (walker.nextNode()) {
					const node = walker.currentNode;
					if (node === targetNode) {
						return pos + targetOffset;
					}
					pos += node.textContent?.length ?? 0;
				}
				return pos;
			}
			pos += child.textContent?.length ?? 0;
		}
	}

	return block === targetNode ? blockStartPlain + targetOffset : -1;
}

function resolvePlainPositionInBlock(
	block: HTMLElement,
	remaining: number,
): { node: Node; offset: number } | null {
	let pos = 0;
	for (const child of Array.from(block.childNodes)) {
		if (child.nodeType === Node.TEXT_NODE) {
			const len = child.textContent?.length ?? 0;
			if (remaining <= pos + len) {
				return { node: child, offset: remaining - pos };
			}
			pos += len;
			continue;
		}
		if (child instanceof HTMLElement && child.tagName === 'BR') {
			const placeholder = isPlaceholderBr(block, child);
			if (remaining <= pos) {
				return { node: block, offset: Array.from(block.childNodes).indexOf(child) };
			}
			if (!placeholder) {
				if (remaining === pos + 1) {
					return {
						node: block,
						offset: Array.from(block.childNodes).indexOf(child) + 1,
					};
				}
				pos += 1;
			}
			continue;
		}
		if (child instanceof HTMLElement) {
			const walker = document.createTreeWalker(child, NodeFilter.SHOW_TEXT);
			while (walker.nextNode()) {
				const node = walker.currentNode;
				const len = node.textContent?.length ?? 0;
				if (remaining <= pos + len) {
					return { node, offset: remaining - pos };
				}
				pos += len;
			}
		}
	}
	return { node: block, offset: block.childNodes.length };
}

function getTextPosition(root: HTMLElement, targetNode: Node, targetOffset: number): number {
	const blocks = Array.from(root.querySelectorAll(':scope > .krona-note-block')) as HTMLElement[];
	let pos = 0;

	for (let blockIndex = 0; blockIndex < blocks.length; blockIndex += 1) {
		const block = blocks[blockIndex]!;
		const blockPos = getTextPositionWithinBlock(block, targetNode, targetOffset, pos);
		if (blockPos >= 0) return blockPos;

		pos += measureBlockPlainLength(block);
		if (blockIndex < blocks.length - 1) {
			pos += 1;
		}
	}

	return pos;
}

function resolvePlainPosition(
	root: HTMLElement,
	plainOffset: number,
): { node: Node; offset: number } | null {
	const blocks = Array.from(root.querySelectorAll(':scope > .krona-note-block')) as HTMLElement[];
	let remaining = plainOffset;

	for (let blockIndex = 0; blockIndex < blocks.length; blockIndex += 1) {
		const block = blocks[blockIndex]!;
		const blockTextLen = measureBlockPlainLength(block);

		if (remaining < blockTextLen) {
			return resolvePlainPositionInBlock(block, remaining);
		}

		if (remaining === blockTextLen) {
			if (blockIndex < blocks.length - 1) {
				const nextBlock = blocks[blockIndex + 1]!;
				return (
					resolvePlainPositionInBlock(nextBlock, 0) ?? {
						node: nextBlock,
						offset: 0,
					}
				);
			}
			return resolvePlainPositionInBlock(block, remaining);
		}

		remaining -= blockTextLen;
		if (blockIndex < blocks.length - 1) {
			if (remaining === 0) {
				const nextBlock = blocks[blockIndex + 1]!;
				return (
					resolvePlainPositionInBlock(nextBlock, 0) ?? {
						node: nextBlock,
						offset: 0,
					}
				);
			}
			remaining -= 1;
		}
	}

	const last = blocks[blocks.length - 1];
	if (!last) return null;
	return { node: last, offset: last.childNodes.length };
}

function setTextRange(root: HTMLElement, plainStart: number, plainEnd: number) {
	const start = resolvePlainPosition(root, plainStart);
	const end = resolvePlainPosition(root, plainEnd);
	if (!start || !end) return;

	const range = document.createRange();
	range.setStart(start.node, start.offset);
	range.setEnd(end.node, end.offset);
	const sel = window.getSelection();
	sel?.removeAllRanges();
	sel?.addRange(range);
}

export function captureNoteEditorSelection(
	root: HTMLElement,
	markdown: string,
): { start: number; end: number } {
	const sel = window.getSelection();
	if (!sel || sel.rangeCount === 0 || !root.contains(sel.anchorNode)) {
		return { start: 0, end: 0 };
	}

	const range = sel.getRangeAt(0);
	const plainStart = getTextPosition(root, range.startContainer, range.startOffset);
	const plainEnd = getTextPosition(root, range.endContainer, range.endOffset);
	const start = plainOffsetToMarkdownOffset(markdown, plainStart);
	const end = plainOffsetToMarkdownOffset(markdown, plainEnd);
	return { start: Math.min(start, end), end: Math.max(start, end) };
}

export function restoreNoteEditorSelection(
	root: HTMLElement,
	markdown: string,
	mdStart: number,
	mdEnd: number,
) {
	const plainStart = markdownOffsetToPlainOffset(markdown, mdStart);
	const plainEnd = markdownOffsetToPlainOffset(markdown, mdEnd);
	setTextRange(root, plainStart, plainEnd);
	root.focus({ preventScroll: true });
}

export function applyFormatToNoteEditor(
	root: HTMLElement,
	markdown: string,
	format: NoteTextFormat,
	selection?: { start: number; end: number },
): { markdown: string; selectionStart: number; selectionEnd: number } {
	const { start, end } = selection ?? captureNoteEditorSelection(root, markdown);
	const result = applyNoteTextFormat(markdown, start, end, format);
	return {
		markdown: result.text,
		selectionStart: result.selectionStart,
		selectionEnd: result.selectionEnd,
	};
}

export function normalizeNoteEditorDom(root: HTMLElement) {
	let blocks = Array.from(root.querySelectorAll(':scope > .krona-note-block')) as HTMLElement[];
	if (blocks.length === 0) {
		root.innerHTML = noteMarkdownToHtml('');
		return;
	}

	for (const block of blocks) {
		if (!block.getAttribute('data-kind')) {
			block.setAttribute('data-kind', 'body');
		}
		block.classList.add('krona-note-block');
		if (measureBlockPlainLength(block) === 0 && !block.querySelector('br')) {
			block.innerHTML = '<br>';
		}
	}

	const needsMerge = Array.from(root.childNodes).some(
		(node) =>
			(node.nodeType === Node.TEXT_NODE && (node.textContent?.length ?? 0) > 0) ||
			(node instanceof HTMLElement && !node.classList.contains('krona-note-block')),
	);
	if (!needsMerge) return;

	for (const node of Array.from(root.childNodes)) {
		if (node instanceof HTMLElement && node.classList.contains('krona-note-block')) {
			continue;
		}

		if (node instanceof HTMLElement) {
			const body = document.createElement('div');
			body.setAttribute('data-kind', 'body');
			body.className = 'krona-note-block';
			body.innerHTML = node.innerHTML;
			root.replaceChild(body, node);
			continue;
		}

		if (node.nodeType !== Node.TEXT_NODE) {
			root.removeChild(node);
			continue;
		}

		const text = node.textContent ?? '';
		if (!text) {
			root.removeChild(node);
			continue;
		}

		const prev = node.previousSibling;
		const next = node.nextSibling;
		const target =
			prev instanceof HTMLElement && prev.classList.contains('krona-note-block')
				? prev
				: next instanceof HTMLElement && next.classList.contains('krona-note-block')
					? next
					: null;

		if (target) {
			if (target === next) {
				target.insertBefore(document.createTextNode(text), target.firstChild);
			} else {
				target.append(document.createTextNode(text));
			}
			root.removeChild(node);
			continue;
		}

		const body = document.createElement('div');
		body.setAttribute('data-kind', 'body');
		body.className = 'krona-note-block';
		body.textContent = text;
		root.replaceChild(body, node);
	}
}

export function insertNoteBlockAfter(root: HTMLElement, block: HTMLElement) {
	const next = document.createElement('div');
	next.setAttribute('data-kind', 'body');
	next.className = 'krona-note-block';
	next.innerHTML = '<br>';
	block.after(next);

	const range = document.createRange();
	range.selectNodeContents(next);
	range.collapse(true);
	const sel = window.getSelection();
	sel?.removeAllRanges();
	sel?.addRange(range);
}

/** Split markdown at the cursor into two lines (Enter). */
export function splitNoteMarkdownAtCursor(
	markdown: string,
	cursor: number,
	selectionEnd = cursor,
): { markdown: string; selectionStart: number; selectionEnd: number } {
	const start = Math.min(cursor, selectionEnd);
	const end = Math.max(cursor, selectionEnd);
	const base = markdown.slice(0, start) + markdown.slice(end);
	const next = `${base.slice(0, start)}\n${base.slice(start)}`;
	const newCursor = start + 1;
	return { markdown: next, selectionStart: newCursor, selectionEnd: newCursor };
}

/** Insert an in-paragraph line break at the cursor (Shift+Enter). */
export function insertNoteSoftBreakAtCursor(
	markdown: string,
	cursor: number,
	selectionEnd = cursor,
): { markdown: string; selectionStart: number; selectionEnd: number } {
	const start = Math.min(cursor, selectionEnd);
	const end = Math.max(cursor, selectionEnd);
	const base = markdown.slice(0, start) + markdown.slice(end);
	const next = `${base.slice(0, start)}${NOTE_SOFT_BREAK}${base.slice(start)}`;
	const newCursor = start + NOTE_SOFT_BREAK.length;
	return { markdown: next, selectionStart: newCursor, selectionEnd: newCursor };
}

/** Merge with the previous line or soft break (Backspace at line start). */
export function mergeNoteMarkdownBeforeCursor(
	markdown: string,
	cursor: number,
): { markdown: string; selectionStart: number; selectionEnd: number } | null {
	if (cursor <= 0) return null;
	const removed = markdown[cursor - 1];
	if (removed !== '\n' && removed !== NOTE_SOFT_BREAK) return null;
	const next = markdown.slice(0, cursor - 1) + markdown.slice(cursor);
	const newCursor = cursor - 1;
	return { markdown: next, selectionStart: newCursor, selectionEnd: newCursor };
}

/** Merge with the next line or soft break (Delete at line end). */
export function mergeNoteMarkdownAfterCursor(
	markdown: string,
	cursor: number,
): { markdown: string; selectionStart: number; selectionEnd: number } | null {
	if (cursor >= markdown.length) return null;
	const removed = markdown[cursor];
	if (removed !== '\n' && removed !== NOTE_SOFT_BREAK) return null;
	const next = markdown.slice(0, cursor) + markdown.slice(cursor + 1);
	return { markdown: next, selectionStart: cursor, selectionEnd: cursor };
}

/** Delete the selected markdown range (Backspace/Delete with selection). */
export function deleteNoteMarkdownRange(
	markdown: string,
	start: number,
	end: number,
): { markdown: string; selectionStart: number; selectionEnd: number } {
	const rangeStart = Math.min(start, end);
	const rangeEnd = Math.max(start, end);
	const next = markdown.slice(0, rangeStart) + markdown.slice(rangeEnd);
	return { markdown: next, selectionStart: rangeStart, selectionEnd: rangeStart };
}

function getLineBounds(markdown: string, cursor: number) {
	const lineStart = markdown.lastIndexOf('\n', Math.max(0, cursor - 1)) + 1;
	let lineEnd = markdown.indexOf('\n', cursor);
	if (lineEnd === -1) lineEnd = markdown.length;
	return { lineStart, lineEnd };
}

/** Backspace on a bullet line removes the prefix or the empty bullet row. */
export function handleBulletListOnBackspace(
	markdown: string,
	cursor: number,
): { markdown: string; selectionStart: number; selectionEnd: number } | null {
	const { lineStart, lineEnd } = getLineBounds(markdown, cursor);
	const fullLine = markdown.slice(lineStart, lineEnd);
	const { isBullet, content } = parseBulletLine(fullLine);
	if (!isBullet) return null;

	const prefixLength = fullLine.length - content.length;
	const contentStart = lineStart + prefixLength;

	if (content.trim().length === 0) {
		if (cursor < lineStart || cursor > lineEnd) return null;
		const next = markdown.slice(0, lineStart) + markdown.slice(lineEnd);
		return { markdown: next, selectionStart: lineStart, selectionEnd: lineStart };
	}

	if (cursor === contentStart) {
		const next = markdown.slice(0, lineStart) + content + markdown.slice(lineEnd);
		return { markdown: next, selectionStart: lineStart, selectionEnd: lineStart };
	}

	return null;
}

export function getNoteEditorPlainLength(markdown: string): number {
	return getPlainTextLength(markdown);
}

function stripBulletPrefix(line: string): string {
	return line.replace(/^-\s*(\[[ xX]\]\s*)?/, '').trimEnd();
}

function parseBulletLine(line: string): { isBullet: boolean; content: string } {
	if (/^-\s*\[[ xX]\]/.test(line)) {
		return { isBullet: false, content: '' };
	}
	const match = line.match(/^-\s+(.*)$/);
	if (!match) return { isBullet: false, content: '' };
	return { isBullet: true, content: match[1] ?? '' };
}

/** Continue a markdown bullet list when the user presses Enter. */
export function continueBulletListOnEnter(
	markdown: string,
	cursor: number,
): { markdown: string; selectionStart: number; selectionEnd: number } | null {
	const lineStart = markdown.lastIndexOf('\n', Math.max(0, cursor - 1)) + 1;
	let lineEnd = markdown.indexOf('\n', cursor);
	if (lineEnd === -1) lineEnd = markdown.length;

	const fullLine = markdown.slice(lineStart, lineEnd);
	const { isBullet, content } = parseBulletLine(fullLine);
	if (!isBullet) return null;

	const prefixLength = fullLine.length - content.length;
	const cursorInContent = Math.min(
		Math.max(cursor - lineStart - prefixLength, 0),
		content.length,
	);
	const beforeCursor = content.slice(0, cursorInContent);
	const afterCursor = content.slice(cursorInContent);

	if (beforeCursor.trim().length === 0 && afterCursor.trim().length === 0) {
		const next = markdown.slice(0, lineStart) + markdown.slice(lineEnd);
		return {
			markdown: next,
			selectionStart: lineStart,
			selectionEnd: lineStart,
		};
	}

	const currentLine = `- ${beforeCursor}`;
	const nextLine = `- ${afterCursor}`;
	const next =
		markdown.slice(0, lineStart) +
		currentLine +
		'\n' +
		nextLine +
		markdown.slice(lineEnd);
	const newCursor = lineStart + currentLine.length + 1 + 2;

	return {
		markdown: next,
		selectionStart: newCursor,
		selectionEnd: newCursor,
	};
}

/** Turn selected prose lines into a markdown bullet list. */
export function convertProseSelectionToBulletList(
	markdown: string,
	selectionStart: number,
	selectionEnd: number,
): { markdown: string; selectionStart: number; selectionEnd: number } {
	if (selectionStart !== selectionEnd) {
		const lineStart = markdown.lastIndexOf('\n', Math.max(0, selectionStart - 1)) + 1;
		const lineEndRaw = markdown.indexOf('\n', selectionEnd);
		const lineEnd = lineEndRaw === -1 ? markdown.length : lineEndRaw;
		const region = markdown.slice(lineStart, lineEnd);
		const converted = region
			.split('\n')
			.map((line) => {
				const content = stripBulletPrefix(line).trim();
				if (!content) return line;
				return `- ${content}`;
			})
			.join('\n');
		const next = markdown.slice(0, lineStart) + converted + markdown.slice(lineEnd);
		return {
			markdown: next,
			selectionStart: lineStart,
			selectionEnd: lineStart + converted.length,
		};
	}

	const lineStart = markdown.lastIndexOf('\n', Math.max(0, selectionStart - 1)) + 1;
	const lineEndRaw = markdown.indexOf('\n', selectionStart);
	const lineEnd = lineEndRaw === -1 ? markdown.length : lineEndRaw;
	const line = markdown.slice(lineStart, lineEnd);
	if (line.startsWith('- ')) {
		return { markdown, selectionStart, selectionEnd };
	}
	const next = `${markdown.slice(0, lineStart)}- ${markdown.slice(lineStart)}`;
	return {
		markdown: next,
		selectionStart: selectionStart + 2,
		selectionEnd: selectionStart + 2,
	};
}
