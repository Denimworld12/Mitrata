/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    // Proxies API calls through this same origin instead of hitting
    // onrender.com directly from the browser. The refresh-token cookie was a
    // third-party cookie from the browser's point of view (vercel.app and
    // onrender.com are different eTLD+1s) — Safari ITP and Chrome's
    // third-party-cookie phaseout silently purge those within days, which is
    // what was actually logging people out well before the cookie's real
    // 30-day maxAge. Proxied through here, it's first-party.
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        // Google Identity Services signs the user in via a popup that posts a
        // message back to this window — the browser's default COOP silently
        // blocks that unless this page explicitly allows popups.
        source: "/login",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
        ],
      },
    ];
  },
};

export default nextConfig;
