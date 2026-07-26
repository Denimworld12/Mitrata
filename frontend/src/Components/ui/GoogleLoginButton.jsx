import { useEffect, useRef } from 'react';

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

export default function GoogleLoginButton({ onCredential }) {
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!CLIENT_ID) return;

    const renderButton = () => {
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: (response) => onCredential(response.credential),
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
  }, [onCredential]);

  if (!CLIENT_ID) {
    return (
      <p className="text-center text-xs text-gray-400">
        Google sign-in isn&apos;t configured yet.
      </p>
    );
  }

  return <div ref={buttonRef} className="flex justify-center" />;
}
