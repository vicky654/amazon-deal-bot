import * as React from 'react';
import { cn } from '../../lib/utils';
import { PackageOpen } from 'lucide-react';

function EmptyState({ title, description, icon: Icon = PackageOpen, action, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center p-8 text-center animate-fade-in-up', className)}>
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted/50 mb-4">
        <Icon className="h-10 w-10 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-heading font-semibold text-foreground mb-1">{title}</h3>
      {description && <p className="text-sm text-muted-foreground max-w-sm mb-6">{description}</p>}
      {action && <div>{action}</div>}
    </div>
  );
}

export { EmptyState };
