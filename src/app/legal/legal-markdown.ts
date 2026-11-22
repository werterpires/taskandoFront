export type LegalInlineSegment =
  | { kind: 'text'; text: string }
  | { kind: 'bold'; text: string }
  | { kind: 'italic'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'link'; label: string; href: string };

export type LegalMarkdownBlock =
  | { kind: 'heading'; level: 1 | 2 | 3; segments: LegalInlineSegment[] }
  | { kind: 'paragraph'; segments: LegalInlineSegment[] }
  | { kind: 'blockquote'; paragraphs: LegalInlineSegment[][] }
  | { kind: 'list'; ordered: boolean; items: LegalInlineSegment[][] }
  | { kind: 'table'; headers: LegalInlineSegment[][]; rows: LegalInlineSegment[][][] }
  | { kind: 'hr' };

function normalizeHref(href: string): string {
  const trimmed = href.trim();
  if (trimmed.includes('TERMOS-DE-USO.md')) return '#/termos';
  if (trimmed.includes('POLITICA-PRIVACIDADE.md')) return '#/privacidade';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('#/')) {
    return trimmed;
  }
  return '#';
}

export function parseInlineMarkdown(text: string): LegalInlineSegment[] {
  const segments: LegalInlineSegment[] = [];
  const tokenPattern = /(\[[^\]]+\]\([^)]+\)|`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let lastIndex = 0;

  for (const match of text.matchAll(tokenPattern)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      segments.push({ kind: 'text', text: text.slice(lastIndex, index) });
    }
    const token = match[0];
    if (token.startsWith('[')) {
      const sep = token.indexOf('](');
      const label = token.slice(1, sep);
      const href = normalizeHref(token.slice(sep + 2, -1));
      segments.push({ kind: 'link', label, href });
    } else if (token.startsWith('`')) {
      segments.push({ kind: 'code', text: token.slice(1, -1) });
    } else if (token.startsWith('**')) {
      segments.push({ kind: 'bold', text: token.slice(2, -2) });
    } else if (token.startsWith('*')) {
      segments.push({ kind: 'italic', text: token.slice(1, -1) });
    }
    lastIndex = index + token.length;
  }

  if (lastIndex < text.length) {
    segments.push({ kind: 'text', text: text.slice(lastIndex) });
  }
  return segments.length ? segments : [{ kind: 'text', text }];
}

function splitTableCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map(cell => cell.trim());
}

function isTableSeparator(line: string): boolean {
  const cells = splitTableCells(line);
  return cells.length > 0 && cells.every(cell => /^:?-{3,}:?$/.test(cell));
}

export function parseLegalMarkdown(markdown: string): LegalMarkdownBlock[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: LegalMarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const trimmed = lines[index].trim();
    if (!trimmed) {
      index += 1;
      continue;
    }
    if (/^-{3,}$/.test(trimmed)) {
      blocks.push({ kind: 'hr' });
      index += 1;
      continue;
    }
    const headingMatch = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (headingMatch) {
      const level = headingMatch[1].length as 1 | 2 | 3;
      blocks.push({ kind: 'heading', level, segments: parseInlineMarkdown(headingMatch[2].trim()) });
      index += 1;
      continue;
    }
    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = [];
      while (index < lines.length && lines[index].trim().startsWith('>')) {
        quoteLines.push(lines[index].trim().replace(/^>\s?/, ''));
        index += 1;
      }
      blocks.push({ kind: 'blockquote', paragraphs: [parseInlineMarkdown(quoteLines.join(' ').trim())] });
      continue;
    }
    if (trimmed.startsWith('|') && index + 1 < lines.length && isTableSeparator(lines[index + 1])) {
      const headers = splitTableCells(lines[index]).map(parseInlineMarkdown);
      index += 2;
      const rows: LegalInlineSegment[][][] = [];
      while (index < lines.length && lines[index].trim().startsWith('|')) {
        rows.push(splitTableCells(lines[index]).map(parseInlineMarkdown));
        index += 1;
      }
      blocks.push({ kind: 'table', headers, rows });
      continue;
    }
    if (/^-\s+/.test(trimmed)) {
      const items: LegalInlineSegment[][] = [];
      while (index < lines.length && /^-\s+/.test(lines[index].trim())) {
        items.push(parseInlineMarkdown(lines[index].trim().replace(/^-\s+/, '')));
        index += 1;
      }
      blocks.push({ kind: 'list', ordered: false, items });
      continue;
    }
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: LegalInlineSegment[][] = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        items.push(parseInlineMarkdown(lines[index].trim().replace(/^\d+\.\s+/, '')));
        index += 1;
      }
      blocks.push({ kind: 'list', ordered: true, items });
      continue;
    }

    const paragraphLines: string[] = [];
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^-{3,}$/.test(lines[index].trim()) &&
      !/^#{1,3}\s+/.test(lines[index].trim()) &&
      !lines[index].trim().startsWith('>') &&
      !(lines[index].trim().startsWith('|') && index + 1 < lines.length && isTableSeparator(lines[index + 1])) &&
      !/^-\s+/.test(lines[index].trim()) &&
      !/^\d+\.\s+/.test(lines[index].trim())
    ) {
      paragraphLines.push(lines[index].trim());
      index += 1;
    }
    blocks.push({ kind: 'paragraph', segments: parseInlineMarkdown(paragraphLines.join(' ')) });
  }

  return blocks;
}

