import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[color,background-color,box-shadow,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground border border-primary shadow-sm hover:brightness-110',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline:
          'border border-input bg-background/60 hover:bg-gradient-brand-soft hover:border-primary/30 hover:text-foreground backdrop-blur-sm',
        secondary:
          'bg-gradient-brand-soft text-foreground hover:bg-gradient-brand-soft/80 hover:shadow-soft border border-primary/10',
        ghost:
          'hover:bg-gradient-brand-soft hover:text-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
        'gradient-outline':
          'relative bg-background hover:bg-gradient-brand-soft border border-primary/20 text-foreground hover:border-primary/40 shadow-soft/40',
      },
      size: {
        default: 'min-h-11 px-4 py-2',
        sm: 'min-h-11 rounded-md px-3',
        lg: 'h-11 rounded-lg px-8 text-base',
        xl: 'h-12 rounded-xl px-10 text-base',
        icon: 'h-11 w-11',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
