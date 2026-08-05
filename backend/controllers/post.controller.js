import * as Sentry from "@sentry/node";
import User from "../models/users.model.js";

import Profile from "../models/profile.model.js";
import Post from "../models/posts.model.js";
import Comment from "../models/comments.model.js";
import { v2 as cloudinary } from "cloudinary";
import ConnectionRequest from "../models/connection.model.js";
import Notification from "../models/notification.model.js";
import { sendPush } from "../utils/push.js";
import { track } from "../utils/analytics.js";

const ONE_HOUR_MS = 60 * 60 * 1000;

// ponytail: naive per-hour dedupe per (userId, fromUser, type, target) so a
// like/comment burst doesn't spam the notification list — move to a proper
// digest job if volume grows.
const notifyOnce = async ({ userId, fromUser, type, message, metadata }) => {
  if (userId.toString() === fromUser.toString()) return; // never notify yourself
  const recent = await Notification.findOne({
    userId,
    fromUser,
    type,
    read: false,
    createdAt: { $gte: new Date(Date.now() - ONE_HOUR_MS) },
    ...(metadata?.postId ? { "metadata.postId": metadata.postId } : {}),
  });
  if (recent) return;
  await Notification.create({ userId, fromUser, type, message, metadata });
  sendPush(userId, { title: "Mitrata", body: message, data: { type, ...metadata } })
    .catch((err) => console.error("sendPush failed:", err.message));
};

export const REACTION_TYPES = ["like", "dislike", "flame", "handHeart", "lightbulb"];

// Pulled out of post bodies at create-time — backs real trending tags
// instead of the landing page's previously hardcoded list.
export const extractTags = (body) =>
  [...new Set((body.match(/#(\w+)/g) || []).map((t) => t.slice(1).toLowerCase()))].slice(0, 10);

// Shared by every endpoint that returns a post's reactions, so "the same
// post shows the same counts everywhere" doesn't depend on each call site
// re-deriving it correctly.
const summarise = (reactions, userId) => {
  const counts = {};
  let mine = null;
  // .lean() reads (used for scale on the hot list endpoints) skip Mongoose's
  // schema-default hydration, so an old post saved before this field existed
  // comes back with reactions === undefined instead of [] — every caller
  // routes through here, so this is the one place that needs the fallback.
  (reactions || []).forEach((r) => {
    counts[r.type] = (counts[r.type] || 0) + 1;
    if (userId && r.userId.toString() === userId.toString()) mine = r;
  });
  return {
    counts,
    likeCount: counts.like || 0,
    dislikeCount: counts.dislike || 0,
    reactions: mine,
  };
};

// One aggregate query for however many posts are being returned, not one
// countDocuments per post — the feed/profile-posts endpoints return a whole
// page at once, and N+1 comment-count queries would be the same mistake the
// N+1 audit already caught elsewhere in this codebase (see connection
// requests). Only ever called on an already-paginated slice (~20 posts),
// never the full ranking pool.
const attachCommentCounts = async (posts) => {
  if (posts.length === 0) return posts;
  const counts = await Comment.aggregate([
    { $match: { post_Id: { $in: posts.map((p) => p._id) } } },
    { $group: { _id: "$post_Id", count: { $sum: 1 } } },
  ]);
  const countByPostId = new Map(counts.map((c) => [c._id.toString(), c.count]));
  return posts.map((post) => ({
    ...post,
    commentCount: countByPostId.get(post._id.toString()) || 0,
  }));
};

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

    // multer parses non-file multipart fields as plain strings — the
    // client sends the picked track's metadata as a JSON string alongside
    // the rest of the post.
    let music;
    if (req.body.music) {
      try { music = JSON.parse(req.body.music); } catch { /* ignore malformed input */ }
    }

    const post = new Post({
      userId: user._id,
      body: body.trim(),
      media: req.file ? req.file.path : "",
      fileType: req.file ? req.file.mimetype.split("/")[1] : "",
      tags: extractTags(body),
      music,
    });

    await post.save();
    track(user._id, "post_created", { hasMedia: !!post.media, hasMusic: !!music });
    return res.status(200).json({ message: "post created" });
  } catch (error) {
    Sentry.captureException(error);
    console.error("DETAILED SERVER ERROR:   ", error);
    return res.status(500).json({ message: error.message });
  }
};

// Public — the target of a shared post link, no auth required
export const getPostById = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate("userId", "name username profilePicture");
    if (!post) return res.status(404).json({ message: "Post not found" });

    // Public route (shared post links) — req.userId only exists when the
    // viewer is also logged in, in which case they still see their own reaction.
    const summary = summarise(post.reactions, req.userId);
    // Public, unauthenticated route — an old/popular post can carry
    // thousands of comments, and this had no cap at all (unlike the
    // paginated getComment_by_Post), so a shared link could pull the whole
    // history in one unbounded query on every open.
    const comments = await Comment.find({ post_Id: post._id })
      .populate("userId", "name username profilePicture")
      .sort({ _id: -1 })
      .limit(100);

    return res.json({ post: { ...post._doc, ...summary }, comments });
  } catch (error) {
    Sentry.captureException(error);
    return res.status(500).json({ message: error.message });
  }
};

