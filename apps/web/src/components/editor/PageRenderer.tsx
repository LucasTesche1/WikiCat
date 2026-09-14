import { Children, isValidElement, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { createLowlight, common } from 'lowlight';
import { parseDocument, remarkDocumentHeadings, nodeText, visitMarkdown, type MarkdownNode, type Attachment } from '@wikicat/shared';
import { Check, Copy, Download, FileText, GitBranch, WrapText, ZoomIn, ZoomOut } from 'lucide-react';
import { api } from '../../api/client';
import { cn } from '../../lib/utils';
import { useThemeStore } from '../../store/useThemeStore';
const lowlight = createLowlight(common);
type HighlightNode = { type: string; value?: string; children?: HighlightNode[]; properties?: { className?: string[] } };
function highlightedNodes(nodes: HighlightNode[]): ReactNode {
  return nodes.map((n,i) => n.type === 'text' ? n.value : <span key={i} className={n.properties?.className?.filter(c => /^hljs-[\w-]+$/.test(c)).join(' ')}>{highlightedNodes(n.children ?? [])}</span>);
}
function markdownTableFromElement(table: HTMLTableElement): string {
  const rows = Array.from(table.querySelectorAll('tr')).map(row =>
    Array.from(row.querySelectorAll('th,td')).map(cell =>
      (cell.textContent || '').replace(/\s+/g, ' ').replace(/\|/g, '\\|').trim(),
    ),
  ).filter(row => row.length);
  if (!rows.length) return '';
  const width = Math.max(...rows.map(row => row.length));
  const normalized = rows.map(row => [...row, ...Array(Math.max(0, width - row.length)).fill('')]);
  const head = normalized[0]!;
  const body = normalized.slice(1);
  const line = (row: string[]) => `| ${row.map(cell => cell || ' ').join(' | ')} |`;
  return ['', line(head), line(head.map(() => '---')), ...body.map(line), ''].join('\n');
}

function normalizeHtmlTables(markdown: string): string {
  if (typeof document === 'undefined' || !/<table[\s>]/i.test(markdown)) return markdown;
  return markdown.replace(/<table[\s\S]*?<\/table>/gi, tableHtml => {
    const template = document.createElement('template');
    template.innerHTML = tableHtml.trim();
    const table = template.content.querySelector('table');
    return table ? markdownTableFromElement(table) : tableHtml;
  });
}

function calloutPlugin() {
  return (tree: unknown) => visitMarkdown(tree as MarkdownNode, node => {
    if (node.type !== 'blockquote') return;
    const first = node.children?.[0]?.children?.[0];
    const match = first?.value?.match(/^\[!(WARNING|TIP|NOTE)\]\s*/i);
    if (!match || !first) return;
    node.data = { hProperties: { 'data-callout': match[1]!.toUpperCase() } };
    first.value = first.value!.slice(match[0].length);
  });
}
export function CodeBlock({ source, language = '' }: { source: string; language?: string }) {
  const [status, setStatus] = useState(''), [wrap, setWrap] = useState(false);
  const timer = useRef<number>();
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const highlighted = useMemo(() => {
    try { return language && lowlight.registered(language) ? highlightedNodes(lowlight.highlight(language, source).children as HighlightNode[]) : source; }
    catch { return source; }
  }, [source, language]);
  const copy = async () => { try { await navigator.clipboard.writeText(source); setStatus('Copiado'); } catch { setStatus('Não foi possível copiar. Selecione o código.'); } window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setStatus(''), 3000); };
  return <figure className="code-panel"><header><span className="flex-1 font-mono text-muted-foreground">{language || 'texto'}</span><button type="button" onClick={() => setWrap(!wrap)} aria-pressed={wrap} aria-label="Quebrar linhas de código" className="workspace-icon"><WrapText size={16} /></button><button type="button" onClick={() => void copy()} className="flex min-h-11 items-center gap-2 rounded px-2 text-sm">{status === 'Copiado' ? <Check size={16} /> : <Copy size={16} />}{status === 'Copiado' ? 'Copiado' : 'Copiar'}</button></header><pre tabIndex={0} aria-label={`Código ${language || 'texto'}`} style={{ whiteSpace: wrap ? 'pre-wrap' : 'pre', overflowWrap: wrap ? 'anywhere' : 'normal' }}><code>{highlighted}</code></pre><span role="status" className="sr-only">{status}</span></figure>;
}
function MermaidDiagram({ source }: { source: string }) {
  const id = useId().replace(/:/g, ''), [svg, setSvg] = useState(''), [error, setError] = useState(''), [zoom, setZoom] = useState(1);
  const theme = useThemeStore(s => s.theme);
  useEffect(() => {
    let cancelled = false; setSvg(''); setError('');
    if (source.length > 50_000) { setError('Diagrama muito grande para visualização embutida. Use a fonte abaixo.'); return; }
    void Promise.all([import('mermaid'), import('dompurify')]).then(async ([module, sanitizer]) => {
      const mermaid = module.default;
      mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: document.documentElement.classList.contains('dark') ? 'dark' : 'default', flowchart: { htmlLabels: false }, maxEdges: 400, maxTextSize: 50_000 });
      const rendered = await mermaid.render(`mermaid-${id}-${Date.now()}`, source);
      if (!cancelled) setSvg(sanitizer.default.sanitize(rendered.svg, { USE_PROFILES: { svg: true, svgFilters: true }, FORBID_TAGS: ['foreignObject'] }));
    }).catch(() => { if (!cancelled) setError('Não foi possível renderizar este diagrama. A fonte está preservada abaixo.'); });
    return () => { cancelled = true; };
  }, [source, theme, id]);
  return <section className="my-6 overflow-hidden rounded-xl border border-input bg-background" aria-label="Diagrama Mermaid"><header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2"><GitBranch size={17} className="text-secondary" /><span className="flex-1 text-sm font-medium">Diagrama de arquitetura</span><button className="workspace-icon" aria-label="Reduzir diagrama" onClick={() => setZoom(v => Math.max(.5,v-.25))}><ZoomOut size={16} /></button><button className="workspace-icon" aria-label="Ampliar diagrama" onClick={() => setZoom(v => Math.min(2,v+.25))}><ZoomIn size={16} /></button></header>
    {error ? <p role="status" className="p-4 text-sm">{error}</p> : !svg ? <p role="status" className="p-4 text-sm">Renderizando diagrama…</p> : <div tabIndex={0} aria-label="Diagrama; use a fonte textual abaixo como alternativa" className="overflow-auto p-6"><div style={{ width: `${zoom * 100}%`, minWidth: 280 }} dangerouslySetInnerHTML={{ __html: svg }} /></div>}
    <details className="border-t border-border px-4"><summary className="min-h-11 cursor-pointer py-3 text-sm">Ver fonte e relações textuais</summary><CodeBlock source={source} language="mermaid" /></details>
  </section>;
}
function InternalLink({ href, children }: { href: string; children: ReactNode }) {
  const [open, setOpen] = useState(false), [preview, setPreview] = useState<{ title: string; text: string } | null>(null);
  const timer = useRef<number>(), target = href.match(/^\/s\/[^/]+\/p\/([\w-]+)/)?.[1];
  const id = useId();
  useEffect(() => {
    if (!open || !target) return;
    const ac = new AbortController();
    api.pages.get(target, ac.signal).then(p => setPreview({ title: p.title, text: p.contentMarkdown.slice(0, 240) })).catch(() => { if (!ac.signal.aborted) setPreview({ title: 'Prévia indisponível', text: 'Abra a página para verificar o acesso.' }); });
    return () => ac.abort();
  }, [open, target]);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  if (!target) return <a href={href}>{children}</a>;
  return <span className="relative inline" onMouseEnter={() => { timer.current = window.setTimeout(() => setOpen(true), 300); }} onMouseLeave={() => { window.clearTimeout(timer.current); setOpen(false); }} onKeyDown={e => { if (e.key === 'Escape') { setOpen(false); e.stopPropagation(); } }}>
    <Link to={href} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} aria-describedby={open ? id : undefined}>{children}</Link>
    {open && <span id={id} role="tooltip" className="absolute left-0 top-full z-20 mt-2 block w-[min(320px,80vw)] rounded-xl border border-input bg-popover p-4 text-sm leading-6 text-popover-foreground shadow-xl"><strong className="block">{preview?.title ?? 'Carregando prévia…'}</strong><span className="mt-2 block font-normal text-muted-foreground">{preview?.text}</span></span>}
  </span>;
}
export function AttachmentList({ attachments }: { attachments: Attachment[] }) {
  if (!attachments.length) return null;
  return <section className="mt-8 border-t border-border pt-6" aria-label="Anexos"><h2 className="mb-4 text-base font-semibold">Anexos <span className="font-mono text-sm text-muted-foreground">{attachments.length}</span></h2><ul className="divide-y divide-border rounded-xl border border-border bg-card">{attachments.map(a => <li key={a.id} className="flex items-center gap-3 p-4"><FileText size={20} className="shrink-0 text-muted-foreground" /><div className="min-w-0 flex-1"><p className="break-all text-sm font-medium">{a.originalName}</p><p className="mt-1 font-mono text-xs text-muted-foreground">{a.sizeBytes < 1048576 ? `${Math.ceil(a.sizeBytes / 1024)} KB` : `${(a.sizeBytes / 1048576).toFixed(1)} MB`} · {a.storageTier === 'large' ? 'Anexo grande' : 'Standard'}</p></div><a href={api.attachments.downloadUrl(a.id)} className="workspace-icon" aria-label={`Baixar ${a.originalName}`}><Download size={18} /></a></li>)}</ul></section>;
}
export function PageRenderer({ markdown, attachments = [], className, onSectionHistory }: { markdown: string; attachments?: Attachment[]; className?: string; onSectionHistory?: (id: string) => void }) {
  const normalizedMarkdown = useMemo(() => normalizeHtmlTables(markdown), [markdown]);
  const { headings } = useMemo(() => parseDocument(normalizedMarkdown), [normalizedMarkdown]);
  const article = useRef<HTMLElement>(null);
  const location = useLocation();
  const [active, setActive] = useState(''), [progress, setProgress] = useState(0), [wide, setWide] = useState(() => window.innerWidth >= 1280);
  const [size, setSize] = useState(16), [width, setWidth] = useState('68ch');
  const jump = (id: string) => {
    const target = document.getElementById(id); if (!target) return;
    let parent = target.parentElement; while (parent) { if (parent instanceof HTMLDetailsElement) parent.open = true; parent = parent.parentElement; }
    target.setAttribute('tabindex', '-1'); target.scrollIntoView({ block: 'start' }); target.focus({ preventScroll: true }); setActive(id);
  };
  useEffect(() => {
    if (!location.hash) return;
    let id = ''; try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    const timer = window.setTimeout(() => jump(id), 50); return () => window.clearTimeout(timer);
  }, [location.hash, normalizedMarkdown]);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0; if (!article.current) return;
      const rect = article.current.getBoundingClientRect(), viewport = window.innerHeight - 110;
      setProgress(Math.round(rect.height <= viewport ? 100 : Math.max(0, Math.min(100, (110 - rect.top) / (rect.height - viewport) * 100))));
      const current = [...headings].reverse().find(h => (document.getElementById(h.id)?.getBoundingClientRect().top ?? Infinity) <= 150);
      setActive(current?.id ?? headings[0]?.id ?? ''); setWide(window.innerWidth >= 1280);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    const observer = new ResizeObserver(schedule); if (article.current) observer.observe(article.current);
    window.addEventListener('scroll', schedule, { passive: true }); window.addEventListener('resize', schedule); update();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener('scroll', schedule); window.removeEventListener('resize', schedule); };
  }, [headings]);
  return <div className={cn('reader-grid', className)}>
    <article ref={article} className="reader-content" style={{ '--reader-size': `${size}px`, '--reader-width': width } as React.CSSProperties}>
      <div className="doc-prose"><ReactMarkdown remarkPlugins={[remarkGfm, remarkDocumentHeadings, calloutPlugin]} components={{
        pre({ children }) {
          const child = Children.toArray(children)[0];
          if (!isValidElement<{ children?: ReactNode; className?: string }>(child)) return <pre>{children}</pre>;
          const source = String(child.props.children ?? '').replace(/\n$/, '');
          const language = /language-([^\s]+)/.exec(child.props.className ?? '')?.[1] ?? '';
          return language === 'mermaid' ? <MermaidDiagram source={source} /> : <CodeBlock source={source} language={language} />;
        },
        a({ href, children }) { return <InternalLink href={href ?? '#'}>{children}</InternalLink>; },
        table({ children }) { return <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Tabela do documento"><table>{children}</table></div>; },
        blockquote({ node, children }) {
          const kind = String(node?.properties?.['data-callout'] ?? '');
          if (!kind) return <blockquote>{children}</blockquote>;
          const title = node ? nodeText(node as unknown as MarkdownNode).trim().split('\n')[0] : '';
          return <details open className="doc-callout" data-kind={kind}><summary>{kind === 'WARNING' ? 'Atenção operacional' : kind === 'TIP' ? 'Dica' : 'Nota de arquitetura'}{title ? ` · ${title.slice(0, 100)}` : ''}</summary><div>{children}</div></details>;
        },
      }}>{normalizedMarkdown}</ReactMarkdown></div><AttachmentList attachments={attachments} />
    </article>
    <aside className="toc-panel"><details open={wide} key={String(wide)}><summary className="min-h-11 cursor-pointer text-sm font-semibold">Nesta página <span className="ml-2 font-mono text-xs text-muted-foreground">{headings.length}</span></summary><nav aria-label="Índice do documento" className="mt-3">{headings.map(h => <div key={h.id} className="group flex items-start"><a href={`#${encodeURIComponent(h.id)}`} aria-current={active === h.id ? 'location' : undefined} className="min-w-0 flex-1" style={{ paddingLeft: Math.min(h.level - 1, 3) * 10 + 12 }} onClick={e => { e.preventDefault(); history.replaceState(history.state, '', `#${encodeURIComponent(h.id)}`); jump(h.id); }}>{h.text}</a>{onSectionHistory && <button aria-label={`Histórico da seção ${h.text}`} className="workspace-icon shrink-0 text-muted-foreground" onClick={() => onSectionHistory(h.id)}>↗</button>}</div>)}{!headings.length && <p className="py-3 text-sm text-muted-foreground">Sem seções neste documento.</p>}</nav></details>
      <div className="mt-6 border-t border-border pt-5"><div className="mb-3 flex justify-between text-sm text-muted-foreground"><span>Leitura</span><span className="font-mono">{progress}%</span></div><div role="progressbar" aria-label="Progresso de leitura" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} className="read-progress"><div style={{ width: `${progress}%` }} /></div></div>
      <details className="mt-6 border-t border-border pt-3"><summary className="min-h-11 cursor-pointer py-3 text-sm">Ajustar leitura</summary><label className="block py-2 text-sm">Tamanho do texto<select className="mt-2 block min-h-11 w-full rounded border border-input bg-card px-2" value={size} onChange={e => setSize(Number(e.target.value))}>{[16,18,20,24].map(n => <option key={n} value={n}>{n}px</option>)}</select></label><label className="block py-2 text-sm">Largura<select className="mt-2 block min-h-11 w-full rounded border border-input bg-card px-2" value={width} onChange={e => setWidth(e.target.value)}>{['60ch','68ch','72ch'].map(w => <option key={w}>{w}</option>)}</select></label></details>
    </aside>
  </div>;
}
