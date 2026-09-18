import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { WorkspaceSearchItem } from '@wikicat/shared';
import { ArrowUpRight, Code2, FileText, FolderOpen, Layers, Plus, Search } from 'lucide-react';
import { api } from '../api/client';
import { useAuthStore } from '../store/useAuthStore';
import { useWorkspace } from '../components/layout/AppShell';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/Dialog';
import { SystemLogo } from '../components/ui/SystemLogo';

export default function DashboardPage() {
  const user = useAuthStore(s => s.user), { spaces, refresh } = useWorkspace();
  const [recent, setRecent] = useState<WorkspaceSearchItem[]>([]), [loading, setLoading] = useState(true), [recentError, setRecentError] = useState(false), [retry, setRetry] = useState(0);
  const [query, setQuery] = useState(''), [open, setOpen] = useState(false), [submitting, setSubmitting] = useState(false), [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', slug: '', description: '', icon: '' });

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    setRecentError(false);
    api.search('', undefined, ac.signal)
      .then(r => setRecent(r.results))
      .catch(() => { if (!ac.signal.aborted) setRecentError(true); })
      .finally(() => { if (!ac.signal.aborted) setLoading(false); });
    return () => ac.abort();
  }, [retry]);

  const filtered = useMemo(() => spaces.filter(s => `${s.name} ${s.description ?? ''}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())), [spaces, query]);
  const count = spaces.reduce((sum, s) => sum + s.pageCount, 0);
  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.spaces.create({ ...form, icon: form.icon.trim() || null, color: '#065f46' });
      refresh();
      setOpen(false);
      setForm({ name: '', slug: '', description: '', icon: '' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Space creation failed.');
    } finally {
      setSubmitting(false);
    }
  };
  const openSearch = () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));

  return <div className="space-y-8 pb-8">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="eyebrow flex items-center gap-2"><span className="h-2 w-2 rounded-sm bg-primary" />WORKSPACE / OVERVIEW</div>
      <span className="text-sm text-muted-foreground">{new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
    </div>

    <header className="rounded-xl border border-border bg-card p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-8">
        <div className="max-w-xl">
          <div className="mb-4 flex items-center gap-3">
            <SystemLogo className="h-12 w-12" />
            <div>
              <p className="font-mono text-xs uppercase tracking-[.16em] text-muted-foreground">Technical workspace</p>
              <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">WikiCat Tool Console</h1>
            </div>
          </div>
          <p className="max-w-lg text-sm leading-6 text-muted-foreground">
            Search, maintain, and publish operational documentation.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button onClick={openSearch}><Search size={17} />Search documents</Button>
            {user?.role === 'admin' && <Button variant="outline" onClick={() => setOpen(true)}><Plus size={17} />New space</Button>}
          </div>
        </div>
        <div className="grid min-w-[180px] grid-cols-2 gap-8 self-end border-t border-border pt-6 md:border-l md:border-t-0 md:pl-8 md:pt-0">
          <div><div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground"><FileText size={16} />Pages</div><p className="font-mono text-4xl tracking-tight">{count.toString().padStart(2, '0')}</p></div>
          <div><div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground"><Layers size={16} />Spaces</div><p className="font-mono text-4xl tracking-tight">{spaces.length.toString().padStart(2, '0')}</p></div>
        </div>
      </div>
    </header>

    <div className="workspace-grid"><div className="min-w-0 space-y-8"><section aria-labelledby="spaces-heading">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 id="spaces-heading" className="flex items-center gap-3 text-lg font-semibold"><FolderOpen size={19} className="text-primary" />Documentation spaces</h2>
        <div className="relative"><Search className="absolute left-3 top-3.5 text-muted-foreground" size={16} /><Input aria-label="Filter spaces" value={query} onChange={e => setQuery(e.target.value)} placeholder="Filter spaces" className="min-h-11 max-w-full pl-9" /></div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{filtered.map(space => <Link key={space.id} to={`/s/${space.slug}`} className="group technical-panel rounded-xl p-5 transition-colors hover:border-input"><div className="flex items-center justify-between"><span className="grid h-11 w-11 place-items-center rounded-lg border border-border bg-muted"><span className="font-mono text-sm font-semibold">{space.icon?.trim() || space.name.slice(0, 2).toUpperCase()}</span></span><ArrowUpRight size={18} className="text-muted-foreground group-hover:text-primary" /></div><h3 className="mt-5 text-base font-semibold">{space.name}</h3><p className="mt-2 line-clamp-2 min-h-12 text-sm leading-6 text-muted-foreground">{space.description || 'Operational notes, references, and procedures.'}</p><div className="mt-5 flex items-center justify-between border-t border-border pt-4 font-mono text-xs text-muted-foreground"><span>{space.pageCount} pages</span><span>/{space.slug}</span></div></Link>)}</div>
      {!filtered.length && <div className="rounded-xl border border-dashed border-input p-8 text-center text-sm text-muted-foreground">{query ? 'No spaces match this filter.' : 'No spaces yet. Create one to start.'}</div>}
    </section>

    <section aria-labelledby="recent-heading" className="technical-panel overflow-hidden rounded-xl"><header className="flex items-center justify-between border-b border-border px-5 py-4"><h2 id="recent-heading" className="font-semibold">Recently updated</h2><span className="font-mono text-xs text-muted-foreground">PAGES</span></header>{loading ? <p role="status" className="p-6 text-sm text-muted-foreground">Loading documents...</p> : recentError ? <div className="p-5 text-sm">Activity could not be loaded.<button className="ml-3 min-h-11 underline" onClick={() => setRetry(v => v + 1)}>Retry</button></div> : recent.length ? <ul className="divide-y divide-border">{recent.slice(0, 6).map(item => <li key={item.pageId}><Link className="flex min-h-20 items-center gap-4 px-5 py-4 hover:bg-muted" to={`/s/${item.spaceSlug}/p/${item.pageId}`}><FileText size={18} className="shrink-0 text-muted-foreground" /><div className="min-w-0 flex-1"><h3 className="truncate text-sm font-medium">{item.title}</h3><p className="mt-1 text-sm text-muted-foreground">{item.spaceName} / {item.updatedByName}</p></div><span className="hidden font-mono text-xs text-muted-foreground sm:block">{new Date(item.updatedAt).toLocaleDateString('en-US', { day: '2-digit', month: 'short' })}</span><ArrowUpRight size={16} className="shrink-0 text-muted-foreground" /></Link></li>)}</ul> : <p className="p-6 text-sm text-muted-foreground">Published pages will appear here.</p>}</section></div>

    <aside className="space-y-5">
      <div className="rounded-lg border border-border bg-muted/35 p-4 text-sm leading-6 text-muted-foreground">
        Press <kbd className="rounded border border-border bg-card px-1.5 py-0.5 font-mono text-xs text-foreground">Ctrl K</kbd> to search pages, jump to matching sections, and open the exact document context.
      </div>
      <section className="technical-panel rounded-xl p-5"><h2 className="mb-5 text-sm font-semibold">Content types</h2>{[[Code2, 'Runbooks', 'Procedures, validation, and rollback.'], [Layers, 'Architecture', 'Decisions and document relationships.'], [FileText, 'References', 'Commands, configuration, and attachments.']].map(([Icon, title, description]) => { const I = Icon as typeof Code2; return <div key={String(title)} className="mb-5 flex items-start gap-3 last:mb-0"><I size={17} className="mt-1 shrink-0 text-primary" /><div><h3 className="text-sm font-medium">{String(title)}</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">{String(description)}</p></div></div>; })}</section>
    </aside></div>

    <footer className="flex flex-wrap justify-between gap-2 border-t border-border pt-5 text-xs text-muted-foreground"><span>WikiCat / internal tool</span><span className="font-mono">SEARCH. EDIT. PUBLISH.</span></footer>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="w-[calc(100%-2rem)]"><form onSubmit={create}><DialogHeader><DialogTitle>New space</DialogTitle><DialogDescription>Create a documentation scope for a team, system, or domain.</DialogDescription></DialogHeader><div className="space-y-4 py-5"><div><Label htmlFor="space-name">Name</Label><Input id="space-name" required minLength={3} value={form.name} onChange={e => { const name = e.target.value; setForm({ ...form, name, slug: name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') }); }} /></div><div><Label htmlFor="space-slug">URL slug</Label><Input id="space-slug" required minLength={2} value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} /></div><div><Label htmlFor="space-description">Description</Label><Input id="space-description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div><div><Label htmlFor="space-icon">Space icon</Label><Input id="space-icon" value={form.icon} onChange={e => setForm({ ...form, icon: e.target.value.slice(0, 8) })} placeholder="EX: API" maxLength={8} /><p className="mt-1 text-xs text-muted-foreground">Optional. Displayed in cards and navigation.</p></div>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</div><DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={submitting}>{submitting ? 'Creating...' : 'Create space'}</Button></DialogFooter></form></DialogContent></Dialog>
  </div>;
}
