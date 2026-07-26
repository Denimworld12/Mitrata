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
});

postSchema.index({ "reactions.userId": 1 }); // GET /user/liked_posts

const Post = mongoose.model("posts", postSchema);
export default Post;
