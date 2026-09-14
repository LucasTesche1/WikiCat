import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { documentLinks, lineDiff, parseDocument, type DocumentVersion, type PageTreeNode } from '@wikicat/shared';
import { ArrowUpRight, FileText, GitBranch } from 'lucide-react';
import { api } from '../../api/client';
import { Button } from '../ui/Button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../ui/Dialog';

export function DocumentRelations({ markdown, title, slug, tree, pageId }: { markdown: string; title: string; slug: string; tree: PageTreeNode[]; pageId: string }) {
  const [selected, setSelected] = useState<string | null>(null);
  const nodes = useMemo(() => {
    const result: { id: string; title: string; relation: string; href: string }[] = [];
    const walk = (items: PageTreeNode[]) => items.forEach(n => { if (n.id === pageId && n.parentPageId) result.push({ id: n.parentPageId, title: 'Página superior', relation: 'Pertence a', href: `/s/${slug}/p/${n.parentPageId}` }); if (n.parentPageId === pageId) result.push({ id: n.id, title: n.title, relation: 'Contém', href: `/s/${slug}/p/${n.id}` }); walk(n.children); });
    walk(tree);
    documentLinks(markdown).filter(url => /^\/s\/[^/]+\/p\/[\w-]+/.test(url)).forEach(url => result.push({ id: url, title: url, relation: 'Referencia', href: url }));
    return result.slice(0,200);
  }, [markdown, tree, pageId, slug]);
  const selectedNode = nodes.find(n => n.id === selected);
  return <section className="technical-panel overflow-hidden rounded-xl"><header className="flex items-start gap-3 border-b border-border p-5"><GitBranch className="mt-1 text-secondary" size={20} /><div><h2 className="font-semibold">Relações do documento</h2><p className="mt-1 text-sm text-muted-foreground">Hierarquia e referências explícitas. Links não indicam dependência operacional.</p></div><span className="ml-auto font-mono text-sm">{nodes.length}</span></header>
    <div className="relation-canvas flex min-h-72 flex-wrap items-center justify-center gap-8 p-8"><div className="max-w-sm rounded-xl border-2 border-primary bg-card p-6"><div className="eyebrow mb-3">DOCUMENTO ATUAL</div><p className="text-lg font-semibold">{title}</p></div>{nodes.length > 0 && <span aria-hidden className="text-2xl text-secondary">→</span>}<div className="space-y-3">{nodes.slice(0,8).map(n => <button key={`${n.relation}-${n.id}`} aria-pressed={selected === n.id} className={`block min-h-11 max-w-sm rounded-lg border bg-card p-4 text-left ${selected === n.id ? 'border-primary ring-2 ring-primary' : 'border-input'}`} onClick={() => setSelected(n.id)}><span className="eyebrow block">{n.relation}</span><span className="mt-1 block break-all text-sm">{n.title}</span></button>)}</div>{!nodes.length && <p className="max-w-sm text-sm leading-6 text-muted-foreground">Sem relações documentadas. Adicione links internos ou organize páginas filhas para conectar o conteúdo.</p>}</div>
    {selectedNode && <div className="border-t border-border bg-muted p-5"><p className="text-sm">Origem: {title} · {selectedNode.relation}</p><Link to={selectedNode.href} className="mt-2 inline-flex min-h-11 items-center gap-2 text-sm text-primary underline">Abrir página relacionada <ArrowUpRight size={16} /></Link></div>}
    <details className="border-t border-border p-5"><summary className="min-h-11 cursor-pointer font-medium">Lista de relações ({nodes.length})</summary><ul>{nodes.map(n => <li key={`${n.relation}-${n.id}`} className="border-t border-border py-3"><Link className="inline-flex min-h-11 items-center gap-3 break-all text-sm underline" to={n.href}><FileText size={16} className="shrink-0" />{n.relation}: {n.title}</Link></li>)}</ul><p className="text-sm text-muted-foreground">Até 200 relações. O mapa mostra as primeiras oito; a lista mantém todas as relações carregadas.</p></details>
  </section>;
}
export function HistoryPanel({ pageId, current, open, onOpenChange, onRestore, sectionId }: { pageId: string; current: string; open: boolean; onOpenChange: (v: boolean) => void; onRestore?: (id: string) => Promise<void>; sectionId?: string }) {
  const [versions, setVersions] = useState<DocumentVersion[]>([]), [error, setError] = useState(''), [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(''), [restoring, setRestoring] = useState(false), [confirm, setConfirm] = useState(false), [retry, setRetry] = useState(0);
  useEffect(() => { if (!open) return; const ac = new AbortController(); setLoading(true); setError(''); setConfirm(false);
    api.pages.versions(pageId, ac.signal).then(rows => { if (!ac.signal.aborted) { setVersions(rows); setSelected(rows[0]?.id ?? ''); } }).catch(() => { if (!ac.signal.aborted) setError('Não foi possível carregar o histórico.'); }).finally(() => { if (!ac.signal.aborted) setLoading(false); }); return () => ac.abort();
  }, [pageId, open, retry]);
  const version = versions.find(v => v.id === selected);
  const section = (md: string) => { if (!sectionId) return md; const h = parseDocument(md).headings; const i = h.findIndex(n => n.id === sectionId); return i < 0 ? null : md.slice(h[i]!.offset, h[i+1]?.offset); };
  const previousSection = version ? section(version.snapshotMarkdown) : null, currentSection = section(current);
  const diff = useMemo(() => {
    const scoped = sectionId && previousSection !== null && currentSection !== null;
    return lineDiff(scoped ? previousSection : version?.snapshotMarkdown ?? '', scoped ? currentSection : current);
  }, [sectionId, previousSection, currentSection, version, current]);
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-4xl overflow-y-auto"><DialogTitle className="pr-10">{sectionId ? 'Histórico da seção' : 'Histórico de publicações'}</DialogTitle><DialogDescription>Compare uma publicação com o conteúdo atual. Restaurar cria uma nova versão da página inteira.</DialogDescription>
    {loading ? <p role="status">Carregando versões…</p> : error ? <div role="alert">{error}<Button variant="outline" onClick={() => setRetry(v => v+1)}>Tentar novamente</Button></div> : !versions.length ? <p className="py-8 text-sm text-muted-foreground">O histórico começa na próxima publicação. Versões anteriores não estão disponíveis.</p> : <>
      <label className="text-sm">Comparar com<select value={selected} onChange={e => { setSelected(e.target.value); setConfirm(false); }} className="mt-2 min-h-11 w-full rounded-lg border border-input bg-card px-3">{versions.map(v => <option key={v.id} value={v.id}>v{v.versionNumber} · {v.authorName} · {new Date(v.createdAt).toLocaleString('pt-BR')}</option>)}</select></label>
      {sectionId && (previousSection === null || currentSection === null) && <p className="text-sm text-muted-foreground">Seção renomeada ou ausente. Exibindo a comparação disponível; use o histórico completo para revisar a página.</p>}
      <div className="flex gap-4 font-mono text-sm"><span className="text-primary">+{diff.filter(l => l.type === 'added').length} adicionadas</span><span className="text-destructive">−{diff.filter(l => l.type === 'removed').length} removidas</span></div>
      <pre tabIndex={0} aria-label="Diferenças entre versões" className="max-h-96 overflow-auto rounded-lg border border-input bg-background p-4 text-sm leading-6">{diff.map((line,i) => <div key={i} className={line.type === 'added' ? 'text-primary' : line.type === 'removed' ? 'text-destructive' : 'text-muted-foreground'}><span aria-label={line.type === 'added' ? 'Adicionada' : line.type === 'removed' ? 'Removida' : 'Sem alteração'}>{line.type === 'added' ? '+ ' : line.type === 'removed' ? '− ' : '  '}</span>{line.content || ' '}</div>)}</pre>
      {onRestore && version && <div className="border-t border-border pt-4">{confirm ? <div><p className="mb-3 text-sm">Publicar novamente todo o conteúdo de v{version.versionNumber}? Seu conteúdo atual ficará no histórico de publicações.</p><div className="flex gap-2"><Button disabled={restoring} onClick={() => { setRestoring(true); void onRestore(version.id).then(() => onOpenChange(false)).catch(e => setError(e instanceof Error ? e.message : 'Falha ao restaurar.')).finally(() => setRestoring(false)); }}>{restoring ? 'Restaurando…' : 'Confirmar restauração'}</Button><Button variant="outline" onClick={() => setConfirm(false)}>Cancelar</Button></div></div> : <Button variant="outline" onClick={() => setConfirm(true)}>Restaurar esta publicação</Button>}</div>}
    </>}
  </DialogContent></Dialog>;
}
export function RunbookCheckpoints({ pageId, markdown, userId }: { pageId: string; markdown: string; userId: string }) {
  const steps = useMemo(() => parseDocument(markdown).headings.filter(h => h.level === 2), [markdown]);
  const fingerprint = useMemo(() => { let hash=2166136261; for (const char of markdown) hash=Math.imul(hash ^ char.charCodeAt(0),16777619); return (hash>>>0).toString(16); }, [markdown]);
  const key = `wikicat:checkpoints:${userId}:${pageId}`;
  const [checked,setChecked] = useState<string[]>([]), [started,setStarted] = useState(false), [changed,setChanged] = useState(false);
  useEffect(() => { try { const raw = sessionStorage.getItem(key); if (raw) { const saved = JSON.parse(raw) as { fingerprint: string; checked: string[] }; if (saved.fingerprint === fingerprint && Array.isArray(saved.checked)) { setChecked(saved.checked); setStarted(true); } else { setChecked([]); setChanged(true); } } } catch { /* optional persistence */ } }, [key,fingerprint]);
  if (!steps.length) return null;
  return <details className="mb-6 rounded-xl border border-border bg-card p-4"><summary className="min-h-11 cursor-pointer text-sm font-medium">Acompanhar procedimento <span className="ml-2 font-mono text-xs text-muted-foreground">{checked.length}/{steps.length}</span></summary><p className="mb-3 text-sm text-muted-foreground">Marque as seções que você verificou. Isso não executa comandos nem altera a documentação.</p>{changed && <p role="status" className="mb-3 text-sm text-destructive">O conteúdo mudou. O acompanhamento anterior foi reiniciado.</p>}{!started ? <Button variant="outline" onClick={() => setStarted(true)}>Iniciar acompanhamento</Button> : <ul>{steps.map(step => <li key={step.id} className="flex items-center gap-3"><label className="flex min-h-11 flex-1 cursor-pointer items-center gap-3 text-sm"><input type="checkbox" className="h-5 w-5 accent-current" checked={checked.includes(step.id)} onChange={e => { const next = e.target.checked ? [...checked,step.id] : checked.filter(id => id !== step.id); setChecked(next); try { sessionStorage.setItem(key,JSON.stringify({ fingerprint,checked:next })); } catch { /* unavailable */ } }} />{step.text}</label><a href={`#${encodeURIComponent(step.id)}`} className="workspace-icon" aria-label={`Ir para ${step.text}`}><ArrowUpRight size={16} /></a></li>)}</ul>}</details>;
}
