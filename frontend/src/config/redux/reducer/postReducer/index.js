import { createSlice } from '@reduxjs/toolkit';
import { commentPost, createPost, getAllComments, getAllPosts, getBookmarkedPosts, getLikedPosts, getPostsByUsername, reactToPost, toggleBookmark } from '../../action/postAction';



const initialState = {
    posts: [],
    likedPosts: [],
    bookmarkedPosts: [],
    userPosts: [],
    userPostsHasMore: false,
    userPostsPage: 1,
    isError: false,
    postFetched: false,
    isLoading: false,
    isLoadingMore: false,
    hasMore: false,
    page: 1,
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
                const isLoadMore = !!action.meta.arg?.append;
                state.message = action.payload || "Feching all posts ";
                state.isLoading = !isLoadMore;
                state.isLoadingMore = isLoadMore;
                state.isError = false
            })
            .addCase(getAllPosts.fulfilled, (state, action) => {
                const { posts, hasMore, page } = action.payload;
                state.isLoading = false;
                state.isLoadingMore = false;
                state.isError = false;
                state.postFetched = true;
                state.hasMore = !!hasMore;
                state.page = page || 1;
                // Server returns sorted posts, no need to .reverse()
                state.posts = action.meta.arg?.append
                    ? [...state.posts, ...(posts || [])]
                    : (posts || []);
            })
            .addCase(getAllPosts.rejected, (state, action) => {
                state.message = action.payload,
                    state.isLoading = false,
                    state.isLoadingMore = false,
                    state.isError = true
            })
            .addCase(createPost.fulfilled, (state, action) => {
                state.message = action.payload
                state.isLoading = false
                state.isError = false
            })
            .addCase(createPost.rejected, (state, action) => {
                state.message = action.payload
                state.isLoading = false
                state.isError = true
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
            .addCase(reactToPost.fulfilled, (state, action) => {
                // Patch the single post in place — no full refetch needed,
                // this is the same data getAllPosts already returns per-post.
                // Also patches userPosts (activity/profile/view_profile's own
                // posts list) — same post, same shape, just a different array.
                const { postId, counts, likeCount, dislikeCount, reactions } = action.payload;
                for (const list of [state.posts, state.userPosts]) {
                    const post = list.find((p) => p._id === postId);
                    if (post) {
                        post.counts = counts;
                        post.likeCount = likeCount;
                        post.dislikeCount = dislikeCount;
                        post.reactions = reactions;
                    }
                }
            })
            .addCase(getLikedPosts.fulfilled, (state, action) => {
                state.likedPosts = action.payload.posts || []
            })
            .addCase(toggleBookmark.fulfilled, (state, action) => {
                const { postId, bookmarked } = action.payload;
                for (const list of [state.posts, state.userPosts]) {
                    const post = list.find((p) => p._id === postId);
                    if (post) post.bookmarked = bookmarked;
                }
            })
            .addCase(getBookmarkedPosts.fulfilled, (state, action) => {
                state.bookmarkedPosts = action.payload.posts || []
            })
            .addCase(getPostsByUsername.fulfilled, (state, action) => {
                const { posts, hasMore, page } = action.payload;
                state.userPosts = page > 1 ? [...state.userPosts, ...(posts || [])] : (posts || []);
                state.userPostsHasMore = !!hasMore;
                state.userPostsPage = page || 1;
            })
    }
})
export const { reset, resetPostId } = postSlice.actions
export default postSlice.reducer