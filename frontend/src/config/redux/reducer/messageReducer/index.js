import { createSlice } from "@reduxjs/toolkit";
import { getMessages, sendMessage, deleteChat, deleteMessageForEveryone, deleteMessages } from "../../action/messageAction";

const initialState = {
    messages: [],
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
                state.messages = action.payload || [];
            })
            .addCase(getMessages.rejected, (state, action) => {
                state.isLoading = false;
                state.isError = true;
                state.errorMessage = action.payload?.message || "Failed to load messages";
            })

            /* ---------------- SEND MESSAGE ---------------- */
            .addCase(sendMessage.pending, (state) => {
                state.isLoading = true;
                state.isError = false;
                state.errorMessage = null;
            })
            .addCase(sendMessage.fulfilled, (state, action) => {
                state.isLoading = false;

                // Push sent message instantly (optimistic UI)
                state.messages.push(action.payload);
            })
            .addCase(sendMessage.rejected, (state, action) => {
                state.isLoading = false;
                state.isError = true;
                state.errorMessage = action.payload?.message || "Failed to send message";
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
            });
    }
});

export const { pushMessage, resetMessages, removeDeletedMessages } = messageSlice.actions;
export default messageSlice.reducer;
