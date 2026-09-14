import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BookOpen, Code2, GitBranch, ServerCog } from 'lucide-react';
import { LoginForm } from '../components/auth/LoginForm';
import { useAuthStore } from '../store/useAuthStore';

export default function LoginPage() {
  const user = useAuthStore((state) => state.user);
  const bootstrap = useAuthStore((state) => state.bootstrap);
  const isBootstrapped = useAuthStore((state) => state.isBootstrapped);
  const isLoading = useAuthStore((state) => state.isLoading);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => { if (!isBootstrapped && !isLoading) void bootstrap(); }, [isBootstrapped, isLoading, bootstrap]);
  const redirectTo = (location.state && typeof location.state === 'object' && 'redirectTo' in location.state ? String((location.state as { redirectTo?: unknown }).redirectTo ?? '/') : '/') || '/';
  useEffect(() => { if (isBootstrapped && user) navigate(redirectTo, { replace: true }); }, [isBootstrapped, user, redirectTo, navigate]);

  return (
    <div className="min-h-screen bg-background text-foreground lg:grid lg:grid-cols-[minmax(0,1fr)_480px]">
      <section className="relative hidden min-h-screen overflow-hidden border-r border-border bg-card lg:block">
        <div className="absolute inset-0 opacity-60" style={{ backgroundImage: 'linear-gradient(hsl(var(--border)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="relative flex h-full flex-col">
          <header className="flex h-20 items-center gap-3 border-b border-border px-10">
            <span className="grid h-11 w-11 place-items-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
              <ServerCog className="h-5 w-5" />
            </span>
            <div>
              <div className="font-semibold">WikiCat</div>
              <div className="font-mono text-[10px] uppercase tracking-[.18em] text-muted-foreground">Engineering Knowledge</div>
            </div>
          </header>
          <div className="flex flex-1 items-center px-12 xl:px-20">
            <div className="max-w-2xl">
              <div className="mb-5 flex items-center gap-2 font-mono text-xs uppercase tracking-[.16em] text-primary">
                <BookOpen className="h-4 w-4" />
                Documentacao interna
              </div>
              <h1 className="max-w-xl text-5xl font-semibold leading-tight xl:text-6xl">
                O workspace tecnico da sua equipe.
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground">
                Runbooks, arquiteturas, decisoes e referencias em um ambiente pensado para leitura rapida, edicao segura e recuperacao por contexto.
              </p>
              <div className="mt-10 grid max-w-xl grid-cols-2 gap-3">
                {[
                  [Code2, 'Markdown tecnico', 'Codigo, diagramas e chamadas operacionais.'],
                  [GitBranch, 'Relacoes reais', 'Hierarquia e links internos sem telemetria inventada.'],
                ].map(([Icon, title, description]) => {
                  const I = Icon as typeof Code2;
                  return (
                    <div key={String(title)} className="rounded-lg border border-border bg-background/70 p-4">
                      <I className="h-4 w-4 text-primary" />
                      <div className="mt-4 text-sm font-medium">{String(title)}</div>
                      <div className="mt-1 text-xs leading-5 text-muted-foreground">{String(description)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>
      <main className="flex min-h-screen items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
                <ServerCog className="h-5 w-5" />
              </span>
              <div>
                <div className="font-semibold">WikiCat</div>
                <div className="font-mono text-[10px] uppercase tracking-[.18em] text-muted-foreground">Engineering Knowledge</div>
              </div>
            </div>
          </div>
          <LoginForm />
        </div>
      </main>
    </div>
  );
}