// ponytail: the engagement score below needs each candidate post's full
// reactions array in memory (they're embedded, not aggregatable cheaply),
// so it can't be pure DB-level sort+limit — but scanning literally every
// post ever made, on every feed load, doesn't scale past a few thousand
// rows. Bounding the candidate pool to the most recent N (indexed, DB-level
// sort+limit) keeps the recency+engagement blend intact for anything that
// could plausibly rank anyway — a post buried under 1000 more recent ones
// wasn't going to surface in "for you" either way — while capping worst-case
// work per request. Upgrade path if this pool ever isn't enough: a
// precomputed/cached score field updated on reaction instead of scored here.
const RANKING_POOL_SIZE = 1000;

export const getAllPosts = async (req, res) => {
  try {
    const userId = req.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Independent lookups — were sequential awaits (two round trips back to
    // back) even though neither depends on the other's result.
    const [myConnections, me] = await Promise.all([
      ConnectionRequest.find({
        $or: [
          { userId: userId, status_accepted: true },
          { connectionId: userId, status_accepted: true }
        ]
      }).lean(),
      User.findById(userId).select("bookmarks").lean()
    ]);
    const bookmarkedIds = new Set((me?.bookmarks || []).map((id) => id.toString()));

    const connectedUserIds = myConnections.map(conn => {
      return conn.userId.toString() === userId.toString()
        ? conn.connectionId.toString()
        : conn.userId.toString();
    });

    const feed = req.query.feed;
    const query = feed === "following" ? { userId: { $in: connectedUserIds } } : {};

    const [posts, totalMatching] = await Promise.all([
      Post.find(query)
        .sort({ createId: -1 })
        .limit(RANKING_POOL_SIZE)
        .populate("userId", "name username profilePicture createdAt")
        .lean(),
      Post.countDocuments(query)
    ]);

    // Engagement-weighted chronological sort algorithm
    const now = new Date();
    const scoredPosts = posts.map(post => {
      const { counts, likeCount, dislikeCount, reactions } = summarise(post.reactions, userId);

      // Calculate engagement score
      const hoursSincePosted = (now - new Date(post.createId || post.createdAt)) / (1000 * 60 * 60);
      const recencyBoost = Math.max(0, 24 - hoursSincePosted) / 24; // 0-1 scale, 24h window
      const engagementScore = (likeCount * 2) + (dislikeCount * 0.5);
      const hasMedia = post.media ? 1.2 : 1.0;
      const isConnected = connectedUserIds.includes(post.userId?._id?.toString()) ? 1.5 : 1.0;

      // Final score: engagement + recency, boosted by connection & media
      const score = (engagementScore + recencyBoost * 10) * hasMedia * isConnected;

      return {
        ...post,
        counts,
        likeCount,
        dislikeCount,
        reactions,
        bookmarked: bookmarkedIds.has(post._id.toString()),
        _score: score
      };
    });

    // Sort by score descending
    scoredPosts.sort((a, b) => b._score - a._score);

    // Paginate
    const paginatedPosts = scoredPosts.slice(skip, skip + limit);

    // Remove internal score from response
    const formattedPosts = await attachCommentCounts(paginatedPosts.map(({ _score, ...post }) => post));

    const effectiveTotal = Math.min(totalMatching, RANKING_POOL_SIZE);

    return res.status(200).json({
      posts: formattedPosts,
      hasMore: skip + limit < effectiveTotal,
      totalPosts: effectiveTotal,
      page,
      limit
    });

  } catch (error) {
    Sentry.captureException(error);
    return res.status(500).json({ message: error.message });
  }
};

// profile/activity/view_profile were all filtering *one page* of the
// engagement-ranked global getAllPosts() feed down to a single username —
// a user's own posts that didn't rank into that page (very likely once
// they have more than a handful) were invisible on their own profile.
// This queries their actual posts directly instead.
export const getPostsByUsername = async (req, res) => {
  try {
    const requesterId = req.userId;
    const { username } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const author = await User.findOne({ username }).select("_id isPrivate blockedUsers").lean();
    if (!author) {
      return res.status(404).json({ message: "User not found" });
    }

    const isSelf = requesterId && requesterId.toString() === author._id.toString();
    if (author.blockedUsers?.some((id) => id.toString() === requesterId?.toString())) {
      return res.status(404).json({ message: "User not found" });
    }
    if (author.isPrivate && !isSelf) {
      // Same gate as getAllUserBasedOnUsername — a private account's posts
      // shouldn't be fetchable directly even if the profile card itself is
      // locked, since this is a separate endpoint the activity page hits.
      const isConnection = await ConnectionRequest.exists({
        status_accepted: true,
        $or: [
          { userId: requesterId, connectionId: author._id },
          { userId: author._id, connectionId: requesterId }
        ]
      });
      if (!isConnection) {
        return res.status(200).json({ posts: [], hasMore: false, totalPosts: 0, page: 1, limit });
      }
    }

    const query = { userId: author._id };
    const [posts, totalPosts] = await Promise.all([
      Post.find(query)
        .sort({ createId: -1 })
        .skip(skip)
        .limit(limit)
        .populate("userId", "name username profilePicture createdAt")
        .lean(),
      Post.countDocuments(query)
    ]);

    const formattedPosts = await attachCommentCounts(posts.map((post) => ({
      ...post,
      ...summarise(post.reactions, requesterId),
    })));

    return res.status(200).json({
      posts: formattedPosts,
      hasMore: skip + limit < totalPosts,
      totalPosts,
      page,
      limit
    });
  } catch (error) {
    Sentry.captureException(error);
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
    Sentry.captureException(error);
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

    const commenter = await User.findById(req.userId);
    await notifyOnce({
      userId: post.userId,
      fromUser: req.userId,
      type: "comment",
      message: `${commenter.name} commented on your post`,
      metadata: { postId: post._id },
    });

    return res.status(200).json({ message: "comment added" });
  } catch (error) {
    Sentry.captureException(error);
    return res.status(500).json({ message: error.message });
  }
};

export const getComment_by_Post = async (req, res) => {
  const { post_id } = req.query;
  try {
    const post = await Post.findById({ _id: post_id });
    if (!post) return res.status(400).json({ message: "post not found" });

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 500;
    const skip = (page - 1) * limit;
    const query = { post_Id: post_id };

    const [comments, total] = await Promise.all([
      Comment.find(query)
        .populate("userId", "username name profilePicture")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Comment.countDocuments(query)
    ]);

    return res.status(200).json({ comments, hasMore: skip + limit < total, total, page, limit });
  } catch (error) {
    Sentry.captureException(error);
    return res.status(500).json({ message: error.message });
  }
};

export const editComment = async (req, res) => {
  const { comment_id, commentBody } = req.body;
  try {
    if (!commentBody || !commentBody.trim()) {
      return res.status(400).json({ message: "Comment body is required" });
    }

    const comment = await Comment.findOne({ _id: comment_id });
    if (!comment) return res.status(400).json({ message: "Comment not found" });

    // Same ownership rule as delete — only the author can edit their own
    // comment, checked the same way.
    if (comment.userId.toString() !== req.userId.toString()) {
      return res.status(403).json({ message: "Unauthorized — not your comment" });
    }

    comment.body = commentBody.trim();
    comment.edited = true;
    await comment.save();
    await comment.populate("userId", "username name profilePicture");

    return res.status(200).json({ message: "comment updated", comment });
  } catch (error) {
    Sentry.captureException(error);
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
    Sentry.captureException(error);
    return res.status(500).json({ message: error.message });
  }
};

export const reactToComplaint = async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.body;
    const userId = req.userId;

    if (!REACTION_TYPES.includes(type)) {
      return res.status(400).json({ message: "Invalid reaction type" });
    }

    // Atomic remove-then-conditionally-add instead of fetch + mutate +
    // save — on a popular post, two reactions arriving milliseconds apart
    // both loading the same array would have one overwrite the other on
    // save (a classic lost-update race). $pull/$push are single-document
    // atomic ops, so this can't lose a concurrent reaction no matter how
    // many land on the same post at once.
    const before = await Post.findOneAndUpdate(
      { _id: id },
      { $pull: { reactions: { userId } } },
      { new: false }
    );
    if (!before) {
      return res.status(404).json({ message: "Post not found" });
    }

    const prior = before.reactions.find((r) => r.userId.toString() === userId.toString());
    const isNewReaction = !prior;
    const isToggleOff = prior?.type === type;

    const complaint = isToggleOff
      ? await Post.findById(id)
      : await Post.findOneAndUpdate(
          { _id: id },
          { $push: { reactions: { userId, type } } },
          { new: true }
        );
    if (!complaint) {
      return res.status(404).json({ message: "Post not found" });
    }

    // Only notify on a genuinely new reaction (not un-reacting or switching
    // type), and not for "dislike" — a negative signal isn't worth pinging
    // someone about.
    if (isNewReaction && type !== "dislike") {
      const reactor = await User.findById(userId);
      await notifyOnce({
        userId: complaint.userId,
        fromUser: userId,
        type: "like",
        message: `${reactor.name} reacted to your post`,
        metadata: { postId: complaint._id, reactionType: type },
      });
    }

    const summary = summarise(complaint.reactions, userId);

    res.status(200).json({
      message: "Reaction updated",
      ...summary,
    });
  } catch (error) {
    Sentry.captureException(error);
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

    // Get all posts by this user — Post has no `createdAt` field (see
    // createId/updatedAt below), so sorting by createdAt was silently a
    // no-op; doesn't corrupt the analytics below (they don't depend on
    // find-order) but was dead weight on every call.
    const myPosts = await Post.find({ userId: userId })
      .populate("userId", "name username profilePicture")
      .sort({ createId: -1 })
      .lean();

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
      const { likeCount: likes, dislikeCount: dislikes } = summarise(post.reactions);
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
    Sentry.captureException(error);
    console.error("Analytics error:", error);
    return res.status(500).json({ message: error.message });
  }
};

