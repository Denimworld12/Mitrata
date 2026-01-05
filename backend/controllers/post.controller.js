import User from "../models/users.model.js";

import Profile from "../models/profile.model.js";
import Post from "../models/posts.model.js";
import Comment from "../models/comments.model.js";
import bcrypt from "bcrypt";
import { v2 as cloudinary } from "cloudinary";
export const activecheck = async (req, res) => {
  return res.status(200).json({ message: "Running route post" });
};

export const createPost = async (req, res) => {
  const { token, body } = req.body;
  try {
    const user = await User.findOne({ token });
    if (!user) return res.status(400).json({ message: "not found user" });

    const post = new Post({
      userId: user._id,
      body: body,
      // CLOUDINARY uses .path for the URL. req.file.filename will crash the server.
      media: req.file ? req.file.path : "",
      fileType: req.file ? req.file.mimetype.split("/")[1] : "",
    });

    await post.save();
    return res.status(200).json({ message: "post created" });
  } catch (error) {
    console.error("DETAILED SERVER ERROR:   ", error); // Look at your terminal for this!
    return res.status(500).json({ message: error.message });
  }
};

export const getAllPosts = async (req, res) => {
  try {
    const userId = req.userId;
    const posts = await Post.find().populate(
      "userId",
      "name username email profilePicture createAt"
    );
    const postsWithReactions = posts.map(post => {
  let likeCount = 0;
  let dislikeCount = 0;
  let userReaction = null;

  post.reactions.forEach(r => {
    if (r.userId.toString() === userId.toString()) userReaction = r;
    if (r.type === "like") likeCount++;
    if (r.type === "dislike") dislikeCount++;
  });

    return {
      posts: {...post._doc,
      likeCount,
      dislikeCount,
      reactions: userReaction,}
    };
  });

    // return res.json({ posts: postsWithReactions });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const deletePost = async (req, res) => {
  const { token, post_id } = req.body;
  try {
    const user = await User.findOne({ token: token }).select("_id");
    if (!user) return res.status(400).json({ message: "not found user" });

    const post = await Post.findOne({ _id: post_id });
    if (!post) return res.status(400).json({ message: "not found post" });

    // Check if the user is the owner
    if (post.userId.toString() !== user._id.toString())
      return res.status(401).json({ message: "Unauthorized" });

    // --- NEW LOGIC: DELETE FROM CLOUDINARY ---
    if (post.media && post.media.includes("cloudinary")) {
      try {
        // Example URL: https://res.cloudinary.com/demo/image/upload/v1234/folder/image_name.jpg
        // We need to extract "folder/image_name"
        const urlParts = post.media.split("/");
        const fileNameWithExtension = urlParts[urlParts.length - 1]; // "image_name.jpg"
        const folderName = urlParts[urlParts.length - 2]; // "folder" (your Cloudinary folder name)

        // Remove the extension (.jpg, .png, etc) to get the Public ID
        const publicId = `${folderName}/${fileNameWithExtension.split(".")[0]}`;

        await cloudinary.uploader.destroy(publicId);
        console.log("Deleted from Cloudinary:", publicId);
      } catch (cloudErr) {
        console.error("Cloudinary Delete Error:", cloudErr);
        // We continue to delete from DB even if Cloudinary fails to avoid "ghost" records
      }
    }

    // Delete from MongoDB
    await Post.deleteOne({ _id: post_id });

    // Optional: Delete associated comments as well
    await Comment.deleteMany({ post_Id: post_id });

    return res.json({ message: "Post and associated media Deleted" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
export const commentPost = async (req, res) => {
  const { token, post_id, commentBody } = req.body;
  try {
    const user = await User.findOne({ token: token }).select("_id");
    if (!user) return res.status(400).json({ message: "not found user" });
    const post = await Post.findById(post_id);
    if (!post) return res.status(400).json({ message: "not found post" });
    const comments = new Comment({
      userId: user._id,
      post_Id: post_id,
      body: commentBody,
    });
    await comments.save();

    return res.status(200).json({ message: "comment added " });
  } catch (error) {
    return res.status(505).json({ message: error.message });
  }
};

export const getComment_by_Post = async (req, res) => {
  const { post_id } = req.query;
  try {
    const post = await Post.findById({ _id: post_id });
    const comments = await Comment.find({ post_Id: post_id })
      .populate("userId", "username name profilePicture")
      .sort({ createAt: -1 });
    if (!post) return res.status(400).json({ message: "post not found" });
    return res.status(200).json({ comments });
  } catch (error) {
    return res.status(505).json({ message: error.message });
  }
};

export const delete_Comments = async (req, res) => {
  const { token, comment_id } = req.body;
  try {
    const user = await User.findOne({ token: token }).select("_id");
    if (!user) return res.status(400).json({ message: "not found user" });
    const comments = await Comment.findOne({
      _id: comment_id,
    });
    if (!comments) return res.status(400).json({ message: "not found post" });
    await Comment.deleteOne({ _id: comment_id });

    return res.status(200).json({ message: "comment deleted " });
  } catch (error) {
    return res.status(505).json({ message: error.message });
  }
};

export const increament_likes = async (req, res) => {
  const { token, post_id } = req.body;
  try {
    const user = await User.findOne({ token: token }).select("_id");
    if (!user) return res.status(400).json({ message: "not found user" });
    const posts = await Post.findOne({ _id: post_id });
    if (!posts) return res.status(400).json({ message: "post not found" });
    posts.likes = posts.likes + 1;
    await posts.save();
    return res.status(200).json({ message: "like added " });
  } catch (error) {
    return res.status(505).json({ message: error.message });
  }
};

export const reactToComplaint = async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.body; // "like" | "dislike"
    const userId = req.userId;

    if (!["like", "dislike"].includes(type)) {
      return res.status(400).json({ message: "Invalid reaction type" });
    }

    const complaint = await Post.findById(id);
    if (!complaint) {
      return res.status(404).json({ message: "Complaint not found" });
    }

    const index = complaint.reactions.findIndex(
      (r) => r.userId.toString() === userId.toString()
    );

    // Case 1: no previous reaction
    if (index === -1) {
      complaint.reactions.push({ userId, type });
    }
    // Case 2: same reaction → cancel
    else if (complaint.reactions[index].type === type) {
      complaint.reactions.splice(index, 1);
    }
    // Case 3: switch reaction
    else {
      complaint.reactions[index].type = type;
    }

    await complaint.save();

    // derive counts
    const likeCount = complaint.reactions.filter(
      (r) => r.type === "like"
    ).length;

    const dislikeCount = complaint.reactions.filter(
      (r) => r.type === "dislike"
    ).length;

    // console.log(complaint.reactions, userId);

    res.status(200).json({
      message: "Reaction updated",
      likeCount,
      dislikeCount,
      reactions:
        complaint.reactions.find(
          (r) => r.userId.toString() === userId.toString()
        ) || null,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};
