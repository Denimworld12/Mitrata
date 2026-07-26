// Same convention as NEXT_PUBLIC_GOOGLE_CLIENT_ID (see GoogleLoginButton) —
// an unset/empty env var hides the feature. Set these in .env.local locally
// while building; leave unset in prod until Reels/Groups are ready to ship.
export const REELS_ENABLED = process.env.NEXT_PUBLIC_ENABLE_REELS === 'true';
export const GROUPS_ENABLED = process.env.NEXT_PUBLIC_ENABLE_GROUPS === 'true';
