import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, FileText, Loader2, Plus, Search, FolderTree } from 'lucide-react';
import { api, ApiError } from '../api/client.js';
import { useAuthStore, hasRole } from '../store/useAuthStore.js';
import { Button } from '../components/ui/Button.js';
import { Input } from '../components/ui/Input.js';
import { Card } from '../components/ui/Card.js';
import type { PageTreeNode, SpaceSummary } from '@wikicat/shared';
import { cn } from '../lib/utils.js';
import { AppShell } from '../components/layout/AppShell.js';

function flattenTree(nodes: PageTreeNode[], out: PageTreeNode[] = []): PageTreeNode[] {
  for (const n of nodes) {
    out.push(n);
    if (n.children?.length) flattenTree(n.children, out);
  }
  return out;
}

export default function SpaceHomePage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const canWrite = hasRole(user, ['editor', 'admin']);
  const [loading, setLoading] = useState(true);
  const [tree, setTree] = useState<PageTreeNode[]>([]);
  const [spaces, setSpaces] = useState<SpaceSummary[]>([]);
  const [query, setQuery] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr(null);
    Promise.all([api.spaces.tree(slug!), api.spaces.list()]).then(([t, s]) => { if (!cancelled) { setTree(t); setSpaces(s); } })
      .catch((e: unknown) => { if (!cancelled) setErr(e instanceof ApiError ? e.message : 'Falha ao carregar árvore do espaço.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slug]);

  const flat = useMemo(() => flattenTree(tree), [tree]);
  const filtered = useMemo(() => {
    if (!query.trim()) return flat;
    const q = query.trim().toLowerCase();
    return flat.filter((n) => n.title.toLowerCase().includes(q) || n.slug.toLowerCase().includes(q));
  }, [flat, query]);

  const createRoot = async () => {
    if (!slug || !canWrite) return;
    setCreating(true);
    try {
      const title = window.prompt('Título da nova página:', 'Nova página');
      if (!title || !title.trim()) return;
      const created = await api.pages.create(slug, { title: title.trim(), contentMarkdown: '' });
      navigate(`/s/${slug}/p/${created.id}`);
    } catch (e: unknown) {
      setErr(e instanceof ApiError ? e.message : 'Erro ao criar página.');
    } finally {
      setCreating(false);
    }
  };

  const TreeBranch = ({ nodes, depth = 0 }: { nodes: PageTreeNode[]; depth?: number }) => (
    <ul className={cn('space-y-1', depth > 0 && 'pl-4 border-l border-border/70 ml-2')}>
      {nodes.map((n) => (
        <li key={n.id}>
          <Link
            to={`/s/${slug}/p/${n.id}`}
            className="group flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent transition-colors"
          >
            <FileText className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
            <span className="flex-1 truncate">{n.title}</span>
            {n.children?.length > 0 && (
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60" />
            )}
          </Link>
          {n.children?.length > 0 && <TreeBranch nodes={n.children} depth={depth + 1} />}
        </li>
      ))}
    </ul>
  );

  return (
    <AppShell spaces={spaces}>
    <div className="mx-auto max-w-6xl space-y-7 pb-10">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-7">
        <div className="space-y-1">
          <div className="eyebrow flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Base de conhecimento</div>
          <h1 className="mt-2 flex items-center gap-3 text-3xl font-semibold tracking-[-0.035em]">
            <FolderTree className="h-7 w-7 text-primary" />
            <span className="font-mono lowercase">{slug}</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            {flat.length} {flat.length === 1 ? 'página' : 'páginas'} neste espaço.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canWrite && (
            <Button size="sm" onClick={createRoot} disabled={creating || loading}>
              {creating ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
              Nova página
            </Button>
          )}
        </div>
      </header>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrar páginas por título ou slug…"
            className="pl-9"
          />
        </div>
      </div>

      {err && (
        <Card className="p-4 text-sm text-destructive border-destructive/40 bg-destructive/5">
          {err}
        </Card>
      )}

      <Card className="technical-panel min-h-[420px] overflow-hidden rounded-xl p-0">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Carregando estrutura de páginas…
          </div>
        ) : flat.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <FileText className="w-14 h-14 text-muted-foreground/30" />
            <div>
              <div className="font-semibold">Nenhuma página neste espaço ainda.</div>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                {canWrite
                  ? 'Clique em "Nova página" para começar a documentar.'
                  : 'Peça a um editor ou administrador para criar a primeira página.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)]">
            <aside className="border-r border-border p-5">
              <h2 className="eyebrow mb-4 px-2">
                Árvore hierárquica
              </h2>
              <TreeBranch nodes={tree} />
            </aside>
            <section className="p-5">
              <h2 className="eyebrow mb-4 px-2">
                {query ? `Resultados (${filtered.length})` : 'Todas as páginas'}
              </h2>
              <ul className="divide-y divide-border rounded-lg border border-border overflow-hidden">
                {(query ? filtered : flat).map((n) => (
                  <li key={n.id}>
                    <Link
                      to={`/s/${slug}/p/${n.id}`}
                      className="flex items-center gap-3 px-3 py-2.5 hover:bg-accent/50"
                    >
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <div className="truncate font-medium">{n.title}</div>
                        <div className="text-xs text-muted-foreground truncate font-mono lowercase">{n.slug}</div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
                    </Link>
                  </li>
                ))}
                {query && filtered.length === 0 && (
                  <li className="p-4 text-sm text-muted-foreground text-center">
                    Nenhuma página corresponde ao filtro.
                  </li>
                )}
              </ul>
            </section>
          </div>
        )}
      </Card>
    </div>
    </AppShell>
  );
}
