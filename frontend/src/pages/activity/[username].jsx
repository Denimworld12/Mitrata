import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/router';
import { useDispatch, useSelector } from 'react-redux';
import styles from './index.module.css';
import DashboardLayout from '@/layout/DashboardLayout';
import ReportMenu from '@/Components/ReportMenu';
import EmptyState from '@/Components/ui/EmptyState';
import PageLoader from '@/Components/ui/PageLoader';
import BlastLoader from '@/Components/ui/BlastLoader';
import { getPostsByUsername, deletePost, reactToPost, getAllComments, commentPost, toggleBookmark } from '@/config/redux/action/postAction';
import { resetPostId } from '@/config/redux/reducer/postReducer';
import { Base_Url } from '@/config';
import { useToast } from '@/Components/Toast';
import {
    ArrowLeft, Trash2, X, FileText,
    Heart, Flame, HandHeart, Lightbulb,
    MessageCircle, Share2, Bookmark,
} from 'lucide-react';

// Same reaction set as the dashboard feed — this page shows the identical
// per-post data (post.counts / post.reactions), so the pill row matches
// exactly rather than being its own one-off "like only" button.
const REACTIONS = [
    { type: 'like', Icon: Heart },
    { type: 'flame', Icon: Flame },
    { type: 'handHeart', Icon: HandHeart },
    { type: 'lightbulb', Icon: Lightbulb },
];

