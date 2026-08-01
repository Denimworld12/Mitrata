import { messaging } from "../config/firebase.js";
import User from "../models/users.model.js";

// Sends a push to every device a user has registered — used alongside the
// existing Notification.create()+socket.emit() calls (message, connection
// request/accepted, likes, comments) so someone still gets notified even
// with the tab/app fully closed, which Socket.IO can't do on its own.
export const sendPush = async (userId, { title, body, data = {} }) => {
    if (!messaging) return; // not configured — same no-op pattern as sendMail

    const user = await User.findById(userId).select("fcmTokens pushEnabled").lean();
    if (user?.pushEnabled === false) return; // user turned push off in Settings
    const tokens = user?.fcmTokens || [];
    if (tokens.length === 0) return;

    // FCM requires every data value to be a string — callers pass through
    // raw metadata (ObjectIds, etc.) since that's the shape already used
    // for the in-app Notification model, so it's coerced here once rather
    // than trusting every call site to remember.
    const stringData = Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
    );

    const response = await messaging.sendEachForMulticast({
        tokens,
        notification: { title, body },
        data: stringData,
    });

    // A token stops being valid the moment someone uninstalls the app,
    // clears site data, or the browser revokes it — FCM tells us exactly
    // which ones on every send, so this is the only reliable place to prune
    // them instead of they never resend.
    const deadTokens = response.responses
        .map((r, i) => (!r.success && (
            r.error?.code === "messaging/registration-token-not-registered" ||
            r.error?.code === "messaging/invalid-registration-token"
        )) ? tokens[i] : null)
        .filter(Boolean);

    if (deadTokens.length > 0) {
        await User.updateOne({ _id: userId }, { $pull: { fcmTokens: { $in: deadTokens } } });
    }
};
