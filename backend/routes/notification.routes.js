import express from "express";
import { verifyToken } from "../middleware/auth.middleware.js";
import Notification from "../models/notification.model.js";

const router = express.Router();

// Get all notifications for the logged-in user
router.get("/notification/all", verifyToken, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;

        const [notifications, totalNotifications, unreadCount] = await Promise.all([
            Notification.find({ userId: req.userId })
                .populate("fromUser", "name username profilePicture")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            Notification.countDocuments({ userId: req.userId }),
            Notification.countDocuments({ userId: req.userId, read: false })
        ]);

        res.json({ notifications, unreadCount, hasMore: skip + limit < totalNotifications, page, limit });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Mark all notifications as read
router.patch("/notification/read", verifyToken, async (req, res) => {
    try {
        await Notification.updateMany(
            { userId: req.userId, read: false },
            { $set: { read: true } }
        );
        res.json({ message: "All notifications marked as read" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

export default router;
