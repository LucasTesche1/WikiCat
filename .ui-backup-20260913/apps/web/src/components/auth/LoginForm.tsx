import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../ui/Card';
import { AlertCircle, BookOpen, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';

const schema = z.object({
  email: z
    .string({ required_error: 'E-mail é obrigatório' })
    .min(1, 'E-mail é obrigatório')
    .email('Formato de e-mail inválido'),
  password: z.string().min(1, 'Senha é obrigatória').max(256),
});

type FormValues = z.infer<typeof schema>;

export function LoginForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((s) => s.login);
  const isLoading = useAuthStore((s) => s.isLoading);
  const storeError = useAuthStore((s) => s.error);
  const [showPw, setShowPw] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const redirectTo =
    (location.state && typeof location.state === 'object' && 'redirectTo' in location.state
      ? String((location.state as { redirectTo?: unknown }).redirectTo ?? '/')
      : '/') || '/';

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (data) => {
    setSubmitError(null);
    try {
      await login(data.email.trim().toLowerCase(), data.password);
      navigate(redirectTo, { replace: true });
    } catch (e) {
      const msg =
        (e && typeof e === 'object' && 'message' in e && typeof (e as { message?: unknown }).message === 'string')
          ? (e as { message: string }).message
          : 'Falha ao fazer login. Verifique suas credenciais.';
      setSubmitError(msg);
    }
  });

  const globalError = submitError ?? storeError;

  return (
    <Card className="w-full max-w-md rounded-2xl border-white/10 bg-[#0d131c]/95 text-slate-100 shadow-command backdrop-blur-xl">
      <CardHeader className="gap-2 px-7 pt-7 text-center">
        <div className="mb-3 flex items-center justify-start gap-2">
          <div className="grid h-10 w-10 place-items-center rounded-lg border border-emerald-400/25 bg-emerald-400/10 text-emerald-300">
            <BookOpen className="w-5 h-5" />
          </div>
          <div className="text-left">
            <CardTitle className="text-lg leading-tight text-slate-100">Acesso ao workspace</CardTitle>
            <CardDescription className="text-slate-500">Identidade corporativa obrigatória</CardDescription>
          </div>
        </div>
        <div className="pt-2">
          <h2 className="text-left text-2xl font-semibold tracking-tight text-slate-100">Bem-vindo de volta</h2>
          <CardDescription className="text-left text-slate-400">
            Use suas credenciais da rede interna para continuar.
          </CardDescription>
        </div>
      </CardHeader>
      <form onSubmit={onSubmit} noValidate>
        <CardContent className="space-y-5 px-7">
          {globalError && (
            <div className="flex gap-2 items-start p-3 rounded-md bg-destructive/10 text-destructive border border-destructive/20">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <div className="text-sm">{globalError}</div>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-slate-300">E-mail corporativo</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="nome@empresa.com"
              className="h-11 border-white/10 bg-black/20 text-slate-100 placeholder:text-slate-600 focus-visible:ring-emerald-400"
              {...register('email')}
              aria-invalid={Boolean(errors.email)}
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-slate-300">Senha</Label>
              {/* TODO: rota de recuperação (não no spec v1) */}
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPw ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                className="h-11 border-white/10 bg-black/20 pr-10 text-slate-100 placeholder:text-slate-600 focus-visible:ring-emerald-400"
                {...register('password')}
                aria-invalid={Boolean(errors.password)}
              />
              <button
                type="button"
                onClick={() => setShowPw((s) => !s)}
                tabIndex={-1}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded hover:bg-muted text-muted-foreground"
                aria-label={showPw ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password.message}</p>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex-col gap-2 px-7 pb-7">
          <Button className="h-11 w-full" type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            {isLoading ? 'Entrando...' : 'Entrar'}
          </Button>
          <p className="pt-3 text-center font-mono text-[10px] uppercase tracking-wider text-slate-600">
            Acesso auditado · sessão expira em 8 h
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
