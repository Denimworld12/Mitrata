import styles from "./index.module.css"
import React, { useEffect, useState, useMemo } from 'react'
import { Base_Url, clientServer } from '@/config'
import { useDispatch, useSelector } from 'react-redux'
import { getAboutUser, getConnectionRequest, updateUserProfile, updateAccountSettings } from '@/config/redux/action/authAction'
import { useRouter } from 'next/router'
import { getPostsByUsername, getBookmarkedPosts, getLikedPosts } from '@/config/redux/action/postAction'
import DashboardLayout from '@/layout/DashboardLayout' // Added for Tablet/Mobile logic
import Skeleton from '@/Components/ui/Skeleton'
import { Camera, Pencil, ArrowRight, Plus, X, Heart, Bookmark } from 'lucide-react'
import EmptyState from '@/Components/ui/EmptyState'
import PageLoader from '@/Components/ui/PageLoader'
import BlastLoader from '@/Components/ui/BlastLoader'
import { useToast } from '@/Components/Toast'
import { compressImage, resizeToExactSize } from '@/utils/imageProcessing'

// 4:1 banner — a clean, fixed ratio so every profile's cover looks
// consistent regardless of what shape photo someone uploads (see
// resizeToExactSize, which crops to this exactly before upload).
const COVER_WIDTH = 1600;
const COVER_HEIGHT = 400;

