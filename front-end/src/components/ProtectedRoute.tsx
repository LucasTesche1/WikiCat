import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { hasRole, useAuthStore } from '../store/useAuthStore';
import type { UserRole } from '@wikicat/shared';
import { cn } from '../lib/utils';

export function ProtectedRoute({ redirectTo = '/', roles }: { redirectTo?: string; roles?: UserRole[] }) {
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
        <p className="text-sm text-muted-foreground">Loading WikiCat...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <Navigate
        to={redirectTo}
        replace
        state={{ redirectTo: `${location.pathname}${location.search}${location.hash}` }}
      />
    );
  }

  if (roles && !hasRole(user, roles)) {
    return <Navigate to={redirectTo} replace />;
  }

  return <Outlet />;
}
