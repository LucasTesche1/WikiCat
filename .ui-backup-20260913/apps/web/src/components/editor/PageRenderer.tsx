import { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkToc from 'remark-toc';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import { createLowlight, common } from 'lowlight';
import type { Attachment } from '@wikicat/shared';
import {
  Archive, Check, ChevronDown, Copy, Database, Download, FileText, GitBranch, HardDrive, Package, TriangleAlert,
} from 'lucide-react';
import { Button } from '../ui/Button.js';
import { Card, CardContent } from '../ui/Card.js';
import { api } from '../../api/client.js';
import { cn } from '../../lib/utils.js';

const lowlight = createLowlight(common);

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function extOf(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : '';
}

function LargeIconFor({ fileName }: { fileName: string }) {
  const ext = extOf(fileName);
  if (['iso', 'img', 'qcow2', 'ova', 'vmdk'].includes(ext)) return <HardDrive className="w-6 h-6" />;
  if (['sql', 'dump', 'backup'].includes(ext)) return <Database className="w-6 h-6" />;
  if (['tar', 'gz', 'tgz', 'bz2', 'xz', '7z', 'rar'].includes(ext)) return <Archive className="w-6 h-6" />;
  if (['rpm', 'deb', 'pkg', 'msi', 'apk'].includes(ext)) return <Package className="w-6 h-6" />;
  return <FileText className="w-6 h-6" />;
}

function MermaidDiagram({ source }: { source: string }) {
  const edges = source.split('\n').map((line) => line.match(/([\w-]+)(?:\[([^\]]+)\])?\s*--?>\s*([\w-]+)(?:\[([^\]]+)\])?/)).filter(Boolean).slice(0, 6) as RegExpMatchArray[];
  return <div className="my-6 overflow-hidden rounded-xl border border-indigo-400/20 bg-[#090d14] text-slate-200 not-prose">
    <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5"><span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-indigo-300"><GitBranch className="h-4 w-4" /> Fluxo interativo</span><span className="font-mono text-[9px] text-slate-600">MERMAID</span></div>
    <div className="flex min-h-44 items-center justify-center gap-2 overflow-x-auto p-6">
      {edges.length ? edges.map((edge, index) => <div key={`${edge[1]}-${index}`} className="flex items-center gap-2"><div className="min-w-28 rounded-lg border border-white/10 bg-white/[0.05] px-4 py-3 text-center"><div className="text-xs font-semibold">{edge[2] || edge[1]}</div><div className="mt-1 h-1 rounded-full bg-emerald-400/40" /></div><span className="text-emerald-400">→</span>{index === edges.length - 1 && <div className="min-w-28 rounded-lg border border-indigo-400/25 bg-indigo-400/10 px-4 py-3 text-center text-xs font-semibold">{edge[4] || edge[3]}</div>}</div>) : <pre className="whitespace-pre-wrap font-mono text-xs text-slate-400">{source}</pre>}
    </div>
  </div>;
}

function CodeBlock({ className, children }: { className?: string; children?: React.ReactNode }) {
  const langMatch = /language-(\w+)/.exec(className || '');
  const lang = langMatch ? langMatch[1] : '';
  const text = typeof children === 'string' ? children : '';
  const [copied, setCopied] = useState(false);
  if (lang === 'mermaid') return <MermaidDiagram source={text} />;
  let highlighted = text;
  try {
    if (lang && lowlight.registered(lang)) {
      const result = lowlight.highlight(text, lang);
      highlighted = '';
      const walk = (nodes: unknown[]) => {
        for (const n of nodes) {
          if (typeof n === 'string') { highlighted += n; continue; }
          const node = n as { type?: string; properties?: { className?: string[] }; children?: unknown[]; value?: string };
          if (node.type === 'text') { highlighted += node.value || ''; continue; }
          if (node.children && node.children.length) {
            const classes = (node.properties?.className ?? []).join(' ');
            if (classes) highlighted += `<span class="${classes}">`;
            walk(node.children);
            if (classes) highlighted += '</span>';
          }
        }
      };
      walk((result as unknown as { children: unknown[] }).children);
    }
  } catch {
    /* fallback plain */
  }
  return (
    <pre className="relative group my-5 overflow-hidden rounded-xl border border-white/10 bg-[#090d14] text-slate-200 shadow-soft not-prose">
      <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.025] px-4 py-2.5 text-xs text-slate-400">
        <span className="flex items-center gap-2 font-mono uppercase tracking-wide"><span className="h-2 w-2 rounded-full bg-emerald-400" />{lang || 'code'}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs text-slate-400 hover:bg-white/5 hover:text-white"
          onClick={() => void navigator.clipboard?.writeText(text).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1400); })}
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}{copied ? 'Copiado' : 'Copiar'}
        </Button>
      </div>
      <code
        className={cn('block max-h-[520px] overflow-auto p-4 font-mono text-[13px] leading-6', className)}
        dangerouslySetInnerHTML={{ __html: highlighted }}
      />
    </pre>
  );
}

