const LIST_TAGS = new Set(['ul', 'ol']);
const BLOCK_TAGS = new Set([
  'p',
  'div',
  'ul',
  'ol',
  'li',
  'table',
  'blockquote',
  'pre',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
]);

/** Text of an inline run: text nodes plus <br> as a line break. */
function inlineText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  const el = node as Element;
  if (el.tagName.toLowerCase() === 'br') return '\n';
  return Array.from(el.childNodes).map(inlineText).join('');
}

function collectBlocks(parent: Node, out: string[]) {
  parent.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent ?? '';
      if (text.trim()) out.push(text);
      return;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) return;
    const el = child as Element;
    const tag = el.tagName.toLowerCase();

    if (LIST_TAGS.has(tag)) {
      let n = 0;
      Array.from(el.children).forEach((li) => {
        n += 1;
        const marker = tag === 'ol' ? `${n}. ` : '- ';
        out.push(`${marker}${inlineText(li).trim()}`);
      });
      return;
    }
    if (tag === 'table') {
      el.querySelectorAll('tr').forEach((row) => {
        const cells = Array.from(row.children).map((cell) => inlineText(cell).trim());
        out.push(cells.join(' | '));
      });
      return;
    }
    const hasBlockChildren = Array.from(el.children).some((c) =>
      BLOCK_TAGS.has(c.tagName.toLowerCase()),
    );
    if (hasBlockChildren) {
      collectBlocks(el, out);
      return;
    }
    out.push(inlineText(el));
  });
}

/**
 * Converts the HTML produced by RichTextEditor into plain text: no tags, paragraphs separated by
 * a newline, list items as "- item" / "1. item". An editor with no real content (e.g. `<p><br></p>`)
 * gives an empty string. Browser-only (uses DOMParser).
 */
export function richTextToPlainText(html: string | null | undefined): string {
  const source = html?.trim();
  if (!source) return '';
  const doc = new DOMParser().parseFromString(source, 'text/html');
  const lines: string[] = [];
  collectBlocks(doc.body, lines);
  return lines
    .join('\n')
    .replace(/ /g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Plain text back into editor HTML: one paragraph per line, with the text escaped. */
export function plainTextToRichText(text: string | null | undefined): string {
  const source = text?.trim();
  if (!source) return '';
  const escape = (line: string) =>
    line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return source
    .split('\n')
    .map((line) => `<p>${line.trim() ? escape(line) : '<br>'}</p>`)
    .join('');
}
