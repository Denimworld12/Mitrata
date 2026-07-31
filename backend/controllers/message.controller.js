import mongoose from "mongoose";
import Message from "../models/message.model.js";
import Notification from "../models/notification.model.js";
import ConnectionRequest from "../models/connection.model.js";
import { v2 as cloudinary } from "cloudinary";
import { sendPush } from "../utils/push.js";

export const sendMessage = async (req, res) => {
    try {
        const { receiverId, content } = req.body;
        const senderId = req.userId; // From verifyToken middleware

        console.log("Send message request:", {
            senderId,
            receiverId,
            content: content?.substring(0, 50),
            filesCount: req.files?.length || 0
        });

        // Validate receiver exists
        if (!receiverId || !mongoose.Types.ObjectId.isValid(receiverId)) {
            return res.status(400).json({ message: "A valid receiver ID is required" });
        }

        // The messaging UI only ever exposes a Send button on your own
        // connections list — nothing server-side enforced that, so any
        // authenticated account could DM (and get a notification bell entry
        // in front of) a complete stranger via a direct API call.
        const isConnected = await ConnectionRequest.exists({
            status_accepted: true,
            $or: [
                { userId: senderId, connectionId: receiverId },
                { userId: receiverId, connectionId: senderId }
            ]
        });
        if (!isConnected) {
            return res.status(403).json({ message: "You can only message accepted connections" });
        }

        // Handle Multiple Files (Up to 5)
        let mediaFiles = [];
        if (req.files && req.files.length > 0) {
            if (req.files.length > 5) {
                return res.status(400).json({ message: "Maximum 5 media files allowed" });
            }

            mediaFiles = req.files.map(file => ({
                url: file.path, // Cloudinary URL
                mediaType: file.mimetype.startsWith('video') ? 'video' : 'image',
                publicId: file.filename
            }));
        }

        // Ensure at least content or media is provided
        if (!content && mediaFiles.length === 0) {
            return res.status(400).json({ message: "Message must contain text or media" });
        }

        // Save to Database
        const newMessage = new Message({
            sender: senderId,
            receiver: receiverId,
            content: content || "",
            media: mediaFiles
        });

        await newMessage.save();

        // Populate sender info for the frontend
        const populatedMessage = await Message.findById(newMessage._id)
            .populate({
                path: 'sender',
                select: 'name profilePicture username email'
            })
            .populate({
                path: 'receiver',
                select: 'name profilePicture username'
            });

        console.log("Message saved successfully:", populatedMessage._id);

        // SOCKET.IO REAL-TIME EMISSION
        const io = req.app.get("socketio");

        if (io) {
            // Emit to receiver's room
            io.to(receiverId.toString()).emit("newMessage", populatedMessage);
            console.log("Message emitted to receiver:", receiverId);
        }

        // Persist a notification too — the socket event above only reaches an
        // open tab; without this, messages never show up in /notifications.
        // ponytail: naive per-hour dedupe so a chat burst doesn't spam the
        // list, move to a proper digest job if volume grows.
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const recentMsgNotif = await Notification.findOne({
            userId: receiverId,
            fromUser: senderId,
            type: "message",
            read: false,
            createdAt: { $gte: oneHourAgo }
        });
        if (!recentMsgNotif) {
            await Notification.create({
                userId: receiverId,
                type: "message",
                fromUser: senderId,
                message: `${populatedMessage.sender.name} sent you a message`,
                metadata: { username: populatedMessage.sender.username }
            });
            // Reaches a closed tab / the phone app — the socket emit above
            // only reaches an open one. Same hourly dedupe as the persisted
            // notification so an active chat burst doesn't spam pushes.
            sendPush(receiverId, {
                title: populatedMessage.sender.name,
                body: content ? content.slice(0, 100) : "Sent you media",
                data: { type: "message", username: populatedMessage.sender.username }
            }).catch((err) => console.error("sendPush failed:", err.message));
        }

        res.status(201).json(populatedMessage);
    } catch (error) {
        console.error("Error in sendMessage:", error);
        res.status(500).json({
            message: "Internal Server Error",
            error: error.message
        });
    }
};

