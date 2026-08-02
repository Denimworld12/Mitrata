import mongoose from "mongoose";

// Conversations themselves aren't a stored document — getConversations
// aggregates them on the fly from Message — so per-user "pin this chat" /
// "mute this chat" preferences need their own small collection instead of
// a field on something that doesn't exist yet.
const conversationPrefSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: true
    },
    peerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: true
    },
    pinned: {
        type: Boolean,
        default: false
    },
    muted: {
        type: Boolean,
        default: false
    },
}, {
    timestamps: true
});

conversationPrefSchema.index({ userId: 1, peerId: 1 }, { unique: true });

const ConversationPref = mongoose.model("conversationPref", conversationPrefSchema);
export default ConversationPref;
