import * as React from 'react';
import { cn } from '../../lib/utils';

const Toggle = React.forwardRef(({ className, pressed, onPressedChange, ...props }, ref) => (
  <button
    type="button"
    ref={ref}
    aria-pressed={pressed}
    onClick={() => onPressedChange(!pressed)}
    className={cn(
      'inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50',
      pressed ? 'bg-primary' : 'bg-muted',
      className
    )}
    {...props}
  >
    <span
      data-state={pressed ? 'checked' : 'unchecked'}
      className={cn(
        'pointer-events-none block h-5 w-5 rounded-full bg-surface shadow-lg ring-0 transition-transform',
        pressed ? 'translate-x-5' : 'translate-x-0'
      )}
    />
  </button>
));

Toggle.displayName = 'Toggle';

export { Toggle };
