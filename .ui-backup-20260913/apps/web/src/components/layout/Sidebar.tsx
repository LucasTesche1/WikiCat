import { NavLink } from 'react-router-dom';
import type { SpaceSummary } from '@wikicat/shared';
import { Boxes, ChevronDown, ChevronRight, CircleDot, FileText, Gauge, GitBranch, Plus, ServerCog, Settings2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export function Sidebar({ spaces = [] }: { spaces?: SpaceSummary[] }) {
  return (
    <aside className="hidden w-[272px] shrink-0 flex-col border-r border-white/[0.07] bg-[#080c13] text-slate-300 md:flex">
      <div className="flex h-16 items-center gap-3 border-b border-white/[0.07] px-4">
        <div className="relative grid h-9 w-9 place-items-center rounded-lg border border-emerald-400/25 bg-emerald-400/10 text-emerald-300">
          <ServerCog className="h-5 w-5" /><span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-[#080c13] bg-emerald-400" />
        </div>
        <div className="min-w-0"><div className="text-sm font-semibold tracking-tight text-slate-100">WikiCat</div><div className="font-mono text-[9px] uppercase tracking-[0.2em] text-slate-500">Engineering Knowledge</div></div>
        <button type="button" className="ml-auto rounded p-1.5 text-slate-500 hover:bg-white/5 hover:text-slate-200" aria-label="Configurar workspace"><Settings2 className="h-4 w-4" /></button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <NavLink to="/" end className={({ isActive }) => cn('mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition', isActive ? 'bg-emerald-400/10 text-emerald-300 shadow-[inset_2px_0_0_#34d399]' : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-100')}>
          <Gauge className="h-4 w-4" /><span>Visão operacional</span><span className="ml-auto rounded bg-white/5 px-1.5 py-0.5 font-mono text-[9px]">⌘ 1</span>
        </NavLink>
        <NavLink to="/" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-400 hover:bg-white/[0.04] hover:text-slate-100"><CircleDot className="h-4 w-4" /><span>Atividade recente</span></NavLink>

        <div className="mb-2 mt-6 flex items-center px-3"><span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">Bases de conhecimento</span><button type="button" className="ml-auto rounded p-1 text-slate-500 hover:bg-white/5 hover:text-emerald-300" aria-label="Criar espaço"><Plus className="h-3.5 w-3.5" /></button></div>
        <ul className="space-y-1">
          {spaces.map((space, index) => (
            <li key={space.id}>
              <NavLink to={`/s/${space.slug}`} className={({ isActive }) => cn('group flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition', isActive ? 'bg-white/[0.07] text-slate-100' : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-100')}>
                {index === 0 ? <ChevronDown className="h-3.5 w-3.5 text-slate-600" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-600" />}
                <span className="grid h-6 w-6 place-items-center rounded-md border border-white/10 bg-white/[0.04] font-mono text-[10px] font-bold" style={{ color: space.color }}>{space.icon?.trim().slice(0, 2) || space.name.slice(0, 2).toUpperCase()}</span>
                <span className="min-w-0 flex-1 truncate">{space.name}</span><span className="font-mono text-[10px] text-slate-600">{space.pageCount}</span>
              </NavLink>
              {index === 0 && <div className="ml-[3.25rem] mt-1 space-y-1 border-l border-white/[0.07] pl-3">
                <span className="flex items-center gap-2 py-1.5 text-xs text-slate-500"><FileText className="h-3.5 w-3.5" /> Runbooks</span>
                <span className="flex items-center gap-2 py-1.5 text-xs text-slate-500"><GitBranch className="h-3.5 w-3.5" /> Arquitetura</span>
              </div>}
            </li>
          ))}
          {spaces.length === 0 && <li className="mx-1 rounded-lg border border-dashed border-white/10 p-4 text-center text-xs leading-5 text-slate-500">Os espaços autorizados aparecerão aqui.</li>}
        </ul>

        <div className="mb-2 mt-6 px-3 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">Ferramentas</div>
        <button type="button" className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-400 hover:bg-white/[0.04] hover:text-slate-100"><GitBranch className="h-4 w-4" /> Grafo de dependências</button>
        <button type="button" className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-400 hover:bg-white/[0.04] hover:text-slate-100"><Boxes className="h-4 w-4" /> Catálogo de serviços</button>
      </nav>

      <div className="border-t border-white/[0.07] p-3">
        <div className="rounded-lg border border-white/[0.07] bg-white/[0.025] p-3">
          <div className="mb-2 flex items-center justify-between text-xs"><span className="font-medium text-slate-300">Cobertura documental</span><span className="font-mono text-emerald-300">84%</span></div>
          <div className="h-1 overflow-hidden rounded-full bg-white/[0.08]"><div className="h-full w-[84%] bg-gradient-to-r from-emerald-400 to-indigo-400" /></div>
          <div className="mt-2 font-mono text-[9px] text-slate-600">21/25 serviços com owner</div>
        </div>
      </div>
    </aside>
  );
}
