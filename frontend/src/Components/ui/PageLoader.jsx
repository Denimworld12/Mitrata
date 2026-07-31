import React from 'react';

/** Full-page loading state — swap in for `return null` during an auth/mount
 * check so navigating/refreshing shows a spinner instead of a blank flash. */
export default function PageLoader() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[var(--mt-canvas)]">
      <div
        className="size-10 rounded-full border-[3px] border-t-transparent animate-spin"
        style={{ borderColor: 'var(--mt-accent)', borderTopColor: 'transparent' }}
      />
    </div>
  );
}
