import posthog from "posthog-js";

// Same "disabled until configured" convention as the backend's optional
// integrations — no-ops entirely when the env vars aren't set, and only
// ever runs in the browser (posthog-js touches window/document at import
// time in ways that don't survive Next.js's SSR pass).
let initialized = false;

export const initPosthog = () => {
  if (initialized || typeof window === "undefined") return;
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    // Pages Router navigations are client-side (no new document load), so
    // the default pageview autocapture misses them — captured manually on
    // route change in _app.js instead.
    capture_pageview: false,
  });
  initialized = true;
};

export default posthog;
