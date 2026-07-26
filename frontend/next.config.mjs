/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
