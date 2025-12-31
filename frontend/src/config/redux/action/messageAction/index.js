import { clientServer } from "@/config";
import { createAsyncThunk } from "@reduxjs/toolkit";

export const sendMessage = createAsyncThunk(
    "message/sendMessage",
    async (payload, thunkApi) => {
        try {
            const { receiverId, content, media } = payload;
            
            // Get token from localStorage FIRST
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error("Authentication token not found");
            }

            // Create FormData for file upload
            const formData = new FormData();
            formData.append('receiverId', receiverId);
            formData.append('content', content || '');
            formData.append('token', token); // Add token to form data
            
            // Append media files (up to 5)
            if (media && media.length > 0) {
                if (media.length > 5) {
                    throw new Error("Maximum 5 media files allowed");
                }
                media.forEach(file => {
                    formData.append('media', file);
                });
            }

            console.log('Sending message with token:', token.substring(0, 20) + '...');

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
            const { receiverId } = payload;
            
            if (!receiverId) {
                throw new Error("Receiver ID is required");
            }

            // Get token from localStorage
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error("Authentication token not found");
            }

            // Send request - Token in query params as your backend expects
            const response = await clientServer.get('/user/get_messages', {
                params: { 
                    token,  // Token in query params
                    receiverId 
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

            // Get token from localStorage
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error("Authentication token not found");
            }

            // Send request - Token in body
            const response = await clientServer.post('/user/delete_chat', 
                { 
                    receiverId,
                    token  // Token in body
                }
            );

            return response.data;
        } catch (error) {
            const message = error.response?.data?.message || error.message || "Failed to delete chat";
            return thunkApi.rejectWithValue({ message });
        }
    }
);


// NEW: Delete specific messages
export const deleteMessages = createAsyncThunk(
    "message/deleteMessages",
    async (payload, thunkApi) => {
        try {
            const { messageIds } = payload;
            
            if (!messageIds || messageIds.length === 0) {
                throw new Error("Message IDs are required");
            }

            // Get token from localStorage
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error("Authentication token not found");
            }

            // Send request
            const response = await clientServer.post('/user/delete_messages', 
                { 
                    messageIds,
                    token
                }
            );

            return { ...response.data, messageIds };
        } catch (error) {
            const message = error.response?.data?.message || error.message || "Failed to delete messages";
            return thunkApi.rejectWithValue({ message });
        }
    }
);

// NEW: Delete message for everyone
export const deleteMessageForEveryone = createAsyncThunk(
    "message/deleteMessageForEveryone",
    async (payload, thunkApi) => {
        try {
            const { messageId } = payload;
            
            if (!messageId) {
                throw new Error("Message ID is required");
            }

            // Get token from localStorage
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error("Authentication token not found");
            }

            // Send request
            const response = await clientServer.post('/user/delete_message_for_everyone', 
                { 
                    messageId,
                    token
                }
            );

            return { ...response.data, messageId };
        } catch (error) {
            const message = error.response?.data?.message || error.message || "Failed to delete message";
            return thunkApi.rejectWithValue({ message });
        }
    }
);