import Message from "../models/message.model.js";

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
        if (!receiverId) {
            return res.status(400).json({ message: "Receiver ID is required" });
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
        const { receiverId } = req.query;
        const senderId = req.userId; // From verifyToken middleware

        console.log("Get messages request:", {
            senderId,
            receiverId
        });

        if (!receiverId) {
            return res.status(400).json({ message: "Receiver ID is required" });
        }

        // Fetch messages between these two users
        // Filter out messages that the current user has "deleted"
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
        .sort({ createdAt: 1 }); // Oldest to newest

        console.log("Messages fetched:", messages.length);

        res.status(200).json(messages);
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

        // SOCKET.IO REAL-TIME EMISSION (optional - to notify other user)
        const io = req.app.get("socketio");
        
        if (io) {
            // Get the messages to find the other user
            const messages = await Message.find({ _id: { $in: messageIds } });
            
            messages.forEach(msg => {
                const otherUserId = msg.sender.toString() === senderId.toString() 
                    ? msg.receiver.toString() 
                    : msg.sender.toString();
                
                io.to(otherUserId).emit("messagesDeleted", { messageIds, deletedBy: senderId });
            });
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

        // Permanently delete the message
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