export const getMessages = async (req, res) => {
    try {
        const { receiverId, page: pageStr, limit: limitStr } = req.query;
        const senderId = req.userId; // From verifyToken middleware

        if (!receiverId) {
            return res.status(400).json({ message: "Receiver ID is required" });
        }

        const page = parseInt(pageStr) || 1;
        const limit = Math.min(parseInt(limitStr) || 50, 100); // Cap at 100
        const skip = (page - 1) * limit;

        // Count total messages
        const totalMessages = await Message.countDocuments({
            $or: [
                { sender: senderId, receiver: receiverId },
                { sender: receiverId, receiver: senderId }
            ],
            deletedBy: { $ne: senderId }
        });

        // Fetch paginated messages (newest first, then reverse for display)
        const messages = await Message.find({
            $or: [
                { sender: senderId, receiver: receiverId },
                { sender: receiverId, receiver: senderId }
            ],
            deletedBy: { $ne: senderId }
        })
            .populate({
                path: 'sender',
                select: 'name profilePicture username'
            })
            .populate({
                path: 'receiver',
                select: 'name profilePicture username'
            })
            .sort({ createdAt: -1 }) // newest first
            .skip(skip)
            .limit(limit);

        // Reverse to chronological (oldest-to-newest) for display
        messages.reverse();

        res.status(200).json({
            messages,
            hasMore: skip + limit < totalMessages,
            totalMessages,
            page,
            limit
        });
    } catch (error) {
        console.error("Error in getMessages:", error);
        res.status(500).json({
            message: "Error fetching messages",
            error: error.message
        });
    }
};

export const deleteChat = async (req, res) => {
    try {
        const { receiverId } = req.body;
        const senderId = req.userId;

        console.log("Delete chat request:", {
            senderId,
            receiverId
        });

        if (!receiverId) {
            return res.status(400).json({ message: "Receiver ID is required" });
        }

        // Add current user to deletedBy array for all messages in this conversation
        const result = await Message.updateMany(
            {
                $or: [
                    { sender: senderId, receiver: receiverId },
                    { sender: receiverId, receiver: senderId }
                ]
            },
            {
                $addToSet: { deletedBy: senderId }
            }
        );

        console.log("Chat deleted:", result.modifiedCount, "messages");

        res.status(200).json({
            message: "Chat deleted successfully",
            deletedCount: result.modifiedCount
        });
    } catch (error) {
        console.error("Error in deleteChat:", error);
        res.status(500).json({
            message: "Error deleting chat",
            error: error.message
        });
    }
};



// NEW: Delete specific messages (WhatsApp style)
export const deleteMessages = async (req, res) => {
    try {
        const { messageIds } = req.body;
        const senderId = req.userId;

        console.log("Delete messages request:", {
            senderId,
            messageIds,
            count: messageIds?.length
        });

        if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
            return res.status(400).json({ message: "Message IDs are required" });
        }

        // Add current user to deletedBy array for selected messages
        const result = await Message.updateMany(
            {
                _id: { $in: messageIds },
                $or: [
                    { sender: senderId },
                    { receiver: senderId }
                ]
            },
            {
                $addToSet: { deletedBy: senderId }
            }
        );

        console.log("Messages marked as deleted:", result.modifiedCount);

        // "Delete for me" only hides these messages for the caller (that's
        // all the $addToSet above did) — it emitted to the OTHER
        // participant's room, so their live chat silently lost messages
        // that, for them, were never actually deleted (they'd reappear on
        // their next reload). This is meant to sync the caller's OWN other
        // open tabs/devices, so it needs to target the caller's room, not
        // the other person's.
        const io = req.app.get("socketio");
        if (io) {
            io.to(senderId.toString()).emit("messagesDeleted", { messageIds, deletedBy: senderId });
        }

        res.status(200).json({
            message: "Messages deleted successfully",
            deletedCount: result.modifiedCount
        });
    } catch (error) {
        console.error("Error in deleteMessages:", error);
        res.status(500).json({
            message: "Error deleting messages",
            error: error.message
        });
    }
};

