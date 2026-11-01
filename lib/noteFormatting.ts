export type NoteTextFormat =
	| 'header'
	| 'subheader1'
	| 'subheader2'
	| 'body'
	| 'bulletList'
	| 'numberedList'
	| 'bold'
	| 'italic'
	| 'strikethrough';

export type NoteFormatOption = {
	id: NoteTextFormat;
	label: string;
	hint?: string;
	/** Render a menu divider before this option. */
	dividerBefore?: boolean;
};

export const NOTE_TEXT_FORMAT_OPTIONS: NoteFormatOption[] = [
	{ id: 'header', label: 'Header', hint: '# Heading' },
	{ id: 'subheader1', label: 'Subheader 1', hint: '## Section' },
	{ id: 'subheader2', label: 'Subheader 2', hint: '### Subsection' },
	{ id: 'body', label: 'Body', hint: 'Plain text' },
	{ id: 'bulletList', label: 'Bullet list', hint: '- Item', dividerBefore: true },
	{ id: 'numberedList', label: 'Numbered list', hint: '1. Item' },
	{ id: 'bold', label: 'Bold', hint: '**text**', dividerBefore: true },
	{ id: 'italic', label: 'Italic', hint: '*text*' },
	{ id: 'strikethrough', label: 'Strikethrough', hint: '~~text~~' },
];

const BLOCK_PREFIX: Record<'header' | 'subheader1' | 'subheader2', string> = {
	header: '# ',
	subheader1: '## ',
	subheader2: '### ',
};

const INLINE_MARKERS: Record<
	'bold' | 'italic' | 'strikethrough',
	{ open: string; close: string }
> = {
	bold: { open: '**', close: '**' },
	italic: { open: '*', close: '*' },
	strikethrough: { open: '~~', close: '~~' },
};

function stripBlockPrefix(line: string): string {
	return line.replace(/^#{1,6}\s+/, '');
}

function getAffectedLineRange(text: string, start: number, end: number) {
	const lineStart = text.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
	const lineEndRaw = text.indexOf('\n', end);
	const lineEnd = lineEndRaw === -1 ? text.length : lineEndRaw;
	return { lineStart, lineEnd, segment: text.slice(lineStart, lineEnd) };
}

function applyBlockFormat(
	text: string,
	selectionStart: number,
	selectionEnd: number,
	style: 'header' | 'subheader1' | 'subheader2' | 'body',
) {
	const { lineStart, lineEnd, segment } = getAffectedLineRange(
		text,
		selectionStart,
		selectionEnd,
	);
	const collapsed = selectionStart === selectionEnd;
	const cursorInSegment = selectionStart - lineStart;

	const nextSegment = segment
		.split('\n')
		.map((line) => {
			const content = stripBlockPrefix(line);
			if (style === 'body') return content;
			return `${BLOCK_PREFIX[style]}${content}`;
		})
		.join('\n');
	const next = text.slice(0, lineStart) + nextSegment + text.slice(lineEnd);

	if (collapsed) {
		const firstLine = nextSegment.split('\n')[0] ?? '';
		const oldFirstLine = segment.split('\n')[0] ?? '';
		const oldPrefixLen = oldFirstLine.length - stripBlockPrefix(oldFirstLine).length;
		const newPrefixLen = firstLine.length - stripBlockPrefix(firstLine).length;
		const contentOffset = Math.max(0, cursorInSegment - oldPrefixLen);
		const cursor = lineStart + Math.min(newPrefixLen + contentOffset, firstLine.length);
		return {
			text: next,
			selectionStart: cursor,
			selectionEnd: cursor,
		};
	}

	return {
		text: next,
		selectionStart: lineStart,
		selectionEnd: lineStart + nextSegment.length,
	};
}

function toggleInlineWrap(
	text: string,
	start: number,
	end: number,
	open: string,
	close: string,
) {
	const selected = text.slice(start, end);
	if (selected.length > 0) {
		if (selected.startsWith(open) && selected.endsWith(close)) {
			const inner = selected.slice(open.length, selected.length - close.length);
			const next = text.slice(0, start) + inner + text.slice(end);
			return {
				text: next,
				selectionStart: start,
				selectionEnd: start + inner.length,
			};
		}
		const wrapped = `${open}${selected}${close}`;
		const next = text.slice(0, start) + wrapped + text.slice(end);
		return {
			text: next,
			selectionStart: start + open.length,
			selectionEnd: start + open.length + selected.length,
		};
	}

	const next = text.slice(0, start) + open + close + text.slice(end);
	return {
		text: next,
		selectionStart: start + open.length,
		selectionEnd: start + open.length,
	};
}

function stripListPrefix(line: string): string {
	return line.replace(/^(\s*)([-*+]|\d+[.)])\s+/, '$1');
}

function applyListFormat(
	text: string,
	selectionStart: number,
	selectionEnd: number,
	style: 'bulletList' | 'numberedList',
) {
	const { lineStart, lineEnd, segment } = getAffectedLineRange(
		text,
		selectionStart,
		selectionEnd,
	);
	const lines = segment.split('\n');
	const allAlready =
		lines.length > 0 &&
		lines.every((line) => {
			const trimmed = line.trim();
			if (!trimmed) return true;
			if (style === 'bulletList') return /^[-*+]\s+/.test(trimmed);
			return /^\d+[.)]\s+/.test(trimmed);
		});

	const nextSegment = lines
		.map((line, index) => {
			const content = stripListPrefix(stripBlockPrefix(line));
			if (!content.trim()) return content;
			if (allAlready) return content;
			if (style === 'bulletList') return `- ${content.trimStart()}`;
			return `${index + 1}. ${content.trimStart()}`;
		})
		.join('\n');

	const next = text.slice(0, lineStart) + nextSegment + text.slice(lineEnd);
	return {
		text: next,
		selectionStart: lineStart,
		selectionEnd: lineStart + nextSegment.length,
	};
}

/** Apply a markdown-style format to a prose string and selection range. */
export function applyNoteTextFormat(
	text: string,
	selectionStart: number,
	selectionEnd: number,
	format: NoteTextFormat,
): { text: string; selectionStart: number; selectionEnd: number } {
	if (format === 'header' || format === 'subheader1' || format === 'subheader2' || format === 'body') {
		return applyBlockFormat(text, selectionStart, selectionEnd, format);
	}

	if (format === 'bulletList' || format === 'numberedList') {
		return applyListFormat(text, selectionStart, selectionEnd, format);
	}

	const markers = INLINE_MARKERS[format];
	return toggleInlineWrap(text, selectionStart, selectionEnd, markers.open, markers.close);
}

export function applyNoteTextFormatToTextarea(
	textarea: HTMLTextAreaElement,
	format: NoteTextFormat,
): string {
	const result = applyNoteTextFormat(
		textarea.value,
		textarea.selectionStart,
		textarea.selectionEnd,
		format,
	);
	textarea.value = result.text;
	textarea.selectionStart = result.selectionStart;
	textarea.selectionEnd = result.selectionEnd;
	textarea.focus();
	return result.text;
}
