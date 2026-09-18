import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import GithubSlugger from 'github-slugger';

export type MarkdownNode = {
  type: string; value?: string; depth?: number; url?: string;
  children?: MarkdownNode[]; data?: { hProperties?: Record<string, unknown> };
  position?: { start: { offset?: number }; end: { offset?: number } };
};
export type DocumentHeading = { id: string; text: string; level: number; offset: number };
export function nodeText(node: MarkdownNode): string {
  return node.value ?? node.children?.map(nodeText).join('') ?? '';
}
export function visitMarkdown(node: MarkdownNode, visitor: (node: MarkdownNode) => void) {
  visitor(node); node.children?.forEach(child => visitMarkdown(child, visitor));
}
export function annotateHeadings(tree: MarkdownNode): DocumentHeading[] {
  const slugger = new GithubSlugger();
  const headings: DocumentHeading[] = [];
  visitMarkdown(tree, node => {
    if (node.type !== 'heading') return;
    const text = nodeText(node);
    const id = slugger.slug(text);
    node.data = { ...node.data, hProperties: { ...node.data?.hProperties, id } };
    headings.push({ id, text, level: node.depth ?? 2, offset: node.position?.start.offset ?? 0 });
  });
  return headings;
}
export function remarkDocumentHeadings() {
  return (tree: unknown) => { annotateHeadings(tree as MarkdownNode); };
}
const parser = unified().use(remarkParse).use(remarkGfm);
export function parseDocument(markdown: string) {
  const tree = parser.parse(markdown) as MarkdownNode;
  return { tree, headings: annotateHeadings(tree) };
}
export function documentLinks(markdown: string): string[] {
  const { tree } = parseDocument(markdown);
  const links = new Set<string>();
  visitMarkdown(tree, node => { if (node.type === 'link' && node.url) links.add(node.url); });
  return [...links];
}
export type LineChange = { type: 'added' | 'removed' | 'unchanged'; content: string };
export function lineDiff(before: string, after: string): LineChange[] {
  if (before === after) return before.split('\n').map(content => ({ type: 'unchanged', content }));
  const a = before.split('\n'), b = after.split('\n');
  // Bound memory for unusually large runbooks; the fallback remains exact.
  if (a.length * b.length > 1_000_000) return [
    ...a.map(content => ({ type: 'removed' as const, content })),
    ...b.map(content => ({ type: 'added' as const, content })),
  ];
  const grid = Array.from({ length: a.length + 1 }, () => new Uint32Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--)
    grid[i]![j] = a[i] === b[j] ? grid[i + 1]![j + 1]! + 1 : Math.max(grid[i + 1]![j]!, grid[i]![j + 1]!);
  const result: LineChange[] = [];
  let i = 0, j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      result.push({ type: 'unchanged', content: a[i++]! }); j++;
    } else if (j < b.length && (i === a.length || grid[i]![j + 1]! > grid[i + 1]![j]!)) {
      result.push({ type: 'added', content: b[j++]! });
    } else result.push({ type: 'removed', content: a[i++]! });
  }
  return result;
}
