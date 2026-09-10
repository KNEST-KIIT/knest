/**
 * The plain text inside a Lexical rich-text field.
 *
 * Search needs a summary line for a FAQ, and a FAQ's only body is its
 * `answer` rich-text field. Rendering that to JSX is what `RichText` does;
 * this walks the same tree for the text alone, so a search result can show
 * the start of the answer instead of just repeating the question.
 *
 * Deliberately tolerant: it is fed content authored in an editor, and an
 * unfamiliar node type should cost the caller a shorter snippet, never an
 * exception on a search results page.
 */
type LexicalNode = { type?: string; text?: string; children?: unknown }

function walk(node: unknown, out: string[]): void {
  if (!node || typeof node !== 'object') return
  const candidate = node as LexicalNode

  if (typeof candidate.text === 'string') out.push(candidate.text)

  const children = candidate.children
  if (Array.isArray(children)) {
    for (const child of children) walk(child, out)
    // A block boundary is a space, so two paragraphs don't run together
    // into one unreadable word.
    if (candidate.type && candidate.type !== 'text') out.push(' ')
  }
}

export function lexicalToPlainText(data: unknown, maxLength = 160): string {
  if (!data || typeof data !== 'object') return ''

  const out: string[] = []
  walk((data as { root?: unknown }).root ?? data, out)

  const text = out.join('').replace(/\s+/g, ' ').trim()
  if (text.length <= maxLength) return text
  // Cut on a word boundary rather than mid-word.
  return `${text.slice(0, maxLength).replace(/\s+\S*$/, '')}…`
}
