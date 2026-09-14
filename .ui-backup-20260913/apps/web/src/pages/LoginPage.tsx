import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, Command, FileCode2, GitBranch, ServerCog, ShieldCheck } from 'lucide-react';
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
    <div className="grid min-h-screen bg-[#070b11] text-slate-100 lg:grid-cols-[1.15fr_.85fr]">
      <section className="relative hidden overflow-hidden border-r border-white/[0.08] lg:flex lg:flex-col">
        <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'linear-gradient(rgba(148,163,184,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,.1) 1px, transparent 1px)', backgroundSize: '36px 36px' }} />
        <div className="absolute left-[18%] top-[22%] h-80 w-80 rounded-full bg-emerald-400/10 blur-[100px]" /><div className="absolute bottom-[12%] right-[8%] h-80 w-80 rounded-full bg-indigo-500/10 blur-[110px]" />
        <header className="relative flex h-20 items-center gap-3 border-b border-white/[0.07] px-10"><span className="grid h-10 w-10 place-items-center rounded-lg border border-emerald-400/25 bg-emerald-400/10 text-emerald-300"><ServerCog className="h-5 w-5" /></span><div><div className="font-semibold">WikiCat</div><div className="font-mono text-[9px] uppercase tracking-[.2em] text-slate-500">Engineering Knowledge</div></div><div className="ml-auto flex items-center gap-2 font-mono text-[10px] text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-status" /> INTRANET ONLINE</div></header>
        <div className="relative flex flex-1 items-center px-12 xl:px-20">
          <div className="max-w-2xl"><div className="mb-5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.18em] text-emerald-300"><Command className="h-4 w-4" /> Conhecimento operacional, no fluxo do trabalho</div><h1 className="max-w-xl text-5xl font-semibold leading-[1.08] tracking-[-.045em] xl:text-6xl">A resposta certa.<br /><span className="text-slate-500">Antes do incidente.</span></h1><p className="mt-6 max-w-xl text-base leading-7 text-slate-400">Runbooks, arquiteturas, decisões e dependências num workspace pesquisável, versionado e preparado para equipes técnicas.</p>
            <div className="mt-10 grid max-w-xl grid-cols-3 gap-3">{[[FileCode2,'Runbooks vivos','Código, diffs e validação'],[GitBranch,'Contexto visual','Fluxos e dependências'],[ShieldCheck,'Governança','Owners, versões e SLA']].map(([Icon,title,description]) => { const I = Icon as typeof FileCode2; return <div key={String(title)} className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4"><I className="h-4 w-4 text-emerald-300" /><div className="mt-4 text-sm font-medium">{String(title)}</div><div className="mt-1 text-xs leading-5 text-slate-500">{String(description)}</div></div>; })}</div>
          </div>
        </div>
        <footer className="relative flex items-center justify-between border-t border-white/[0.07] px-10 py-5 font-mono text-[9px] uppercase tracking-wider text-slate-600"><span>SSO interno · sessão protegida</span><span className="flex items-center gap-2"><CheckCircle2 className="h-3 w-3 text-emerald-400" /> índice saudável</span></footer>
      </section>
      <main className="relative flex items-center justify-center overflow-hidden p-6 sm:p-10"><div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 50% 20%, rgba(52,211,153,.2), transparent 36%)' }} /><div className="relative w-full max-w-md"><div className="mb-8 lg:hidden"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-400/10 text-emerald-300"><ServerCog className="h-5 w-5" /></span><div><div className="font-semibold">WikiCat</div><div className="font-mono text-[9px] uppercase tracking-[.2em] text-slate-500">Engineering Knowledge</div></div></div></div><LoginForm /></div></main>
    </div>
  );
}
