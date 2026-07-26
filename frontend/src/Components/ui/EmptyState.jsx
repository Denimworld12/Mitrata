import React from 'react';
import { Inbox } from 'lucide-react';
import Button from './Button';

export default function EmptyState({
  icon: Icon = Inbox,
  title = 'Nothing here yet',
  description = '',
  actionLabel = '',
  onAction,
  className = '',
}) {
  return (
    <div className={`flex flex-col items-center justify-center text-center gap-3 py-12 px-6 ${className}`}>
      <div className="flex items-center justify-center size-14 rounded-full bg-[var(--mt-sunken)] text-[var(--mt-ink3)]">
        <Icon className="size-7" strokeWidth={1.8} />
      </div>
      <h3 className="text-base font-semibold text-[var(--mt-ink)]" style={{ fontFamily: 'var(--font-display)' }}>{title}</h3>
      {description && <p className="text-sm text-[var(--mt-ink2)] max-w-xs">{description}</p>}
      {actionLabel && onAction && (
        <Button variant="secondary" onClick={onAction} className="mt-1">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
