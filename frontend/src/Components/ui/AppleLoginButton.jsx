const SERVICES_ID = process.env.NEXT_PUBLIC_APPLE_SERVICES_ID;
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

// Apple's sign-in is plain OAuth2/OIDC — unlike Google, there's no JS SDK
// needed at all. A real top-level redirect (not a popup, not an iframe) is
// both the simplest implementation and immune to the exact popup-blocking/
// third-party-cookie issues Google's GSI popup flow ran into earlier in this
// project — nothing to load, nothing to silently fail.
//
// response_mode=form_post is what makes Apple POST id_token (and, on first
// authorization only, a `user` JSON blob with name/email) straight to
// redirect_uri as a real top-level navigation — verified server-side in
// appleLoginCallback. No client-side `state` param: same trust model already
// established for Google here — the real boundary is the signed id_token's
// signature/audience check on the backend, not a CSRF token on this hop.
function buildAuthorizeUrl() {
    const params = new URLSearchParams({
        client_id: SERVICES_ID,
        redirect_uri: `${BACKEND_URL}/api/auth/apple/callback`,
        response_type: 'code id_token',
        response_mode: 'form_post',
        scope: 'name email',
    });
    return `https://appleid.apple.com/auth/authorize?${params.toString()}`;
}

export default function AppleLoginButton() {
    if (!SERVICES_ID) {
        return (
            <p className="text-center text-xs text-gray-400">
                Sign in with Apple isn&apos;t configured yet.
            </p>
        );
    }

    return (
        <button
            type="button"
            onClick={() => { window.location.href = buildAuthorizeUrl(); }}
            className="w-full flex items-center justify-center gap-2 rounded-full border border-gray-300 dark:border-gray-600 py-2.5 px-4 text-sm font-medium bg-black text-white hover:opacity-90 transition-opacity"
            style={{ maxWidth: 320, margin: '0 auto' }}
        >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M16.365 1.43c0 1.14-.416 2.11-1.25 2.907-.902.86-2.005 1.362-3.213 1.264-.14-1.11.362-2.24 1.194-3.02.9-.85 2.09-1.34 3.27-1.35zM20.4 17.36c-.51 1.18-.75 1.7-1.4 2.73-.9 1.42-2.17 3.2-3.75 3.21-1.4.01-1.76-.91-3.65-.9-1.9 0-2.29.9-3.68.9-1.58 0-2.78-1.6-3.68-3.02C1.4 16.94.5 12.5 2.1 9.51c.87-1.63 2.44-2.66 4.15-2.68 1.36-.02 2.65.92 3.48.92.83 0 2.39-1.14 4.03-.97.69.03 2.62.28 3.86 2.1-.1.06-2.3 1.35-2.28 4.03.02 3.2 2.8 4.27 2.83 4.28-.02.06-.44 1.53-1.53 3.03z" />
            </svg>
            Sign in with Apple
        </button>
    );
}