function buildToc(markdown: string): Array<{ id: string; text: string; level: number }> {
  const lines = markdown.split('\n');
  const out: Array<{ id: string; text: string; level: number }> = [];
  const slugify = (s: string) =>
    s.toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-');
  for (const raw of lines) {
    const m = /^(#{1,6})\s+(.+)$/.exec(raw);
    if (!m) continue;
    const level = m[1]!.length;
    const text = m[2]!.trim();
    out.push({ id: slugify(text), text, level });
  }
  return out;
}

export function PageRenderer({
  markdown,
  attachments,
  className,
}: {
  markdown: string;
  attachments?: Attachment[];
  className?: string;
}) {
  const toc = useMemo(() => buildToc(markdown || ''), [markdown]);

  const largeAttach = useMemo(
    () => (attachments || []).filter((a) => a.storageTier === 'large'),
    [attachments],
  );
  const standardAttach = useMemo(
    () => (attachments || []).filter((a) => a.storageTier === 'standard'),
    [attachments],
  );

  return (
    <div className={cn('grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_240px]', className)}>
      <article className="min-w-0">
        <div className="prose mx-auto prose-headings:scroll-mt-24 [&_img]:rounded-lg [&_img]:border [&_img]:border-border">
          <ReactMarkdown
            remarkPlugins={[
              remarkGfm,
              [remarkToc, { tight: true, ordered: false, maxDepth: 4, heading: 'Sumário' }],
            ]}
            rehypePlugins={[
              rehypeSlug,
              [rehypeAutolinkHeadings, { behavior: 'wrap' }],
            ]}
            components={{
              code(props: any) {
                const { inline, className, children } = props;
                if (inline) {
                  return (
                    <code className={cn('px-1.5 py-0.5 rounded bg-muted text-[0.9em] font-mono border border-border', className)}>
                      {children}
                    </code>
                  );
                }
                return <CodeBlock className={className}>{children}</CodeBlock>;
              },
              blockquote(props: any) {
                const raw = String(props.children?.[0]?.props?.children ?? '').toLowerCase();
                const warning = raw.includes('warning') || raw.includes('atenção');
                return <details open className={cn('group my-6 rounded-xl border not-prose', warning ? 'border-amber-400/30 bg-amber-400/[0.06]' : 'border-indigo-400/25 bg-indigo-400/[0.055]')}>
                  <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 text-sm font-semibold"><span className={cn('grid h-7 w-7 place-items-center rounded-md', warning ? 'bg-amber-400/10 text-amber-600 dark:text-amber-300' : 'bg-indigo-400/10 text-indigo-500 dark:text-indigo-300')}>{warning ? <TriangleAlert className="h-4 w-4" /> : <GitBranch className="h-4 w-4" />}</span>{warning ? 'Atenção operacional' : 'Nota de arquitetura'}<ChevronDown className="ml-auto h-4 w-4 text-muted-foreground transition group-open:rotate-180" /></summary>
                  <div className="border-t border-current/10 px-4 py-3 text-sm leading-6 text-muted-foreground">{props.children}</div>
                </details>;
              },
            }}
          >
            {markdown || ''}
          </ReactMarkdown>
        </div>

        {(standardAttach.length > 0 || largeAttach.length > 0) && (
          <div className="mt-12 space-y-6 border-t border-border pt-8">
            {largeAttach.length > 0 && (
              <section>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <HardDrive className="w-5 h-5 text-muted-foreground" />
                  Anexos grandes ({largeAttach.length})
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {largeAttach.map((a) => (
                    <Card key={a.id} className="overflow-hidden border-amber-500/30 bg-amber-500/5">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="shrink-0 rounded-lg p-2 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                            <LargeIconFor fileName={a.originalName} />
                          </div>
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="font-medium truncate" title={a.originalName}>
                              {a.originalName}
                            </div>
                            <div className="text-xs text-muted-foreground font-mono">
                              {a.mimeType} · {humanSize(a.sizeBytes)}
                            </div>
                            <div className="pt-1">
                              <Button
                                size="sm"
                                variant="outline"
                                asChild
                              >
                                <a
                                  href={api.attachments.downloadUrl(a.id)}
                                  target="_blank"
                                  rel="noreferrer noopener"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  Baixar
                                </a>
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {standardAttach.length > 0 && (
              <section>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-muted-foreground" />
                  Anexos ({standardAttach.length})
                </h3>
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {standardAttach.map((a) => (
                    <li key={a.id} className="flex items-center gap-3 px-3 py-2.5">
                      <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm" title={a.originalName}>{a.originalName}</div>
                        <div className="text-[11px] text-muted-foreground font-mono">
                          {humanSize(a.sizeBytes)} · {a.mimeType}
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" asChild className="shrink-0">
                        <a
                          href={api.attachments.downloadUrl(a.id)}
                          target="_blank"
                          rel="noreferrer noopener"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      </Button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </article>

      <aside className="hidden lg:block">
        <div className="sticky top-24 rounded-xl border border-border bg-card/70 p-4 backdrop-blur">
          <div className="mb-4 flex items-center justify-between"><div className="eyebrow">Nesta página</div><span className="font-mono text-[9px] text-muted-foreground">{toc.length} SEÇÕES</span></div>
          <nav className="space-y-1 text-sm" aria-label="Índice da página">
            {toc.length === 0 ? (
              <div className="text-xs text-muted-foreground italic">Sem cabeçalhos.</div>
            ) : (
              toc.map((h) => (
                <a
                  key={`${h.id}-${h.level}`}
                  href={`#${h.id}`}
                  className={cn(
                    'block truncate rounded-md border-l-2 border-transparent px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:bg-accent hover:text-foreground',
                    h.level === 1 && 'font-medium text-foreground',
                    h.level === 2 && 'pl-4',
                    h.level === 3 && 'pl-7',
                    h.level >= 4 && 'pl-10 text-xs',
                  )}
                >
                  {h.text}
                </a>
              ))
            )}
          </nav>
          <div className="mt-5 border-t border-border pt-4"><div className="mb-2 flex items-center justify-between font-mono text-[9px] uppercase text-muted-foreground"><span>Progresso de leitura</span><span>38%</span></div><div className="h-1 rounded-full bg-muted"><div className="h-full w-[38%] rounded-full bg-gradient-to-r from-emerald-400 to-indigo-400" /></div></div>
        </div>
      </aside>
    </div>
  );
}
