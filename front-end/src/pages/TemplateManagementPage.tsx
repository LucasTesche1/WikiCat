import { useEffect, useState } from 'react';
import type { DocumentTemplate } from '@wikicat/shared';
import { FileText, Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '../api/client';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/Dialog';

type Form = { title: string; description: string; contentMarkdown: string; key: string };
const empty: Form = { title: '', description: '', contentMarkdown: '', key: '' };

export default function TemplateManagementPage() {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [open, setOpen] = useState(false), [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<DocumentTemplate | null>(null), [form, setForm] = useState<Form>(empty);
  const load = () => {
    setLoading(true);
    setError('');
    api.templates.list().then(setTemplates).catch(e => setError(e instanceof Error ? e.message : 'Failed to load templates.')).finally(() => setLoading(false));
  };
  useEffect(load, []);
  const startCreate = () => { setEditing(null); setForm(empty); setOpen(true); };
  const startEdit = (t: DocumentTemplate) => { setEditing(t); setForm({ title: t.title, description: t.description ?? '', contentMarkdown: t.contentMarkdown, key: t.key }); setOpen(true); };
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const body = { title: form.title.trim(), description: form.description.trim() || null, contentMarkdown: form.contentMarkdown, key: form.key.trim() || undefined };
      if (editing) await api.templates.update(editing.id, body);
      else await api.templates.create(body);
      setOpen(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Template save failed.');
    } finally {
      setSaving(false);
    }
  };
  const remove = async (t: DocumentTemplate) => {
    if (!window.confirm(`Delete template "${t.title}"?`)) return;
    try {
      await api.templates.delete(t.id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Template deletion failed.');
    }
  };
  return <div className="space-y-6 pb-10">
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
      <div><div className="eyebrow">ADMIN / TEMPLATES</div><h1 className="mt-3 text-3xl font-semibold">Template management</h1><p className="mt-2 text-sm text-muted-foreground">Create, edit, and retire document templates.</p></div>
      <Button onClick={startCreate}><Plus size={16} />New template</Button>
    </header>
    {error && <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}
    {loading ? <p className="text-sm text-muted-foreground">Loading templates...</p> : <div className="grid gap-4 lg:grid-cols-2">
      {templates.map(t => <article key={t.id} className="technical-panel rounded-xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0"><div className="flex items-center gap-2 text-sm font-semibold"><FileText size={16} className="text-primary" />{t.title}</div><p className="mt-1 font-mono text-xs text-muted-foreground">{t.key}{t.isSystem ? ' / system' : ''}</p></div>
          <div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => startEdit(t)}><Pencil size={14} />Edit</Button><Button variant="outline" size="sm" disabled={t.isSystem} onClick={() => void remove(t)}><Trash2 size={14} />Delete</Button></div>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{t.description || 'No description.'}</p>
        <pre className="mt-4 max-h-40 overflow-auto rounded-lg border border-border bg-muted p-3 text-xs leading-5">{t.contentMarkdown || '(empty)'}</pre>
      </article>)}
    </div>}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="w-[calc(100%-2rem)] max-w-3xl"><form onSubmit={save}>
      <DialogHeader><DialogTitle>{editing ? 'Edit template' : 'New template'}</DialogTitle><DialogDescription>Template content is inserted when creating a new page.</DialogDescription></DialogHeader>
      <div className="space-y-4 py-5"><div><Label htmlFor="template-title">Title</Label><Input id="template-title" required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
      <div><Label htmlFor="template-key">Key</Label><Input id="template-key" value={form.key} onChange={e => setForm({ ...form, key: e.target.value })} placeholder="Generated from title when empty" /></div>
      <div><Label htmlFor="template-description">Description</Label><Input id="template-description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
      <div><Label htmlFor="template-content">Content</Label><textarea id="template-content" required value={form.contentMarkdown} onChange={e => setForm({ ...form, contentMarkdown: e.target.value })} className="mt-2 min-h-72 w-full rounded-lg border border-input bg-card p-3 font-mono text-sm leading-6" /></div></div>
      <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save template'}</Button></DialogFooter>
    </form></DialogContent></Dialog>
  </div>;
}
