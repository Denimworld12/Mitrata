import apn from "@parse/node-apn";
import User from "../models/users.model.js";

// VoIP pushes are how an incoming call reaches an iOS device whose app has
// been fully killed (a live socket.io connection only works while the
// process is alive) — Apple requires them sent via a dedicated cert-based
// APNs connection on the app's `.voip` topic, completely separate from the
// regular FCM push used for messages/likes/etc.
const IOS_BUNDLE_ID = "com.mitrata.mitrataMobile";

let provider = null;
if (process.env.APNS_VOIP_CERT_P12_BASE64) {
    provider = new apn.Provider({
        pfx: Buffer.from(process.env.APNS_VOIP_CERT_P12_BASE64, "base64"),
        passphrase: process.env.APNS_VOIP_CERT_PASSWORD,
        production: true
    });
}

// Sent for every incoming call whose target isn't reachable over a live
// socket right now — best-effort, same swallow-and-log pattern as sendPush.
export const sendVoipPush = async (userId, { callerId, callerInfo, offer, isVideo }) => {
    if (!provider) return; // not configured — no-op, same as sendPush without Firebase

    const user = await User.findById(userId).select("voipTokens").lean();
    const tokens = user?.voipTokens || [];
    if (tokens.length === 0) return;

    const note = new apn.Notification();
    note.topic = `${IOS_BUNDLE_ID}.voip`;
    note.pushType = "voip";
    note.priority = 10;
    // PushKit payloads carry raw data, not a visible alert — CallKit itself
    // renders the incoming-call UI once the app reports the call.
    note.payload = { callerId, callerInfo, offer, isVideo: !!isVideo };

    try {
        const result = await provider.send(note, tokens);
        const dead = result.failed
            .filter((f) => f.status === "410" || f.response?.reason === "BadDeviceToken")
            .map((f) => f.device);
        if (dead.length > 0) {
            await User.findByIdAndUpdate(userId, { $pull: { voipTokens: { $in: dead } } });
        }
    } catch (err) {
        console.error("sendVoipPush failed:", err.message);
    }
};
