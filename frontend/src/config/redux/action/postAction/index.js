import { createAsyncThunk } from "@reduxjs/toolkit"
import { clientServer } from "@/config";

export const getAllPosts = createAsyncThunk(
    "post/getAllPosts",
    async (params, thunkapi) => {
        try {
            // Token is auto-attached via axios interceptor
            const response = await clientServer.get("/posts", {
                params: {
                    page: params?.page || 1,
                    limit: params?.limit || 20
                }
            });

            return thunkapi.fulfillWithValue(response.data);

        } catch (error) {
            return thunkapi.rejectWithValue(
                error.response?.data || error.message
            );
        }
    }
);


export const createPost = createAsyncThunk(
    'post/createPost',
    async (userData, thunkapi) => {
        const { file, body } = userData
        try {
            const formData = new FormData()
            formData.append('body', body)
            if (file) formData.append('media', file)
            // Token is auto-attached via axios interceptor
            const response = await clientServer.post('/post', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            })

            if (response.status === 200) {
                return thunkapi.fulfillWithValue("Post successfully")
            }
            else {
                return thunkapi.rejectWithValue('post not uploaded')
            }
        } catch (error) {
            return thunkapi.rejectWithValue(error.response?.data || { message: "Post failed" })
        }
    }
)


export const deletePost = createAsyncThunk(
    'post/deletePost',
    async (postId, thunkapi) => {
        try {
            // Token is auto-attached via axios interceptor
            const response = await clientServer.post('/delete_post', {
                post_id: postId
            })
            if (response.status === 200) {
                return thunkapi.fulfillWithValue("Post deleted successfully")
            } else {
                return thunkapi.rejectWithValue("Post not deleted")
            }
        } catch (error) {
            return thunkapi.rejectWithValue(error.response?.data || { message: "Delete failed" })
        }
    }
)

export const incrementLike = createAsyncThunk(
    'post/incrementLike',
    async (postId, thunkapi) => {
        try {
            // Token is auto-attached via axios interceptor
            const response = await clientServer.post('/increment_like', {
                post_id: postId
            })
            thunkapi.dispatch(getAllPosts());
            if (response.status === 200) {
                return thunkapi.fulfillWithValue("like incremented")
            } else {
                return thunkapi.rejectWithValue("like not incremented")
            }
        } catch (error) {
            return thunkapi.rejectWithValue(error.response?.data || { message: "Like failed" })
        }
    }
)


export const getAllComments = createAsyncThunk(
    'post/getAllComments',
    async (postData, thunkapi) => {
        try {
            const response = await clientServer.get('/getcomment_by_post', {
                params: {
                    post_id: postData.postId
                }
            })
            return thunkapi.fulfillWithValue({
                comments: response.data.comments || [],
                postId: postData.postId
            })
        } catch (error) {
            return thunkapi.rejectWithValue(error.response?.data || { message: "Failed to load comments" })
        }
    }
)


export const commentPost = createAsyncThunk(
    'post/commentPost',
    async (commentData, thunkapi) => {
        const { postId, commentBody } = commentData
        try {
            // Token is auto-attached via axios interceptor
            const response = await clientServer.post('/comment_post', {
                post_id: postId,
                commentBody: commentBody
            })
            thunkapi.dispatch(getAllComments({ postId }));
            if (response.status === 200) {
                return thunkapi.fulfillWithValue("Comment added successfully")
            } else {
                return thunkapi.rejectWithValue("Comment not added")
            }
        } catch (error) {
            return thunkapi.rejectWithValue(error.response?.data || { message: "Comment failed" })
        }
    }
)