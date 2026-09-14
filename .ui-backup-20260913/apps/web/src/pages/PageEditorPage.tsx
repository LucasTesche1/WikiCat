import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, ChevronRight, Clock, Eye, GitBranch, Loader2, PencilLine, Plus, Search, UploadCloud, X as CloseIcon,
} from 'lucide-react';
import type { Attachment, PageTagStub, PageTreeNode, PageWithRelations, TagWithPageCount } from '@wikicat/shared';
import { api, ApiError } from '../api/client.js';
import { useAuthStore, hasRole } from '../store/useAuthStore.js';
import { Button } from '../components/ui/Button.js';
import { Input } from '../components/ui/Input.js';
import { Card, CardContent } from '../components/ui/Card.js';
import { Chip } from '../components/ui/Chip.jsx';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../components/ui/Dialog.js';
import { TipTapEditor } from '../components/editor/TipTapEditor.jsx';
import { PageRenderer } from '../components/editor/PageRenderer.jsx';
import { cn } from '../lib/utils.js';

type SaveState = { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved'; at: Date } | { kind: 'error'; message: string };

function findAncestors(tree: PageTreeNode[], targetId: string, out: PageTreeNode[] = []): PageTreeNode[] | null {
  for (const n of tree) {
    const mine = [...out, n];
    if (n.id === targetId) return mine;
    if (n.children?.length) {
      const r = findAncestors(n.children, targetId, mine);
      if (r) return r;
    }
  }
  return null;
}

function formatHHMM(d: Date): string {
  const p = (n: number) => n.toString().padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function PageEditorPage() {
  const { slug, id } = useParams<{ slug: string; id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const canWrite = hasRole(user, ['editor', 'admin']);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [page, setPage] = useState<PageWithRelations | null>(null);
  const [tree, setTree] = useState<PageTreeNode[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const [title, setTitle] = useState('');
  const [markdown, setMarkdown] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [viewMode, setViewMode] = useState<'edit' | 'preview' | 'graph'>(canWrite ? 'edit' : 'preview');

  const [saveState, setSaveState] = useState<SaveState>({ kind: 'idle' });
  const [publishing, setPublishing] = useState(false);

  const [pageTags, setPageTags] = useState<PageTagStub[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [tagSuggestOpen, setTagSuggestOpen] = useState(false);
  const [tagSuggest, setTagSuggest] = useState<TagWithPageCount[]>([]);
  const [tagSuggestLoading, setTagSuggestLoading] = useState(false);
  const tagDebounce = useRef<number | null>(null);
  const tagInputRef = useRef<HTMLInputElement | null>(null);

  const [largeOpen, setLargeOpen] = useState(false);
  const [largeFile, setLargeFile] = useState<File | null>(null);
  const [largeProgress, setLargeProgress] = useState<number | null>(null);
  const [largeError, setLargeError] = useState<string | null>(null);
  const largeAbort = useRef<AbortController | null>(null);

  const debounceRef = useRef<number | null>(null);

  const loadAll = useCallback(() => {
    if (!slug || !id) return;
    let cancelled = false;
    setLoading(true);
    setErr(null);
    Promise.all([
      api.pages.get(id),
      api.spaces.tree(slug),
      api.pages.attachments(id),
    ]).then(([p, t, a]) => {
      if (cancelled) return;
      setPage(p);
      setTree(t);
      setAttachments(a);
      setPageTags(p.tags ?? []);
      setTitle(p.title);
      setMarkdown(p.isDraft ? (p.draftMarkdown ?? p.contentMarkdown ?? '') : (p.contentMarkdown ?? ''));
      setIsDirty(false);
      setSaveState({ kind: 'idle' });
    }).catch((e: unknown) => {
      if (cancelled) return;
      setErr(e instanceof ApiError ? e.message : 'Falha ao carregar página.');
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [slug, id]);

  useEffect(() => { loadAll?.(); }, [loadAll]);

  const ancestors = useMemo(() => {
    if (!page) return [];
    return findAncestors(tree, page.id) ?? [];
  }, [tree, page]);

  const saveDraft = useCallback(async (force = false) => {
    if (!page || !canWrite) return;
    if (!force && !isDirty) return;
    setSaveState({ kind: 'saving' });
    try {
      const body: Parameters<typeof api.pages.update>[1] = {
        draftMarkdown: markdown,
        isDraft: true,
      };
      if (title !== page.title) body.title = title;
      const updated = await api.pages.update(page.id, body);
      setPage((prev) => prev ? { ...prev, draftMarkdown: updated.draftMarkdown, isDraft: updated.isDraft, title: updated.title } : prev);
      setIsDirty(false);
      setSaveState({ kind: 'saved', at: new Date() });
    } catch (e: unknown) {
      const msg = e instanceof ApiError ? e.message : 'Erro ao salvar rascunho.';
      setSaveState({ kind: 'error', message: msg });
    }
  }, [page, canWrite, isDirty, markdown, title]);

  useEffect(() => {
    if (!canWrite) return;
    if (!isDirty) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = null;
      void saveDraft(false);
    }, 3000);
    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [markdown, title, isDirty, canWrite, saveDraft]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty || saveState.kind === 'saving') {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty, saveState]);

  useEffect(() => {
    if (!canWrite || !slug) return;
    const q = tagInput.trim();
    if (tagDebounce.current) window.clearTimeout(tagDebounce.current);
    if (!q) {
      setTagSuggest([]);
      setTagSuggestOpen(false);
      return;
    }
    setTagSuggestLoading(true);
    setTagSuggestOpen(true);
    tagDebounce.current = window.setTimeout(async () => {
      try {
        const list = await api.spaces.tags.list(slug, q);
        const existingNames = new Set(pageTags.map((t) => t.name.toLowerCase()));
        setTagSuggest(list.filter((t) => !existingNames.has(t.name.toLowerCase())).slice(0, 6));
      } catch {
        setTagSuggest([]);
      } finally {
        setTagSuggestLoading(false);
      }
    }, 180);
    return () => {
      if (tagDebounce.current) window.clearTimeout(tagDebounce.current);
    };
  }, [tagInput, canWrite, slug, pageTags]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!tagInputRef.current) return;
      const t = e.target as Node;
      if (!tagInputRef.current.contains(t)) setTagSuggestOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const addTagByName = useCallback(async (raw: string) => {
    if (!page || !canWrite) return;
    const name = raw.trim().replace(/\s+/g, ' ');
    if (!name) return;
    if (name.length < 2 || name.length > 64) {
      setErr('Tag inválida: use 2-64 caracteres (letras, números, espaço, - e _).');
      return;
    }
    const lower = name.toLowerCase();
    if (pageTags.some((t) => t.name.toLowerCase() === lower)) return;
    try {
      const added = await api.pages.tags.add(page.id, { name });
      setPageTags((prev) => [...prev, added].sort((a, b) => a.name.localeCompare(b.name)));
      setTagInput('');
      setTagSuggestOpen(false);
    } catch (e: unknown) {
      setErr(e instanceof ApiError ? e.message : 'Erro ao adicionar tag.');
    }
  }, [page, canWrite, pageTags]);

  const removeTag = useCallback(async (name: string) => {
    if (!page || !canWrite) return;
    try {
      await api.pages.tags.remove(page.id, name);
      setPageTags((prev) => prev.filter((t) => t.name !== name));
    } catch (e: unknown) {
      setErr(e instanceof ApiError ? e.message : 'Erro ao remover tag.');
    }
  }, [page, canWrite]);

  const onMarkdownChange = (v: string) => {
    setMarkdown(v);
    setIsDirty(true);
  };

  const onTitleChange = (v: string) => {
    setTitle(v);
    setIsDirty(true);
  };

  const publish = async () => {
    if (!page || !canWrite) return;
    setPublishing(true);
    try {
      await saveDraft(true);
      await api.pages.update(page.id, {
        contentMarkdown: markdown,
        draftMarkdown: markdown,
        isDraft: false,
        ...(title !== page.title ? { title } : {}),
      });
      await loadAll?.();
    } catch (e: unknown) {
      setErr(e instanceof ApiError ? e.message : 'Erro ao publicar.');
    } finally {
      setPublishing(false);
    }
  };

  const handleStandard = async (file: File) => {
    if (!page || !canWrite) return;
    try {
      const att = await api.attachments.uploadStandard(page.id, file);
      setAttachments((prev) => [...prev, att]);
    } catch (e: unknown) {
      setErr(e instanceof ApiError ? e.message : 'Erro ao anexar arquivo.');
    }
  };

  const startLarge = () => {
    setLargeFile(null);
    setLargeProgress(null);
    setLargeError(null);
    setLargeOpen(true);
  };

  const submitLarge = async () => {
    if (!page || !canWrite || !largeFile) return;
    const ac = new AbortController();
    largeAbort.current = ac;
    setLargeProgress(0);
    setLargeError(null);
    try {
      const att = await api.attachments.uploadLarge(page.id, largeFile, ac.signal);
      setAttachments((prev) => [...prev, att]);
      setLargeProgress(100);
      setTimeout(() => {
        setLargeOpen(false);
        setLargeFile(null);
        setLargeProgress(null);
      }, 600);
    } catch (e: unknown) {
      if ((e as { name?: string }).name === 'AbortError') {
        setLargeError('Upload cancelado.');
      } else {
        setLargeError(e instanceof ApiError ? e.message : 'Erro ao enviar arquivo grande.');
      }
      setLargeProgress(null);
    } finally {
      largeAbort.current = null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (err && !page) {
    return (
      <div className="min-h-screen p-8 max-w-xl mx-auto">
        <Card>
          <CardContent className="pt-6 space-y-4">
            <h2 className="text-xl font-semibold">Não foi possível carregar a página</h2>
            <p className="text-sm text-muted-foreground">{err}</p>
            <div className="flex gap-2">
              <Link to={`/s/${slug}`}><Button variant="outline" size="sm"><ArrowLeft className="w-4 h-4" />Voltar ao espaço</Button></Link>
              <Button size="sm" onClick={() => loadAll?.()}>Tentar novamente</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="fixed inset-x-0 top-0 z-30 h-0.5 bg-gradient-to-r from-emerald-400 via-indigo-400 to-violet-400" />
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1500px] items-center gap-3 px-4 py-3 md:px-6">
          <Link to={`/s/${slug}`} className="shrink-0">
            <Button variant="ghost" size="sm" title="Voltar ao espaço">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>

          <nav className="min-w-0 flex items-center flex-wrap gap-1 font-mono text-xs">
            <Link
              to={`/s/${slug}`}
              className="text-muted-foreground hover:text-foreground transition truncate max-w-[180px]"
            >
              {slug}
            </Link>
            {ancestors.map((a, i) => (
              <span key={a.id} className="flex items-center gap-1">
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <Link
                  to={`/s/${slug}/p/${a.id}`}
                  className={cn(
                    'truncate max-w-[200px] transition',
                    i === ancestors.length - 1 ? 'font-medium text-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {a.title}
                </Link>
              </span>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {canWrite && (
              <>
                <div className="flex items-center gap-2 min-w-[160px] justify-end">
                  {saveState.kind === 'saving' && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Salvando rascunho…
                    </span>
                  )}
                  {saveState.kind === 'saved' && (
                    <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      Rascunho salvo {formatHHMM(saveState.at)}
                    </span>
                  )}
                  {saveState.kind === 'error' && (
                    <span className="text-xs text-red-600 dark:text-red-400 max-w-[220px] truncate" title={saveState.message}>
                      Erro: {saveState.message}
                    </span>
                  )}
                  {page?.isDraft && (
                    <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                      Rascunho
                    </span>
                  )}
                </div>

                <div className="flex items-center rounded-lg border border-border bg-muted/40 p-1">
                  <button type="button" onClick={() => setViewMode('preview')} className={cn('flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs', viewMode === 'preview' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}><Eye className="h-3.5 w-3.5" /> Ler</button>
                  <button type="button" onClick={() => setViewMode('graph')} className={cn('flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs', viewMode === 'graph' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}><GitBranch className="h-3.5 w-3.5" /> Grafo</button>
                  <button type="button" onClick={() => setViewMode('edit')} className={cn('flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs', viewMode === 'edit' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}><PencilLine className="h-3.5 w-3.5" /> Editar</button>
                </div>
                <Button
                  size="sm"
                  onClick={() => void saveDraft(true)}
                  disabled={saveState.kind === 'saving'}
                >
                  {saveState.kind === 'saving' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Salvar
                </Button>
                <Button size="sm" onClick={publish} disabled={publishing}>
                  {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Publicar
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] space-y-7 px-4 py-7 md:px-8">
        {err && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/5 text-red-700 dark:text-red-300 px-4 py-3 text-sm">
            {err}
          </div>
        )}

        <div className="mx-auto max-w-[1180px] space-y-3">
          <div className="eyebrow flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-status" /> RUNBOOK · PRODUÇÃO · REV. {page?.isDraft ? 'RASCUNHO' : 'PUBLICADA'}</div>
          <Input
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            readOnly={!canWrite || viewMode !== 'edit'}
            placeholder="Título da página"
            className={cn(
              '!h-auto !border-0 !bg-transparent !px-0 !py-1 !text-4xl !font-semibold !tracking-[-0.04em] shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 md:!text-5xl',
              (!canWrite || viewMode !== 'edit') && 'cursor-default',
            )}
          />
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 min-h-[32px]">
              {pageTags.length === 0 && !canWrite ? (
                <span className="text-xs text-muted-foreground italic">Sem tags.</span>
              ) : null}
              {pageTags.map((t) => (
                <Chip
                  key={t.id}
                  label={t.name}
                  color={t.color}
                  size="sm"
                  onClick={() => slug && navigate(`/s/${slug}/tag/${encodeURIComponent(t.name)}`)}
                  onRemove={canWrite && viewMode === 'edit' ? () => void removeTag(t.name) : undefined}
                />
              ))}
              {canWrite && viewMode === 'edit' ? (
                <div className="relative" ref={tagInputRef}>
                  <div className="flex items-center max-w-[260px] rounded-full border border-border bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1">
                    <Search className="w-3.5 h-3.5 ml-2 text-muted-foreground shrink-0" />
                    <Input
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onFocus={() => { if (tagInput.trim()) setTagSuggestOpen(true); }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void addTagByName(tagInput);
                        } else if (e.key === 'Escape') {
                          setTagSuggestOpen(false);
                          (e.target as HTMLInputElement).blur();
                        }
                      }}
                      placeholder="Adicionar tag…"
                      className="!border-0 !px-2 !py-1 !h-8 !text-xs shadow-none !rounded-full bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                    <button
                      type="button"
                      title="Adicionar"
                      className="shrink-0 rounded-full p-1 mr-1 text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-40"
                      disabled={!tagInput.trim() || tagInput.length < 2}
                      onClick={() => void addTagByName(tagInput)}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {tagSuggestOpen && (
                    <div className="absolute left-0 top-full mt-1 z-30 w-[260px] max-h-72 overflow-auto rounded-lg border border-border bg-background shadow-lg py-1">
                      {tagSuggestLoading ? (
                        <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                          <Loader2 className="w-3 h-3 animate-spin" /> Buscando…
                        </div>
                      ) : tagSuggest.length === 0 ? (
                        tagInput.trim().length >= 2 ? (
                          <button
                            type="button"
                            className="w-full text-left px-3 py-2 hover:bg-accent flex items-center gap-2 text-sm"
                            onClick={() => void addTagByName(tagInput)}
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Criar tag “{tagInput.trim().slice(0, 32)}”
                          </button>
                        ) : (
                          <div className="px-3 py-2 text-xs text-muted-foreground italic">
                            Digite para buscar ou criar.
                          </div>
                        )
                      ) : (
                        <>
                          {tagSuggest.map((t) => (
                            <button
                              type="button"
                              key={t.id}
                              className="w-full text-left px-3 py-1.5 hover:bg-accent flex items-center justify-between gap-2"
                              onClick={() => void addTagByName(t.name)}
                            >
                              <Chip label={t.name} color={t.color} size="sm" />
                              <span className="text-[10px] text-muted-foreground">
                                {t.pageCount} {t.pageCount === 1 ? 'página' : 'páginas'}
                              </span>
                            </button>
                          ))}
                          {tagInput.trim().length >= 2 &&
                            !tagSuggest.some(
                              (s) => s.name.toLowerCase() === tagInput.trim().toLowerCase(),
                            ) && (
                              <div className="my-1 mx-3 border-t border-border" />
                            )}
                          {tagInput.trim().length >= 2 &&
                            !tagSuggest.some(
                              (s) => s.name.toLowerCase() === tagInput.trim().toLowerCase(),
                            ) && (
                              <button
                                type="button"
                                className="w-full text-left px-3 py-1.5 hover:bg-accent flex items-center gap-2 text-sm"
                                onClick={() => void addTagByName(tagInput)}
                              >
                                <Plus className="w-3.5 h-3.5" />
                                Criar nova tag “{tagInput.trim().slice(0, 28)}”
                              </button>
                            )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-3">
            <span>Atualizado por {page?.updatedByUser.name ?? '—'}</span>
            <span>·</span>
            <span>{page?.updatedAt ? new Date(page.updatedAt as unknown as string).toLocaleString('pt-BR') : '—'}</span>
            {page?.createdByUser?.name && (
              <>
                <span>·</span>
                <span>Criado por {page.createdByUser.name}</span>
              </>
            )}
          </div>
        </div>

        {!canWrite || viewMode === 'preview' ? (
          <PageRenderer
            markdown={markdown}
            attachments={attachments}
          />
        ) : viewMode === 'graph' ? (
          <section className="technical-panel relative min-h-[560px] overflow-hidden rounded-xl bg-[#080c13] p-6 text-slate-200">
            <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'linear-gradient(rgba(148,163,184,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,.12) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
            <div className="relative flex items-start justify-between"><div><div className="font-mono text-[10px] uppercase tracking-[.18em] text-indigo-300">Mapa de contexto</div><h2 className="mt-2 text-xl font-semibold">Dependências desta documentação</h2></div><span className="rounded-full border border-emerald-400/20 bg-emerald-400/[.07] px-3 py-1 font-mono text-[10px] text-emerald-300">{ancestors.length + attachments.length + 3} NÓS</span></div>
            <div className="relative mt-20 flex flex-wrap items-center justify-center gap-5">
              <div className="rounded-xl border border-white/10 bg-white/[.04] p-4 text-center"><div className="font-mono text-[9px] uppercase text-slate-500">Espaço</div><div className="mt-1 text-sm font-semibold">{slug}</div></div><span className="text-emerald-400">→</span>
              <div className="min-w-64 rounded-xl border border-emerald-400/35 bg-emerald-400/[.09] p-5 shadow-[0_0_40px_-18px_#34d399]"><div className="font-mono text-[9px] uppercase text-emerald-300">Documento atual</div><div className="mt-2 text-base font-semibold">{title}</div><div className="mt-3 flex gap-2">{pageTags.slice(0, 3).map((tag) => <span key={tag.id} className="rounded bg-black/20 px-2 py-1 font-mono text-[9px] text-slate-400">{tag.name}</span>)}</div></div><span className="text-indigo-400">→</span>
              <div className="space-y-3"><div className="rounded-xl border border-indigo-400/25 bg-indigo-400/[.08] p-4"><div className="font-mono text-[9px] uppercase text-indigo-300">Owner</div><div className="mt-1 text-sm">{page?.updatedByUser.name}</div></div><div className="rounded-xl border border-white/10 bg-white/[.04] p-4"><div className="font-mono text-[9px] uppercase text-slate-500">Artefatos</div><div className="mt-1 text-sm">{attachments.length} anexos</div></div></div>
            </div>
            <div className="relative mx-auto mt-20 max-w-2xl rounded-lg border border-white/10 bg-black/20 p-4 font-mono text-[11px] leading-6 text-slate-400"><span className="text-violet-300">insight:</span> links internos, serviços citados e owners formam o grafo automaticamente. Selecione um nó para filtrar dependências de entrada e saída.</div>
          </section>
        ) : (
          <div className="space-y-6">
            <TipTapEditor
              value={markdown}
              onChange={onMarkdownChange}
              editable={canWrite}
              onAddAttachmentStandard={handleStandard}
              onAddAttachmentLarge={startLarge}
            />

            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Anexos ({attachments.length})
                </h3>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={startLarge}>
                    <UploadCloud className="w-4 h-4" />
                    Anexo grande…
                  </Button>
                </div>
              </div>
              <PageRenderer markdown="" attachments={attachments} className="[&_article]:!mt-0 [&_h3]:!hidden" />
            </section>
          </div>
        )}
      </main>

      <Dialog open={largeOpen} onOpenChange={setLargeOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Enviar anexo grande</DialogTitle>
            <DialogDescription>
              Utilize esta modal para arquivos acima de 20MB (ISOs, dumps SQL, imagens VM, tarballs, pacotes .rpm/.deb).
              Tamanho máximo padrão: <strong>2 GB</strong>. Tipos permitidos: .iso, .tar, .tar.gz, .tgz, .zip, .sql, .ova, .img, .qcow2, .rpm, .deb, .pkg.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Arquivo</label>
              <Input
                type="file"
                disabled={largeProgress !== null}
                onChange={(e) => setLargeFile(e.target.files?.[0] ?? null)}
              />
              {largeFile && (
                <div className="text-xs text-muted-foreground mt-1.5 font-mono">
                  {largeFile.name} · {new Intl.NumberFormat('pt-BR').format(Math.ceil(largeFile.size / (1024 * 1024)))} MB
                </div>
              )}
            </div>

            {largeProgress !== null && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Enviando…</span>
                  <span>{Math.round(largeProgress)}%</span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-200"
                    style={{ width: `${Math.min(100, Math.max(largeProgress, 2))}%` }}
                  />
                </div>
              </div>
            )}

            {largeError && (
              <div className="text-sm text-red-600 dark:text-red-400 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2">
                {largeError}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                largeAbort.current?.abort();
                setLargeOpen(false);
              }}
            >
              {largeProgress !== null ? 'Cancelar' : 'Fechar'}
            </Button>
            <Button
              onClick={() => void submitLarge()}
              disabled={!largeFile || largeProgress !== null}
            >
              {largeProgress !== null ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Enviando</>
              ) : (
                <><UploadCloud className="w-4 h-4" />Enviar</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
