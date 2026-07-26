import React from 'react';

const VARIANTS = {
  primary:
    'bg-[image:var(--mt-grad)] text-white shadow-[0_10px_24px_-12px_rgba(4,71,255,.6)]',
  secondary:
    'bg-[var(--mt-surface)] text-[var(--mt-ink)] border border-[var(--mt-border)]',
  ghost:
    'bg-transparent text-[var(--mt-ink2)] hover:bg-[var(--mt-sunken)]',
  danger:
    'bg-[var(--mt-danger)] text-white hover:brightness-110',
};

export default function Button({
  variant = 'primary',
  loading = false,
  disabled = false,
  className = '',
  children,
  type = 'button',
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`mt-btn-lift inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium
        transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed
        ${VARIANTS[variant] || VARIANTS.primary} ${className}`}
      {...props}
    >
      {loading && (
        <span className="size-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
      )}
      {children}
    </button>
  );
}
