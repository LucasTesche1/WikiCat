import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Clock, Loader2, Search } from 'lucide-react';
import type { TaggedPage, TagWithPageCount } from '@wikicat/shared';
import { api, ApiError } from '../api/client.js';
import { Button } from '../components/ui/Button.js';
import { Input } from '../components/ui/Input.js';
import { Chip } from '../components/ui/Chip.jsx';
import { Card, CardContent } from '../components/ui/Card.js';

export default function SpaceTagListPage() {
  const { slug, tagName: tagParam } = useParams<{ slug: string; tagName?: string }>();
  const navigate = useNavigate();
  const tagName = decodeURIComponent(tagParam ?? '');

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pages, setPages] = useState<TaggedPage[]>([]);
  const [tags, setTags] = useState<TagWithPageCount[]>([]);
  const [tagFilter, setTagFilter] = useState(tagName);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (tagFilter) setTagFilter(tagName);
  }, [tagName, tagFilter]);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    setErr(null);
    const q = tagFilter ? api.spaces.tags.pages(slug, tagFilter) : Promise.resolve([]);
    Promise.all([
      api.spaces.tags.list(slug),
      q,
    ]).then(([all, list]) => {
      if (cancelled) return;
      setTags(all);
      setPages(list);
    }).catch((e: unknown) => {
      if (cancelled) return;
      setErr(e instanceof ApiError ? e.message : 'Erro ao carregar tags.');
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [slug, tagFilter]);

  const currentTag = useMemo(() => {
    if (!tagFilter) return null;
    return tags.find((t) => t.name.toLowerCase() === tagFilter.toLowerCase()) ?? null;
  }, [tags, tagFilter]);

  const filteredPages = useMemo(() => {
    if (!search.trim()) return pages;
    const q = search.trim().toLowerCase();
    return pages.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.tags.some((t) => t.name.toLowerCase().includes(q)) ||
        p.updatedByName.toLowerCase().includes(q),
    );
  }, [pages, search]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        <div className="flex items-center gap-2">
          <Link to={`/s/${slug}`}>
            <Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4" />Voltar ao espaço</Button>
          </Link>
          <h1 className="text-xl font-semibold ml-2">Tags do espaço</h1>
        </div>

        {err && (
          <Card className="border-red-500/30 bg-red-500/5">
            <CardContent className="pt-4 text-sm text-red-700 dark:text-red-300">{err}</CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-[260px_minmax(0,1fr)] gap-6">
          <aside className="space-y-4">
            <Card>
              <CardContent className="pt-4 space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Filtrar por tag
                </div>
                {loading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando…
                  </div>
                ) : tags.length === 0 ? (
                  <div className="text-xs text-muted-foreground italic py-2">
                    Nenhuma tag criada ainda. Adicione tags dentro de uma página.
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    <Chip
                      label="Todas"
                      color="#64748b"
                      size="sm"
                      className={!tagFilter ? 'ring-2 ring-offset-background ring-ring' : ''}
                      onClick={() => {
                        setTagFilter('');
                        navigate(`/s/${slug}/tags`);
                      }}
                    />
                    {tags.map((t) => {
                      const active = tagFilter && t.name.toLowerCase() === tagFilter.toLowerCase();
                      return (
                        <Chip
                          key={t.id}
                          label={t.name}
                          color={t.color}
                          size="sm"
                          className={active ? 'ring-2 ring-offset-background ring-ring' : ''}
                          onClick={() => {
                            setTagFilter(t.name);
                            navigate(`/s/${slug}/tag/${encodeURIComponent(t.name)}`);
                          }}
                        />
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </aside>

          <section className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              {currentTag ? (
                <div className="flex items-center gap-3">
                  <Chip label={currentTag.name} color={currentTag.color} size="md" />
                  <span className="text-sm text-muted-foreground">
                    {currentTag.pageCount} {currentTag.pageCount === 1 ? 'página' : 'páginas'}
                  </span>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Selecione uma tag ao lado, ou pesquise abaixo.
                </div>
              )}
              <div className="ml-auto relative w-full md:w-72">
                <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar nesta lista…"
                  className="pl-8"
                />
              </div>
            </div>

            {loading && !currentTag ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-12 justify-center">
                <Loader2 className="w-4 h-4 animate-spin" /> Carregando páginas…
              </div>
            ) : filteredPages.length === 0 ? (
              <Card>
                <CardContent className="pt-6 pb-8 text-center">
                  <div className="text-sm font-medium">
                    {currentTag ? 'Nenhuma página possui esta tag.' : 'Nenhuma página encontrada.'}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Abra qualquer página para adicionar ou remover tags.
                  </div>
                </CardContent>
              </Card>
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border bg-card text-card-foreground">
                {filteredPages.map((p) => (
                  <li key={p.id}>
                    <Link
                      to={`/s/${slug}/p/${p.id}`}
                      className="block px-4 py-3 hover:bg-accent/60 transition"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="font-medium truncate">{p.title}</div>
                          <div className="flex flex-wrap gap-1">
                            {p.tags.slice(0, 6).map((t) => (
                              <Chip
                                key={t.id}
                                label={t.name}
                                color={t.color}
                                size="sm"
                                onClick={(e) => {
                                  e.preventDefault();
                                  setTagFilter(t.name);
                                  navigate(`/s/${slug}/tag/${encodeURIComponent(t.name)}`);
                                }}
                              />
                            ))}
                            {p.tags.length > 6 && (
                              <span className="text-[10px] text-muted-foreground self-center px-1">
                                +{p.tags.length - 6}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="shrink-0 text-right text-xs text-muted-foreground space-y-0.5">
                          <div className="whitespace-nowrap flex items-center gap-1 justify-end">
                            <Clock className="w-3 h-3" />
                            {new Date(p.updatedAt as unknown as string).toLocaleString('pt-BR', {
                              day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                            })}
                          </div>
                          <div className="opacity-80 truncate max-w-[160px]" title={p.updatedByName}>
                            por {p.updatedByName}
                          </div>
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
