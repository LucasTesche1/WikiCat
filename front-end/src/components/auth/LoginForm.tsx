import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, Eye, EyeOff, Loader2, LogIn } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
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

const schema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .min(1, 'Email is required')
    .email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required').max(256),
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
          : 'Sign-in failed. Check your credentials.';
      setSubmitError(msg);
    }
  });

  const globalError = submitError ?? storeError;

  return (
    <Card className="w-full rounded-lg border-border bg-card shadow-command">
      <CardHeader className="gap-2 px-7 pt-7">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
          <LogIn className="h-5 w-5" />
        </div>
        <div>
          <CardTitle className="text-2xl">Sign in</CardTitle>
          <CardDescription>Use your internal account to continue.</CardDescription>
        </div>
      </CardHeader>
      <form onSubmit={onSubmit} noValidate>
        <CardContent className="space-y-5 px-7">
          {globalError && (
            <div id="login-error" role="alert" className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{globalError}</span>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="name@company.com"
              {...register('email')}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={[errors.email ? 'email-error' : '', globalError ? 'login-error' : ''].filter(Boolean).join(' ') || undefined}
            />
            {errors.email && (
              <p id="email-error" className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPw ? 'text' : 'password'}
                autoComplete="current-password"
                className="pr-12"
                {...register('password')}
                aria-invalid={Boolean(errors.password)}
                aria-describedby={[errors.password ? 'password-error' : '', globalError ? 'login-error' : ''].filter(Boolean).join(' ') || undefined}
              />
              <button
                type="button"
                onClick={() => setShowPw((s) => !s)}
                className="absolute right-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={showPw ? 'Hide password' : 'Show password'}
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && (
              <p id="password-error" className="text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>
        </CardContent>
        <CardFooter className="px-7 pb-7">
          <Button className="w-full" type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {isLoading ? 'Signing in...' : 'Sign in'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
