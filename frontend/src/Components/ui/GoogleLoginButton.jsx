import { useEffect, useRef } from 'react';

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

// GSI's own client is a global singleton — calling initialize() again from a
// second mount of this component (chooser → password fallback → back, or
// just two instances on the page at once) doesn't reset anything, it just
// logs "called multiple times... only the last initialized instance will be
// used" and re-points that singleton at whichever <div> called it last. One
// real initialize() call, tracked here across every mount of this component.
let gsiInitialized = false;

export default function GoogleLoginButton() {
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!CLIENT_ID) return;
    let cancelled = false;

    const renderButton = () => {
      // The script's onload (or the "already loaded" branch below) can fire
      // after this instance has already unmounted (e.g. the chooser
      // fell through to this button and the user navigated away before the
      // script finished loading) — rendering into a detached buttonRef then
      // throws GSI's own "no parent or options set" error.
      if (cancelled || !buttonRef.current) return;

      if (!gsiInitialized) {
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          // The classic popup+iframe handshake this library used to rely on
          // gets silently blocked by Safari's Intelligent Tracking Prevention
          // and Edge's Tracking Prevention ("Failed to open popup window").
          // ux_mode:"redirect" is a real top-level navigation instead, so it
          // isn't affected by popup blockers or third-party-cookie policies.
          ux_mode: 'redirect',
          login_uri: `${BACKEND_URL}/api/auth/google/callback`,
        });
        gsiInitialized = true;
      }
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: 'outline',
        size: 'large',
        shape: 'pill',
        width: 320,
      });
    };

    if (window.google?.accounts?.id) {
      renderButton();
    } else {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.onload = renderButton;
      document.body.appendChild(script);
    }

    return () => {
      cancelled = true;
    };
  }, []);

  if (!CLIENT_ID) {
    return (
      <p className="text-center text-xs text-gray-400">
        Google sign-in isn&apos;t configured yet.
      </p>
    );
  }

  return <div ref={buttonRef} className="flex justify-center" />;
}
