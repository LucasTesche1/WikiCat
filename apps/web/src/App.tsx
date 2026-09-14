import { lazy, Suspense, useEffect } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useThemeStore } from './store/useThemeStore';
import { Button } from './components/ui/Button';
import { WorkspaceLayout } from './components/layout/AppShell';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const SpaceHomePage = lazy(() => import('./pages/SpaceHomePage'));
const PageEditorPage = lazy(() => import('./pages/PageEditorPage'));
const SpaceTagListPage = lazy(() => import('./pages/SpaceTagListPage'));

function Bootstrap() {
  useEffect(() => {
    useThemeStore.getState().init();
  }, []);
  return null;
}

export default function App() {
  return (
    <>
      <Bootstrap />
      <Suspense fallback={<div className="grid min-h-screen place-items-center bg-background"><div className="flex items-center gap-3 font-mono text-xs uppercase tracking-wider text-muted-foreground"><span className="h-2 w-2 animate-pulse rounded-full bg-primary" /> Carregando workspace</div></div>}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<WorkspaceLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/s/:slug" element={<SpaceHomePage />} />
          <Route path="/s/:slug/tags" element={<SpaceTagListPage />} />
          <Route path="/s/:slug/tag/:tagName" element={<SpaceTagListPage />} />
          <Route path="/s/:slug/p/:id" element={<PageEditorPage />} />
          </Route>
        </Route>
        <Route path="*" element={
          <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 bg-background text-foreground">
            <div className="text-7xl font-bold text-muted-foreground/20 select-none">404</div>
            <h1 className="text-2xl font-semibold">Página não encontrada</h1>
            <p className="text-sm text-muted-foreground max-w-md text-center">
              A URL solicitada não existe ou foi movida. Verifique o endereço ou volte para a página inicial.
            </p>
            <div className="flex gap-2 pt-2">
              <Link to="/"><Button>Voltar para início</Button></Link>
              <Link to="/login"><Button variant="outline">Ir para login</Button></Link>
            </div>
          </div>
        } />
      </Routes>
      </Suspense>
    </>
  );
}
