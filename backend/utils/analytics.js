import { PostHog } from "posthog-node";

// Same "disabled until configured" convention as firebase.js/mailer.js —
// server-side event tracking silently no-ops if POSTHOG_API_KEY is unset,
// instead of crashing the server.
const client = process.env.POSTHOG_API_KEY
    ? new PostHog(process.env.POSTHOG_API_KEY, { host: process.env.POSTHOG_HOST || "https://us.i.posthog.com" })
    : null;

export const track = (userId, event, properties = {}) => {
    if (!client || !userId) return;
    client.capture({ distinctId: userId.toString(), event, properties });
};
