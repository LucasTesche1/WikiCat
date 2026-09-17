import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Clock, Loader2, Search, Tag } from 'lucide-react';
import type { TaggedPage, TagWithPageCount } from '@wikicat/shared';
import { api, ApiError } from '../api/client.js';
import { Button } from '../components/ui/Button.js';
import { Input } from '../components/ui/Input.js';
import { Chip } from '../components/ui/Chip.jsx';
import { Card, CardContent } from '../components/ui/Card.js';

export default function SpaceTagListPage() {
  const { slug = '', tagName: tagParam } = useParams<{ slug: string; tagName?: string }>();
  const navigate = useNavigate();
  const tagFilter = tagParam ?? '';

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pages, setPages] = useState<TaggedPage[]>([]);
  const [tags, setTags] = useState<TagWithPageCount[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!slug) return;
    const ac = new AbortController();
    setLoading(true);
    setErr(null);
    const q = tagFilter ? api.spaces.tags.pages(slug, tagFilter) : Promise.resolve([]);
    Promise.all([api.spaces.tags.list(slug), q])
      .then(([all, list]) => {
        if (ac.signal.aborted) return;
        setTags(all);
        setPages(list);
      })
      .catch((e: unknown) => {
        if (ac.signal.aborted) return;
        setErr(e instanceof ApiError ? e.message : 'Failed to load tags.');
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => ac.abort();
  }, [slug, tagFilter]);

  const currentTag = useMemo(() => {
    if (!tagFilter) return null;
    return tags.find(t => t.name.toLowerCase() === tagFilter.toLowerCase()) ?? null;
  }, [tags, tagFilter]);

  const filteredPages = useMemo(() => {
    if (!search.trim()) return pages;
    const q = search.trim().toLowerCase();
    return pages.filter(
      p =>
        p.title.toLowerCase().includes(q) ||
        p.tags.some(t => t.name.toLowerCase().includes(q)) ||
        p.updatedByName.toLowerCase().includes(q),
    );
  }, [pages, search]);

  return (
    <div className="space-y-6 pb-12">
      <nav aria-label="Space navigation" className="flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to={`/s/${slug}`}><ArrowLeft className="h-4 w-4" />Back to space</Link>
        </Button>
      </nav>

      <header className="border-b border-border pb-6">
        <div className="mb-3 flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-primary">
          <Tag className="h-4 w-4" />
          Tags
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">Space tags</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          Filter pages by technology, process, owner, or operating context.
        </p>
      </header>

      {err && (
        <Card className="border-destructive/40 bg-destructive/10">
          <CardContent className="pt-4 text-sm text-destructive">{err}</CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <Card>
            <CardContent className="space-y-3 pt-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Filter</div>
              {loading && tags.length === 0 ? (
                <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading...
                </div>
              ) : tags.length === 0 ? (
                <div className="py-2 text-sm text-muted-foreground">No tags created yet.</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Chip label="All" color="#64748b" size="sm" className={!tagFilter ? 'ring-2 ring-ring' : ''} onClick={() => navigate(`/s/${slug}/tags`)} />
                  {tags.map(t => {
                    const active = tagFilter && t.name.toLowerCase() === tagFilter.toLowerCase();
                    return (
                      <Chip
                        key={t.id}
                        label={t.name}
                        color={t.color}
                        size="sm"
                        className={active ? 'ring-2 ring-ring' : ''}
                        onClick={() => navigate(`/s/${slug}/tag/${encodeURIComponent(t.name)}`)}
                      />
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </aside>

        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            {currentTag ? (
              <div className="flex items-center gap-3">
                <Chip label={currentTag.name} color={currentTag.color} size="md" />
                <span className="text-sm text-muted-foreground">
                  {currentTag.pageCount} {currentTag.pageCount === 1 ? 'page' : 'pages'}
                </span>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Select a tag to view associated pages.</div>
            )}
            <div className="relative ml-auto w-full md:w-80">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search this list..." className="pl-10" />
            </div>
          </div>

          {loading && !currentTag ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading pages...
            </div>
          ) : filteredPages.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <div className="text-sm font-medium">{currentTag ? 'No page has this tag.' : 'No page found.'}</div>
                <div className="mt-1 text-xs text-muted-foreground">Open a page to add or remove tags.</div>
              </CardContent>
            </Card>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border bg-card text-card-foreground">
              {filteredPages.map(p => (
                <li key={p.id}>
                  <div className="grid gap-3 px-4 py-3 transition hover:bg-accent/60 md:grid-cols-[minmax(0,1fr)_auto]">
                    <div className="min-w-0 space-y-2">
                      <Link to={`/s/${slug}/p/${p.id}`} className="inline-flex min-h-11 max-w-full items-center truncate font-medium underline-offset-4 hover:underline">
                        {p.title}
                      </Link>
                      <div className="flex flex-wrap gap-1.5">
                        {p.tags.slice(0, 6).map(t => (
                          <Chip key={t.id} label={t.name} color={t.color} size="sm" onClick={() => navigate(`/s/${slug}/tag/${encodeURIComponent(t.name)}`)} />
                        ))}
                        {p.tags.length > 6 && <span className="self-center px-1 text-xs text-muted-foreground">+{p.tags.length - 6}</span>}
                      </div>
                    </div>
                    <div className="shrink-0 space-y-1 text-sm text-muted-foreground md:text-right">
                      <div className="flex items-center gap-1 md:justify-end">
                        <Clock className="h-4 w-4" />
                        {new Date(p.updatedAt as unknown as string).toLocaleString('en-US', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                      <div className="truncate md:max-w-[180px]" title={p.updatedByName}>by {p.updatedByName}</div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
