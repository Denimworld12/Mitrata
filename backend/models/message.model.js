import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
    // The person sending the message
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: true
    },
    // The person receiving the message
    receiver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: true
    },
    // The actual text content
    content: {
        type: String,
        trim: true,
        // Content is optional if they are only sending images/videos
        default: ""
    },
    // Array to handle up to 5 media files
    media: [
        {
            url: String,       // Cloudinary or local URL
            mediaType: {
                type: String,
                enum: ['image', 'video'],
                required: true
            },
            publicId: String   // Useful for deleting from Cloudinary later
        }
    ],
    // Message status
    isRead: {
        type: Boolean,
        default: false
    },
    // For the "Delete Chat" or "Delete Message" logic
    // We use "deletedBy" to allow one person to delete a chat 
    // without it disappearing for the other person
    deletedBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }]
}, {
    timestamps: true // This gives us createdAt (Message Time) and updatedAt
});

// Indexing for faster retrieval of conversations between two people
messageSchema.index({ sender: 1, receiver: 1, createdAt: -1 });

const Message = mongoose.model("Message", messageSchema);
export default Message;