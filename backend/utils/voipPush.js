import apn from "@parse/node-apn";
import { messaging } from "../config/firebase.js";
import User from "../models/users.model.js";

// VoIP pushes are how an incoming call reaches a device whose app has been
// fully killed (a live socket.io connection only works while the process is
// alive). iOS requires a dedicated cert-based APNs connection on the app's
// `.voip` topic (CallKit/PushKit). Android has no equivalent cert — a plain
// high-priority, data-only FCM message is enough to wake the app and let
// flutter_callkit_incoming show the same native-style call UI there.
const IOS_BUNDLE_ID = "com.mitrata.mitrataMobile";

let provider = null;
if (process.env.APNS_VOIP_CERT_P12_BASE64) {
    provider = new apn.Provider({
        pfx: Buffer.from(process.env.APNS_VOIP_CERT_P12_BASE64, "base64"),
        passphrase: process.env.APNS_VOIP_CERT_PASSWORD,
        production: true
    });
}

const sendIosVoipPush = async (userId, tokens, payload) => {
    if (!provider || tokens.length === 0) return;

    const note = new apn.Notification();
    note.topic = `${IOS_BUNDLE_ID}.voip`;
    note.pushType = "voip";
    note.priority = 10;
    // PushKit payloads carry raw data, not a visible alert — CallKit itself
    // renders the incoming-call UI once the app reports the call.
    note.payload = payload;

    try {
        const result = await provider.send(note, tokens);
        const dead = result.failed
            .filter((f) => f.status === "410" || f.response?.reason === "BadDeviceToken")
            .map((f) => f.device);
        if (dead.length > 0) {
            await User.findByIdAndUpdate(userId, { $pull: { voipTokens: { $in: dead } } });
        }
    } catch (err) {
        console.error("sendVoipPush (iOS) failed:", err.message);
    }
};

const sendAndroidVoipPush = async (userId, tokens, payload) => {
    if (!messaging || tokens.length === 0) return;

    try {
        // data-only (no `notification` block) + androidPriority "high" is what
        // lets FCM wake the app from a killed/backgrounded state — a regular
        // notification+data payload can get throttled or shown by the OS
        // tray instead of reaching app code, which is useless for a call.
        const response = await messaging.sendEachForMulticast({
            tokens,
            android: { priority: "high" },
            data: {
                type: "call",
                callerId: String(payload.callerId),
                callerInfo: JSON.stringify(payload.callerInfo || {}),
                offer: JSON.stringify(payload.offer || {}),
                isVideo: String(!!payload.isVideo),
            },
        });

        const dead = response.responses
            .map((r, i) => (!r.success && (
                r.error?.code === "messaging/registration-token-not-registered" ||
                r.error?.code === "messaging/invalid-registration-token"
            )) ? tokens[i] : null)
            .filter(Boolean);
        if (dead.length > 0) {
            await User.updateOne({ _id: userId }, { $pull: { fcmTokens: { $in: dead } } });
        }
    } catch (err) {
        console.error("sendVoipPush (Android) failed:", err.message);
    }
};

// Sent for every incoming call whose target isn't reachable over a live
// socket right now — best-effort, same swallow-and-log pattern as sendPush.
// Fires both platform paths in parallel since a user could in theory have
// both an iOS and Android device registered.
export const sendVoipPush = async (userId, { callerId, callerInfo, offer, isVideo }) => {
    const user = await User.findById(userId).select("voipTokens fcmTokens").lean();
    if (!user) return;

    const payload = { callerId, callerInfo, offer, isVideo: !!isVideo };
    await Promise.all([
        sendIosVoipPush(userId, user.voipTokens || [], payload),
        sendAndroidVoipPush(userId, user.fcmTokens || [], payload),
    ]);
};
