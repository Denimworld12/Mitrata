import { createSlice } from '@reduxjs/toolkit';
import { commentPost, createPost, getAllComments, getAllPosts } from '../../action/postAction';



const initialState = {
    posts: [],
    isError: false,
    postFetched: false,
    isLoading: false,
    loggedIn: false,
    message: "",
    comments: [],
    postId: ""
}

const postSlice = createSlice({
    name: "post",
    initialState,
    reducers: {
        reset: () => initialState,
        resetPostId: (state) => {
            state.postId = ""
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(getAllPosts.pending, (state, action) => {
                state.message = action.payload || "Feching all posts ";
                state.isLoading = true,
                    state.isError = false
            })
            .addCase(getAllPosts.fulfilled, (state, action) => {
                state.isLoading = false,
                state.message = action.payload,
                state.isError = false,
                state.postFetched = true,
                state.posts = action.payload.posts.reverse()
            })
            .addCase(getAllPosts.rejected, (state, action) => {
                state.message = action.payload,
                    state.isLoading = false,
                    state.isError = true
            })
            .addCase(createPost.fulfilled, (state, action) => {
                state.message = action.payload
                state.isLoading = false
                state.isError= false
            })
            .addCase(createPost.rejected, (state, action) => {
                state.message = action.payload
                state.isLoading = false
                state.isError= true
            }
            )
            .addCase(getAllComments.fulfilled, (state, action) => {
                state.comments = action.payload.comments
                state.postId = action.payload.postId
                state.isLoading = false
                state.isError = false
            })
            .addCase(getAllComments.rejected, (state, action) => {
                state.message = action.payload
                state.isLoading = false
                state.isError = true
                state.comments = []; // Clear comments on fetch error
                state.postId = ""; // Close modal on fetch error
            }
            )
            .addCase(getAllComments.pending, (state) => {
                state.isLoading = true;
                // Keep postId until fulfillment/rejection to prevent modal flicker
            })
            .addCase(commentPost.fulfilled, (state, action) => {
                state.message = action.payload
                state.isLoading = false
                state.isError = false
            })
            .addCase(commentPost.rejected, (state, action) => {
                state.message = action.payload
                state.isLoading = false
                state.isError = true
            }
            )
        }
})
export const { reset, resetPostId } = postSlice.actions
export default postSlice.reducer