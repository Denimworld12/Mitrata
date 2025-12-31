import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/router';
import { useDispatch, useSelector } from 'react-redux';
import styles from './index.module.css';
import UserLayout from '@/layout/userLayout';
import DashboardLayout from '@/layout/DashboardLayout';
import { getAllPosts, deletePost, incrementLike, getAllComments, commentPost } from '@/config/redux/action/postAction';
import { resetPostId } from '@/config/redux/reducer/postReducer';
import { Base_Url } from '@/config';

export default function UserActivityPage() {
    const router = useRouter();
    const { username } = router.query;
    const dispatch = useDispatch();
    
    const postState = useSelector((state) => state.post);
    const authState = useSelector((state) => state.auth);
    
    const [mounted, setMounted] = useState(false);
    const [isMobileOrTablet, setIsMobileOrTablet] = useState(false);
    const [commentText, setCommentText] = useState("");
    const refreshData = () => {
        const token = localStorage.getItem('token');
        if (token) {
            dispatch(getAllPosts({ token }));
        }
    };
    // --- NEW: Scroll Lock Logic ---
    useEffect(() => {
        if (postState.postId !== "") {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "unset";
        }
        return () => { document.body.style.overflow = "unset"; };
    }, [postState.postId]);
    useEffect(() => {
        setMounted(true);
        const token = localStorage.getItem('token');
        
        // Only fetch if Redux is empty to prevent "loading every time" flicker
        if (token && postState.posts.length === 0) {
            dispatch(getAllPosts({ token }));
        }
    }, [dispatch]);
    useEffect(() => {
        
        const handleResize = () => setIsMobileOrTablet(window.innerWidth <= 1024);
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const token = localStorage.getItem('token');
        dispatch(getAllPosts({ token }));
    }, [dispatch]);

    const userPosts = useMemo(() => {
        if (postState.posts && username) {
            return postState.posts.filter(post => post.userId?.username === username);
        }
        return [];
    }, [postState.posts, username]);

    const isOwner = authState.user?.userId?.username === username;

    const handleLike = async (postId) => {
       await dispatch(incrementLike(postId));
        refreshData();
    };

    const handleCommentSubmit = async () => {
        if (!commentText.trim()) return;
        await dispatch(commentPost({
            postId: postState.postId,
            commentBody: commentText.trim()
        }));
        setCommentText("");
        dispatch(getAllComments({ postId: postState.postId }));
        refreshData();
    };

    const handleShare = (postId) => {
        const shareUrl = `${window.location.origin}/post/${postId}`;
        navigator.clipboard.writeText(shareUrl);
        alert("Link copied to clipboard!");
    };

    const handleDelete = (postId) => {
        if (window.confirm("Are you sure?")) {
            dispatch(deletePost(postId)).then(() => {
                dispatch(getAllPosts());
            });
        }
    };

    const ActivityContent = (
        <div className={styles.activityContainer}>
            <div className={styles.navigationRow}>
                <button className={styles.backBtn} onClick={() => router.back()}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="18"><path d="M15 18l-6-6 6-6" /></svg>
                    Back to Profile
                </button>
            </div>

            <div className={styles.pageHeader}>
                <h1>{isOwner ? "Your Activity" : `${username}'s Activity`}</h1>
                <p className={styles.postCount}>{userPosts.length} posts</p>
            </div>

            <div className={styles.postsFeed}>
                {userPosts.map((post) => (
                    <div key={post._id} className={styles.postCard}>
                        <div className={styles.postHeader}>
                            <div className={styles.userMeta}>
                                <img 
                                    className={styles.miniAvatar}
                                    src={post.userId?.profilePicture ? (post.userId.profilePicture.startsWith("http") ? post.userId.profilePicture : `${Base_Url}/${post.userId.profilePicture}`) : "/default-avatar.png"} 
                                    alt="avatar" 
                                />
                                <div className={styles.metaText}>
                                    <p className={styles.userName}>{post.userId?.name || post.userId?.username}</p>
                                    <p className={styles.postDate}>{new Date(post.createdAt || post.createId).toLocaleDateString()}</p>
                                </div>
                            </div>
                            {isOwner && (
                                <button className={styles.deleteBtn} onClick={() => handleDelete(post._id)}>
                                    <svg viewBox="0 0 24 24" fill="currentColor" width="18"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                                </button>
                            )}
                        </div>

                        <div className={styles.postBody}>
                            <p className={styles.postContent}>{post.body}</p>
                            {post.media && post.media.trim() !== "" && (
                                <div className={styles.mediaContainer}>
                                    <img src={post.media.startsWith("http") ? post.media : `${Base_Url}/${post.media}`} className={styles.postImg} alt="content" />
                                </div>
                            )}
                        </div>

                        <div className={styles.postActions}>
                            <div className={styles.actionBtn} onClick={() => handleLike(post._id)}>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width="20"><path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.25c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 0 1 2.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 0 0 .322-1.672V2.75a.75.75 0 0 1 .75-.75 2.25 2.25 0 0 1 2.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282m0 0h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 0 1-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 0 0-1.423-.23H5.904m10.598-9.75H14.25M5.904 18.5c.083.205.173.405.27.602.197.4-.078.898-.523.898h-.908c-.889 0-1.713-.518-1.972-1.368a12 12 0 0 1-.521-3.507c0-1.553.295-3.036.831-4.398C3.387 9.953 4.167 9.5 5 9.5h1.053c.472 0 .745.556.5.96a8.958 8.958 0 0 0-1.302 4.665c0 1.194.232 2.333.654 3.375Z" /></svg>
                                <span>{post.likes}</span>
                            </div>

                            <div className={styles.actionBtn} onClick={() => dispatch(getAllComments({ postId: post._id }))}>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width="20"><path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25-9 3.694-9 8.25c0 2.155.894 4.12 2.346 5.61.15.155.23.365.2.573l-.521 3.124a2.404 2.404 0 0 0 2.747 2.747l3.125-.521c.207-.03.417.05.572.2.15.15.355.23.573.2.03.03.03.03.03.03Z" /></svg>
                                <span>Comment</span>
                            </div>

                            <div className={styles.actionBtn} onClick={() => handleShare(post._id)}>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width="20"><path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" /></svg>
                                <span>Share</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {postState.postId !== "" && (
                <div className={styles.commentsOverlay} onClick={() => dispatch(resetPostId())}>
                    <div className={styles.commentsPopup} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.commentsHeader}>
                            <h3>Comments</h3>
                            <span className={styles.closeBtn} onClick={() => dispatch(resetPostId())}>✕</span>
                        </div>
                        <div className={styles.commentsList}>
                            {postState.comments?.length === 0 ? (
                                <p className={styles.noCommentsText}>No comments yet.</p>
                            ) : (
                                [...postState.comments].reverse().map((item, i) => (
                                    <div key={i} className={styles.singleCommentContainer}>
                                        <img className={styles.commentAvatar} src={item?.userId?.profilePicture ? (item.userId.profilePicture.startsWith("http") ? item.userId.profilePicture : `${Base_Url}/${item.userId.profilePicture}`) : "/default-avatar.png"} alt="avatar" />
                                        <div className={styles.commentContent}>
                                            <span className={styles.commentUser}>{item?.userId?.username || "User"}</span>
                                            <p className={styles.commentMsg}>{item.body}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className={styles.commentInputBar}>
                            <input type="text" value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Write a comment..." />
                            <button onClick={handleCommentSubmit} disabled={!commentText.trim()}>Post</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    if (!mounted) return <UserLayout>{ActivityContent}</UserLayout>;
    return (
        <UserLayout>
            {isMobileOrTablet ? (
                <DashboardLayout>{ActivityContent}</DashboardLayout>
            ) : (
                <div style={{ paddingTop: '80px', width: '100%', overflowX: 'hidden' }}>{ActivityContent}</div>
            )}
        </UserLayout>
    );
}