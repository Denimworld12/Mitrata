import mongoose from "mongoose";

const storySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: true,
        index: true
    },
    media: {
        type: String,
        required: true
    },
    mediaType: {
        type: String,
        enum: ["image", "video"],
        default: "image"
    },
    viewers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "user"
    }],
    // Optional background track picked from the Spotify search proxy
    // (see music.controller.js) — just the metadata needed to play/show it,
    // not a re-hosted copy of the audio itself.
    music: {
        spotifyId: String,
        title: String,
        artist: String,
        albumArt: String,
        previewUrl: String,
        durationMs: Number
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    // TTL index — Mongo reaps expired stories on its own, same technique
    // notification.model.js already uses. No cron job needed.
    expiresAt: {
        type: Date,
        default: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
        index: { expires: 0 }
    }
});

const Story = mongoose.model("story", storySchema);
export default Story;
