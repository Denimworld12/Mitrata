import * as Sentry from "@sentry/node";
import mongoose from "mongoose";
import User from "../models/users.model.js";
import Post from "../models/posts.model.js";
import Comment from "../models/comments.model.js";
import Report from "../models/report.model.js";
import ConnectionRequest from "../models/connection.model.js";
import { v2 as cloudinary } from "cloudinary";
import { escapeRegex } from "../utils/regex.js";

// ============ USER MANAGEMENT ============
export const getAllUsers = async (req, res) => {
    try {
        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const q = req.query.q;

        const filter = q
            ? (() => {
                const safe = new RegExp(escapeRegex(q.slice(0, 100)), "i");
                return { $or: [{ name: safe }, { email: safe }, { username: safe }] };
            })()
            : {};

        const [users, total] = await Promise.all([
            User.find(filter)
                .select("name username email role active createdAt")
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit),
            User.countDocuments(filter)
        ]);

        return res.json({ users, total, page, pages: Math.ceil(total / limit) });
    } catch (error) {
        Sentry.captureException(error);
        return res.status(500).json({ message: error.message });
    }
};

export const setUserActive = async (req, res) => {
    try {
        const { userId, active } = req.body;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: "User not found" });
        if (user.role === "admin") return res.status(400).json({ message: "Cannot suspend an admin account" });

        user.active = !!active;
        if (!user.active) user.sessions = []; // force logout on suspend, every device
        await user.save();

        return res.json({ message: active ? "User reactivated" : "User suspended", active: user.active });
    } catch (error) {
        Sentry.captureException(error);
        return res.status(500).json({ message: error.message });
    }
};

// ============ CONTENT MODERATION ============
export const adminDeletePost = async (req, res) => {
    try {
        const { postId } = req.body;
        const post = await Post.findById(postId);
        if (!post) return res.status(404).json({ message: "Post not found" });

        if (post.media && post.media.includes("cloudinary")) {
            try {
                const urlParts = post.media.split("/");
                const fileNameWithExtension = urlParts[urlParts.length - 1];
                const folderName = urlParts[urlParts.length - 2];
                const publicId = `${folderName}/${fileNameWithExtension.split(".")[0]}`;
                await cloudinary.uploader.destroy(publicId);
            } catch (cloudErr) {
                console.error("Cloudinary Delete Error:", cloudErr);
            }
        }

        await Post.deleteOne({ _id: postId });
        await Comment.deleteMany({ post_Id: postId });

        return res.json({ message: "Post removed by admin" });
    } catch (error) {
        Sentry.captureException(error);
        return res.status(500).json({ message: error.message });
    }
};

// ============ REPORTS ============
// Any authenticated user can file a report
export const createReport = async (req, res) => {
    try {
        const { targetType, targetId, reason } = req.body;
        if (!targetType || !targetId || !reason) {
            return res.status(400).json({ message: "targetType, targetId and reason are required" });
        }
        if (!mongoose.Types.ObjectId.isValid(targetId)) {
            return res.status(400).json({ message: "targetId is not a valid id" });
        }
        // Without this, re-clicking "Report" (or a scripted retry) queued a
        // fresh duplicate every time — the moderation queue was one bad
        // click away from filling up with copies of the same report.
        const existing = await Report.findOne({ reporterId: req.userId, targetType, targetId, status: "pending" });
        if (existing) {
            return res.status(409).json({ message: "You've already reported this" });
        }
        const report = await Report.create({ reporterId: req.userId, targetType, targetId, reason });
        return res.json({ message: "Report submitted", report });
    } catch (error) {
        Sentry.captureException(error);
        return res.status(500).json({ message: error.message });
    }
};

export const getAllReports = async (req, res) => {
    try {
        const status = req.query.status; // optional filter: pending/resolved/dismissed
        const filter = status ? { status } : {};
        const reports = await Report.find(filter)
            .populate("reporterId", "name username")
            .sort({ createdAt: -1 })
            .limit(200);
        return res.json({ reports });
    } catch (error) {
        Sentry.captureException(error);
        return res.status(500).json({ message: error.message });
    }
};

export const resolveReport = async (req, res) => {
    try {
        const { reportId, status } = req.body; // status: resolved | dismissed
        if (!["resolved", "dismissed"].includes(status)) {
            return res.status(400).json({ message: "status must be 'resolved' or 'dismissed'" });
        }
        const report = await Report.findByIdAndUpdate(reportId, { status }, { new: true });
        if (!report) return res.status(404).json({ message: "Report not found" });
        return res.json({ message: "Report updated", report });
    } catch (error) {
        Sentry.captureException(error);
        return res.status(500).json({ message: error.message });
    }
};

