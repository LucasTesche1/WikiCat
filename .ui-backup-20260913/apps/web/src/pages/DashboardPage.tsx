import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { SpaceSummary } from '@wikicat/shared';
import { Activity, ArrowUpRight, BookOpen, Boxes, CheckCircle2, ChevronRight, Clock3, FileText, GitCommitHorizontal, Loader2, Plus, Search, ServerCog, ShieldCheck, TriangleAlert } from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { api, ApiError } from '../api/client';
import { useAuthStore } from '../store/useAuthStore';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/Dialog';

export default function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const [spaces, setSpaces] = useState<SpaceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [openCreate, setOpenCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', slug: '', description: '', color: '#34d399', icon: '' });

  useEffect(() => {
    const controller = new AbortController();
    api.spaces.list(controller.signal).then(setSpaces).catch(() => setSpaces([])).finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return spaces;
    return spaces.filter((space) => [space.name, space.slug, space.description ?? ''].some((value) => value.toLowerCase().includes(term)));
  }, [spaces, query]);

  const totalPages = spaces.reduce((sum, space) => sum + space.pageCount, 0);
  const firstName = user?.name?.split(/\s+/)[0] ?? 'equipe';

  const setName = (name: string) => setForm((current) => ({ ...current, name, slug: name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') }));

  const createSpace = async (event: React.FormEvent) => {
    event.preventDefault();
    if (form.name.trim().length < 3 || form.slug.trim().length < 2) { setError('Informe um nome e uma URL válidos.'); return; }
    setSubmitting(true); setError(null);
    try {
      const created = await api.spaces.create({ name: form.name.trim(), slug: form.slug.trim(), description: form.description.trim() || null, color: form.color, icon: form.icon.trim() || null });
      setSpaces((current) => [{ ...created, pageCount: 0 }, ...current]);
      setOpenCreate(false); setForm({ name: '', slug: '', description: '', color: '#34d399', icon: '' });
    } catch (cause) { setError(cause instanceof ApiError ? cause.message : 'Não foi possível criar o espaço.'); }
    finally { setSubmitting(false); }
  };

  return (
    <AppShell spaces={spaces}>
      <div className="space-y-7 pb-10">
        <header className="flex flex-col gap-5 border-b border-border pb-7 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="eyebrow mb-2 flex items-center gap-2"><Activity className="h-3.5 w-3.5 text-emerald-500" /> Central de conhecimento</div>
            <h1 className="text-3xl font-semibold tracking-[-0.035em] md:text-4xl">Bom trabalho, {firstName}.</h1>
            <p className="mt-2 max-w-2xl text-[15px] leading-6 text-muted-foreground">Acompanhe a saúde da documentação, encontre runbooks e retome mudanças em andamento.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline"><GitCommitHorizontal className="h-4 w-4" /> Ver alterações</Button>
            {user?.role === 'admin' && <Button onClick={() => setOpenCreate(true)}><Plus className="h-4 w-4" /> Novo espaço</Button>}
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label="Resumo operacional">
          {[
            { label: 'Páginas publicadas', value: totalPages, note: 'em toda a organização', icon: FileText, tone: 'text-emerald-500' },
            { label: 'Bases ativas', value: spaces.length, note: 'todas acessíveis', icon: Boxes, tone: 'text-indigo-500' },
            { label: 'Cobertura de owners', value: '84%', note: '+6% nos últimos 30 dias', icon: ShieldCheck, tone: 'text-violet-500' },
            { label: 'Docs a revisar', value: '07', note: '2 ultrapassaram o SLA', icon: TriangleAlert, tone: 'text-amber-500' },
          ].map((metric) => <div key={metric.label} className="technical-panel rounded-xl p-5">
            <div className="mb-5 flex items-start justify-between"><span className="eyebrow">{metric.label}</span><metric.icon className={`h-4 w-4 ${metric.tone}`} /></div>
            <div className="metric-value">{metric.value}</div><div className="mt-1 text-xs text-muted-foreground">{metric.note}</div>
          </div>)}
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <section className="technical-panel overflow-hidden rounded-xl">
            <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
              <div><h2 className="text-base font-semibold">Bases de conhecimento</h2><p className="mt-1 text-xs text-muted-foreground">Documentação organizada por domínio e ownership.</p></div>
              <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filtrar bases…" className="h-9 w-64 pl-9" /></div>
            </div>
            <div className="divide-y divide-border">
              {loading ? Array.from({ length: 4 }).map((_, index) => <div key={index} className="flex animate-pulse items-center gap-4 p-4"><div className="h-10 w-10 rounded-lg bg-muted" /><div className="flex-1"><div className="h-3 w-40 rounded bg-muted" /><div className="mt-2 h-2 w-64 rounded bg-muted" /></div></div>) : filtered.length ? filtered.map((space) => (
                <Link key={space.id} to={`/s/${space.slug}`} className="group flex items-center gap-4 p-4 transition hover:bg-muted/50">
                  <span className="grid h-10 w-10 place-items-center rounded-lg border border-border bg-muted font-mono text-xs font-bold" style={{ color: space.color }}>{space.icon?.trim().slice(0, 2) || space.name.slice(0, 2).toUpperCase()}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{space.name}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{space.description || 'Sem descrição operacional.'}</span></span>
                  <span className="hidden items-center gap-5 sm:flex"><span className="font-mono text-xs text-muted-foreground">{space.pageCount} docs</span><span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" /> saudável</span></span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
                </Link>
              )) : <div className="p-10 text-center text-sm text-muted-foreground">Nenhuma base corresponde ao filtro.</div>}
            </div>
          </section>

          <aside className="space-y-6">
            <section className="technical-panel rounded-xl p-5">
              <div className="mb-5 flex items-center justify-between"><div><h2 className="text-base font-semibold">Fila de revisão</h2><p className="mt-1 text-xs text-muted-foreground">Prioridade calculada por impacto.</p></div><ArrowUpRight className="h-4 w-4 text-muted-foreground" /></div>
              <div className="space-y-4">
                {[['Rotação de secrets do CI','Plataforma','há 3 dias','P1'],['Disaster recovery · PostgreSQL','Dados','há 8 dias','P1'],['Provisionamento de VPN','IT Ops','há 12 dias','P2']].map(([title, team, time, priority]) => <div key={title} className="group cursor-pointer border-l-2 border-border pl-3 hover:border-emerald-400"><div className="flex items-start gap-2"><div className="flex-1 text-sm font-medium leading-5">{title}</div><span className={`rounded px-1.5 py-0.5 font-mono text-[9px] ${priority === 'P1' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-300' : 'bg-muted text-muted-foreground'}`}>{priority}</span></div><div className="mt-1 font-mono text-[10px] text-muted-foreground">{team} · {time}</div></div>)}
              </div>
              <Button variant="ghost" className="mt-4 w-full justify-between text-xs">Abrir fila completa <ChevronRight className="h-3.5 w-3.5" /></Button>
            </section>
            <section className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.055] p-5">
              <div className="flex items-start gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-400/10 text-emerald-500"><ServerCog className="h-4 w-4" /></span><div><div className="text-sm font-semibold">Índice sincronizado</div><div className="mt-1 text-xs leading-5 text-muted-foreground">Busca semântica atualizada há 2 min. 0 documentos com erro.</div></div></div>
            </section>
          </aside>
        </div>

        <section className="technical-panel rounded-xl p-5">
          <div className="mb-5 flex items-center justify-between"><div><h2 className="text-base font-semibold">Atividade recente</h2><p className="mt-1 text-xs text-muted-foreground">Mudanças relevantes nas áreas que você acompanha.</p></div><Button variant="ghost" size="sm">Ver histórico</Button></div>
          <div className="grid gap-3 lg:grid-cols-3">{[['Deploy seguro no Kubernetes','Marina S.','12 min','+18 −4'],['Matriz de escalonamento','Rafael A.','1 h','+7 −2'],['Política de retenção S3','Lucas T.','ontem','+23 −11']].map(([title, author, time, diff]) => <div key={title} className="rounded-lg border border-border bg-muted/20 p-4 hover:border-primary/30"><div className="flex items-center gap-2"><Clock3 className="h-3.5 w-3.5 text-muted-foreground" /><span className="font-mono text-[10px] text-muted-foreground">{time}</span><span className="ml-auto font-mono text-[10px] text-emerald-600 dark:text-emerald-400">{diff}</span></div><div className="mt-3 text-sm font-medium">{title}</div><div className="mt-1 text-xs text-muted-foreground">editado por {author}</div></div>)}</div>
        </section>
      </div>

      <Dialog open={openCreate} onOpenChange={setOpenCreate}><DialogContent className="sm:max-w-lg"><form onSubmit={createSpace}>
        <DialogHeader><DialogTitle>Criar base de conhecimento</DialogTitle><DialogDescription>Defina um domínio claro. Ownership e estrutura de páginas podem ser configurados depois.</DialogDescription></DialogHeader>
        <div className="space-y-4 py-5"><div className="space-y-2"><Label htmlFor="name">Nome</Label><Input id="name" autoFocus value={form.name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Plataforma & SRE" /></div><div className="space-y-2"><Label htmlFor="slug">URL</Label><Input id="slug" value={form.slug} onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))} placeholder="plataforma-sre" className="font-mono" /></div><div className="space-y-2"><Label htmlFor="description">Descrição</Label><Input id="description" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Escopo, owners e tipo de documentação" /></div>{error && <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}</div>
        <DialogFooter><Button type="button" variant="outline" onClick={() => setOpenCreate(false)}>Cancelar</Button><Button type="submit" disabled={submitting}>{submitting && <Loader2 className="h-4 w-4 animate-spin" />} Criar base</Button></DialogFooter>
      </form></DialogContent></Dialog>
    </AppShell>
  );
}
