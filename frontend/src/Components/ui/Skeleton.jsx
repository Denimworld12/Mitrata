import React from 'react';

const base = 'animate-pulse bg-[var(--mt-sunken)] rounded-sm';

export function SkeletonLine({ className = '' }) {
  return <div className={`${base} h-3 rounded-full ${className}`} />;
}

export function SkeletonAvatar({ size = 48, className = '' }) {
  return (
    <div
      className={`${base} rounded-full shrink-0 ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

export function SkeletonBlock({ className = '' }) {
  return <div className={`${base} rounded-md ${className}`} />;
}

/** A ready-made "post card" style skeleton, used on feed/list loading states. */
export default function Skeleton({ rows = 3 }) {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="rounded-[22px] border border-[var(--mt-border)] bg-[var(--mt-surface)] p-4 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <SkeletonAvatar size={40} />
            <div className="flex-1 flex flex-col gap-2">
              <SkeletonLine className="w-1/3" />
              <SkeletonLine className="w-1/4" />
            </div>
          </div>
          <SkeletonLine className="w-full" />
          <SkeletonLine className="w-2/3" />
        </div>
      ))}
    </div>
  );
}
