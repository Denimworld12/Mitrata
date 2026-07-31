import { getAboutUser } from "@/config/redux/action/authAction";
import { useToast } from "@/Components/Toast";
import {
  commentPost,
  createPost,
  deletePost,
  getAllComments,
  getAllPosts,
  reactToPost,
  toggleBookmark,
} from "@/config/redux/action/postAction";
import DashboardLayout from "@/layout/DashboardLayout";
import PageLoader from "@/Components/ui/PageLoader";
import { useRouter } from "next/router";
import React, { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import styles from "./index.module.css";
import {
  setTokenNotThere,
  setTokenThere,
} from "@/config/redux/reducer/authReducer";
import { resetPostId } from "@/config/redux/reducer/postReducer";
import { Base_Url, clientServer } from "@/config";
import Skeleton from "@/Components/ui/Skeleton";
import EmptyState from "@/Components/ui/EmptyState";
import ReportMenu from "@/Components/ReportMenu";
import StoryViewer from "@/Components/StoryViewer";
import { compressImage } from "@/utils/imageProcessing";
import {
  FileText,
  ImagePlus,
  Send,
  Trash2,
  Heart,
  Flame,
  HandHeart,
  Lightbulb,
  MessageCircle,
  Share2,
  Bookmark,
  X,
  Plus,
} from "lucide-react";

const REACTIONS = [
  { type: "like", Icon: Heart },
  { type: "flame", Icon: Flame },
  { type: "handHeart", Icon: HandHeart },
  { type: "lightbulb", Icon: Lightbulb },
];

// Fixed ring-gradient palette for story avatars (same technique as pages/index.jsx avatar dots).
const STORY_GRADIENTS = [
  "linear-gradient(135deg,#0447ff,#7b5cf0)", // blue-violet
  "linear-gradient(135deg,#ff4704,#f0a85e)", // orange-amber
  "linear-gradient(135deg,#8aa86a,#9fb6d4)", // green-sky
  "linear-gradient(135deg,#d98aa6,#8b86d6)", // rose-violet
];

const FEED_TABS = [
  { key: "foryou", label: "For you" },
  { key: "following", label: "Following" },
];

export default function Dashboard() {
  const router = useRouter();
  const dispatch = useDispatch();
  const authState = useSelector((state) => state.auth);
  const postState = useSelector((state) => state.post);
  const fileRef = useRef(null);
  const composerRef = useRef(null);
  const storyFileRef = useRef(null);
  const toast = useToast();

  const [feedTab, setFeedTab] = useState("foryou");
  const [tagQuery, setTagQuery] = useState(null);
  const [allTags, setAllTags] = useState([]);

  // Real stories (24h TTL, connections-only) — replaces the old strip that
  // just relabeled every user in the app as a fake "story".
  const [storyGroups, setStoryGroups] = useState([]);
  const [viewerGroupIndex, setViewerGroupIndex] = useState(null);
  const [uploadingStory, setUploadingStory] = useState(false);

  const refreshStories = () => {
    clientServer.get('/stories').then(({ data }) => setStoryGroups(data.groups || [])).catch(() => {});
  };

  useEffect(() => {
    refreshStories();
  }, []);

  // Backs the "#tag" autocomplete in the composer — same trending-tags
  // endpoint the sidebar already uses, just a wider slice fetched once.
  useEffect(() => {
    clientServer.get('/trending/tags', { params: { limit: 50 } })
      .then(({ data }) => setAllTags(data.tags || []))
      .catch(() => {});
  }, []);

  const tagSuggestions = tagQuery
    ? allTags
        .filter((t) => t.tag.toLowerCase().startsWith(tagQuery.toLowerCase()))
        .slice(0, 6)
    : [];

  // Reads the "#word" token the cursor is currently inside of, if any.
  const updateTagQuery = (text, cursor) => {
    const upToCursor = text.slice(0, cursor);
    const match = upToCursor.match(/#(\w*)$/);
    setTagQuery(match ? match[1] : null);
  };

  const applyTagSuggestion = (tag) => {
    const textarea = composerRef.current;
    const cursor = textarea?.selectionStart ?? postContent.length;
    const upToCursor = postContent.slice(0, cursor);
    const replaced = upToCursor.replace(/#(\w*)$/, `#${tag} `);
    const newContent = replaced + postContent.slice(cursor);
    setPostContent(newContent);
    setTagQuery(null);
    requestAnimationFrame(() => {
      textarea?.focus();
      const pos = replaced.length;
      textarea?.setSelectionRange(pos, pos);
    });
  };

  const myStoryGroupIndex = storyGroups.findIndex((g) => g.user._id === authState.user?.userId?._id);

  const handleStoryFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file again next time
    if (!file || uploadingStory) return;
    setUploadingStory(true);
    try {
      // no-ops for video files — only compresses actual images
      const compressed = await compressImage(file, { maxWidthOrHeight: 1080, quality: 0.8 });
      const formData = new FormData();
      formData.append('media', compressed);
      await clientServer.post('/story', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success("Story posted");
      refreshStories();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to post story");
    } finally {
      setUploadingStory(false);
    }
  };

  // "Following" is a real server-side filter (see getAllPosts' ?feed=following
  // handling) — refetch whenever the tab actually changes feed scope. Skipped
  // on mount (the auth-check effect below already fetches the default feed).
  const isMountedRef = useRef(false);
  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      return;
    }
    dispatch(getAllPosts(feedTab === "following" ? { feed: "following" } : undefined));
  }, [feedTab, dispatch]);
  const [complaints, setComplaints] = useState([]);

  useEffect(() => {
    setComplaints(postState.posts);
  }, [postState.posts]);

  const handleLoadMore = () => {
    if (postState.isLoadingMore || !postState.hasMore) return;
    dispatch(getAllPosts({
      page: postState.page + 1,
      append: true,
      ...(feedTab === "following" ? { feed: "following" } : {}),
    }));
  };
  const [postContent, setPostContent] = useState("");
  const [fileContent, setFileContent] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [commentText, setCommentText] = useState("");
  const [expandedPosts, setExpandedPosts] = useState({});
  const [isMounted, setIsMounted] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [isCommenting, setIsCommenting] = useState(false);

  // 1. Initial Auth Check (Runs only once)
  useEffect(() => {
    setIsMounted(true);
    const token = localStorage.getItem("token");
    if (!token) {
      dispatch(setTokenNotThere());
      router.push("/login");
    } else {
      dispatch(setTokenThere());
      // Only fetch if Redux is empty to avoid "loading everytime"
      if (postState.posts.length === 0) {
        dispatch(getAllPosts());
      }
      if (!authState.user) {
        dispatch(getAboutUser());
      }
    }
  }, []); // Empty dependency array is key for returning users

  // Deep-link from the mobile FAB / any "New post" entry point: /dashboard?compose=1
  useEffect(() => {
    if (router.isReady && router.query.compose === '1') {
      composerRef.current?.focus();
      composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      router.replace('/dashboard', undefined, { shallow: true });
    }
  }, [router.isReady, router.query.compose]);

  // 2. Optimized Refresh Handler
  // Use this after likes/comments to get fresh data without a full page reload

  const handleReact = async (postId, type) => {
    if (!localStorage.getItem("token")) {
      toast.warning("Please login to react");
      return;
    }
    try {
      await dispatch(reactToPost({ postId, type })).unwrap();
    } catch (err) {
      toast.error(err?.message || "Failed to update reaction");
    }
  };

  const handleRefresh = () => {
    dispatch(getAllPosts(feedTab === "following" ? { feed: "following" } : undefined));
  };

  const handlePost = async () => {
    if (isPosting) return; // guard against double-submit (double-click, double-tap)
    if (!postContent.trim() && !fileContent) return;
    setIsPosting(true);
    try {
      await dispatch(createPost({ file: fileContent, body: postContent }));
      setPostContent("");
      setFileContent(null);
      setPreviewUrl(null);
      if (fileRef.current) fileRef.current.value = "";
      handleRefresh();
    } finally {
      setIsPosting(false);
    }
  };

  const handleCommentPost = async () => {
    if (isCommenting) return; // guard against double-submit
    if (!commentText.trim()) return;
    setIsCommenting(true);
    try {
      await dispatch(
        commentPost({
          postId: postState.postId,
          commentBody: commentText.trim(),
        })
      );
      setCommentText("");
      await dispatch(getAllComments({ postId: postState.postId }));
      handleRefresh(); // Updates the comment count on the main card
    } finally {
      setIsCommenting(false);
    }
  };

  const handleDelete = (postId) => {
    if (window.confirm("Are you sure you want to delete this post?")) {
      dispatch(deletePost(postId)).then(() => {
        handleRefresh();
        toast.success("Post deleted.");
      });
    }
  };

  const handleShare = async (postId) => {
    const url = `${window.location.origin}/post/${postId}`;
    try {
      if (navigator.share) {
        await navigator.share({ url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard!");
    } catch (err) {
      if (err.name === "AbortError") return; // user dismissed the native share sheet
      toast.error("Couldn't share this post");
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

  // 3. Scroll Lock Logic (Keep your existing code)
  useEffect(() => {
    if (postState.postId !== "") {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [postState.postId]);

  // Prevent Hydration error
  if (!isMounted) return <PageLoader />;

  // ... your return JSX remains exactly the same

  // --- Render ---
  if (authState.user) {
    return (
              <DashboardLayout>
          <div className={styles.scrollcomponent}>
            {/* Segmented feed tabs: purely local UI state, no backend ranking behind these. */}
            <div className={`${styles.feedTabs} mt-enter-sm`}>
              <div
                className={styles.feedTabsIndicator}
                style={{
                  width: `calc((100% - 8px) / ${FEED_TABS.length})`,
                  transform: `translateX(${FEED_TABS.findIndex((t) => t.key === feedTab) * 100}%)`,
                }}
              />
              {FEED_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={`${styles.feedTab} ${feedTab === tab.key ? styles.feedTabActive : ""}`}
                  onClick={() => setFeedTab(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Stories strip — real 24h stories from me + accepted connections */}
            <div className={`${styles.storiesStrip} mt-enter-sm`}>
              <input
                type="file"
                accept="image/*,video/*"
                ref={storyFileRef}
                style={{ display: 'none' }}
                onChange={handleStoryFileChange}
              />
              <div
                className={styles.storyItem}
                onClick={() => myStoryGroupIndex > -1 ? setViewerGroupIndex(myStoryGroupIndex) : storyFileRef.current?.click()}
              >
                <div className={`${styles.storyRing} ${myStoryGroupIndex === -1 ? styles.storyRingDashed : ""}`}
                  style={myStoryGroupIndex > -1 ? { background: STORY_GRADIENTS[0] } : undefined}
                >
                  <img
                    className={styles.storyAvatar}
                    src={authState.user?.userId?.profilePicture || "/default-avatar.svg"}
                    alt="Your story"
                  />
                  <span
                    className={styles.storyAddBadge}
                    onClick={(e) => { e.stopPropagation(); storyFileRef.current?.click(); }}
                  >
                    <Plus size={12} />
                  </span>
                </div>
                <span className={styles.storyLabel}>{uploadingStory ? "Posting…" : "Your story"}</span>
              </div>

              {storyGroups
                .filter((g) => g.user._id !== authState.user?.userId?._id)
                .map((g, i) => (
                  <div
                    key={g.user._id}
                    className={styles.storyItem}
                    onClick={() => setViewerGroupIndex(storyGroups.findIndex((sg) => sg.user._id === g.user._id))}
                  >
                    <div
                      className={styles.storyRing}
                      style={{ background: g.allViewed ? "var(--mt-border-2)" : STORY_GRADIENTS[i % STORY_GRADIENTS.length] }}
                    >
                      <img
                        className={styles.storyAvatar}
                        src={g.user.profilePicture || "/default-avatar.svg"}
                        alt={g.user.username || "User"}
                      />
                    </div>
                    <span className={styles.storyLabel}>{g.user.username || "User"}</span>
                  </div>
                ))}
            </div>

            {viewerGroupIndex !== null && storyGroups[viewerGroupIndex] && (
              <StoryViewer
                groups={storyGroups}
                startIndex={viewerGroupIndex}
                onClose={() => setViewerGroupIndex(null)}
                onDeleted={() => refreshStories()}
              />
            )}

            {/* Create Post Area (Improved Layout) */}
            <div className={`${styles.createPostContainer} mt-enter`}>
              <div className={styles.composerTop}>
                <img
                  className={styles.userProfile}
                  src={authState.user?.userId?.profilePicture}
                  alt="Profile"
                />
                <div className={styles.textareaWrap}>
                  <textarea
                    ref={composerRef}
                    placeholder="Write your thoughts through post!"
                    className={styles.postTextarea}
                    onInput={(e) => {
                      const textarea = e.target;
                      textarea.style.height = "auto";
                      textarea.style.height = textarea.scrollHeight + "px";
                    }}
                    onChange={(e) => {
                      setPostContent(e.target.value);
                      updateTagQuery(e.target.value, e.target.selectionStart);
                    }}
                    onClick={(e) => updateTagQuery(e.target.value, e.target.selectionStart)}
                    onKeyUp={(e) => updateTagQuery(e.target.value, e.target.selectionStart)}
                    onBlur={() => setTimeout(() => setTagQuery(null), 150)}
                    value={postContent}
                  ></textarea>
                  {tagSuggestions.length > 0 && (
                    <div className={styles.tagSuggestions}>
                      {tagSuggestions.map((t) => (
                        <button
                          type="button"
                          key={t.tag}
                          className={styles.tagSuggestionItem}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => applyTagSuggestion(t.tag)}
                        >
                          #{t.tag}
                          <span className={styles.tagSuggestionCount}>{t.count}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* File Preview and Controls */}
              {(previewUrl || fileContent) && ( // Use || here to check if fileContent exists
                <div className={styles.previewBox}>
                  <img
                    src={previewUrl}
                    alt="preview"
                    className={styles.previewImage}
                  />
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
                    <X size={12} />
                  </button>
                </div>
              )}

              <div className={styles.composerDivider} />

              <div className={styles.createPostFooter}>
                <div className={styles.uploadFileSection}>
                  <label
                    htmlFor={fileContent ? "" : "fileUpload"}
                    style={{ cursor: fileContent ? "not-allowed" : "pointer" }}
                  >
                    <div
                      className={styles.fab}
                      style={fileContent ? { opacity: 0.6 } : {}}
                    >
                      <ImagePlus />
                    </div>
                  </label>

                  <input
                    type="file"
                    hidden
                    id="fileUpload"
                    accept="image/*"
                    ref={fileRef}
                    onChange={async (e) => {
                      const file = e.target.files[0];
                      if (file) {
                        const compressed = await compressImage(file, { maxWidthOrHeight: 1280, quality: 0.8 });
                        setFileContent(compressed);
                        setPreviewUrl(URL.createObjectURL(compressed));
                      }
                    }}
                  />
                  {previewUrl && <span>Image added</span>}
                </div>

                {postContent.length > 0 && (
                  <button
                    onClick={handlePost}
                    disabled={isPosting}
                    className={`${styles.uploadButton} mt-btn-lift`}
                    style={isPosting ? { opacity: 0.6, cursor: "not-allowed" } : {}}
                  >
                    <Send />
                    Post
                  </button>
                )}
              </div>
            </div>

            {/* Posts Feed */}
            <div className={styles.postContainer}>
              {feedTab === "following" && (
                    <p className={styles.feedNote}>Showing posts from people you follow</p>
                  )}
                  {postState.isLoading && (!complaints || complaints.length === 0) ? (
                    <Skeleton rows={3} />
                  ) : complaints && complaints.length === 0 ? (
                    <EmptyState
                      icon={FileText}
                      title="No posts yet"
                      description="When you or your connections share something, it will show up here."
                    />
                  ) : null}
                  {complaints && complaints.map((post, index) => {
                const isExpanded = expandedPosts[post._id] || false;
                const isLongText = post.body?.length > 80;

                return (
                  <div
                    key={post._id}
                    className={`${styles.singleCard} mt-enter mt-card-hover`}
                    style={{ animationDelay: `${Math.min(index, 5) * 60}ms` }}
                  >
                    <div className={styles.singleCard_top}>
                      <div className={styles.singleCard_profileContainer}>
                        <img
                          className={styles.userProfile}
                          src={
                            post.userId?.profilePicture || "/default-avatar.svg"
                          }
                          alt="User Profile"
                        />

                        <div>
                          <p
                            onClick={() => {
                              router.push(
                                `/view_profile/${post?.userId?.username}`
                              );
                            }}
                            className={styles.userName}
                          >
                            {post?.userId?.username}
                          </p>
                          <span className={styles.postTime}>
                            {new Date(post?.createId).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {/* DELETE BUTTON */}
                      {authState.user?.userId?._id === post.userId._id ? (
                        <button
                          className={styles.deleteBtn}
                          onClick={() => handleDelete(post._id)}
                        >
                          <Trash2 />
                        </button>
                      ) : (
                        <ReportMenu targetType="post" targetId={post._id} />
                      )}
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
                              onClick={() =>
                                setExpandedPosts((prev) => ({
                                  ...prev,
                                  [post._id]: true,
                                }))
                              }
                            >
                              ...more
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          <p className={styles.fullText}>{post.body}</p>
                          <span
                            className={styles.showMore}
                            onClick={() =>
                              setExpandedPosts((prev) => ({
                                ...prev,
                                [post._id]: false,
                              }))
                            }
                          >
                            show less
                          </span>
                        </>
                      )}

                      {/* IMAGE */}
                      {post.media ? (
                        <div className={styles.mediaContainer}>
                          <img
                            className={`${styles.postImage} mt-media-zoom`}
                            /* Detect if it is a Cloudinary link or an old local file */
                            src={
                              post.media.startsWith("http")
                                ? post.media
                                : `${Base_Url}/${post.media}`
                            }
                            alt="Post Image"
                          />
                        </div>
                      ) : null}
                    </div>

                    {/* ACTIONS */}
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
                              <Icon fill={active ? "currentColor" : "none"} />
                              {count > 0 && <span>{count}</span>}
                            </div>
                          );
                        })}
                      </div>

                      <div className={styles.actionGroup}>
                        {/* COMMENT */}
                        <div
                          onClick={async () => {
                            // Trigger fetch. Reducer will set postId on fulfillment, opening modal.
                            await dispatch(getAllComments({ postId: post._id }));
                          }}
                          className={styles.actionBtn}
                        >
                          <MessageCircle />
                        </div>

                        {/* SHARE */}
                        <div className={styles.actionBtn} onClick={() => handleShare(post._id)}>
                          <Share2 />
                        </div>

                        {/* BOOKMARK */}
                        <div
                          className={`${styles.actionBtn} ${post.bookmarked ? `${styles.actionBtnActive} mt-pop` : ""
                            }`}
                          onClick={() => handleBookmark(post._id)}
                        >
                          <Bookmark
                            fill={post.bookmarked ? "currentColor" : "none"}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {complaints && complaints.length > 0 && postState.hasMore && (
                <button
                  type="button"
                  className={styles.loadMoreBtn}
                  onClick={handleLoadMore}
                  disabled={postState.isLoadingMore}
                >
                  {postState.isLoadingMore ? "Loading…" : "Load more"}
                </button>
              )}
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
                    <X />
                  </span>
                </div>

                <div className={styles.commentsList}>
                  {postState.comments?.length === 0 && (
                    <p className={styles.noCommentsText}>
                      No comments yet. Be the first to comment!
                    </p>
                  )}

                  {/* Reverse comments list for newest first display (if API doesn't do it) */}
                  {postState.comments?.length > 0 &&
                    [...postState.comments].reverse().map((item, i) => {
                      return (
                        <div key={i} className={styles.singleCommentContainer}>
                          {" "}
                          {/* NEW: Wrap comment for complex layout */}
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
                      );
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
                    disabled={!commentText.trim() || isCommenting} // Disable while empty or in-flight
                  >
                    Comment
                  </button>
                </div>
              </div>
            </div>
          )}
        </DashboardLayout>
    );
  } else {
    return (
              <DashboardLayout>
          <div className="loading">...loading</div>
        </DashboardLayout>
    );
  }
}
