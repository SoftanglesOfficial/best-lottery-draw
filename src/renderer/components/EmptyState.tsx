import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';
import { Button } from './ui';

interface EmptyStateProps {
  icon?: LucideIcon;
  entity: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({
  icon: Icon = Inbox,
  entity,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
      <Icon className="mb-3 h-10 w-10 text-gray-400" />
      <h3 className="text-sm font-medium text-gray-900">No {entity} found</h3>
      <p className="mt-1 text-sm text-gray-500">
        Get started by creating your first {entity.toLowerCase()}.
      </p>
      {actionLabel && onAction ? (
        <Button type="button" className="mt-4" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
