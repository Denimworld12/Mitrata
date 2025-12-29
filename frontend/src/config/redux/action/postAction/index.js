import { createAsyncThunk } from "@reduxjs/toolkit"
import { clientServer } from "@/config";

export const getAllPosts = createAsyncThunk(
    "post/getAllPosts",
    async (_, thunkapi) => {
        try {
            const response = await clientServer.get('/posts')
            console.log(response.data);
            return thunkapi.fulfillWithValue(response.data)

        } catch (error) {
            return thunkapi.rejectWithValue(error.message.data)
        }
    }
) 

export const createPost = createAsyncThunk(
    'post/createPost',
    async (userData, thunkapi) => {
        const { file, body } = userData
        try {
            const formData = new FormData()
            formData.append('token', localStorage.getItem('token'))
            formData.append('body', body)
            formData.append('media', file)
            const response = clientServer.post('/post', formData)
            
            if ((await response).status === 200) {
                return thunkapi.fulfillWithValue("Post successfully")
            }
            else {
                return thunkapi.rejectWithValue('post not uploaded')
            }
        } catch (error) {
            return thunkapi.rejectWithValue(error.response.data)
        }
    }
)


export const deletePost = createAsyncThunk(
    'post/deletePost',
    async (postId, thunkapi) => {
        try {
            const response = await clientServer.post('/delete_post', {
                token: localStorage.getItem('token'),
                post_id: postId
            })
            if (response.status === 200) {
                return thunkapi.fulfillWithValue("Post deleted successfully")
            } else {
                return thunkapi.rejectWithValue("Post not deleted")
            }
        } catch (error) {
            return thunkapi.rejectWithValue(error.response.data)
        }
    }
)

export const incrementLike = createAsyncThunk(
    'post/incrementLike',
    async (postId, thunkapi) => {
        try {
            const response = await clientServer.post('/increment_like', {
                post_id: postId,
                token: localStorage.getItem('token')
            })
            thunkapi.dispatch(getAllPosts());
            if (response.status === 200) {
                return thunkapi.fulfillWithValue("like incremented")
            } else {
                return thunkapi.rejectWithValue("like not incremented")
            }
        } catch (error) {
            return thunkapi.rejectWithValue(error.response.data)
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
                comments: response.data.comments ||[],
                postId: postData.postId
            })
        } catch (error) {
            return thunkapi.rejectWithValue(error.response.data)
        }
    }
)


export const commentPost = createAsyncThunk(
    'post/commentPost',
    async (commentData, thunkapi) => {
        const { postId, commentBody } = commentData
        try {
            const response = await clientServer.post('/comment_post', {
                token: localStorage.getItem('token'),
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
            return thunkapi.rejectWithValue(error.response.data)
        }
    }
)