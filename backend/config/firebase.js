import { initializeApp, cert } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

// FIREBASE_SERVICE_ACCOUNT_KEY holds the whole service-account JSON as one
// string env var (never committed — set directly on Render, same pattern as
// every other secret in this project). Same "disabled until configured"
// convention as the mailer/Google login: push sends silently no-op if it's
// missing instead of crashing the server, so the app still runs locally
// without it set up.
//
// firebase-admin v12+ dropped the old namespaced admin.credential/admin.messaging()
// API in favor of these modular imports — the namespaced style silently
// returns undefined for admin.credential on this version.
let app = null;
if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        app = initializeApp({
            credential: cert(serviceAccount),
        });
    } catch (err) {
        console.error("Failed to initialize Firebase Admin:", err.message);
    }
} else {
    console.warn("FIREBASE_SERVICE_ACCOUNT_KEY not set — push notifications are disabled.");
}

export const messaging = app ? getMessaging(app) : null;
