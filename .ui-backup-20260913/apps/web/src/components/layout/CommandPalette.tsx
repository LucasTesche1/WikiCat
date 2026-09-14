import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SpaceSummary } from '@wikicat/shared';
import { ArrowRight, Bot, Command, FilePlus2, FolderKanban, Search, Sparkles } from 'lucide-react';
import { Dialog, DialogContent } from '../ui/Dialog';

type Props = { open: boolean; onOpenChange: (open: boolean) => void; spaces: SpaceSummary[] };

export function CommandPalette({ open, onOpenChange, spaces }: Props) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [aiMode, setAiMode] = useState(false);

  useEffect(() => {
    if (!open) { setQuery(''); setAiMode(false); }
  }, [open]);

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return spaces.slice(0, 5);
    return spaces.filter((space) =>
      [space.name, space.slug, space.description ?? ''].some((value) => value.toLowerCase().includes(term)),
    ).slice(0, 6);
  }, [query, spaces]);

  const go = (path: string) => { navigate(path); onOpenChange(false); };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[12vh] translate-y-0 max-w-2xl overflow-hidden border-white/10 bg-[#0b1018]/96 p-0 text-slate-100 shadow-command backdrop-blur-2xl">
        <div className="flex items-center gap-3 border-b border-white/10 px-4">
          {aiMode ? <Bot className="h-5 w-5 text-violet-400" /> : <Search className="h-5 w-5 text-emerald-400" />}
          <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)}
            placeholder={aiMode ? 'Pergunte sobre sistemas, runbooks ou dependências…' : 'Buscar documentação, espaço ou executar ação…'}
            className="h-16 flex-1 bg-transparent text-[15px] outline-none placeholder:text-slate-500"
            onKeyDown={(event) => {
              if (event.key === 'Tab') { event.preventDefault(); setAiMode((value) => !value); }
              if (event.key === 'Enter' && !aiMode && results[0]) go(`/s/${results[0].slug}`);
            }} />
          <button type="button" onClick={() => setAiMode((value) => !value)}
            className="rounded-md border border-white/10 bg-white/5 px-2 py-1 font-mono text-[11px] text-slate-400 hover:border-violet-400/40 hover:text-violet-300">
            TAB · {aiMode ? 'BUSCA' : 'IA'}
          </button>
        </div>
        <div className="max-h-[430px] overflow-y-auto p-2">
          {aiMode ? (
            <div className="space-y-3 p-3">
              <div className="rounded-xl border border-violet-400/20 bg-violet-400/[0.06] p-4">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-violet-300"><Sparkles className="h-4 w-4" /> Resposta contextual</div>
                <p className="text-sm leading-6 text-slate-300">{query.trim() ? 'A consulta será resumida usando apenas o conteúdo interno autorizado. As fontes e os saltos exatos para cada seção aparecerão aqui.' : 'Faça uma pergunta operacional. A resposta preserva permissões, mostra as fontes e leva você direto à seção relevante.'}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-400"><span className="rounded-lg border border-white/10 p-3">“Como rotacionar o token do CI?”</span><span className="rounded-lg border border-white/10 p-3">“Quais serviços dependem do Redis?”</span></div>
            </div>
          ) : (
            <>
              <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{query ? 'Resultados' : 'Ir para'}</div>
              {results.map((space, index) => (
                <button key={space.id} type="button" onClick={() => go(`/s/${space.slug}`)} className="group flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left hover:bg-white/[0.06] focus:bg-white/[0.06] focus:outline-none">
                  <span className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/5 text-slate-300"><FolderKanban className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{space.name}</span><span className="block truncate font-mono text-[11px] text-slate-500">/s/{space.slug} · {space.pageCount} páginas</span></span>
                  {index === 0 && <span className="font-mono text-[10px] text-slate-600">ENTER</span>}<ArrowRight className="h-4 w-4 text-slate-600 group-hover:text-emerald-400" />
                </button>
              ))}
              {!query && <div className="mt-2 border-t border-white/10 pt-2">
                <button type="button" onClick={() => go('/')} className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm text-slate-300 hover:bg-white/[0.06]"><Command className="h-4 w-4 text-emerald-400" /> Abrir central de operações</button>
                <button type="button" onClick={() => onOpenChange(false)} className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm text-slate-300 hover:bg-white/[0.06]"><FilePlus2 className="h-4 w-4 text-indigo-400" /> Criar nova documentação</button>
              </div>}
            </>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-white/10 bg-black/20 px-4 py-2 font-mono text-[10px] text-slate-500"><span>↑↓ navegar · enter abrir · esc fechar</span><span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> índice sincronizado</span></div>
      </DialogContent>
    </Dialog>
  );
}
