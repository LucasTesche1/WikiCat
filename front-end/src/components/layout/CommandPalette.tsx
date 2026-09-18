import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SpaceSummary, WorkspaceSearchItem } from '@wikicat/shared';
import { ArrowUpRight, FileText, Search } from 'lucide-react';
import { api } from '../../api/client';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../ui/Dialog';

export function CommandPalette({ open, onOpenChange, spaces, returnFocus }: { open: boolean; onOpenChange: (open: boolean) => void; spaces: SpaceSummary[]; returnFocus: () => void }) {
  const navigate = useNavigate(), id = useId();
  const [query, setQuery] = useState(''), [scope, setScope] = useState('');
  const [items, setItems] = useState<WorkspaceSearchItem[]>([]), [state, setState] = useState<'loading'|'ready'|'error'>('loading');
  const [selected, setSelected] = useState(0), [retry, setRetry] = useState(0), [more, setMore] = useState(false);
  const input = useRef<HTMLInputElement>(null), list = useRef<HTMLUListElement>(null);
  useEffect(() => { if (!open) { setQuery(''); setScope(''); setItems([]); } }, [open]);
  useEffect(() => {
    if (!open) return; const ac = new AbortController(); setState('loading'); setSelected(0);
    const timer = window.setTimeout(() => api.search(query, scope || undefined, ac.signal).then(data => { if (!ac.signal.aborted) { setItems(data.results); setMore(data.hasMore); setState('ready'); } }).catch(() => { if (!ac.signal.aborted) setState('error'); }), 180);
    return () => { ac.abort(); window.clearTimeout(timer); };
  }, [open, query, scope, retry]);
  useEffect(() => { list.current?.children[selected]?.scrollIntoView({ block: 'nearest' }); }, [selected]);
  const go = (item: WorkspaceSearchItem) => { onOpenChange(false); navigate(`/s/${encodeURIComponent(item.spaceSlug)}/p/${item.pageId}${item.anchor ? `#${encodeURIComponent(item.anchor)}` : ''}`); };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="palette-enter top-[8dvh] max-h-[84dvh] w-[calc(100%-2rem)] max-w-2xl translate-y-0 gap-0 overflow-y-auto p-0" onOpenAutoFocus={e => { e.preventDefault(); input.current?.focus(); }} onCloseAutoFocus={e => { e.preventDefault(); returnFocus(); }}>
    <div className="border-b border-border px-5 pb-4 pt-5"><DialogTitle className="pr-12 text-base">Search documents</DialogTitle><DialogDescription className="mt-2">Published pages and sections in one tool.</DialogDescription></div>
    <div className="flex items-center gap-3 border-b border-border px-5"><Search size={20} className="text-primary" /><label htmlFor={`${id}-input`} className="sr-only">Search term</label><input ref={input} id={`${id}-input`} role="combobox" aria-autocomplete="list" aria-expanded={true} aria-controls={`${id}-results`} aria-activedescendant={state === 'ready' && items[selected] ? `${id}-${selected}` : undefined} className="h-16 min-w-0 flex-1 bg-transparent text-base" placeholder="Command, procedure, or decision..." value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.nativeEvent.isComposing || state !== 'ready') return; if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (items.length) setSelected((selected + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length); } if (e.key === 'Enter' && items[selected]) { e.preventDefault(); go(items[selected]!); } }} /></div>
    <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3"><label className="text-sm" htmlFor={`${id}-scope`}>Space</label><select id={`${id}-scope`} value={scope} onChange={e => setScope(e.target.value)} className="min-h-11 max-w-full rounded-lg border border-input bg-card px-3 text-sm"><option value="">All spaces</option>{spaces.map(s => <option key={s.id} value={s.slug}>{s.name}</option>)}</select></div>
    <p role="status" className="px-5 pb-3 text-sm text-muted-foreground">{state === 'loading' ? 'Searching...' : state === 'error' ? 'Search failed.' : `${query ? items.length + ' results' : 'Recently updated'}${more ? ' / refine the query to narrow results' : ''}`}</p>
    {state === 'error' && <button className="mx-5 mb-4 min-h-11 rounded-lg border border-input px-4" onClick={() => setRetry(v => v + 1)}>Retry</button>}
    <ul ref={list} role="listbox" aria-label="Results" aria-busy={state === 'loading'} id={`${id}-results`} className="max-h-[42dvh] overflow-y-auto px-2 pb-2">{state === 'ready' && items.map((item,i) => <li key={item.pageId} id={`${id}-${i}`} role="option" aria-selected={selected === i} onMouseDown={e => e.preventDefault()} onPointerMove={() => setSelected(i)} onClick={() => go(item)} className={`flex cursor-pointer items-start gap-3 rounded-lg border-l-2 p-3 ${i === selected ? 'border-primary bg-muted' : 'border-transparent'}`}><FileText size={18} className="mt-1 shrink-0 text-primary" /><div className="min-w-0 flex-1"><p className="font-medium">{item.title}</p><p className="mt-1 font-mono text-xs text-muted-foreground">{item.spaceName}{item.sectionTitle ? ` / ${item.sectionTitle}` : ''}</p><p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{item.snippet}</p></div><ArrowUpRight size={16} className="mt-1 shrink-0" /></li>)}</ul>
    {state === 'ready' && !items.length && <p className="px-5 pb-8 text-sm">No pages found. Try another term or space.</p>}
    <div className="border-t border-border px-5 py-3 font-mono text-xs text-muted-foreground">Arrow keys select / Enter opens / Esc closes</div>
  </DialogContent></Dialog>;
}
