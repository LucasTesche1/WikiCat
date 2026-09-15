import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import type { SpaceSummary } from '@wikicat/shared';
import { api } from '../../api/client';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../ui/Dialog';
const Context = createContext({ spaces: [] as SpaceSummary[], refresh: () => {}, focus: false, setFocus: (_: boolean) => {} });
export const useWorkspace = () => useContext(Context);
export function WorkspaceLayout() {
  const [spaces, setSpaces] = useState<SpaceSummary[]>([]), [revision, setRevision] = useState(0);
  const [error, setError] = useState(false), [drawer, setDrawer] = useState(false), [focus, setFocus] = useState(false);
  const location = useLocation();
  useEffect(() => {
    const ac = new AbortController(); setError(false);
    api.spaces.list(ac.signal).then(setSpaces).catch(() => { if (!ac.signal.aborted) setError(true); });
    return () => ac.abort();
  }, [revision]);
  useEffect(() => { setDrawer(false); setFocus(false); window.scrollTo(0, 0); }, [location.pathname]);
  return <Context.Provider value={{ spaces, refresh: () => setRevision(v => v + 1), focus, setFocus }}>
    <a href="#workspace-main" className="skip-link">Pular para o conteúdo</a>
    <div className={`workspace ${focus ? 'workspace-focus' : ''}`}>
      <aside className="workspace-nav"><Sidebar spaces={spaces} /></aside>
      <div className="workspace-work"><Navbar spaces={spaces} onMenu={() => setDrawer(true)} />
        <main id="workspace-main" tabIndex={-1} className="workspace-main">
          {error && <div role="alert" className="mb-4 rounded-lg border border-input p-4 text-sm">Não foi possível carregar os espaços. <button className="min-h-11 underline" onClick={() => setRevision(v => v + 1)}>Tentar novamente</button></div>}
          <div key={location.pathname} className="route-transition min-w-0">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
    <Dialog open={drawer} onOpenChange={setDrawer}><DialogContent className="left-0 top-0 h-[100dvh] w-[min(340px,100vw)] max-w-none translate-x-0 translate-y-0 gap-0 rounded-none p-0">
      <DialogTitle className="sr-only">Navegação do workspace</DialogTitle><DialogDescription className="sr-only">Espaços e páginas da documentação.</DialogDescription><Sidebar spaces={spaces} />
    </DialogContent></Dialog>
  </Context.Provider>;
}
export function AppShell({ children }: { children: ReactNode; spaces?: SpaceSummary[] }) { return <>{children}</>; }