export default function UserActivityPage() {
    const router = useRouter();
    const { username } = router.query;
    const dispatch = useDispatch();

    const postState = useSelector((state) => state.post);
    const authState = useSelector((state) => state.auth);

    const [mounted, setMounted] = useState(false);
    const [commentText, setCommentText] = useState("");
    const [expandedPosts, setExpandedPosts] = useState({});
    const toast = useToast();

    const refreshData = () => {
        if (username) dispatch(getPostsByUsername({ username }));
    };

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
    }, []);

    // Was reusing whatever was already in Redux for `posts` (the global
    // feed) whenever it was non-empty — which could just as easily be a
    // `feed=following` list from the dashboard, one that by definition
    // never contains your own posts. Fetches this user's real posts
    // directly instead, whenever `username` is actually available.
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token && username) {
            dispatch(getPostsByUsername({ username }));
        }
    }, [dispatch, username]);

    const userPosts = postState.userPosts || [];

    const isOwner = authState.user?.userId?.username === username;

    const handleReact = async (postId, type) => {
        try {
            await dispatch(reactToPost({ postId, type })).unwrap();
        } catch (error) {
            toast.error(error?.message || 'Failed to update reaction');
        }
    };

    const handleBookmark = async (postId) => {
        try {
            const { bookmarked } = await dispatch(toggleBookmark(postId)).unwrap();
            toast.info(bookmarked ? "Post bookmarked" : "Bookmark removed");
        } catch (error) {
            toast.error(error?.message || "Failed to update bookmark");
        }
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
        toast.success("Link copied to clipboard!");
    };

    const handleDelete = (postId) => {
        if (window.confirm("Are you sure you want to delete this post?")) {
            dispatch(deletePost(postId)).then(() => {
                refreshData();
                toast.success("Post deleted.");
            });
        }
    };

    const ActivityContent = (
        <div className={styles.activityContainer}>
            <button className={`${styles.backBtn} mt-btn-lift`} onClick={() => router.back()}>
                <ArrowLeft size={16} strokeWidth={2} />
                Back to Profile
            </button>

            <div className={styles.pageHeader}>
                <h1>{isOwner ? "Your Activity" : `${username}'s Activity`}</h1>
                <p className={styles.postCount}>{userPosts.length} post{userPosts.length === 1 ? '' : 's'}</p>
            </div>

            {!postState.userPostsLoaded ? (
                <div className="w-full flex items-center justify-center py-16">
                    <BlastLoader size={48} />
                </div>
            ) : userPosts.length === 0 ? (
                <EmptyState
                    icon={FileText}
                    title="No posts yet"
                    description={isOwner ? "Anything you post will show up here." : "This user hasn't posted anything yet."}
                />
            ) : (
                <div className={styles.postsFeed}>
                    {userPosts.map((post, index) => {
                        const isExpanded = expandedPosts[post._id] || false;
                        const isLongText = post.body?.length > 220;

                        return (
                            <div
                                key={post._id}
                                className={`${styles.postCard} mt-enter mt-card-hover`}
                                style={{ animationDelay: `${Math.min(index, 5) * 60}ms` }}
                            >
                                <div className={styles.postHeader}>
                                    <div className={styles.userMeta}>
                                        <img
                                            className={styles.miniAvatar}
                                            src={post.userId?.profilePicture || "/default-avatar.svg"}
                                            alt="avatar"
                                        />
                                        <div className={styles.metaText}>
                                            <p className={styles.userName}>{post.userId?.name || post.userId?.username}</p>
                                            <p className={styles.postDate}>{new Date(post.createdAt || post.createId).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                    {isOwner ? (
                                        <button className={styles.deleteBtn} onClick={() => handleDelete(post._id)} title="Delete post">
                                            <Trash2 size={17} strokeWidth={1.8} />
                                        </button>
                                    ) : (
                                        <ReportMenu targetType="post" targetId={post._id} />
                                    )}
                                </div>

                                <div className={styles.postBody}>
                                    <p className={styles.postContent}>
                                        {isLongText && !isExpanded ? `${post.body.slice(0, 220)}…` : post.body}
                                    </p>
                                    {isLongText && (
                                        <span
                                            className={styles.showMore}
                                            onClick={() => setExpandedPosts((prev) => ({ ...prev, [post._id]: !isExpanded }))}
                                        >
                                            {isExpanded ? 'show less' : 'show more'}
                                        </span>
                                    )}
                                    {post.media && post.media.trim() !== "" && (
                                        <div className={styles.mediaContainer}>
                                            <img
                                                src={post.media.startsWith("http") ? post.media : `${Base_Url}/${post.media}`}
                                                className={styles.postImg}
                                                alt="content"
                                            />
                                        </div>
                                    )}
                                </div>

                                <div className={styles.postActions}>
                                    <div className={styles.reactionGroup}>
                                        {REACTIONS.map(({ type, Icon }) => {
                                            const active = post?.reactions?.type === type;
                                            const count = post?.counts?.[type] || 0;
                                            return (
                                                <div
                                                    key={type}
                                                    className={`${styles.actionBtn} ${active ? `${styles.actionBtnActive} mt-pop` : ""}`}
                                                    onClick={() => handleReact(post._id, type)}
                                                >
                                                    <Icon size={17} strokeWidth={1.8} fill={active ? "currentColor" : "none"} />
                                                    {count > 0 && <span>{count}</span>}
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className={styles.actionGroup}>
                                        <div className={styles.actionBtn} onClick={() => dispatch(getAllComments({ postId: post._id }))}>
                                            <MessageCircle size={17} strokeWidth={1.8} />
                                        </div>
                                        <div className={styles.actionBtn} onClick={() => handleShare(post._id)}>
                                            <Share2 size={17} strokeWidth={1.8} />
                                        </div>
                                        <div
                                            className={`${styles.actionBtn} ${post.bookmarked ? `${styles.actionBtnActive} mt-pop` : ""}`}
                                            onClick={() => handleBookmark(post._id)}
                                        >
                                            <Bookmark size={17} strokeWidth={1.8} fill={post.bookmarked ? "currentColor" : "none"} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {postState.postId !== "" && (
                <div className={styles.commentsOverlay} onClick={() => dispatch(resetPostId())}>
                    <div className={styles.commentsPopup} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.commentsHeader}>
                            <h3>Comments</h3>
                            <span className={styles.closeBtn} onClick={() => dispatch(resetPostId())}>
                                <X size={18} strokeWidth={1.8} />
                            </span>
                        </div>
                        <div className={styles.commentsList}>
                            {postState.comments?.length === 0 ? (
                                <p className={styles.noCommentsText}>No comments yet.</p>
                            ) : (
                                [...postState.comments].reverse().map((item, i) => (
                                    <div key={i} className={styles.singleCommentContainer}>
                                        <img
                                            className={styles.commentAvatar}
                                            src={item?.userId?.profilePicture || "/default-avatar.svg"}
                                            alt="avatar"
                                        />
                                        <div className={styles.singleComment}>
                                            <span className={styles.commentUser}>{item?.userId?.username || "User"}</span>
                                            <p className={styles.commentMsg}>{item.body}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className={styles.commentInputBar}>
                            <input
                                type="text"
                                value={commentText}
                                onChange={(e) => setCommentText(e.target.value)}
                                placeholder="Write a comment..."
                                onKeyDown={(e) => e.key === 'Enter' && handleCommentSubmit()}
                            />
                            <button onClick={handleCommentSubmit} disabled={!commentText.trim()}>Post</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    if (!mounted) return <PageLoader />;
    return <DashboardLayout>{ActivityContent}</DashboardLayout>;
}
