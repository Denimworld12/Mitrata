import mongoose from "mongoose";


const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    username: {
        type: String,
        required: true,
        unique: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    active: {
        type: Boolean,
        default: true
    },
    emailVerified: {
        type: Boolean,
        default: false
    },
    password: {
        type: String,
        required: function () { return !this.googleId && !this.appleId; }
    },
    googleId: {
        type: String,
        default: null
    },
    appleId: {
        type: String,
        default: null
    },
    role: {
        type: String,
        enum: ["user", "admin"],
        default: "user"
    },
    // One entry per active refresh cookie — replaces the old single
    // refreshTokenHash field, which meant logging in on a second device
    // silently kicked the first one out (its hash no longer matched the one
    // shared field). Now each device/browser keeps its own entry, which is
    // also what powers the "login activity" list in Settings.
    sessions: [{
        tokenHash: { type: String, required: true },
        userAgent: { type: String, default: "" },
        ip: { type: String, default: "" },
        createdAt: { type: Date, default: Date.now },
        lastActiveAt: { type: Date, default: Date.now },
    }],
    profilePicture: {
        type: String,
        default: 'https://res.cloudinary.com/detvfqvem/image/upload/v1767007231/default_qzkkui.jpg'
    },
    coverPhoto: {
        type: String,
        default: ''
    },
    bookmarks: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "posts"
    }],
    // One user can have several (web browser + phone app, or multiple
    // browsers) — push sends go to all of them, and dead tokens FCM reports
    // back as invalid get pruned from here rather than kept forever.
    fcmTokens: {
        type: [String],
        default: []
    },
    // Private account: profile/posts are only visible to accepted
    // connections; everyone else sees a limited "this account is private"
    // card. Doesn't affect search visibility (same as Instagram/X — you can
    // still find a private account, just not see into it uninvited).
    isPrivate: {
        type: Boolean,
        default: false
    },
    blockedUsers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "user"
    }],
    pushEnabled: {
        type: Boolean,
        default: true
    },
    // A single daily on/off window in the user's own local time (captured as
    // an IANA zone name when they set it, e.g. "Asia/Kolkata") — not a
    // per-day schedule. sendPush checks the current time against this before
    // sending; start > end means the window wraps past midnight (22:00-07:00).
    quietHours: {
        enabled: { type: Boolean, default: false },
        start: { type: String, default: "22:00" },
        end: { type: String, default: "07:00" },
        timezone: { type: String, default: "UTC" },
    },
    // TOTP two-step verification. `secret` holds a pending (unconfirmed)
    // secret while the user is mid-setup, and the confirmed one once
    // `enabled`. `select: false` keeps these out of any query that doesn't
    // explicitly ask for them (they're never needed for a normal populate).
    twoFactor: {
        enabled: { type: Boolean, default: false, select: false },
        secret: { type: String, default: null, select: false },
        backupCodeHashes: { type: [String], default: [], select: false },
    },
}, {
    timestamps: true
})

const User = mongoose.model("user", userSchema);
export default User;