// Toggles a post in/out of the caller's saved list — replaces the old
// localStorage-only bookmarking, which was per-device and invisible to any
// "Saved" view.
export const toggleBookmark = async (req, res) => {
  try {
    const { postId } = req.body;
    // Atomic conditional pull instead of fetch + mutate + save — two
    // near-simultaneous toggles (double-tap, client retry) both loading the
    // same bookmarks array would have one overwrite the other on save, the
    // same lost-update race reactToComplaint below was fixed for.
    const removed = await User.findOneAndUpdate(
      { _id: req.userId, bookmarks: postId },
      { $pull: { bookmarks: postId } }
    );
    if (removed) return res.status(200).json({ bookmarked: false });

    const added = await User.findOneAndUpdate(
      { _id: req.userId },
      { $addToSet: { bookmarks: postId } }
    );
    if (!added) return res.status(404).json({ message: "User not found" });

    return res.status(200).json({ bookmarked: true });
  } catch (error) {
    Sentry.captureException(error);
    return res.status(500).json({ message: error.message });
  }
};

export const getBookmarkedPosts = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const query = { _id: { $in: user.bookmarks } };

    const [posts, total] = await Promise.all([
      Post.find(query)
        .populate("userId", "name username profilePicture createdAt")
        .sort({ createId: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Post.countDocuments(query)
    ]);

    const formatted = await attachCommentCounts(posts.map((post) => ({
      ...post,
      ...summarise(post.reactions, req.userId),
      bookmarked: true,
    })));

    return res.status(200).json({ posts: formatted, hasMore: skip + limit < total, total, page, limit });
  } catch (error) {
    Sentry.captureException(error);
    return res.status(500).json({ message: error.message });
  }
};

