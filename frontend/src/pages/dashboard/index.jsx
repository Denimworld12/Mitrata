import { getAboutUser } from '@/config/redux/action/authAction';
import { commentPost, createPost, deletePost, getAllComments, getAllPosts, incrementLike } from '@/config/redux/action/postAction';
import DashboardLayout from '@/layout/DashboardLayout';
import UserLayout from '@/layout/userLayout'
import { useRouter } from 'next/router';
import React, { useEffect, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux';
import styles from './index.module.css'
import { setTokenNotThere, setTokenThere } from '@/config/redux/reducer/authReducer';
import { resetPostId } from '@/config/redux/reducer/postReducer';
import { Base_Url } from '@/config';

export default function Dashboard() { // Renamed export to Dashboard for Next.js convention
    const router = useRouter();
    const dispatch = useDispatch();
    const authState = useSelector((state) => state.auth)
    const postState = useSelector((state) => state.post)
    const fileRef = useRef(null);

    // --- State Management ---
    const [postContent, setPostContent] = useState("");
    const [fileContent, setFileContent] = useState(null)
    const [previewUrl, setPreviewUrl] = useState(null);
    const [commentText, setCommentText] = useState("");
    const [expandedPosts, setExpandedPosts] = useState({});

    // --- Handlers ---
    const toggleExpand = (postId) => {
        setExpandedPosts(prev => ({
            ...prev,
            [postId]: !prev[postId]
        }));
    };

    const handlePost = async () => {
        if (!postContent.trim() && !fileContent) return;

        await dispatch(createPost({ file: fileContent, body: postContent }))

        // Reset local state and trigger refresh
        setPostContent('')
        setFileContent(null)
        setPreviewUrl(null)
        if (fileRef.current) {
            fileRef.current.value = "";
        }
        dispatch(getAllPosts());
    }

    const handleDelete = (postId) => {
        dispatch(deletePost(postId)).then(() => {
            dispatch(getAllPosts()); // Fetch all posts after deletion
        });
    }

    const handleCommentPost = async () => {
        if (!commentText.trim()) return;

        await dispatch(commentPost({
            postId: postState.postId,
            commentBody: commentText.trim()
        }))

        setCommentText("")
        // Fetch comments again to show the newly posted comment
        await dispatch(getAllComments({ postId: postState.postId }))
    }

    // --- Effects ---
    useEffect(() => {
        const token = localStorage.getItem("token");
        if (token) {
            dispatch(setTokenThere());
        } else {
            dispatch(setTokenNotThere());
            router.push('/login')
        }
    }, [dispatch, router]);

    useEffect(() => {
        if (authState.isTokenThere && localStorage.getItem('token')) {
            dispatch(getAllPosts())
            dispatch(getAboutUser({ token: localStorage.getItem('token') }))
        }
    }, [authState.isTokenThere, dispatch])
    useEffect(() => {
        if (postState.postId !== "") {
            // Disable scroll on the main page
            document.body.style.overflow = "hidden";
        } else {
            // Re-enable scroll
            document.body.style.overflow = "unset";
        }

        // Cleanup function to ensure scroll is re-enabled if component unmounts
        return () => {
            document.body.style.overflow = "unset";
        };
    }, [postState.postId]);

    // --- Render ---
    if (authState.user) {
        return (
            <UserLayout>
                <DashboardLayout>

                    <div className={styles.scrollcomponent}>

                        {/* Create Post Area (Improved Layout) */}
                        <div className={styles.createPostContainer}>
                            <div style={{ display: 'flex', width: '100%', gap: '1rem', alignItems: 'flex-start' }}>
                                <img
                                    className={styles.userProfile}
                                    src={authState.user?.userId?.profilePicture}
                                    alt="Profile"
                                />
                                <textarea
                                    placeholder='Write your thoughts through post!'
                                    className={styles.postTextarea}
                                    onInput={(e) => {
                                        const textarea = e.target;
                                        textarea.style.height = "auto";
                                        textarea.style.height = textarea.scrollHeight + "px";
                                    }}
                                    onChange={(e) => setPostContent(e.target.value)}
                                    value={postContent}>
                                </textarea>
                            </div>

                            {/* File Preview and Controls */}
                            {(previewUrl || fileContent) && ( // Use || here to check if fileContent exists
                                <div className={styles.previewBox} style={{ marginLeft: '48px', marginTop: '10px' }}>
                                    <img src={previewUrl} alt="preview" className={styles.previewImage} />
                                    <button
                                        className={styles.removeImageBtn}
                                        onClick={() => {
                                            setFileContent(null);
                                            setPreviewUrl(null);
                                            if (fileRef.current) {
                                                fileRef.current.value = "";
                                            }
                                        }}
                                    >
                                        ✕
                                    </button>
                                </div>
                            )}

                            <div className={styles.createPostFooter} style={previewUrl ? { marginTop: '10px' } : {}}>
                                <div className={styles.uploadFileSection}>
                                    <label htmlFor={fileContent ? "" : "fileUpload"} style={{ cursor: fileContent ? "not-allowed" : "pointer" }}>
                                        <div className={styles.fab} style={fileContent ? { opacity: 0.6 } : {}}>
                                            {/* File Icon SVG */}
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-6">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10.5v6m3-3H9m4.06-7.19-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
                                            </svg>
                                        </div>
                                    </label>

                                    <input
                                        type="file"
                                        hidden
                                        id="fileUpload"
                                        accept="image/*"
                                        ref={fileRef}
                                        onChange={(e) => {
                                            const file = e.target.files[0];
                                            if (file) {
                                                setFileContent(file);
                                                setPreviewUrl(URL.createObjectURL(file));
                                            }
                                        }}
                                    />
                                    {previewUrl && <span style={{ fontSize: '0.9rem', color: '#555' }}>Image added</span>}
                                </div>


                                {postContent.length > 0 &&
                                    <button
                                        onClick={handlePost}
                                        className={styles.uploadButton}>
                                        {/* Send Icon SVG */}
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-6">
                                            <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
                                        </svg>

                                    </button>
                                }
                            </div>
                        </div>

                        {/* Posts Feed */}
                        <div className={styles.postContainer}>
                            {postState.posts.map((post) => {
                                const isExpanded = expandedPosts[post._id] || false;
                                const isLongText = post.body?.length > 80;

                                return (
                                    <div key={post._id} className={styles.singleCard}>

                                        <div className={styles.singleCard_top}>
                                            <div className={styles.singleCard_profileContainer}>
                                                <img
                                                    className={styles.userProfile}
                                                    src={post.userId?.profilePicture || "/default-avatar.png"}
                                                    alt="User Profile"
                                                />

                                                <div>
                                                    <p className={styles.userName}>{post?.userId?.username}</p>
                                                    <span className={styles.postTime}>
                                                        {new Date(post?.createId).toLocaleString()}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* DELETE BUTTON */}
                                            {authState.user?.userId?._id === post.userId._id &&
                                                <button
                                                    className={styles.deleteBtn}
                                                    onClick={() => handleDelete(post._id)}
                                                >
                                                    {/* DELETE ICON */}
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
                                                        <path fillRule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 0 1 3.878.512.75.75 0 1 1-.256 1.478l-.209-.035-1.005 13.07a3 3 0 0 1-2.991 2.77H8.084a3 3 0 0 1-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 0 1-.256-1.478A48.567 48.567 0 0 1 7.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 0 1 3.369 0c1.603.051 2.815 1.387 2.815 2.951Zm-6.136-1.452a51.196 51.196 0 0 1 3.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 0 0-6 0v-.113c0-.794.609-1.428 1.364-1.452Zm-.355 5.945a.75.75 0 1 0-1.5.058l.347 9a.75.75 0 1 0 1.499-.058l-.346-9Zm5.48.058a.75.75 0 1 0-1.498-.058l-.347 9a.75.75 0 0 0 1.5.058l.345-9Z" clipRule="evenodd" />
                                                    </svg>
                                                </button>
                                            }

                                        </div>

                                        {/* POST BODY */}
                                        <div className={styles.postBody}>

                                            {!isExpanded ? (
                                                <>
                                                    <p className={styles.postText}>
                                                        {post.body.slice(0, 80)}
                                                    </p>

                                                    {isLongText && (
                                                        <span
                                                            className={styles.showMore}
                                                            onClick={() => toggleExpand(post._id)}
                                                        >
                                                            {isExpanded ? "Show less" : "...more"}
                                                        </span>
                                                    )}
                                                </>
                                            ) : (
                                                <>
                                                    <p className={styles.fullText}>{post.body}</p>
                                                    <span className={styles.showMore} onClick={() => setExpandedPosts(prev => ({
                                                        ...prev,
                                                        [post._id]: false
                                                    }))}>
                                                        show less
                                                    </span>
                                                </>
                                            )}

                                            {/* IMAGE */}
                                            {post.media ? (
                                                <img
                                                    className={styles.postImage}
                                                    /* Detect if it is a Cloudinary link or an old local file */
                                                    src={post.media.startsWith("http") ? post.media : `${Base_Url}/${post.media}`}
                                                    alt="Post Image"
                                                />
                                            ) : null}
                                        </div>

                                        {/* ACTIONS */}
                                        <div className={styles.postActions}>

                                            {/* LIKE */}
                                            <div className={styles.actionBtn}
                                                onClick={async () => {
                                                    await dispatch(incrementLike(post._id))
                                                    await dispatch(getAllPosts());
                                                }}
                                            >
                                                {/* Thumbs Up Icon SVG */}
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-6">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.25c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 0 1 2.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 0 0 .322-1.672V2.75a.75.75 0 0 1 .75-.75 2.25 2.25 0 0 1 2.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282m0 0h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 0 1-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 0 0-1.423-.23H5.904m10.598-9.75H14.25M5.904 18.5c.083.205.173.405.27.602.197.4-.078.898-.523.898h-.908c-.889 0-1.713-.518-1.972-1.368a12 12 0 0 1-.521-3.507c0-1.553.295-3.036.831-4.398C3.387 9.953 4.167 9.5 5 9.5h1.053c.472 0 .745.556.5.96a8.958 8.958 0 0 0-1.302 4.665c0 1.194.232 2.333.654 3.375Z" />
                                                </svg>

                                                <span>{post.likes} Likes</span>
                                            </div>

                                            {/* COMMENT */}
                                            <div
                                                onClick={async () => {
                                                    // Trigger fetch. Reducer will set postId on fulfillment, opening modal.
                                                    await dispatch(getAllComments({ postId: post._id }))
                                                }}
                                                className={styles.actionBtn}>
                                                {/* Chat Bubble Icon SVG */}
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                                                    <path fillRule="evenodd" d="M4.804 21.644A6.707 6.707 0 0 0 6 21.75a6.721 6.721 0 0 0 3.583-1.029c.774.182 1.584.279 2.417.279 5.322 0 9.75-3.97 9.75-9 0-5.03-4.428-9-9.75-9s-9.75 3.97-9.75 9c0 2.409 1.025 4.587 2.674 6.192.232.226.277.428.254.543a3.73 3.73 0 0 1-.814 1.686.75.75 0 0 0 .44 1.223ZM8.25 10.875a1.125 1.125 0 1 0 0 2.25 1.125 1.125 0 0 0 0-2.25ZM10.875 12a1.125 1.125 0 1 1 2.25 0 1.125 1.125 0 0 1-2.25 0Zm4.875-1.125a1.125 1.125 0 1 0 0 2.25 1.125 1.125 0 0 0 0-2.25Z" clipRule="evenodd" />
                                                </svg>
                                                <span>Comments</span>
                                            </div>

                                            {/* SHARE */}
                                            <div className={styles.actionBtn}>
                                                {/* Share Icon SVG */}
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-6">
                                                    <path fillRule="evenodd" d="M2.25 2.25a.75.75 0 0 0 0 1.5H3v10.5a3 3 0 0 0 3 3h1.21l-1.172 3.513a.75.75 0 0 0 1.424.474l.329-.987h8.418l.33.987a.75.75 0 0 0 1.422-.474l-1.17-3.513H18a3 3 0 0 0 3-3V3.75h.75a.75.75 0 0 0 0-1.5H2.25Zm6.54 15h6.42l.5 1.5H8.29l.5-1.5Zm8.085-8.995a.75.75 0 1 0-.75-1.299 12.81 12.81 0 0 0-3.558 3.05L11.03 8.47a.75.75 0 0 0-1.06 0l-3 3a.75.75 0 1 0 1.06 1.06l2.47-2.47 1.617 1.618a.75.75 0 0 0 1.146-.102 11.312 11.312 0 0 1 3.612-3.321Z" clipRule="evenodd" />
                                                </svg>
                                                <span>Share</span>
                                            </div>

                                        </div>

                                    </div>
                                );
                            })}

                        </div>
                    </div>

                    {/* Comments Modal/Overlay (FIXED) */}
                    {postState.postId !== "" && (
                        <div
                            className={styles.commentsOverlay}
                            onClick={() => {
                                dispatch(resetPostId());
                                setCommentText(""); // Clear comment text on modal close
                            }}
                        >
                            <div
                                className={styles.commentsPopup}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className={styles.commentsHeader}>
                                    <h3>Comments</h3>
                                    <span
                                        className={styles.closeBtn}
                                        onClick={() => {
                                            dispatch(resetPostId());
                                            setCommentText("");
                                        }}
                                    >
                                        ✕
                                    </span>
                                </div>

                                <div className={styles.commentsList}>
                                    {postState.comments?.length === 0 && (
                                        <p className={styles.noCommentsText}>No comments yet. Be the first to comment!</p>
                                    )}

                                    {/* Reverse comments list for newest first display (if API doesn't do it) */}
                                    {postState.comments?.length > 0 && [...postState.comments].reverse().map((item, i) => {
                                        return (
                                            <div key={i} className={styles.singleCommentContainer}> {/* NEW: Wrap comment for complex layout */}

                                                {/* 1. Profile Picture */}
                                                <img
                                                    className={styles.commentUserProfile} // NEW CLASS
                                                    src={item?.userId?.profilePicture}
                                                    alt={`${item?.userId?.username}'s profile`}
                                                />

                                                {/* 2. Comment Content */}
                                                <div className={styles.singleComment}>
                                                    <span className={styles.commentUser}>
                                                        {item?.userId?.username || "User"}
                                                    </span>
                                                    <p className={styles.commentMsg}>{item.body}</p>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>

                                {/* Bottom Input Box */}
                                <div className={styles.commentInputBar}>
                                    <input
                                        type="text"
                                        value={commentText}
                                        onChange={(e) => setCommentText(e.target.value)}
                                        placeholder="Write a comment..."
                                    />
                                    <button
                                        onClick={handleCommentPost}
                                        disabled={!commentText.trim()} // Disable button if empty
                                    >
                                        Comment
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}


                </DashboardLayout >
            </UserLayout >
        )
    }

    else {
        return (
            <UserLayout>
                <DashboardLayout>
                    <div className="loading">
                        ...loading
                    </div>
                </DashboardLayout>
            </UserLayout>
        )
    }
}