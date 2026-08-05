import mongoose, { now } from "mongoose";

const postSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
    index: true,
  },
  body: {
    type: String,
    required: true,
  },
  reactions: [
    {
      _id: false, // 👈 THIS LINE
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      type: {
        type: String,
        enum: ["like", "dislike", "flame", "handHeart", "lightbulb"],
        required: true,
      },
    },
  ],

  createId: {
    type: Date,
    default: Date.now,
    index: true,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  media: {
    type: String,
    default: "",
  },
  active: {
    type: Date,
    default: Date.now,
  },
  fileType: {
    type: String,
    default: "",
  },
  tags: {
    type: [String],
    default: [],
    index: true,
  },
  // Optional background track picked from the Audius search proxy (see
  // music.controller.js) — just the metadata needed to play/show it, not a
  // re-hosted copy of the audio itself.
  music: {
    trackId: String,
    title: String,
    artist: String,
    albumArt: String,
    previewUrl: String,
    durationMs: Number,
  },
});

postSchema.index({ "reactions.userId": 1 }); // GET /user/liked_posts
// getAllPosts' "following" feed filters by userId then sorts by createId —
// the single-field indexes on each covered one or the other, not both, so
// Mongo had to sort in memory after filtering. This lets it use one index
// for both.
postSchema.index({ userId: 1, createId: -1 });

const Post = mongoose.model("posts", postSchema);
export default Post;
