import * as React from 'react';
import { Box } from '@mui/joy';

export type NoteProseBlockKind = 'header' | 'subheader1' | 'subheader2' | 'body';

type InlineToken = {
	text: string;
	bold?: boolean;
	italic?: boolean;
	strike?: boolean;
};

const BLOCK_PREFIX_RE = /^(#{1,3})\s+/;

const PROSE_LINE_HEIGHT = 'calc(var(--krona-note-editor-font-size) * 1.7)';

const BLOCK_STYLES: Record<
	NoteProseBlockKind,
	{ fontSize: string; fontWeight: number }
> = {
	body: { fontSize: 'var(--krona-note-editor-font-size)', fontWeight: 400 },
	header: { fontSize: '22px', fontWeight: 600 },
	subheader1: { fontSize: '18px', fontWeight: 600 },
	subheader2: { fontSize: '16px', fontWeight: 600 },
};

export function parseNoteProseBlock(line: string): { kind: NoteProseBlockKind; content: string } {
	const match = line.match(BLOCK_PREFIX_RE);
	if (!match) {
		return { kind: 'body', content: line };
	}
	const hashes = match[1]!.length;
	const content = line.slice(match[0].length);
	if (hashes === 1) return { kind: 'header', content };
	if (hashes === 2) return { kind: 'subheader1', content };
	return { kind: 'subheader2', content };
}

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

function renderInlineTokens(tokens: InlineToken[]): React.ReactNode[] {
	return tokens.map((token, index) => (
		<Box
			component="span"
			key={`${index}-${token.text.slice(0, 8)}`}
			sx={{
				fontWeight: token.bold ? 700 : 'inherit',
				fontStyle: token.italic ? 'italic' : 'inherit',
				textDecoration: token.strike ? 'line-through' : 'none',
			}}
		>
			{token.text}
		</Box>
	));
}

function ProseLine({ line }: { line: string }) {
	const { kind, content } = parseNoteProseBlock(line);
	const blockStyle = BLOCK_STYLES[kind];
	const inline = renderInlineTokens(tokenizeInline(content));

	return (
		<Box
			component="div"
			sx={{
				fontSize: blockStyle.fontSize,
				fontWeight: blockStyle.fontWeight,
				lineHeight: PROSE_LINE_HEIGHT,
				minHeight: PROSE_LINE_HEIGHT,
				color: 'var(--krona-text)',
				whiteSpace: 'pre-wrap',
				wordBreak: 'break-word',
			}}
		>
			{inline.length > 0 ? inline : '\u00a0'}
		</Box>
	);
}

/** Styled mirror of note prose markdown (sits behind the transparent textarea). */
export default function NoteProseStyledLayer({ text }: { text: string }) {
	const lines = text.split('\n');

	return (
		<Box
			aria-hidden
			sx={{
				width: '100%',
				fontFamily: 'inherit',
				fontSize: 'var(--krona-note-editor-font-size)',
				lineHeight: PROSE_LINE_HEIGHT,
				color: 'var(--krona-text)',
			}}
		>
			{lines.map((line, index) => (
				<ProseLine key={`${index}-${line.length}`} line={line} />
			))}
		</Box>
	);
}
