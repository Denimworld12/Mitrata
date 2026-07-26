import { Html, Head, Main, NextScript } from "next/document";

// Runs before paint so the correct theme applies immediately — no flash of the
// wrong theme while React hydrates. Duplicated (not imported) on purpose: this
// has to be a plain inline script, not a module, to run this early.
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var saved = localStorage.getItem('theme') || 'system';
    var dark = saved === 'dark' || (saved === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.setAttribute('data-mt-theme', dark ? 'dark' : 'light');
  } catch (e) {}
})();
`;

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* Brand mark favicon — an explicit <link> here beats the browser's
            implicit /favicon.ico lookup, which was still serving the default
            create-next-app Vercel triangle. The mark itself is solid black,
            so every size below is composited onto a white circle (square for
            the Apple touch icon) — without it the icon just disappears
            against a dark browser tab or dark-mode UI. Multiple sizes let
            the browser/OS pick a crisp one instead of scaling one image. */}
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/favicon-192.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </Head>
      <body className="antialiased">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