// ============ ANALYTICS OVERVIEW ============
export const getAnalyticsOverview = async (req, res) => {
    try {
        const days = Math.min(parseInt(req.query.days) || 30, 90);
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const onlineUsers = req.app.get("onlineUsers");

        const [totalUsers, totalPosts, totalConnections, activeUsers, pendingReports, rawSignupTrend] = await Promise.all([
            User.countDocuments(),
            Post.countDocuments(),
            ConnectionRequest.countDocuments({ status_accepted: true }),
            User.countDocuments({ active: true }),
            Report.countDocuments({ status: "pending" }),
            User.aggregate([
                { $match: { createdAt: { $gte: since } } },
                { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } }
            ])
        ]);

        // Fill every day in the window, not just days that had a signup —
        // otherwise a sparse result renders as one misleading full-width bar.
        const countByDay = new Map(rawSignupTrend.map((d) => [d._id, d.count]));
        const signupTrend = [];
        for (let i = days - 1; i >= 0; i--) {
            const day = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
            signupTrend.push({ _id: day, count: countByDay.get(day) || 0 });
        }

        return res.json({
            totalUsers,
            totalPosts,
            totalConnections,
            activeUsers,
            suspendedUsers: totalUsers - activeUsers,
            pendingReports,
            onlineNow: onlineUsers ? onlineUsers.size : 0,
            signupTrend
        });
    } catch (error) {
        Sentry.captureException(error);
        return res.status(500).json({ message: error.message });
    }
};

// ============ TRENDING CONTENT & PEOPLE ============
export const getTrendingPosts = async (req, res) => {
    try {
        const days = Math.min(parseInt(req.query.days) || 14, 90);
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const posts = await Post.aggregate([
            { $match: { createId: { $gte: since } } },
            { $addFields: { reactionCount: { $size: { $ifNull: ["$reactions", []] } } } },
            { $lookup: { from: "comments", localField: "_id", foreignField: "post_Id", as: "comments" } },
            { $addFields: { commentCount: { $size: "$comments" } } },
            { $addFields: { engagementScore: { $add: [{ $multiply: ["$reactionCount", 2] }, "$commentCount"] } } },
            { $match: { engagementScore: { $gt: 0 } } },
            { $sort: { engagementScore: -1, createId: -1 } },
            { $limit: 10 },
            { $lookup: { from: "users", localField: "userId", foreignField: "_id", as: "author" } },
            { $unwind: { path: "$author", preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    body: 1, media: 1, createId: 1, reactionCount: 1, commentCount: 1, engagementScore: 1,
                    "author._id": 1, "author.name": 1, "author.username": 1, "author.profilePicture": 1
                }
            }
        ]);

        return res.json({ posts });
    } catch (error) {
        Sentry.captureException(error);
        return res.status(500).json({ message: error.message });
    }
};

export const getTrendingPeople = async (req, res) => {
    try {
        const days = Math.min(parseInt(req.query.days) || 14, 90);
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const people = await Post.aggregate([
            { $match: { createId: { $gte: since } } },
            { $addFields: { reactionCount: { $size: { $ifNull: ["$reactions", []] } } } },
            { $lookup: { from: "comments", localField: "_id", foreignField: "post_Id", as: "comments" } },
            { $addFields: { commentCount: { $size: "$comments" } } },
            {
                $group: {
                    _id: "$userId",
                    postCount: { $sum: 1 },
                    totalReactions: { $sum: "$reactionCount" },
                    totalComments: { $sum: "$commentCount" }
                }
            },
            { $addFields: { engagementScore: { $add: [{ $multiply: ["$totalReactions", 2] }, "$totalComments"] } } },
            { $match: { engagementScore: { $gt: 0 } } },
            { $sort: { engagementScore: -1 } },
            { $limit: 10 },
            { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
            { $unwind: "$user" },
            {
                $project: {
                    postCount: 1, totalReactions: 1, totalComments: 1, engagementScore: 1,
                    "user._id": 1, "user.name": 1, "user.username": 1, "user.profilePicture": 1
                }
            }
        ]);

        return res.json({ people });
    } catch (error) {
        Sentry.captureException(error);
        return res.status(500).json({ message: error.message });
    }
};
