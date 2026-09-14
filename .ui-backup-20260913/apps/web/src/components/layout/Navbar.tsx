import { useEffect, useState } from 'react';
import type { SpaceSummary } from '@wikicat/shared';
import { Bell, Moon, Search, Sun } from 'lucide-react';
import { Button } from '../ui/Button';
import { useAuthStore } from '../../store/useAuthStore';
import { useThemeStore } from '../../store/useThemeStore';
import { CommandPalette } from './CommandPalette';

export function Navbar({ spaces }: { spaces: SpaceSummary[] }) {
  const user = useAuthStore((state) => state.user);
  const { theme, toggleTheme } = useThemeStore();
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const initials = user?.name?.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'IT';

  return (
    <>
      <header className="relative z-20 flex h-16 shrink-0 items-center gap-4 border-b border-white/[0.07] bg-[#090d14]/90 px-4 text-slate-100 backdrop-blur-xl md:px-6">
        <button type="button" onClick={() => setPaletteOpen(true)}
          className="group flex h-10 w-full max-w-xl items-center gap-3 rounded-lg border border-white/10 bg-white/[0.035] px-3 text-left text-sm text-slate-500 transition hover:border-emerald-400/30 hover:bg-white/[0.055] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400">
          <Search className="h-4 w-4 text-slate-400 group-hover:text-emerald-400" />
          <span className="flex-1 truncate">Buscar docs ou perguntar à IA…</span>
          <kbd className="rounded border border-white/10 bg-black/30 px-2 py-1 font-mono text-[10px] text-slate-400">CTRL K</kbd>
        </button>
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/[0.06] px-3 py-1.5 text-xs text-emerald-300 xl:flex"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-status" />Todos os sistemas operacionais</div>
          <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Alternar tema">{theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}</Button>
          <Button variant="ghost" size="icon" aria-label="Notificações"><Bell className="h-4 w-4" /></Button>
          <button type="button" className="ml-1 flex items-center gap-2 rounded-lg p-1.5 hover:bg-white/5">
            <span className="grid h-8 w-8 place-items-center rounded-md bg-indigo-500 text-xs font-bold text-white">{initials}</span>
            <span className="hidden text-left lg:block"><span className="block max-w-32 truncate text-xs font-medium text-slate-200">{user?.name}</span><span className="block font-mono text-[9px] uppercase tracking-wider text-slate-500">{user?.role}</span></span>
          </button>
        </div>
      </header>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} spaces={spaces} />
    </>
  );
}
