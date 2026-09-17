import { cn } from '../../lib/utils';

export function SystemLogo({ className }: { className?: string }) {
  return (
    <img
      src="/logo.svg"
      alt="WikiCat"
      className={cn('h-10 w-10 rounded-md border border-border bg-background object-contain', className)}
    />
  );
}
