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
        required: function () { return !this.googleId; }
    },
    googleId: {
        type: String,
        default: null
    },
    role: {
        type: String,
        enum: ["user", "admin"],
        default: "user"
    },
    refreshTokenHash: {
        type: String,
        default: null
    },
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
}, {
    timestamps: true
})

const User = mongoose.model("user", userSchema);
export default User;
