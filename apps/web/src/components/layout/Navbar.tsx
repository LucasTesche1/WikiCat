import { useEffect, useRef, useState } from 'react';
import type { SpaceSummary } from '@wikicat/shared';
import { Menu, Monitor, Moon, Search, Sun } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useThemeStore } from '../../store/useThemeStore';
import { CommandPalette } from './CommandPalette';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '../ui/DropdownMenu';
import { ThemeCard } from '../ui/ThemeCard';
import { AccountCard } from '../ui/AccountCard';

export function Navbar({ spaces, onMenu }: { spaces: SpaceSummary[]; onMenu: () => void }) {
  const user = useAuthStore(s => s.user), logout = useAuthStore(s => s.logout);
  const { theme, setTheme } = useThemeStore();
  const [open, setOpen] = useState(false), search = useRef<HTMLButtonElement>(null), previous = useRef<HTMLElement | null>(null);
  const show = () => { previous.current = document.activeElement as HTMLElement; setOpen(true); };
  useEffect(() => { const key = (e: KeyboardEvent) => { if (!e.repeat && !e.isComposing && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); show(); } }; window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key); }, []);

  return (
    <>
      <header className="workspace-header">
        <button aria-label="Abrir navegação" onClick={onMenu} className="workspace-icon lg:hidden">
          <Menu size={20} />
        </button>
        <button
          ref={search}
          onClick={show}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-lg border border-input bg-card px-3 text-left text-sm text-muted-foreground transition-all duration-200 hover:border-primary/40 lg:max-w-[540px]"
        >
          <Search size={17} className="shrink-0" />
          <span className="flex-1 truncate">Buscar documentação…</span>
          <kbd className="hidden rounded border border-border px-2 py-1 font-mono text-xs sm:inline">Ctrl K</kbd>
        </button>
        <span className="ml-auto hidden font-mono text-xs text-muted-foreground xl:inline">
          SEU CONTEXTO, CONECTADO
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="workspace-icon transition-colors hover:bg-muted" aria-label={`Tema: ${theme}`}>
              {theme === 'dark' ? <Moon size={18} /> : theme === 'light' ? <Sun size={18} /> : <Monitor size={18} />}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="p-0 border-0 bg-transparent shadow-none">
            <ThemeCard currentTheme={theme} onThemeSelect={(t) => setTheme(t)} />
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex min-h-11 items-center rounded-lg px-1 transition-opacity hover:opacity-80" aria-label="Menu da conta">
              <span className="grid h-9 w-9 place-items-center rounded-full border border-input bg-muted text-sm font-semibold text-foreground shadow-sm">
                {user?.name?.slice(0, 2).toUpperCase()}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="p-0 border-0 bg-transparent shadow-none">
            <AccountCard user={user ?? null} onLogout={() => void logout()} />
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
      <CommandPalette
        open={open}
        onOpenChange={setOpen}
        spaces={spaces}
        returnFocus={() => (previous.current?.isConnected ? previous.current : search.current)?.focus()}
      />
    </>
  );
}

