import { messaging } from "../config/firebase.js";
import User from "../models/users.model.js";

// True if "now" falls inside the user's quiet-hours window, evaluated in
// their own local time (native Intl, no tz library needed). start > end means
// the window crosses midnight (e.g. 22:00-07:00).
const isWithinQuietHours = ({ start, end, timezone }) => {
    try {
        const parts = new Intl.DateTimeFormat("en-GB", {
            timeZone: timezone || "UTC", hour: "2-digit", minute: "2-digit", hour12: false
        }).formatToParts(new Date());
        const nowMinutes = Number(parts.find(p => p.type === "hour").value) * 60
            + Number(parts.find(p => p.type === "minute").value);
        const [sh, sm] = start.split(":").map(Number);
        const [eh, em] = end.split(":").map(Number);
        const startMinutes = sh * 60 + sm;
        const endMinutes = eh * 60 + em;
        if (startMinutes === endMinutes) return false;
        return startMinutes < endMinutes
            ? nowMinutes >= startMinutes && nowMinutes < endMinutes
            : nowMinutes >= startMinutes || nowMinutes < endMinutes;
    } catch {
        return false; // unrecognized timezone string — fail open, don't block real pushes
    }
};

// Sends a push to every device a user has registered — used alongside the
// existing Notification.create()+socket.emit() calls (message, connection
// request/accepted, likes, comments) so someone still gets notified even
// with the tab/app fully closed, which Socket.IO can't do on its own.
export const sendPush = async (userId, { title, body, data = {} }) => {
    if (!messaging) return; // not configured — same no-op pattern as sendMail

    const user = await User.findById(userId).select("fcmTokens pushEnabled quietHours").lean();
    if (user?.pushEnabled === false) return; // user turned push off in Settings
    if (user?.quietHours?.enabled && isWithinQuietHours(user.quietHours)) return;
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

// Message notifications specifically: web tokens get the same notification+
// data payload as sendPush above (unchanged, still relies on the OS to
// auto-display it), but mobile tokens get a data-only payload instead —
// that's what makes FCM invoke the app's background handler instead of just
// showing a plain system notification, which is what lets the mobile app
// build its own notification with Reply/Mark-as-read actions even while
// backgrounded or fully killed. `content-available` is iOS's equivalent
// signal for the same thing.
export const sendMessagePush = async (userId, { title, body, data = {} }) => {
    if (!messaging) return;

    const user = await User.findById(userId).select("fcmTokens mobileFcmTokens pushEnabled quietHours").lean();
    if (user?.pushEnabled === false) return;
    if (user?.quietHours?.enabled && isWithinQuietHours(user.quietHours)) return;

    const mobileTokens = user?.mobileFcmTokens || [];
    const webTokens = (user?.fcmTokens || []).filter((t) => !mobileTokens.includes(t));
    const stringData = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)]));

    const responses = await Promise.all([
        webTokens.length > 0
            ? messaging.sendEachForMulticast({ tokens: webTokens, notification: { title, body }, data: stringData })
            : null,
        mobileTokens.length > 0
            ? messaging.sendEachForMulticast({
                tokens: mobileTokens,
                data: { ...stringData, title, body },
                android: { priority: "high" },
                apns: {
                    headers: { "apns-push-type": "background", "apns-priority": "5" },
                    payload: { aps: { "content-available": 1 } },
                },
            })
            : null,
    ]);

    const deadTokens = [];
    if (responses[0]) {
        responses[0].responses.forEach((r, i) => {
            if (!r.success && isDeadTokenError(r.error)) deadTokens.push(webTokens[i]);
        });
    }
    if (responses[1]) {
        responses[1].responses.forEach((r, i) => {
            if (!r.success && isDeadTokenError(r.error)) deadTokens.push(mobileTokens[i]);
        });
    }
    if (deadTokens.length > 0) {
        await User.updateOne(
            { _id: userId },
            { $pull: { fcmTokens: { $in: deadTokens }, mobileFcmTokens: { $in: deadTokens } } }
        );
    }
};

const isDeadTokenError = (error) =>
    error?.code === "messaging/registration-token-not-registered" ||
    error?.code === "messaging/invalid-registration-token";
