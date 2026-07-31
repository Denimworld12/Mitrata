import React from 'react';
import BlastLoader from './BlastLoader';

/** Full-page loading state — swap in for `return null` during an auth/mount
 * check so navigating/refreshing shows the brand loader instead of a blank flash. */
export default function PageLoader() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[var(--mt-canvas)]">
      <BlastLoader />
    </div>
  );
}
