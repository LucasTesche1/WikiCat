import React from 'react';
import { LogOut, ShieldCheck, User as UserIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from './Button';

export interface AccountCardProps extends React.HTMLAttributes<HTMLDivElement> {
  user: {
    name: string;
    role: string;
    email?: string;
  } | null;
  onLogout?: () => void;
}

export function AccountCard({ user, onLogout, className, ...props }: AccountCardProps) {
  if (!user) return null;

  const initials = user.name
    ? user.name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map(n => n[0])
        .join('')
        .toUpperCase()
    : 'U';

  return (
    <div
      role="region"
      aria-label="Informações da conta"
      className={cn(
        'w-72 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-soft-lg',
        'backdrop-blur-none transition-shadow',
        className,
      )}
      {...props}
    >
      <div className="flex items-center gap-3.5 border-b border-border pb-3.5">
        <div className="relative">
          <span className="grid h-11 w-11 place-items-center rounded-xl border border-border/80 bg-muted font-mono text-sm font-bold text-foreground shadow-sm">
            {initials}
          </span>
          <span
            className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-emerald-500"
            title="Sessão ativa"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{user.name}</p>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted/70 px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              <ShieldCheck size={11} className="text-primary" />
              {user.role}
            </span>
          </div>
        </div>
      </div>

      {user.email && (
        <div className="py-2.5 text-xs text-muted-foreground">
          <span className="block truncate font-mono">{user.email}</span>
        </div>
      )}

      <div className="pt-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onLogout}
          className="w-full justify-start gap-2 border-destructive/20 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive hover:border-destructive/40"
        >
          <LogOut size={14} />
          Sair da conta
        </Button>
      </div>
    </div>
  );
}
