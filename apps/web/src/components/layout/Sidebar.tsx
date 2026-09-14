import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import type { PageTreeNode, SpaceSummary } from '@wikicat/shared';
import { BookOpen, ChevronDown, ChevronRight, FileText, FolderOpen, Layers, Library, Tags } from 'lucide-react';
import { api } from '../../api/client';
import { useAuthStore } from '../../store/useAuthStore';
export function PageBranch({ nodes, slug, depth = 0 }: { nodes: PageTreeNode[]; slug: string; depth?: number }) {
  return <ul className={depth > 0 && depth < 5 ? 'ml-3 border-l border-border pl-2' : 'space-y-1'}>{nodes.map(node => <Branch key={node.id} node={node} slug={slug} depth={depth} />)}</ul>;
}
function contains(node: PageTreeNode, path: string): boolean { return path.endsWith(`/p/${node.id}`) || node.children.some(n => contains(n, path)); }
function Branch({ node, slug, depth }: { node: PageTreeNode; slug: string; depth: number }) {
  const { pathname } = useLocation();
  const userId = useAuthStore(s => s.user?.id);
  const key = `wikicat:tree:${userId}:${slug}:${node.id}`;
  const [open, setOpen] = useState(() => { try { return sessionStorage.getItem(key) === '1' || contains(node, pathname); } catch { return contains(node, pathname); } });
  useEffect(() => { if (contains(node, pathname)) setOpen(true); }, [pathname, node]);
  return <li><div className="flex min-w-0 items-center">
    {node.children.length > 0 ? <button type="button" aria-expanded={open} aria-label={`${open ? 'Recolher' : 'Expandir'} ${node.title}`} className="workspace-icon shrink-0"
      onClick={() => { setOpen(!open); try { sessionStorage.setItem(key, open ? '0' : '1'); } catch { /* unavailable */ } }}>
      {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</button> : <FileText size={14} className="mx-3 shrink-0 text-muted-foreground" />}
    <NavLink to={`/s/${encodeURIComponent(slug)}/p/${node.id}`} className="nav-row min-w-0 flex-1" title={node.title}><span className="truncate">{node.title}</span></NavLink>
  </div>{node.children.length > 0 && open && <PageBranch nodes={node.children} slug={slug} depth={depth + 1} />}</li>;
}
export function Sidebar({ spaces }: { spaces: SpaceSummary[] }) {
  const { pathname } = useLocation(), slug = pathname.match(/^\/s\/([^/]+)/)?.[1];
  const [tree, setTree] = useState<PageTreeNode[]>([]), [error, setError] = useState(false), [retry, setRetry] = useState(0);
  useEffect(() => {
    setTree([]); setError(false); if (!slug) return;
    const ac = new AbortController();
    api.spaces.tree(decodeURIComponent(slug), ac.signal).then(setTree).catch(() => { if (!ac.signal.aborted) setError(true); });
    return () => ac.abort();
  }, [slug, pathname, retry]);
  return <>
    <Link to="/" className="flex min-h-[76px] items-center gap-3 border-b border-border px-5"><span className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground"><Layers size={22} /></span><span><span className="block text-lg font-semibold tracking-tight">WikiCat<span className="text-primary">.</span></span><span className="font-mono text-xs text-muted-foreground">Engineering workspace</span></span></Link>
    <nav aria-label="Navegação principal" className="flex-1 overflow-y-auto p-3"><NavLink end to="/" className="nav-row"><Library size={18} />Visão geral</NavLink><div className="eyebrow mb-3 mt-8 px-3">CONHECIMENTO</div>
      {spaces.map(space => <div key={space.id} className="mb-2"><NavLink end to={`/s/${space.slug}`} className="nav-row"><FolderOpen size={17} className="shrink-0" /><span className="min-w-0 flex-1 truncate">{space.name}</span><span className="font-mono text-xs text-muted-foreground">{space.pageCount}</span></NavLink>
        {slug === space.slug && <div className="mt-1"><PageBranch nodes={tree} slug={space.slug} />{error && <button className="nav-row underline" onClick={() => setRetry(v => v + 1)}>Recarregar páginas</button>}<NavLink to={`/s/${space.slug}/tags`} className="nav-row text-muted-foreground"><Tags size={15} />Explorar tags</NavLink></div>}
      </div>)}{!spaces.length && <p className="px-3 text-sm leading-6 text-muted-foreground">Seus espaços aparecerão aqui.</p>}
    </nav><div className="m-4 rounded-xl border border-border bg-muted/40 p-4"><BookOpen size={18} className="mb-3 text-primary" /><p className="text-sm font-medium">Conhecimento compartilhado.</p><p className="mt-1 text-sm leading-6 text-muted-foreground">Documente decisões. Encontre contexto. Mantenha a equipe no mesmo caminho.</p></div><div className="border-t border-border px-5 py-4 font-mono text-xs text-muted-foreground">WIKICAT / INTRANET</div>
  </>;
}
