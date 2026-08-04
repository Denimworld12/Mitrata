import Story from "../models/story.model.js";
import ConnectionRequest from "../models/connection.model.js";
import { v2 as cloudinary } from "cloudinary";

export const createStory = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: "Media is required" });

        // multer parses non-file multipart fields as plain strings — the
        // client sends the picked track's metadata as a JSON string
        // alongside the media file.
        let music;
        if (req.body.music) {
            try { music = JSON.parse(req.body.music); } catch { /* ignore malformed input */ }
        }

        const story = await Story.create({
            userId: req.userId,
            media: req.file.path,
            mediaType: req.file.mimetype.startsWith("video") ? "video" : "image",
            music,
        });

        return res.status(201).json({ message: "Story posted", story });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// Mine + accepted connections' stories, grouped by author, non-expired
// (TTL already reaps expired docs, but a request can land in the gap before
// Mongo's background reaper runs, so a small $gt safety filter is cheap
// insurance).
export const getStories = async (req, res) => {
    try {
        const userId = req.userId;

        const myConnections = await ConnectionRequest.find({
            $or: [
                { userId, status_accepted: true },
                { connectionId: userId, status_accepted: true }
            ]
        });
        const connectedUserIds = myConnections.map((c) =>
            c.userId.toString() === userId.toString() ? c.connectionId.toString() : c.userId.toString()
        );

        const authorIds = [userId, ...connectedUserIds];

        const stories = await Story.find({
            userId: { $in: authorIds },
            expiresAt: { $gt: new Date() }
        })
            .populate("userId", "name username profilePicture")
            .sort({ createdAt: 1 });

        const grouped = new Map();
        for (const story of stories) {
            // populate() leaves this null if the author user doc is ever
            // missing — .toString() on that would throw and take the whole
            // feed down with it, for every story in the batch, not just theirs.
            if (!story.userId) continue;
            const key = story.userId._id.toString();
            if (!grouped.has(key)) {
                grouped.set(key, { user: story.userId, stories: [], allViewed: true });
            }
            const entry = grouped.get(key);
            const viewed = story.viewers.some((v) => v.toString() === userId.toString());
            entry.stories.push({
                _id: story._id,
                media: story.media,
                mediaType: story.mediaType,
                music: story.music,
                createdAt: story.createdAt,
                expiresAt: story.expiresAt,
                viewed,
                isMine: key === userId.toString()
            });
            if (!viewed && key !== userId.toString()) entry.allViewed = false;
        }

        // Own stories (if any) always first, then by most recent story.
        const result = Array.from(grouped.values()).sort((a, b) => {
            if (a.user._id.toString() === userId.toString()) return -1;
            if (b.user._id.toString() === userId.toString()) return 1;
            return new Date(b.stories.at(-1).createdAt) - new Date(a.stories.at(-1).createdAt);
        });

        return res.status(200).json({ groups: result });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

export const viewStory = async (req, res) => {
    try {
        await Story.findByIdAndUpdate(req.params.id, { $addToSet: { viewers: req.userId } });
        return res.status(200).json({ message: "Marked as viewed" });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// Owner-only "who's seen this" list — Instagram-style story insights.
// $addToSet appends in first-seen order, so reversing gives most-recent-viewer-first
// without needing a separate viewedAt timestamp per viewer.
export const getStoryViewers = async (req, res) => {
    try {
        const story = await Story.findById(req.params.id).populate("viewers", "name username profilePicture");
        if (!story) return res.status(404).json({ message: "Story not found" });
        if (story.userId.toString() !== req.userId.toString()) {
            return res.status(403).json({ message: "Unauthorized — not your story" });
        }
        return res.status(200).json({ viewers: [...story.viewers].reverse() });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

export const deleteStory = async (req, res) => {
    try {
        const story = await Story.findById(req.params.id);
        if (!story) return res.status(404).json({ message: "Story not found" });
        if (story.userId.toString() !== req.userId.toString()) {
            return res.status(403).json({ message: "Unauthorized — not your story" });
        }

        if (story.media && story.media.includes("cloudinary")) {
            try {
                const urlParts = story.media.split("/");
                const fileNameWithExtension = urlParts[urlParts.length - 1];
                const folderName = urlParts[urlParts.length - 2];
                const publicId = `${folderName}/${fileNameWithExtension.split(".")[0]}`;
                await cloudinary.uploader.destroy(publicId, {
                    resource_type: story.mediaType === "video" ? "video" : "image"
                });
            } catch (cloudErr) {
                console.error("Cloudinary story delete error:", cloudErr);
            }
        }

        await Story.deleteOne({ _id: story._id });
        return res.status(200).json({ message: "Story deleted" });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};
