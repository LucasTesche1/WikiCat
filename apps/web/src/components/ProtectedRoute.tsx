import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { cn } from '../lib/utils';

export function ProtectedRoute() {
  const { isBootstrapped, isLoading, user, bootstrap } = useAuthStore();
  const location = useLocation();

  useEffect(() => {
    if (!isBootstrapped && !isLoading) {
      void bootstrap();
    }
  }, [isBootstrapped, isLoading, bootstrap]);

  if (!isBootstrapped || isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background text-foreground">
        <Loader2 className={cn('w-8 h-8 text-primary animate-spin')} />
        <p className="text-sm text-muted-foreground">Carregando WikiCat...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ redirectTo: `${location.pathname}${location.search}${location.hash}` }}
      />
    );
  }

  return <Outlet />;
}
