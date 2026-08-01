import { createSlice } from "@reduxjs/toolkit";
import { getMessages, sendMessage, deleteChat, deleteMessageForEveryone, deleteMessages, getConversations, markMessagesRead } from "../../action/messageAction";

const initialState = {
    messages: [],
    conversations: [],
    isLoading: false,
    isError: false,
    errorMessage: null,
};

const messageSlice = createSlice({
    name: "message",
    initialState,
    reducers: {
        /* Socket real-time message */
        pushMessage: (state, action) => {
            state.messages.push(action.payload);
        },

        /* Reset chat when switching user */
        resetMessages: (state) => {
            state.messages = [];
            state.isLoading = false;
            state.isError = false;
            state.errorMessage = null;
        },
        removeDeletedMessages: (state, action) => {
            const { messageIds } = action.payload;
            state.messages = state.messages.filter(
                msg => !messageIds.includes(msg._id)
            );
        },

        /* The other person just read our messages (socket "messagesRead") —
           flip isRead on our own sent messages in the currently open thread
           so the sent/read tick updates live. */
        markMyMessagesRead: (state) => {
            state.messages.forEach((msg) => {
                msg.isRead = true;
            });
        },

        /* A "newMessage" socket event only ever pushed into the currently
           open thread — the sidebar's conversation list (preview text,
           unread badge, recency sort) never updated for it, so a message
           from anyone you weren't actively chatting with sat there stale
           until a full reload. */
        bumpConversation: (state, action) => {
            const { senderId, lastMessage, isActiveChat } = action.payload;
            const convo = state.conversations.find((c) => c.userId === senderId);
            if (convo) {
                convo.lastMessage = lastMessage;
                if (!isActiveChat) convo.unreadCount = (convo.unreadCount || 0) + 1;
            } else {
                state.conversations.push({
                    userId: senderId,
                    lastMessage,
                    unreadCount: isActiveChat ? 0 : 1
                });
            }
        }
    },

    extraReducers: (builder) => {
        builder
            /* ---------------- GET MESSAGES ---------------- */
            .addCase(getMessages.pending, (state) => {
                state.isLoading = true;
                state.isError = false;
                state.errorMessage = null;
            })
            .addCase(getMessages.fulfilled, (state, action) => {
                state.isLoading = false;
                // Handle paginated response format
                const payload = action.payload;
                if (payload && payload.messages) {
                    state.messages = payload.messages;
                } else if (Array.isArray(payload)) {
                    state.messages = payload;
                } else {
                    state.messages = [];
                }
            })
            .addCase(getMessages.rejected, (state, action) => {
                state.isLoading = false;
                state.isError = true;
                state.errorMessage = action.payload?.message || "Failed to load messages";
            })

            /* ---------------- SEND MESSAGE ---------------- */
            .addCase(sendMessage.pending, (state, action) => {
                state.isLoading = true;
                state.isError = false;
                state.errorMessage = null;

                // A real optimistic placeholder — the actual round trip
                // (DB write, Cloudinary upload if there's media) can take a
                // beat, and showing nothing in the thread until it resolves
                // is what made sending feel laggy. RTK auto-attaches a
                // requestId to every dispatch of this thunk, shared across
                // its pending/fulfilled/rejected — used here purely to find
                // and replace/flag THIS specific placeholder later, not sent
                // to the server.
                const { receiverId, content, senderId, media } = action.meta.arg;
                state.messages.push({
                    _id: `pending-${action.meta.requestId}`,
                    __pendingId: action.meta.requestId,
                    __status: 'sending',
                    // File objects aren't kept here (Redux state should stay
                    // serializable) — __hadMedia just lets a failed retry
                    // warn that any attachment needs to be re-picked, rather
                    // than silently retrying text-only and dropping it.
                    __hadMedia: !!(media && media.length > 0),
                    content: content || '',
                    media: [],
                    sender: senderId,
                    receiver: receiverId,
                    isRead: false,
                    createdAt: new Date().toISOString(),
                });
            })
            .addCase(sendMessage.fulfilled, (state, action) => {
                state.isLoading = false;
                const idx = state.messages.findIndex((m) => m.__pendingId === action.meta.requestId);
                if (idx !== -1) {
                    state.messages[idx] = action.payload;
                } else {
                    state.messages.push(action.payload);
                }
            })
            .addCase(sendMessage.rejected, (state, action) => {
                state.isLoading = false;
                state.isError = true;
                state.errorMessage = action.payload?.message || "Failed to send message";
                // Left in the thread flagged as failed (not removed) — losing
                // what you just typed silently on a network blip is worse
                // than showing a "failed, tap to retry" bubble.
                const idx = state.messages.findIndex((m) => m.__pendingId === action.meta.requestId);
                if (idx !== -1) {
                    state.messages[idx].__status = 'failed';
                }
            })

            /* ---------------- DELETE CHAT ---------------- */
            .addCase(deleteChat.pending, (state) => {
                state.isLoading = true;
                state.isError = false;
                state.errorMessage = null;
            })
            .addCase(deleteChat.fulfilled, (state) => {
                state.isLoading = false;
                state.messages = [];
            })
            .addCase(deleteChat.rejected, (state, action) => {
                state.isLoading = false;
                state.isError = true;
                state.errorMessage = action.payload?.message || "Failed to delete chat";
            })
            .addCase(deleteMessages.pending, (state) => {
                state.isLoading = true;
                state.isError = false;
                state.errorMessage = null;
            })
            .addCase(deleteMessages.fulfilled, (state, action) => {
                state.isLoading = false;
                // Remove deleted messages from state
                const { messageIds } = action.payload;
                state.messages = state.messages.filter(
                    msg => !messageIds.includes(msg._id)
                );
            })
            .addCase(deleteMessages.rejected, (state, action) => {
                state.isLoading = false;
                state.isError = true;
                state.errorMessage = action.payload?.message || "Failed to delete messages";
            })

            /* ---------------- DELETE MESSAGE FOR EVERYONE ---------------- */
            .addCase(deleteMessageForEveryone.pending, (state) => {
                state.isLoading = true;
                state.isError = false;
                state.errorMessage = null;
            })
            .addCase(deleteMessageForEveryone.fulfilled, (state, action) => {
                state.isLoading = false;
                // Remove message from state
                const { messageId } = action.payload;
                state.messages = state.messages.filter(
                    msg => msg._id !== messageId
                );
            })
            .addCase(deleteMessageForEveryone.rejected, (state, action) => {
                state.isLoading = false;
                state.isError = true;
                state.errorMessage = action.payload?.message || "Failed to delete message for everyone";
            })

            /* ---------------- CONVERSATIONS ---------------- */
            .addCase(getConversations.fulfilled, (state, action) => {
                state.conversations = action.payload.conversations || [];
            })

            /* ---------------- MARK READ ---------------- */
            .addCase(markMessagesRead.fulfilled, (state, action) => {
                const { senderId } = action.payload;
                const convo = state.conversations.find((c) => c.userId === senderId);
                if (convo) convo.unreadCount = 0;
            });
    }
});

export const { pushMessage, resetMessages, removeDeletedMessages, markMyMessagesRead, bumpConversation } = messageSlice.actions;
export default messageSlice.reducer;
