import UserLayout from '@/layout/userLayout'
import styles from "./index.module.css"
import React, { useEffect, useState, useMemo } from 'react'
import { Base_Url, clientServer } from '@/config'
import { useDispatch, useSelector } from 'react-redux'
import { getAboutUser, getConnectionRequest,  updateUserProfile } from '@/config/redux/action/authAction'
import { useRouter } from 'next/router'
import { getAllPosts } from '@/config/redux/action/postAction'
import DashboardLayout from '@/layout/DashboardLayout' // Added for Tablet/Mobile logic

export default function Profile() {
  const dispatch = useDispatch()
  const authState = useSelector((state) => state.auth);
  const postState = useSelector((state) => state.post);
  const router = useRouter()

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false); // New: track changes
  const [mounted, setMounted] = useState(false); // New: for layout sync
  const [isMobileOrTablet, setIsMobileOrTablet] = useState(false); // New: layout toggle

  const userProfile = authState.user;
  const isOwner = true;

  const [formData, setFormData] = useState({
    name: "",
    bio: "",
    currentPost: "",
    pastWork: [],
    education: []
  });

  // Handle Responsiveness and Mounting
  useEffect(() => {
    setMounted(true);
    const handleResize = () => {
      setIsMobileOrTablet(window.innerWidth <= 1024);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
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
    const token = localStorage.getItem('token');
    if (token) {
      dispatch(getAboutUser({ token }));
      dispatch(getConnectionRequest({ token }));
      dispatch(getAllPosts({ token }))
    }
  }, [dispatch])

  const userPosts = useMemo(() => {
    if (postState.posts && userProfile?.userId?._id) {
      return postState.posts.filter(post => post.userId?._id === userProfile.userId._id);
    }
    return [];
  }, [postState.posts, userProfile?.userId?._id]);

  const recentPosts = userPosts.slice(0, 3);
  const hasMorePosts = userPosts.length > 3;

  useEffect(() => {
    if (userProfile) {
      setFormData({
        name: userProfile.userId?.name || "",
        bio: userProfile.bio || "",
        currentPost: userProfile.currentPost || "",
        pastWork: userProfile.pastWork || [],
        education: userProfile.education || []
      });
      setIsDirty(false); // Reset dirty state on sync
    }
  }, [userProfile, isEditModalOpen]);

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
    const token = localStorage.getItem('token');
    const result = await dispatch(updateUserProfile({
      token,
      ...formData
    }));

    if (updateUserProfile.fulfilled.match(result)) {
      setIsEditModalOpen(false);
      dispatch(getAboutUser({ token }));
    }
  };

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const fData = new FormData();
      const token = localStorage.getItem('token');
      fData.append('token', token);
      fData.append('profilePicture', file);
      try {
        await clientServer.post('/user/update_profile_picture', fData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        dispatch(getAboutUser({ token }));
      } catch (error) {
        console.error("Profile picture update failed", error);
      }
    }
  }

  if (!userProfile || !userProfile.userId) {
    return <UserLayout><div className={styles.loader}>Loading Profile...</div></UserLayout>;
  }


  // --- Profile Page Content Variable ---
  const MainContent = (
    <div className={styles.container}>
      <div className={styles.coverWrapper}>
        <div className={styles.backDropContainer}></div>
        <div className={styles.profileImageContainer}>
          <div className={styles.imageWrapper}>
            <img
              className={styles.profileImage}
              src={`${Base_Url}/${userProfile.userId?.profilePicture}`}
              alt="profile"
            />
            {isOwner && (
              <div className={styles.imageOverlay}>
                <label className={styles.labeledImageOverlay} htmlFor="profilePictureUpdate">
                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm-9 4.5c0-2.485 2.015-4.5 4.5-4.5h.138l1.41-2.115A3 3 0 0 1 11.53 5.5h.94a3 3 0 0 1 2.481 1.385l1.41 2.115h.139c2.485 0 4.5 2.015 4.5 4.5v5c0 2.485-2.015 4.5-4.5 4.5h-11A4.5 4.5 0 0 1 3 18v-5Z" /></svg>
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
                <h2>{userProfile.userId.name}</h2>
                {isOwner && (
                  <button className={styles.editIconBtn} onClick={() => setIsEditModalOpen(true)}>✎ Edit Profile</button>
                )}
              </div>
              <p className={styles.headline}>{userProfile.currentPost || "Member"}</p>
              <p className={styles.profileUsername}>@{userProfile.userId.username}</p>
            </div>
          </div>

          <div className={styles.profileBio}>
            <h3>About</h3>
            <p>{userProfile.bio || 'This user has not yet added a bio.'}</p>
          </div>

          <div className={styles.infoSection}>
            <h3>Experience</h3>
            {userProfile.pastWork?.length > 0 ? (
              userProfile.pastWork.map((work, idx) => (
                <div key={idx} className={styles.infoItem}>
                  <h4>{work.position}</h4>
                  <p>{work.company} • {work.years}</p>
                </div>
              ))
            ) : <p className={styles.noDataText}>No experience listed.</p>}
          </div>

          <div className={styles.infoSection}>
            <h3>Education</h3>
            {userProfile.education?.length > 0 ? (
              userProfile.education.map((edu, idx) => (
                <div key={idx} className={styles.infoItem}>
                  <h4>{edu.school}</h4>
                  <p>{edu.degree} — {edu.feildStudy}</p>
                </div>
              ))
            ) : <p className={styles.noDataText}>No education listed.</p>}
          </div>
        </div>

        <div className={styles.userActivitySidebar}>
          <h3>Recent Activity</h3>
          {recentPosts.length > 0 ? (
            <>
              {recentPosts.map((post) => (
                <div key={post._id} className={styles.sidebarPostCard}>
                  {post.media ? (
                    <img src={`${Base_Url}/${post.media}`} className={styles.sidebarPostImage} alt="post" />
                  ) : (
                    <p className={styles.sidebarPostText}>{post.body?.substring(0, 60)}...</p>
                  )}
                </div>
              ))}

              {/* --- NEW: SHOW ALL ACTIVITY BUTTON --- */}
              {hasMorePosts && (
                <button
                  className={styles.showAllActivityBtn}
                  onClick={() => router.push(`/profile/activity`)}
                >
                  Show all activity ({userPosts.length})
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" width="16">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </button>
              )}
            </>
          ) : (
            <p className={styles.noDataText}>No activity yet.</p>
          )}
        </div>
      </div>

      {/* --- ENHANCED EDIT MODAL --- */}
      {isEditModalOpen && (
        <div className={styles.modalOverlay} onClick={handleSafeClose}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.headerTitle}>
                <h3>Edit Profile Details</h3>
                <p>Updates will be visible to your network</p>
              </div>
              <button className={styles.closeBtn} onClick={handleSafeClose}>&times;</button>
            </div>

            <form onSubmit={handleUpdateProfile} className={styles.editForm}>
              <div className={styles.scrollableForm}>
                <div className={styles.formGroup}>
                  <label>Full Name</label>
                  <input type="text" value={formData.name} onChange={(e) => updateForm({ ...formData, name: e.target.value })} placeholder="Your full name" />
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
                  <button type="button" className={styles.addBtn} onClick={() => addArrayItem('pastWork')}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 5v14M5 12h14" /></svg> Add
                  </button>
                </div>
                {formData.pastWork?.map((work, index) => (
                  <div key={index} className={styles.cardInputGroup}>
                    <button type="button" onClick={() => removeArrayItem(index, 'pastWork')} className={styles.trashBtn}>&times;</button>
                    <input placeholder="Company Name" value={work.company} onChange={(e) => handleArrayChange(index, 'company', e.target.value, 'pastWork')} />
                    <div className={styles.rowInputs}>
                      <input placeholder="Position" value={work.position} onChange={(e) => handleArrayChange(index, 'position', e.target.value, 'pastWork')} />
                      <input placeholder="Years" value={work.years} onChange={(e) => handleArrayChange(index, 'years', e.target.value, 'pastWork')} />
                    </div>
                  </div>
                ))}

                <div className={styles.sectionHeader}>
                  <h4>Education</h4>
                  <button type="button" className={styles.addBtn} onClick={() => addArrayItem('education')}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 5v14M5 12h14" /></svg> Add
                  </button>
                </div>
                {formData.education?.map((edu, index) => (
                  <div key={index} className={styles.cardInputGroup}>
                    <button type="button" onClick={() => removeArrayItem(index, 'education')} className={styles.trashBtn}>&times;</button>
                    <input placeholder="School / University" value={edu.school} onChange={(e) => handleArrayChange(index, 'school', e.target.value, 'education')} />
                    <div className={styles.rowInputs}>
                      <input placeholder="Degree" value={edu.degree} onChange={(e) => handleArrayChange(index, 'degree', e.target.value, 'education')} />
                      <input placeholder="Years" value={edu.feildStudy} onChange={(e) => handleArrayChange(index, 'feildStudy', e.target.value, 'education')} />
                    </div>
                  </div>
                ))}
              </div>

              <div className={styles.modalFooter}>
                <button type="button" className={styles.cancelBtn} onClick={handleSafeClose}>Cancel</button>
                <button type="submit" className={styles.saveBtn} disabled={!isDirty}>Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );

  if (!mounted) return <UserLayout>{MainContent}</UserLayout>;

  return (
    <UserLayout>
      {isMobileOrTablet ? (
        <DashboardLayout>{MainContent}</DashboardLayout>
      ) : (
        MainContent
      )}
    </UserLayout>
  )
}