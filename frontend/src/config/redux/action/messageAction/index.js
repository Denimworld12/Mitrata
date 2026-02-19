import { clientServer } from "@/config";
import { createAsyncThunk } from "@reduxjs/toolkit";

export const sendMessage = createAsyncThunk(
    "message/sendMessage",
    async (payload, thunkApi) => {
        try {
            const { receiverId, content, media } = payload;

            // Create FormData for file upload
            const formData = new FormData();
            formData.append('receiverId', receiverId);
            formData.append('content', content || '');

            // Append media files (up to 5)
            if (media && media.length > 0) {
                if (media.length > 5) {
                    throw new Error("Maximum 5 media files allowed");
                }
                media.forEach(file => {
                    formData.append('media', file);
                });
            }

            // Token is auto-attached via axios interceptor
            const response = await clientServer.post('/user/send_message', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            return response.data;
        } catch (error) {
            console.error('Send message error:', error.response?.data || error.message);
            const message = error.response?.data?.message || error.message || "Failed to send message";
            return thunkApi.rejectWithValue({ message });
        }
    }
);

export const getMessages = createAsyncThunk(
    "message/getMessages",
    async (payload, thunkApi) => {
        try {
            const { receiverId, page, limit } = payload;

            if (!receiverId) {
                throw new Error("Receiver ID is required");
            }

            // Token is auto-attached via axios interceptor
            const response = await clientServer.get('/user/get_messages', {
                params: {
                    receiverId,
                    page: page || 1,
                    limit: limit || 50
                }
            });

            return response.data;
        } catch (error) {
            const message = error.response?.data?.message || error.message || "Failed to fetch messages";
            return thunkApi.rejectWithValue({ message });
        }
    }
);

export const deleteChat = createAsyncThunk(
    "message/deleteChat",
    async (payload, thunkApi) => {
        try {
            const { receiverId } = payload;

            if (!receiverId) {
                throw new Error("Receiver ID is required");
            }

            // Token is auto-attached via axios interceptor
            const response = await clientServer.post('/user/delete_chat', { receiverId });

            return response.data;
        } catch (error) {
            const message = error.response?.data?.message || error.message || "Failed to delete chat";
            return thunkApi.rejectWithValue({ message });
        }
    }
);


// Delete specific messages (delete for me)
export const deleteMessages = createAsyncThunk(
    "message/deleteMessages",
    async (payload, thunkApi) => {
        try {
            const { messageIds } = payload;

            if (!messageIds || messageIds.length === 0) {
                throw new Error("Message IDs are required");
            }

            // SINGLE batch API call (fixes the sequential loop lag)
            // Token is auto-attached via axios interceptor
            const response = await clientServer.post('/user/delete_messages', { messageIds });

            return { ...response.data, messageIds };
        } catch (error) {
            const message = error.response?.data?.message || error.message || "Failed to delete messages";
            return thunkApi.rejectWithValue({ message });
        }
    }
);

// Delete message for everyone
export const deleteMessageForEveryone = createAsyncThunk(
    "message/deleteMessageForEveryone",
    async (payload, thunkApi) => {
        try {
            const { messageId } = payload;

            if (!messageId) {
                throw new Error("Message ID is required");
            }

            // Token is auto-attached via axios interceptor
            const response = await clientServer.post('/user/delete_message_for_everyone', { messageId });

            return { ...response.data, messageId };
        } catch (error) {
            const message = error.response?.data?.message || error.message || "Failed to delete message";
            return thunkApi.rejectWithValue({ message });
        }
    }
);