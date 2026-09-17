import React from 'react';
import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { ThemePref } from '../../store/useThemeStore';

export interface ThemeCardProps extends React.HTMLAttributes<HTMLDivElement> {
  currentTheme: ThemePref;
  onThemeSelect: (theme: ThemePref) => void;
}

const themeOptions: Array<{
  id: ThemePref;
  label: string;
  description: string;
  Icon: typeof Sun;
}> = [
  { id: 'light', label: 'Light', description: 'High-contrast light mode', Icon: Sun },
  { id: 'dark', label: 'Dark', description: 'Reduced glare in low light', Icon: Moon },
  { id: 'system', label: 'System', description: 'Use system preference', Icon: Monitor },
];

export function ThemeCard({ currentTheme, onThemeSelect, className, ...props }: ThemeCardProps) {
  return (
    <div
      role="region"
      aria-label="Theme preferences"
      className={cn(
        'w-64 rounded-xl border border-border bg-card p-3 text-card-foreground shadow-soft-lg',
        'backdrop-blur-none transition-shadow',
        className,
      )}
      {...props}
    >
      <div className="mb-2.5 px-2 pt-1">
        <h4 className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Workspace appearance
        </h4>
      </div>
      <div className="space-y-1">
        {themeOptions.map(({ id, label, description, Icon }) => {
          const isSelected = currentTheme === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onThemeSelect(id)}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-all',
                isSelected
                  ? 'border-primary/50 bg-primary/10 font-semibold text-foreground shadow-sm'
                  : 'border-transparent text-muted-foreground hover:border-border hover:bg-muted/70 hover:text-foreground',
              )}
              aria-pressed={isSelected}
            >
              <span
                className={cn(
                  'grid h-7 w-7 shrink-0 place-items-center rounded-md border text-sm',
                  isSelected
                    ? 'border-primary/40 bg-background text-primary'
                    : 'border-border bg-muted text-muted-foreground',
                )}
              >
                <Icon size={15} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm">{label}</span>
                  {isSelected && <Check size={14} className="text-primary shrink-0" />}
                </div>
                <p className="truncate text-[11px] text-muted-foreground font-normal">
                  {description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
