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
    // posthog-node batches on a 5s timer by default — fine for high-volume
    // events, but these are rare enough (auth, content creation) that
    // waiting up to 5s just to see one in the dashboard isn't worth the
    // ambiguity while debugging something real. Fire-and-forget: doesn't
    // block the response, just sends the batch sooner.
    client.flush().catch(() => {});
};