// NEW: Delete message for everyone (only if sender)
export const deleteMessageForEveryone = async (req, res) => {
    try {
        const { messageId } = req.body;
        const senderId = req.userId;

        console.log("Delete message for everyone request:", {
            senderId,
            messageId
        });

        if (!messageId) {
            return res.status(400).json({ message: "Message ID is required" });
        }

        // Find the message
        const message = await Message.findById(messageId);

        if (!message) {
            return res.status(404).json({ message: "Message not found" });
        }

        // Only sender can delete for everyone
        if (message.sender.toString() !== senderId.toString()) {
            return res.status(403).json({ message: "You can only delete your own messages for everyone" });
        }

        // Check if message is within 1 hour (optional - WhatsApp rule)
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        if (message.createdAt < oneHourAgo) {
            return res.status(403).json({ message: "Messages older than 1 hour cannot be deleted for everyone" });
        }

        // This is a hard delete (unlike deleteChat/deleteMessages, which just
        // hide the message per-user via deletedBy) — the media's only
        // reference disappears with it, so clean it up in Cloudinary too or
        // it sits there consuming storage forever with nothing pointing to it.
        for (const m of message.media || []) {
            if (!m.publicId) continue;
            try {
                await cloudinary.uploader.destroy(m.publicId, {
                    resource_type: m.mediaType === "video" ? "video" : "image"
                });
            } catch (cloudErr) {
                console.error("Cloudinary message media delete error:", cloudErr);
            }
        }

        await Message.findByIdAndDelete(messageId);

        console.log("Message deleted for everyone:", messageId);

        // SOCKET.IO REAL-TIME EMISSION
        const io = req.app.get("socketio");

        if (io) {
            const receiverId = message.receiver.toString();
            io.to(receiverId).emit("messageDeletedForEveryone", { messageId });
            io.to(senderId).emit("messageDeletedForEveryone", { messageId });
        }

        res.status(200).json({
            message: "Message deleted for everyone successfully"
        });
    } catch (error) {
        console.error("Error in deleteMessageForEveryone:", error);
        res.status(500).json({
            message: "Error deleting message",
            error: error.message
        });
    }
};

// One row per conversation the user is part of: their most recent message
// plus how many of the other person's messages are still unread. Backs the
// messaging sidebar's preview/unread badge (previously a hardcoded
// "Click to chat" string with no real data behind it).
export const getConversations = async (req, res) => {
    try {
        const myId = new mongoose.Types.ObjectId(req.userId);

        const conversations = await Message.aggregate([
            {
                $match: {
                    $or: [{ sender: myId }, { receiver: myId }],
                    deletedBy: { $ne: myId }
                }
            },
            { $sort: { createdAt: -1 } },
            {
                $group: {
                    _id: {
                        $cond: [{ $eq: ["$sender", myId] }, "$receiver", "$sender"]
                    },
                    lastMessage: { $first: "$$ROOT" },
                    unreadCount: {
                        $sum: {
                            $cond: [
                                { $and: [{ $eq: ["$receiver", myId] }, { $eq: ["$isRead", false] }] },
                                1,
                                0
                            ]
                        }
                    }
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "_id",
                    foreignField: "_id",
                    as: "user"
                }
            },
            { $unwind: "$user" },
            {
                $project: {
                    userId: "$user._id",
                    name: "$user.name",
                    username: "$user.username",
                    profilePicture: "$user.profilePicture",
                    lastMessage: {
                        content: "$lastMessage.content",
                        hasMedia: { $gt: [{ $size: { $ifNull: ["$lastMessage.media", []] } }, 0] },
                        createdAt: "$lastMessage.createdAt",
                        isMine: { $eq: ["$lastMessage.sender", myId] }
                    },
                    unreadCount: 1
                }
            },
            { $sort: { "lastMessage.createdAt": -1 } }
        ]);

        res.status(200).json({ conversations });
    } catch (error) {
        console.error("Error in getConversations:", error);
        res.status(500).json({ message: "Error fetching conversations", error: error.message });
    }
};

// Marks the other person's messages to me as read and tells them over the
// socket — the DB write has to happen server-side anyway, so this is the
// natural place for the "messagesRead" emit too (previously only a client
// listener existed with nothing ever emitting it).
export const markMessagesRead = async (req, res) => {
    try {
        const { senderId } = req.body;
        const myId = req.userId;
        if (!senderId) return res.status(400).json({ message: "senderId is required" });

        const result = await Message.updateMany(
            { sender: senderId, receiver: myId, isRead: false },
            { $set: { isRead: true } }
        );

        if (result.modifiedCount > 0) {
            const io = req.app.get("socketio");
            if (io) io.to(senderId.toString()).emit("messagesRead", { readBy: myId });
        }

        res.status(200).json({ message: "Messages marked as read", modifiedCount: result.modifiedCount });
    } catch (error) {
        res.status(500).json({ message: "Error marking messages read", error: error.message });
    }
};