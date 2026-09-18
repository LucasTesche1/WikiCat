import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowUpRight, FileText, FolderOpen, Pencil, Plus, Search, Tags, Trash2 } from 'lucide-react';
import type { DocumentTemplate, PageTreeNode } from '@wikicat/shared';
import { api } from '../api/client';
import { useAuthStore, hasRole } from '../store/useAuthStore';
import { useWorkspace } from '../components/layout/AppShell';
import { PageBranch } from '../components/layout/Sidebar';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogHeader, DialogFooter } from '../components/ui/Dialog';

function flatten(nodes: PageTreeNode[]): PageTreeNode[] {
  return nodes.flatMap(n => [n, ...flatten(n.children)]);
}

export default function SpaceHomePage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const workspace = useWorkspace();
  const space = workspace.spaces.find(s => s.slug === slug);

  const [tree, setTree] = useState<PageTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [query, setQuery] = useState('');

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [parent, setParent] = useState('');
  const [template, setTemplate] = useState('blank');
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [busy, setBusy] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', slug: '', description: '', icon: '' });
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState('');

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    setError('');
    api.spaces.tree(slug!, ac.signal)
      .then(setTree)
      .catch(e => { if (!ac.signal.aborted) setError(e.message); })
      .finally(() => { if (!ac.signal.aborted) setLoading(false); });
    return () => ac.abort();
  }, [slug, retry]);

  useEffect(() => {
    const ac = new AbortController();
    api.templates.list(ac.signal).then(rows => {
      if (!ac.signal.aborted) {
        setTemplates(rows);
        setTemplate(current => rows.length && !rows.some(t => t.key === current) ? rows[0]!.key : current);
      }
    }).catch(() => { /* keep page creation usable */ });
    return () => ac.abort();
  }, []);

  const pages = useMemo(() => flatten(tree), [tree]);
  const filtered = pages.filter(p => `${p.title} ${p.slug}`.toLowerCase().includes(query.toLowerCase()));

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const p = await api.pages.create(slug!, {
        title: title.trim(),
        parentPageId: parent.trim() || null,
        contentMarkdown: templates.find(t => t.key === template)?.contentMarkdown ?? '',
      });
      workspace.refresh();
      navigate(`/s/${slug}/p/${p.id}?view=edit`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Page creation failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleOpenEdit = () => {
    if (space) {
      setEditForm({ name: space.name, slug: space.slug, description: space.description ?? '', icon: space.icon ?? '' });
    }
    setEditError('');
    setEditOpen(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!space) return;
    setEditSubmitting(true);
    setEditError('');
    try {
      const updated = await api.spaces.update(space.id, {
        name: editForm.name.trim(),
        slug: editForm.slug.trim(),
        description: editForm.description.trim() || null,
        icon: editForm.icon.trim() || null,
      });
      workspace.refresh();
      setEditOpen(false);
      if (updated.slug !== slug) navigate(`/s/${updated.slug}`);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Space update failed.');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!space) return;
    setDeleteSubmitting(true);
    setDeleteError('');
    try {
      await api.spaces.delete(space.id);
      workspace.refresh();
      setDeleteOpen(false);
      navigate('/');
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Space deletion failed.');
    } finally {
      setDeleteSubmitting(false);
    }
  };

  return (
    <div className="space-y-7">
      <div className="eyebrow">SPACE / CONTENT</div>
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-7">
        <div>
          <span className="mb-4 grid h-12 w-12 place-items-center rounded-xl border border-border bg-card">
            {space?.icon ? <span className="text-2xl" role="img" aria-label="Space icon">{space.icon}</span> : <FolderOpen size={24} className="text-primary" />}
          </span>
          <h1 className="text-3xl font-semibold tracking-tight">{space?.name ?? slug}</h1>
          <p className="mt-3 max-w-xl text-base leading-7 text-muted-foreground">{space?.description || 'Operational notes, procedures, and references.'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline"><Link to={`/s/${slug}/tags`}><Tags size={16} />Tags</Link></Button>
          {hasRole(user, ['admin', 'editor']) && <Button onClick={() => setOpen(true)}><Plus size={16} />New page</Button>}
          {hasRole(user, ['admin']) && space && (
            <>
              <Button variant="outline" onClick={handleOpenEdit} aria-label="Edit space settings" className="transition-colors hover:border-primary/50"><Pencil size={16} />Edit</Button>
              <Button variant="outline" onClick={() => { setDeleteError(''); setDeleteOpen(true); }} aria-label="Delete space" className="border-destructive/30 text-destructive transition-colors hover:bg-destructive/10 hover:border-destructive/60"><Trash2 size={16} />Delete</Button>
            </>
          )}
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="font-mono text-sm text-muted-foreground">{pages.length} PAGES</p>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-3.5 text-muted-foreground" />
          <Input aria-label="Filter pages" value={query} onChange={e => setQuery(e.target.value)} placeholder="Filter by title" className="min-h-11 pl-9" />
        </div>
      </div>

      {error && !open && <div role="alert" className="rounded-lg border border-input p-4 text-sm">{error}<button className="ml-3 min-h-11 underline" onClick={() => setRetry(v => v + 1)}>Retry</button></div>}

      {loading ? (
        <p role="status" className="py-10 text-sm text-muted-foreground">Loading pages...</p>
      ) : !pages.length ? (
        <div className="technical-panel rounded-xl p-12 text-center">
          <FileText size={32} className="mx-auto text-primary" />
          <h2 className="mt-4 text-lg font-semibold">No pages in this space.</h2>
          <p className="mt-2 text-sm text-muted-foreground">Create the first page to start tracking operational context.</p>
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
          <section className="technical-panel rounded-xl p-4">
            <h2 className="eyebrow mb-4 px-3">STRUCTURE</h2>
            <PageBranch nodes={tree} slug={slug!} />
          </section>
          <section className="technical-panel overflow-hidden rounded-xl">
            <h2 className="border-b border-border px-5 py-4 font-semibold">{query ? 'Filter results' : 'All pages'}</h2>
            <ul className="divide-y divide-border">
              {filtered.map(p => (
                <li key={p.id}>
                  <Link className="flex items-center gap-4 px-5 py-5 transition-colors hover:bg-muted" to={`/s/${slug}/p/${p.id}`}>
                    <FileText size={19} className="shrink-0 text-primary" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{p.title}</span>
                      <span className="mt-1 block truncate font-mono text-xs text-muted-foreground">/{p.slug}</span>
                    </span>
                    {p.children.length > 0 && <span className="text-sm text-muted-foreground">{p.children.length} children</span>}
                    <ArrowUpRight size={16} />
                  </Link>
                </li>
              ))}
            </ul>
            {!filtered.length && <p className="p-8 text-sm text-muted-foreground">No page matches this filter.</p>}
          </section>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[calc(100%-2rem)]">
          <DialogTitle>New page</DialogTitle>
          <DialogDescription>Select the parent context and initial template.</DialogDescription>
          <form onSubmit={create} className="space-y-4">
            <label className="block text-sm">Title<Input required minLength={1} maxLength={255} value={title} onChange={e => setTitle(e.target.value)} className="mt-2" /></label>
            <label className="block text-sm">
              Parent page
              <select value={parent} onChange={e => setParent(e.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-input bg-card px-3">
                <option value="">Space root</option>
                {pages.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </label>
            <label className="block text-sm">
              Start with
              <select value={template} onChange={e => setTemplate(e.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-input bg-card px-3">
                {templates.map(t => <option key={t.id} value={t.key}>{t.title}</option>)}
              </select>
            </label>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" disabled={busy || !title.trim()}>{busy ? 'Creating...' : 'Create page'}</Button>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-lg">
          <form onSubmit={handleEdit}>
            <DialogHeader>
              <DialogTitle>Edit space</DialogTitle>
              <DialogDescription>Update this space metadata.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-5">
              <div>
                <Label htmlFor="edit-space-name">Space name</Label>
                <Input id="edit-space-name" required minLength={3} maxLength={50} value={editForm.name} onChange={e => {
                  const name = e.target.value;
                  setEditForm({ ...editForm, name, slug: name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') });
                }} className="mt-1" />
              </div>
              <div><Label htmlFor="edit-space-slug">URL slug</Label><Input id="edit-space-slug" required minLength={2} maxLength={120} value={editForm.slug} onChange={e => setEditForm({ ...editForm, slug: e.target.value })} className="mt-1" /></div>
              <div><Label htmlFor="edit-space-description">Description</Label><Input id="edit-space-description" maxLength={500} value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} placeholder="Purpose and operating context" className="mt-1" /></div>
              <div>
                <Label htmlFor="edit-space-icon">Space icon</Label>
                <Input id="edit-space-icon" value={editForm.icon} onChange={e => setEditForm({ ...editForm, icon: e.target.value.slice(0, 8) })} placeholder="Optional emoji" maxLength={8} className="mt-1" />
                <p className="mt-1 text-xs text-muted-foreground">Optional. Displayed in the header and sidebar.</p>
              </div>
              {editError && <p role="alert" className="text-sm text-destructive">{editError}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={editSubmitting || !editForm.name.trim() || !editForm.slug.trim()}>{editSubmitting ? 'Saving...' : 'Save changes'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-md">
          <DialogHeader>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive"><AlertTriangle size={20} /></div>
            <DialogTitle>Delete space?</DialogTitle>
            <DialogDescription>Delete <strong>{space?.name ?? slug}</strong> and remove its content from navigation.</DialogDescription>
          </DialogHeader>
          {deleteError && <p role="alert" className="mt-2 text-sm text-destructive">{deleteError}</p>}
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleteSubmitting}>Cancel</Button>
            <Button type="button" variant="destructive" onClick={handleDelete} disabled={deleteSubmitting}>{deleteSubmitting ? 'Deleting...' : 'Confirm deletion'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