// Public — top hashtags used in the last `hours`. Backs the landing page's
// marquee and the dashboard's "Trending now" rail, both previously fabricated.
export const getTrendingTags = async (req, res) => {
  try {
    const hours = Math.min(parseInt(req.query.hours) || 48, 24 * 30);
    const limit = Math.min(parseInt(req.query.limit) || 8, 20);
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const trending = await Post.aggregate([
      { $match: { createId: { $gte: since }, tags: { $exists: true, $ne: [] } } },
      { $unwind: "$tags" },
      { $group: { _id: "$tags", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit },
      { $project: { _id: 0, tag: "$_id", count: 1 } },
    ]);

    return res.status(200).json({ tags: trending });
  } catch (error) {
    Sentry.captureException(error);
    return res.status(500).json({ message: error.message });
  }
};

// Public — real counts for the landing page's proof row (previously a
// hardcoded "18,402 people used Mitrata today"-style string).
export const getPublicStats = async (req, res) => {
  try {
    const [totalUsers, totalPosts] = await Promise.all([
      User.countDocuments(),
      Post.countDocuments(),
    ]);
    const onlineUsers = req.app.get("onlineUsers");

    return res.status(200).json({
      totalUsers,
      totalPosts,
      onlineNow: onlineUsers?.size || 0,
    });
  } catch (error) {
    Sentry.captureException(error);
    return res.status(500).json({ message: error.message });
  }
};

// Posts the caller has reacted to with anything other than "dislike" —
// backs the Profile page's "Liked" tab, same response shape as getAllPosts.
export const getLikedPosts = async (req, res) => {
  try {
    const userId = req.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const query = { reactions: { $elemMatch: { userId, type: { $ne: "dislike" } } } };

    const [posts, total] = await Promise.all([
      Post.find(query)
        .populate("userId", "name username profilePicture createdAt")
        .sort({ createId: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Post.countDocuments(query)
    ]);

    const formatted = await attachCommentCounts(posts.map((post) => ({
      ...post,
      ...summarise(post.reactions, userId),
    })));

    return res.status(200).json({ posts: formatted, hasMore: skip + limit < total, total, page, limit });
  } catch (error) {
    Sentry.captureException(error);
    return res.status(500).json({ message: error.message });
  }
};
