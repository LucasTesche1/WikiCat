import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils.js';

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = /^#?([a-f\d]{3,8})$/i.exec(hex);
  if (!match) return null;
  const raw = match[1] ?? '';
  let v = raw;
  if (v.length === 3) v = v.split('').map((c) => c + c).join('');
  if (v.length !== 6) return null;
  const num = parseInt(v, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

export interface ChipProps {
  label: string;
  color?: string;
  onRemove?: () => void;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  size?: 'sm' | 'md';
}

export const Chip = React.forwardRef<HTMLSpanElement | HTMLButtonElement, ChipProps>(function Chip(
  { label, color = '#6366f1', onRemove, onClick, className, size = 'sm' },
  ref,
) {
  const rgb = hexToRgb(color) ?? { r: 99, g: 102, b: 241 };
  const bg = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.14)`;
  const border = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.35)`;
  const fg = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
  const hoverBg = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.24)`;

  const shared = {
    className: cn(
      'group inline-flex min-h-8 items-center gap-1.5 rounded-md border font-semibold select-none transition-colors',
      size === 'sm' ? 'px-2.5 py-1 text-[11px] leading-4' : 'px-3 py-1.5 text-xs',
      onClick ? 'cursor-pointer hover:bg-[var(--chip-hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring' : '',
      className,
    ),
    style: {
      backgroundColor: bg,
      borderColor: border,
      color: fg,
      '--chip-hover-bg': hoverBg,
    } as React.CSSProperties,
  };
  const content = (
    <>
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      <span className="truncate max-w-[160px]">{label}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className={cn(
            'rounded-full p-0.5 -mr-1 opacity-70 hover:opacity-100 transition hover:bg-destructive/20 hover:text-destructive',
          )}
          style={{ color: fg }}
          aria-label={`Remover tag ${label}`}
        >
          <X className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
        </button>
      )}
    </>
  );
  if (onClick) {
    return (
      <button ref={ref as React.ForwardedRef<HTMLButtonElement>} type="button" onClick={onClick} {...shared}>
        {content}
      </button>
    );
  }
  return (
    <span ref={ref as React.ForwardedRef<HTMLSpanElement>} {...shared}>
      {content}
    </span>
  );
});
