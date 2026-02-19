import User from "../models/users.model.js";

import Profile from "../models/profile.model.js";
import Post from "../models/posts.model.js";
import Comment from "../models/comments.model.js";
import { v2 as cloudinary } from "cloudinary";
import ConnectionRequest from "../models/connection.model.js";

export const activecheck = async (req, res) => {
  return res.status(200).json({ message: "Running route post" });
};

export const createPost = async (req, res) => {
  const { body } = req.body;
  try {
    // req.userId from verifyToken middleware
    const user = await User.findById(req.userId);
    if (!user) return res.status(400).json({ message: "User not found" });

    if (!body || !body.trim()) {
      return res.status(400).json({ message: "Post body is required" });
    }

    const post = new Post({
      userId: user._id,
      body: body.trim(),
      media: req.file ? req.file.path : "",
      fileType: req.file ? req.file.mimetype.split("/")[1] : "",
    });

    await post.save();
    return res.status(200).json({ message: "post created" });
  } catch (error) {
    console.error("DETAILED SERVER ERROR:   ", error);
    return res.status(500).json({ message: error.message });
  }
};

export const getAllPosts = async (req, res) => {
  try {
    const userId = req.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Get user's connections for feed ranking
    const myConnections = await ConnectionRequest.find({
      $or: [
        { userId: userId, status_accepted: true },
        { connectionId: userId, status_accepted: true }
      ]
    });

    const connectedUserIds = myConnections.map(conn => {
      return conn.userId.toString() === userId.toString()
        ? conn.connectionId.toString()
        : conn.userId.toString();
    });

    const posts = await Post.find()
      .populate("userId", "name username email profilePicture createdAt");

    // Engagement-weighted chronological sort algorithm
    const now = new Date();
    const scoredPosts = posts.map(post => {
      let likeCount = 0;
      let dislikeCount = 0;
      let userReaction = null;

      post.reactions.forEach(r => {
        if (r.type === "like") likeCount++;
        if (r.type === "dislike") dislikeCount++;
        if (r.userId.toString() === userId.toString()) {
          userReaction = r;
        }
      });

      // Calculate engagement score
      const hoursSincePosted = (now - new Date(post.createId || post.createdAt)) / (1000 * 60 * 60);
      const recencyBoost = Math.max(0, 24 - hoursSincePosted) / 24; // 0-1 scale, 24h window
      const engagementScore = (likeCount * 2) + (dislikeCount * 0.5);
      const hasMedia = post.media ? 1.2 : 1.0;
      const isConnected = connectedUserIds.includes(post.userId?._id?.toString()) ? 1.5 : 1.0;

      // Final score: engagement + recency, boosted by connection & media
      const score = (engagementScore + recencyBoost * 10) * hasMedia * isConnected;

      return {
        ...post._doc,
        likeCount,
        dislikeCount,
        reactions: userReaction,
        _score: score
      };
    });

    // Sort by score descending
    scoredPosts.sort((a, b) => b._score - a._score);

    // Paginate
    const paginatedPosts = scoredPosts.slice(skip, skip + limit);

    // Remove internal score from response
    const formattedPosts = paginatedPosts.map(({ _score, ...post }) => post);

    return res.status(200).json({
      posts: formattedPosts,
      hasMore: skip + limit < scoredPosts.length,
      totalPosts: scoredPosts.length,
      page,
      limit
    });

  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const deletePost = async (req, res) => {
  const { post_id } = req.body;
  try {
    // req.userId from verifyToken middleware
    const post = await Post.findOne({ _id: post_id });
    if (!post) return res.status(400).json({ message: "Post not found" });

    // Check ownership
    if (post.userId.toString() !== req.userId.toString())
      return res.status(403).json({ message: "Unauthorized — not your post" });

    // Delete from Cloudinary
    if (post.media && post.media.includes("cloudinary")) {
      try {
        const urlParts = post.media.split("/");
        const fileNameWithExtension = urlParts[urlParts.length - 1];
        const folderName = urlParts[urlParts.length - 2];
        const publicId = `${folderName}/${fileNameWithExtension.split(".")[0]}`;
        await cloudinary.uploader.destroy(publicId);
        console.log("Deleted from Cloudinary:", publicId);
      } catch (cloudErr) {
        console.error("Cloudinary Delete Error:", cloudErr);
      }
    }

    await Post.deleteOne({ _id: post_id });
    await Comment.deleteMany({ post_Id: post_id });

    return res.json({ message: "Post and associated media Deleted" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const commentPost = async (req, res) => {
  const { post_id, commentBody } = req.body;
  try {
    // req.userId from verifyToken middleware
    const post = await Post.findById(post_id);
    if (!post) return res.status(400).json({ message: "Post not found" });

    if (!commentBody || !commentBody.trim()) {
      return res.status(400).json({ message: "Comment body is required" });
    }

    const comments = new Comment({
      userId: req.userId,
      post_Id: post_id,
      body: commentBody.trim(),
    });
    await comments.save();

    return res.status(200).json({ message: "comment added" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getComment_by_Post = async (req, res) => {
  const { post_id } = req.query;
  try {
    const post = await Post.findById({ _id: post_id });
    if (!post) return res.status(400).json({ message: "post not found" });

    const comments = await Comment.find({ post_Id: post_id })
      .populate("userId", "username name profilePicture")
      .sort({ createdAt: -1 });

    return res.status(200).json({ comments });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const delete_Comments = async (req, res) => {
  const { comment_id } = req.body;
  try {
    // req.userId from verifyToken middleware
    const comment = await Comment.findOne({ _id: comment_id });
    if (!comment) return res.status(400).json({ message: "Comment not found" });

    // OWNERSHIP CHECK: only the comment author can delete
    if (comment.userId.toString() !== req.userId.toString()) {
      return res.status(403).json({ message: "Unauthorized — not your comment" });
    }

    await Comment.deleteOne({ _id: comment_id });
    return res.status(200).json({ message: "comment deleted" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const increament_likes = async (req, res) => {
  const { post_id } = req.body;
  try {
    // req.userId from verifyToken middleware
    const posts = await Post.findOne({ _id: post_id });
    if (!posts) return res.status(400).json({ message: "post not found" });
    posts.likes = posts.likes + 1;
    await posts.save();
    return res.status(200).json({ message: "like added" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
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
      return res.status(404).json({ message: "Post not found" });
    }

    const index = complaint.reactions.findIndex(
      (r) => r.userId.toString() === userId.toString()
    );

    if (index === -1) {
      complaint.reactions.push({ userId, type });
    } else if (complaint.reactions[index].type === type) {
      complaint.reactions.splice(index, 1);
    } else {
      complaint.reactions[index].type = type;
    }

    await complaint.save();

    const likeCount = complaint.reactions.filter(
      (r) => r.type === "like"
    ).length;

    const dislikeCount = complaint.reactions.filter(
      (r) => r.type === "dislike"
    ).length;

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

// ==================== POST ANALYTICS ====================
export const getPostAnalytics = async (req, res) => {
  try {
    const userId = req.userId;

    // Get all posts by this user
    const myPosts = await Post.find({ userId: userId })
      .populate("userId", "name username profilePicture")
      .sort({ createdAt: -1 });

    if (myPosts.length === 0) {
      return res.json({
        totalPosts: 0,
        totalLikes: 0,
        totalDislikes: 0,
        avgEngagement: 0,
        topPost: null,
        postsByDay: [],
        engagementTrend: []
      });
    }

    // Calculate analytics
    let totalLikes = 0;
    let totalDislikes = 0;
    let topPost = null;
    let topPostScore = -1;

    const postsByDay = {};
    const engagementTrend = [];

    myPosts.forEach(post => {
      const likes = post.reactions.filter(r => r.type === "like").length;
      const dislikes = post.reactions.filter(r => r.type === "dislike").length;
      totalLikes += likes;
      totalDislikes += dislikes;

      // Track top-performing post
      const score = likes * 2 + dislikes * 0.5;
      if (score > topPostScore) {
        topPostScore = score;
        topPost = {
          _id: post._id,
          body: post.body.substring(0, 100),
          media: post.media,
          likes,
          dislikes,
          createdAt: post.createdAt || post.createId
        };
      }

      // Posts per day
      const day = new Date(post.createdAt || post.createId).toISOString().split('T')[0];
      postsByDay[day] = (postsByDay[day] || 0) + 1;

      // Engagement per post
      engagementTrend.push({
        postId: post._id,
        date: post.createdAt || post.createId,
        likes,
        dislikes,
        engagement: likes + dislikes
      });
    });

    const avgEngagement = myPosts.length > 0
      ? ((totalLikes + totalDislikes) / myPosts.length).toFixed(2)
      : 0;

    return res.json({
      totalPosts: myPosts.length,
      totalLikes,
      totalDislikes,
      avgEngagement: parseFloat(avgEngagement),
      topPost,
      postsByDay: Object.entries(postsByDay).map(([date, count]) => ({ date, count })),
      engagementTrend
    });

  } catch (error) {
    console.error("Analytics error:", error);
    return res.status(500).json({ message: error.message });
  }
};
