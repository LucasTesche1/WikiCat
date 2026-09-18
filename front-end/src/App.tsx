import { lazy, Suspense, useEffect } from 'react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useThemeStore } from './store/useThemeStore';
import { Button } from './components/ui/Button';
import { WorkspaceLayout } from './components/layout/AppShell';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const SpaceHomePage = lazy(() => import('./pages/SpaceHomePage'));
const PageEditorPage = lazy(() => import('./pages/PageEditorPage'));
const SpaceTagListPage = lazy(() => import('./pages/SpaceTagListPage'));
const TemplateManagementPage = lazy(() => import('./pages/TemplateManagementPage'));

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
      <Suspense fallback={<div className="grid min-h-screen place-items-center bg-background"><div className="flex items-center gap-3 font-mono text-xs uppercase tracking-wider text-muted-foreground"><span className="h-2 w-2 animate-pulse rounded-full bg-primary" /> Loading workspace</div></div>}>
      <Routes>
        <Route path="/login" element={<Navigate to="/admin/login" replace />} />
        <Route path="/admin/login" element={<LoginPage />} />
        <Route element={<WorkspaceLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/s/:slug" element={<SpaceHomePage />} />
          <Route path="/s/:slug/tags" element={<SpaceTagListPage />} />
          <Route path="/s/:slug/tag/:tagName" element={<SpaceTagListPage />} />
          <Route path="/s/:slug/p/:id" element={<PageEditorPage />} />
        </Route>
        <Route element={<ProtectedRoute redirectTo="/" roles={['admin']} />}>
          <Route element={<WorkspaceLayout />}>
            <Route path="/admin" element={<Navigate to="/" replace />} />
            <Route path="/admin/templates" element={<TemplateManagementPage />} />
            <Route path="/admin/*" element={<Navigate to="/" replace />} />
          </Route>
        </Route>
        <Route path="*" element={
          <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 bg-background text-foreground">
            <div className="text-7xl font-bold text-muted-foreground/20 select-none">404</div>
            <h1 className="text-2xl font-semibold">Page not found</h1>
            <p className="text-sm text-muted-foreground max-w-md text-center">
              The requested URL does not exist or was moved. Check the address or return to the dashboard.
            </p>
            <div className="flex gap-2 pt-2">
              <Link to="/"><Button>Go to dashboard</Button></Link>
              <Link to="/login"><Button variant="outline">Go to sign in</Button></Link>
            </div>
          </div>
        } />
      </Routes>
      </Suspense>
    </>
  );
}
