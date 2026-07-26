import { useEffect, useRef } from 'react';

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

export default function GoogleLoginButton() {
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!CLIENT_ID) return;

    const renderButton = () => {
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
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: 'outline',
        size: 'large',
        shape: 'pill',
        width: 320,
      });
    };

    if (window.google?.accounts?.id) {
      renderButton();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = renderButton;
    document.body.appendChild(script);
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
