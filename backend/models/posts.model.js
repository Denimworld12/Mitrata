import mongoose, { now } from "mongoose";

const postSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
  },
  body: {
    type: String,
    required: true,
  },
  likes: {
    type: Number,
    default: 0,
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
        enum: ["like", "dislike"],
        required: true,
      },
    },
  ],

  createId: {
    type: Date,
    default: Date.now,
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
});
const Post = mongoose.model("posts", postSchema);
export default Post;