export default function Profile() {
  const dispatch = useDispatch()
  const authState = useSelector((state) => state.auth);
  const postState = useSelector((state) => state.post);
  const router = useRouter()

  const toast = useToast();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false); // New: track changes
  const [mounted, setMounted] = useState(false); // New: for layout sync
  const [contentTab, setContentTab] = useState('posts'); // New: Posts/Media/Liked segmented control

  const [isHighlightModalOpen, setIsHighlightModalOpen] = useState(false);
  const [newHighlightTitle, setNewHighlightTitle] = useState('');
  const [newHighlightFile, setNewHighlightFile] = useState(null);
  const [savingHighlight, setSavingHighlight] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  const handleAddHighlight = async (e) => {
    e.preventDefault();
    if (!newHighlightFile || savingHighlight) return;
    setSavingHighlight(true);
    try {
      const compressed = await compressImage(newHighlightFile, { maxWidthOrHeight: 800, quality: 0.85 });
      const fData = new FormData();
      fData.append('image', compressed);
      const { data } = await clientServer.post('/upload/image', fData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const nextHighlights = [
        ...(userProfile?.highlights || []),
        { title: newHighlightTitle.trim(), cover: data.url }
      ];
      const result = await dispatch(updateUserProfile({ highlights: nextHighlights }));
      if (updateUserProfile.fulfilled.match(result)) {
        dispatch(getAboutUser());
        setIsHighlightModalOpen(false);
        setNewHighlightTitle('');
        setNewHighlightFile(null);
      } else {
        toast.error(result.payload?.message || 'Failed to save highlight');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to upload cover image');
    } finally {
      setSavingHighlight(false);
    }
  };

  useEffect(() => {
    if (contentTab === 'liked') dispatch(getLikedPosts());
    if (contentTab === 'saved') dispatch(getBookmarkedPosts());
  }, [contentTab, dispatch]);

  const userProfile = authState.user;
  const isOwner = true;

  const [formData, setFormData] = useState({
    name: "",
    username: "",
    bio: "",
    currentPost: "",
    pastWork: [],
    education: []
  });
  const [usernameError, setUsernameError] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);
  useEffect(() => {
    if (isEditModalOpen) {
      // Prevent background scrolling
      document.body.style.overflow = 'hidden';
      // Optional: Prevent "jump" by accounting for scrollbar width
      document.body.style.paddingRight = '5px';
    } else {
      // Re-enable background scrolling
      document.body.style.overflow = 'unset';
      document.body.style.paddingRight = '0px';
    }

    // Cleanup when component unmounts
    return () => {
      document.body.style.overflow = 'unset';
      document.body.style.paddingRight = '0px';
    };
  }, [isEditModalOpen]);
  useEffect(() => {
    if (userProfile && userProfile.userId) { // Added userId check
      setFormData({
        name: userProfile.userId?.name || "",
        username: userProfile.userId?.username || "",
        bio: userProfile.bio || "",
        currentPost: userProfile.currentPost || "",
        pastWork: userProfile.pastWork || [],
        education: userProfile.education || []
      });
      setIsDirty(false); // Reset dirty state on sync
      setUsernameError("");
    }
  }, [userProfile, isEditModalOpen]);

  useEffect(() => {
    const token = localStorage.getItem('token');

    if (token) {
      // 1. Fetch user profile and connection requests immediately using the
      // token directly from localStorage
      dispatch(getAboutUser());
      dispatch(getConnectionRequest());
    } else {
      // 2. No token? Redirect to login immediately
      router.push('/login');
    }
  }, [dispatch, router]); // Dependency array should be stable

  // Was filtering one page of the engagement-ranked global feed by user id —
  // your own posts that didn't rank into that page were invisible on your
  // own profile. Fetches your real posts directly instead, once the
  // username is known (getAboutUser resolves it above).
  const username = userProfile?.userId?.username;
  useEffect(() => {
    if (username) dispatch(getPostsByUsername({ username }));
  }, [dispatch, username]);

  const tokenExists = typeof window !== 'undefined' ? !!localStorage.getItem('token') : false;
  const userPosts = postState.userPosts || [];

  const recentPosts = userPosts.slice(0, 3);
  const hasMorePosts = userPosts.length > 3;

  const connectionsCount = useMemo(() => {
    return (authState.connection || []).filter(c => c.status_accepted === true).length;
  }, [authState.connection]);

  const mediaPosts = useMemo(() => userPosts.filter(post => !!post.media), [userPosts]);

  // Wrapper to track if user touched the form
  const updateForm = (newData) => {
    setFormData(newData);
    setIsDirty(true);
  };

  const handleSafeClose = () => {
    if (isDirty) {
      const confirm = window.confirm("You have unsaved changes. Are you sure you want to exit?");
      if (!confirm) return;
    }
    setIsEditModalOpen(false);
  };

  const handleArrayChange = (index, field, value, type) => {
    const updatedArray = [...formData[type]];
    updatedArray[index] = { ...updatedArray[index], [field]: value };
    updateForm({ ...formData, [type]: updatedArray });
  };

  const addArrayItem = (type) => {
    const newItem = type === 'pastWork'
      ? { company: "", position: "", years: "" }
      : { school: "", degree: "", feildStudy: "" };
    updateForm({ ...formData, [type]: [newItem, ...formData[type]] }); // Add to top
  };

  const removeArrayItem = (index, type) => {
    const updatedArray = formData[type].filter((_, i) => i !== index);
    updateForm({ ...formData, [type]: updatedArray });
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setUsernameError("");

    // Username lives on the User doc, not the Profile doc — a separate
    // endpoint (with its own uniqueness check) handles it, same one Settings
    // used to call directly before this moved here.
    const trimmedUsername = formData.username.trim();
    if (trimmedUsername !== userProfile.userId?.username) {
      const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
      if (!usernameRegex.test(trimmedUsername)) {
        setUsernameError("3-30 characters, letters/numbers/underscores only");
        return;
      }
      const usernameResult = await dispatch(updateAccountSettings({ username: trimmedUsername }));
      if (!updateAccountSettings.fulfilled.match(usernameResult)) {
        setUsernameError(usernameResult.payload?.message || "Username already taken");
        return;
      }
    }

    const { username, ...profileFields } = formData;
    const result = await dispatch(updateUserProfile(profileFields));

    if (updateUserProfile.fulfilled.match(result)) {
      setIsEditModalOpen(false);
      dispatch(getAboutUser());
    } else {
      toast.error(result.payload?.message || 'Failed to update profile');
    }
  };

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (file) {
      try {
        const compressed = await compressImage(file, { maxWidthOrHeight: 600, quality: 0.85 });
        const fData = new FormData();
        fData.append('profilePicture', compressed);
        await clientServer.post('/user/update_profile_picture', fData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        dispatch(getAboutUser());
      } catch (error) {
        console.error("Profile picture update failed", error);
        toast.error("Failed to update profile picture");
      }
    }
  }

  const handleCoverChange = async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setUploadingCover(true);
    try {
      // Cropped (cover-fit) to an exact 1600x400 (4:1) before it ever
      // leaves the browser — every banner ends up the same shape regardless
      // of what the source photo's own aspect ratio was.
      const banner = await resizeToExactSize(file, { width: COVER_WIDTH, height: COVER_HEIGHT, quality: 0.85 });
      const fData = new FormData();
      fData.append('coverPhoto', banner);
      await clientServer.post('/user/update_cover_photo', fData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      dispatch(getAboutUser());
      toast.success("Cover photo updated");
    } catch (error) {
      console.error("Cover photo update failed", error);
      toast.error("Failed to update cover photo");
    } finally {
      setUploadingCover(false);
    }
  }

  // FIXED: Added "mounted" check to prevent hydration mismatch errors
  if (mounted && !userProfile && tokenExists) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto mt-8 px-4">
          <Skeleton rows={2} />
        </div>
      </DashboardLayout>
    );
  }


  // --- Profile Page Content Variable ---
  const MainContent = (
    <div className={styles.container}>
      <div className={styles.coverWrapper}>
        <div
          className={styles.backDropContainer}
          style={userProfile?.userId?.coverPhoto ? {
            backgroundImage: `url(${userProfile.userId.coverPhoto})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          } : undefined}
        >
          {isOwner && (
            <label
              className={styles.changeCoverBtn}
              htmlFor="coverPhotoUpdate"
              title={`Recommended ${COVER_WIDTH}×${COVER_HEIGHT} (4:1) — any image is auto-cropped to fit`}
            >
              <Camera size={15} strokeWidth={1.8} />
              <span>{uploadingCover ? 'Uploading…' : 'Change cover'}</span>
              <input
                type="file"
                id="coverPhotoUpdate"
                onChange={handleCoverChange}
                accept="image/*"
                style={{ display: 'none' }}
                disabled={uploadingCover}
              />
            </label>
          )}
        </div>
        <div className={styles.profileImageContainer}>
          <div className={styles.imageWrapper}>
            <img
              className={styles.profileImage}
              src={userProfile?.userId?.profilePicture || "/default-avatar.svg"} // Added optional chaining
              alt="profile"
            />
            {isOwner && (
              <div className={styles.imageOverlay}>
                <label className={styles.labeledImageOverlay} htmlFor="profilePictureUpdate">
                  <Camera size={18} strokeWidth={1.8} />
                  <span>Edit Image</span>
                  <input type="file" id="profilePictureUpdate" onChange={handleImageChange} accept="image/*" style={{ display: "none" }} />
                </label>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={styles.profileContentWrapper}>
        <div className={styles.profileDetails}>
          <div className={styles.profileHeaderContent}>
            <div className={styles.profileNameSection}>
              <div className={styles.nameRow}>
                <h2>{userProfile?.userId?.name || "User"}</h2> {/* Added optional chaining */}
                {isOwner && (
                  <button className={`${styles.editIconBtn} mt-btn-lift`} onClick={() => setIsEditModalOpen(true)}><Pencil size={14} strokeWidth={2} /> Edit Profile</button>
                )}
              </div>
              <p className={styles.headline}>{userProfile?.currentPost || "Member"}</p> {/* Added optional chaining */}
              <p className={styles.profileUsername}>@{userProfile?.userId?.username}</p> {/* Added optional chaining */}
            </div>
          </div>

          <div className={styles.statsRow}>
            <div className={`${styles.statCard} mt-enter`}>
              <span className={styles.statNumber}>{connectionsCount}</span>
              <span className={styles.statLabel}>Connections</span>
            </div>
            <div className={`${styles.statCard} mt-enter`} style={{ animationDelay: '60ms' }}>
              <span className={styles.statNumber}>{userPosts.length}</span>
              <span className={styles.statLabel}>Posts</span>
            </div>
          </div>

          <div className={`${styles.highlightsStrip} mt-enter`} style={{ animationDelay: '90ms' }}>
            {(userProfile?.highlights || []).map((h, idx) => (
              <div key={idx} className={styles.highlightItem}>
                <div className={styles.highlightRing} style={{ background: 'var(--mt-grad)' }}>
                  <span
                    className={styles.highlightRingInner}
                    style={h.cover ? { backgroundImage: `url(${h.cover})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
                  />
                </div>
                <span className={styles.highlightLabel}>{h.title || 'Highlight'}</span>
              </div>
            ))}
            <div className={styles.highlightItem} onClick={() => setIsHighlightModalOpen(true)} style={{ cursor: 'pointer' }}>
              <div className={styles.highlightRingDashed}>
                <Plus size={16} strokeWidth={2} />
              </div>
              <span className={styles.highlightLabel}>New</span>
            </div>
          </div>

          <div className={`${styles.profileBio} mt-enter`} style={{ animationDelay: '120ms' }}>
            <h3>About</h3>
            <p>{userProfile?.bio || 'This user has not yet added a bio.'}</p> {/* Added optional chaining */}
          </div>

          <div className={`${styles.infoSection} mt-enter`} style={{ animationDelay: '180ms' }}>
            <h3>Experience</h3>
            {userProfile?.pastWork?.length > 0 ? ( // Added optional chaining
              userProfile.pastWork.map((work, idx) => (
                <div key={idx} className={styles.infoItem}>
                  <h4>{work.position}</h4>
                  <p>{work.company} • {work.years}</p>
                </div>
              ))
            ) : <p className={styles.noDataText}>No experience listed.</p>}
          </div>

          <div className={`${styles.infoSection} mt-enter`} style={{ animationDelay: '240ms' }}>
            <h3>Education</h3>
            {userProfile?.education?.length > 0 ? ( // Added optional chaining
              userProfile.education.map((edu, idx) => (
                <div key={idx} className={styles.infoItem}>
                  <h4>{edu.school}</h4>
                  <p>{edu.degree} — {edu.feildStudy}</p>
                </div>
              ))
            ) : <p className={styles.noDataText}>No education listed.</p>}
          </div>

          <div className={`${styles.contentTabsSection} mt-enter`} style={{ animationDelay: '300ms' }}>
            <div className={styles.tabHeader}>
              <button
                className={contentTab === 'posts' ? styles.activeTab : styles.tabBtn}
                onClick={() => setContentTab('posts')}
              >
                Posts
              </button>
              <button
                className={contentTab === 'media' ? styles.activeTab : styles.tabBtn}
                onClick={() => setContentTab('media')}
              >
                Media
              </button>
              <button
                className={contentTab === 'liked' ? styles.activeTab : styles.tabBtn}
                onClick={() => setContentTab('liked')}
              >
                Liked
              </button>
              <button
                className={contentTab === 'saved' ? styles.activeTab : styles.tabBtn}
                onClick={() => setContentTab('saved')}
              >
                Saved
              </button>
            </div>

            {contentTab === 'posts' && (
              !postState.userPostsLoaded ? (
                <div className="w-full flex items-center justify-center py-12">
                  <BlastLoader size={40} />
                </div>
              ) : userPosts.length > 0 ? (
                <div className={styles.textPostList}>
                  {userPosts.map((post) => (
                    <div key={post._id} className={styles.textPostCard}>
                      <p className={styles.textPostBody}>{post.body}</p>
                      <div className={styles.textPostMeta}>
                        <span className={styles.textPostLikes}><Heart size={13} strokeWidth={2} /> {post.likeCount || 0}</span>
                        {post.createdAt && (
                          <span className={styles.textPostTime}>{new Date(post.createdAt).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className={styles.noDataText}>No posts yet.</p>
            )}

            {contentTab === 'media' && (
              mediaPosts.length > 0 ? (
                <div className={styles.mediaGrid}>
                  {mediaPosts.map((post) => (
                    <div key={post._id} className={styles.mediaGridItem}>
                      <img
                        src={post.media?.startsWith('http') ? post.media : `${Base_Url}/${post.media}`}
                        alt="post media"
                        className={styles.mediaGridImage}
                      />
                    </div>
                  ))}
                </div>
              ) : <p className={styles.noDataText}>No media posts yet.</p>
            )}

            {contentTab === 'liked' && (
              postState.likedPosts?.length > 0 ? (
                <div className={styles.textPostList}>
                  {postState.likedPosts.map((post) => (
                    <div key={post._id} className={styles.textPostCard}>
                      <p className={styles.textPostBody}>{post.body}</p>
                      <div className={styles.textPostMeta}>
                        <span className={styles.textPostLikes}><Heart size={13} strokeWidth={2} /> {post.likeCount || 0}</span>
                        {post.createdAt && (
                          <span className={styles.textPostTime}>{new Date(post.createdAt).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState icon={Heart} title="Nothing liked yet" description="Posts you like will show up here." />
              )
            )}

            {contentTab === 'saved' && (
              postState.bookmarkedPosts?.length > 0 ? (
                <div className={styles.textPostList}>
                  {postState.bookmarkedPosts.map((post) => (
                    <div key={post._id} className={styles.textPostCard}>
                      <p className={styles.textPostBody}>{post.body}</p>
                      <div className={styles.textPostMeta}>
                        <span className={styles.textPostLikes}><Heart size={13} strokeWidth={2} /> {post.likeCount || 0}</span>
                        {post.createdAt && (
                          <span className={styles.textPostTime}>{new Date(post.createdAt).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState icon={Bookmark} title="Nothing saved yet" description="Posts you bookmark will show up here." />
              )
            )}
          </div>
        </div>

        <div className={styles.userActivitySidebar}>
          <h3>Recent Activity</h3>
          {recentPosts.length > 0 ? (
            <>
              {recentPosts.map((post) => (
                <div key={post._id} className={styles.sidebarPostCard}>
                  {post.media ? (
                    <img src={post.media} className={styles.sidebarPostImage} alt="post" />
                  ) : (
                    <p className={styles.sidebarPostText}>{post.body?.substring(0, 60)}...</p>
                  )}
                </div>
              ))}

              {/* --- NEW: SHOW ALL ACTIVITY BUTTON --- */}

              <button
                className={`${styles.showAllActivityBtn} mt-btn-lift`}
                onClick={() => router.push(`/activity/${userProfile?.userId?.username}`)} // Added optional chaining
              >
                Show all activity ({userPosts.length})
                <ArrowRight size={16} strokeWidth={2} />
              </button>

            </>
          ) : (
            <p className={styles.noDataText}>No activity yet.</p>
          )}
        </div>
      </div>

      {/* --- ENHANCED EDIT MODAL --- */}
      {isEditModalOpen && (
        <div
          className={styles.modalOverlay}
          onClick={handleSafeClose}
          style={{ zIndex: 10001 }} /* Increased to clear Dashboard nav exactly */
        >
          <div className={`${styles.modalContent} mt-dropdown-enter`} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.headerTitle}>
                <h3>Edit Profile Details</h3>
                <p>Updates will be visible to your network</p>
              </div>
              <button className={styles.closeBtn} onClick={handleSafeClose}><X size={18} strokeWidth={1.8} /></button>
            </div>

            <form onSubmit={handleUpdateProfile} className={styles.editForm}>
              <div className={styles.scrollableForm}>
                <div className={styles.formGroup}>
                  <label>Full Name</label>
                  <input type="text" value={formData.name} onChange={(e) => updateForm({ ...formData, name: e.target.value })} placeholder="Your full name" />
                </div>
                <div className={styles.formGroup}>
                  <label>Username</label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => {
                      setUsernameError("");
                      // Lowercased as you type — the backend normalizes
                      // regardless (see updateAccountSettings), but showing
                      // "JohnDoe" only to have it silently become "johndoe"
                      // after save reads as a bug, not a feature.
                      updateForm({ ...formData, username: e.target.value.replace(/\s/g, '').toLowerCase() });
                    }}
                    placeholder="username"
                  />
                  {usernameError && <p className={styles.fieldError}>{usernameError}</p>}
                </div>
                <div className={styles.formGroup}>
                  <label>Email</label>
                  <input type="email" value={userProfile?.userId?.email || ''} disabled />
                  <p className={styles.fieldHint}>
                    {userProfile?.userId?.googleId
                      ? "Managed by your Google account"
                      : userProfile?.userId?.appleId
                        ? "Managed by your Apple ID"
                        : "Contact support to change your email"}
                  </p>
                </div>
                <div className={styles.formGroup}>
                  <label>Current Designation</label>
                  <input type="text" value={formData.currentPost} onChange={(e) => updateForm({ ...formData, currentPost: e.target.value })} placeholder="e.g. CTO" />
                </div>
                <div className={styles.formGroup}>
                  <label>About</label>
                  <textarea rows="3" value={formData.bio} onChange={(e) => updateForm({ ...formData, bio: e.target.value })} placeholder="Write a short bio..." />
                </div>

                <hr className={styles.divider} />

                <div className={styles.sectionHeader}>
                  <h4>Experience</h4>
                  <button type="button" className={`${styles.addBtn} mt-btn-lift`} onClick={() => addArrayItem('pastWork')}>
                    <Plus size={14} strokeWidth={2.5} /> Add
                  </button>
                </div>
                {formData.pastWork?.map((work, index) => (
                  <div key={index} className={styles.cardInputGroup}>
                    <button type="button" onClick={() => removeArrayItem(index, 'pastWork')} className={`${styles.trashBtn} mt-icon-btn`}><X size={14} strokeWidth={2} /></button>
                    <input placeholder="Company Name" value={work.company} onChange={(e) => handleArrayChange(index, 'company', e.target.value, 'pastWork')} />
                    <div className={styles.rowInputs}>
                      <input placeholder="Position" value={work.position} onChange={(e) => handleArrayChange(index, 'position', e.target.value, 'pastWork')} />
                      <input placeholder="Years" value={work.years} onChange={(e) => handleArrayChange(index, 'years', e.target.value, 'pastWork')} />
                    </div>
                  </div>
                ))}

                <div className={styles.sectionHeader}>
                  <h4>Education</h4>
                  <button type="button" className={`${styles.addBtn} mt-btn-lift`} onClick={() => addArrayItem('education')}>
                    <Plus size={14} strokeWidth={2.5} /> Add
                  </button>
                </div>
                {formData.education?.map((edu, index) => (
                  <div key={index} className={styles.cardInputGroup}>
                    <button type="button" onClick={() => removeArrayItem(index, 'education')} className={`${styles.trashBtn} mt-icon-btn`}><X size={14} strokeWidth={2} /></button>
                    <input placeholder="School / University" value={edu.school} onChange={(e) => handleArrayChange(index, 'school', e.target.value, 'education')} />
                    <div className={styles.rowInputs}>
                      <input placeholder="Degree" value={edu.degree} onChange={(e) => handleArrayChange(index, 'degree', e.target.value, 'education')} />
                      <input placeholder="Years" value={edu.feildStudy} onChange={(e) => handleArrayChange(index, 'feildStudy', e.target.value, 'education')} />
                    </div>
                  </div>
                ))}
              </div>

              <div className={styles.modalFooter}>
                <button type="button" className={`${styles.cancelBtn} mt-btn-lift`} onClick={handleSafeClose}>Cancel</button>
                <button type="submit" className={`${styles.saveBtn} mt-btn-lift`} disabled={!isDirty}>Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isHighlightModalOpen && (
        <div
          className={styles.modalOverlay}
          onClick={() => setIsHighlightModalOpen(false)}
          style={{ zIndex: 10001 }}
        >
          <div className={`${styles.modalContent} mt-dropdown-enter`} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.headerTitle}>
                <h3>New Highlight</h3>
                <p>A cover image and a short title</p>
              </div>
              <button className={styles.closeBtn} onClick={() => setIsHighlightModalOpen(false)}><X size={18} strokeWidth={1.8} /></button>
            </div>

            <form onSubmit={handleAddHighlight} className={styles.editForm}>
              <div className={styles.scrollableForm}>
                <div className={styles.formGroup}>
                  <label>Title</label>
                  <input
                    type="text"
                    maxLength={40}
                    value={newHighlightTitle}
                    onChange={(e) => setNewHighlightTitle(e.target.value)}
                    placeholder="e.g. Runs"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Cover image</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setNewHighlightFile(e.target.files?.[0] || null)}
                  />
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button type="button" className={`${styles.cancelBtn} mt-btn-lift`} onClick={() => setIsHighlightModalOpen(false)}>Cancel</button>
                <button type="submit" className={`${styles.saveBtn} mt-btn-lift`} disabled={!newHighlightFile || savingHighlight}>
                  {savingHighlight ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );

  // FIXED: Replaced standard return with null if not mounted to solve SSR hydration errors
  if (!mounted) return <DashboardLayout><PageLoader /></DashboardLayout>;

  return <DashboardLayout>{MainContent}</DashboardLayout>;
}