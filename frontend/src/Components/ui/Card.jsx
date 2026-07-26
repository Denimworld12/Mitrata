import React from 'react';

export default function Card({ glass = false, className = '', children, ...props }) {
  return (
    <div
      className={`rounded-[22px] border border-[var(--mt-border)] shadow-[var(--mt-shadow)]
        ${glass
          ? 'backdrop-blur-md bg-[var(--mt-veil)]'
          : 'bg-[var(--mt-surface)]'}
        ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
