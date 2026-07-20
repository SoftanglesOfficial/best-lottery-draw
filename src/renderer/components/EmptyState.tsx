import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';
import { Button } from './ui';

interface EmptyStateProps {
  icon?: LucideIcon;
  entity?: string;
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({
  icon: Icon = Inbox,
  entity,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  const heading = title ?? (entity ? `No ${entity} found` : 'Nothing here');
  const body =
    description ??
    (entity ? `Get started by creating your first ${entity.toLowerCase()}.` : undefined);

  return (
    <div className="flex flex-col items-center justify-center rounded-cyber-lg border border-dashed border-line-strong bg-surface-low px-6 py-12 text-center">
      <div className="mb-3 rounded-cyber bg-cyber-soft p-3">
        <Icon className="h-8 w-8 text-cyber" />
      </div>
      <h3 className="font-display text-base font-bold text-content">{heading}</h3>
      {body ? <p className="mt-1 text-sm text-content-subtle">{body}</p> : null}
      {actionLabel && onAction ? (
        <Button type="button" className="mt-4" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
