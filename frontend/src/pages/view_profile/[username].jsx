import { Base_Url, clientServer } from '@/config'
import React, { useEffect, useState } from 'react'
import styles from './styles.module.css'
import UserLayout from '@/layout/userLayout'
import DashboardLayout from '@/layout/DashboardLayout' 
import { useRouter } from 'next/router'
import { useDispatch, useSelector } from 'react-redux'
import { getAllPosts } from '@/config/redux/action/postAction'
import { downloadResume, getConnectionRequest, sendConnectionRequest } from '@/config/redux/action/authAction'
import serverAxios from '@/config/serverAxios'

export default function viewProfilePage({ userProfile }) {
    const router = useRouter()
    const dispatch = useDispatch()
    const postState = useSelector((state) => state.post)
    const userState = useSelector((state) => state.auth)

    const [mounted, setMounted] = useState(false);
    const [userPost, setUserPost] = useState([])
    const [isCurrentUserInConnection, setIsCurrentUserInConnection] = useState(false)
    const [isConnectionNull, setConnectionNull] = useState(true)
    const [isMobileOrTablet, setIsMobileOrTablet] = useState(false);

    useEffect(() => {
        setMounted(true); // CRITICAL: Mark as mounted to allow layout toggle
        const handleResize = () => {
            // 1024px captures both Mobile and Tablet (iPad/Surface)
            setIsMobileOrTablet(window.innerWidth <= 1024);
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            dispatch(getAllPosts({ token }))
            dispatch(getConnectionRequest({ token }))
        }
    }, [dispatch]);

    useEffect(() => {
        if (postState.posts) {
            let posts = postState.posts.filter((post) => post.userId.username === router.query.username)
            setUserPost(posts)
        }
    }, [postState.posts, router.query.username])

    useEffect(() => {
        const connections = userState.connection;
        const profileId = userProfile?.userId?._id;

        if (connections && Array.isArray(connections) && profileId) {
            const foundConn = connections.find(conn => {
                const connId = conn.connectionId?._id || conn.connectionId;
                const userId = conn.userId?._id || conn.userId;
                return connId === profileId || userId === profileId;
            });

            if (foundConn) {
                setIsCurrentUserInConnection(true);
                setConnectionNull(foundConn.status_accepted === null);
            } else {
                setIsCurrentUserInConnection(false);
            }
        }
    }, [userState.connection, userProfile?.userId?._id]);

    const recentPosts = userPost.slice(0, 3);
    const hasMorePosts = userPost.length > 3;

    const handleDownloadResume = async () => {
        const res = await dispatch(downloadResume({ connectionId: userProfile.userId._id }));
        if (downloadResume.fulfilled.match(res)) {
            const filePath = res.payload.file;
            const cleanBaseUrl = Base_Url.replace(/\/$/, ""); 
            const cleanFilePath = filePath.startsWith("/") ? filePath : `/${filePath}`;
            window.open(`${cleanBaseUrl}${cleanFilePath}`, "_blank");
        }
    };

    // Helper to render content
    const ProfileContent = (
        <div className={styles.container}>
            <div className={styles.coverWrapper}>
                <div className={styles.backDropContainer}></div>
                <img
                    className={styles.profileImage}
                    src={`${Base_Url}/${userProfile.userId?.profilePicture}`}
                    alt="profile"
                />
            </div>

            <div className={styles.profileContentWrapper}>
                <div className={styles.profileDetails}>
                    <div className={styles.profileDetails_userName}>
                        <div className={styles.profileNameDetails}>
                            <div className={styles.profileName}>
                                <h2>{userProfile.userId.name}</h2>
                                <p className={styles.headline}>{userProfile.currentPost || "Member"}</p>
                            </div>
                            <div className={styles.profileUsername}>
                                <p>@{userProfile.userId.username}</p>
                            </div>

                            <div className={styles.actionButtons}>
                                {isCurrentUserInConnection ? (
                                    isConnectionNull ? (
                                        <button className={styles.pendingButton} disabled>Pending</button>
                                    ) : (
                                        <button className={styles.connectedButton}>Connected</button>
                                    )
                                ) : (
                                    <button className={styles.connectButton} onClick={() => {
                                        dispatch(sendConnectionRequest({
                                            token: localStorage.getItem('token'),
                                            connectionId: userProfile.userId._id
                                        }));
                                    }}>Connect</button>
                                )}
                                <button className={styles.resumeButton} onClick={handleDownloadResume}>
                                    <svg viewBox="0 0 24 24" fill="currentColor" width="20"><path d="M12 1.5a.75.75 0 0 1 .75.75V7.5h-1.5V2.25A.75.75 0 0 1 12 1.5ZM11.25 7.5v5.69l-1.72-1.72a.75.75 0 0 0-1.06 1.06l3 3a.75.75 0 0 0 1.06 0l3-3a.75.75 0 1 0-1.06-1.06l-1.72 1.72V7.5h3.75a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3v-9a3 3 0 0 1 3-3h3.75Z" /></svg>
                                    <p>Resume</p>
                                </button>
                            </div>
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
                                    <p>{work.company} • {work.years} yrs</p>
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
                                    <p>{edu.degree}  {edu.fieldOfStudy}</p>
                                </div>
                            ))
                        ) : <p className={styles.noDataText}>No education listed.</p>}
                    </div>
                </div>

                <div className={styles.userActivitySidebar}>
                    <h3>Recent Activity</h3>
                    {recentPosts.map((post) => (
                        <div key={post._id} className={styles.sidebarPostCard}>
                            {post.media ? (
                                <img src={`${Base_Url}/${post.media}`} className={styles.sidebarPostImage} alt="activity"/>
                            ) : (
                                <p className={styles.sidebarPostText}>{post.body.substring(0, 60)}...</p>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    // CRITICAL: Ensure this logic runs AFTER ProfileContent is defined
    if (!mounted) return <UserLayout>{ProfileContent}</UserLayout>;

    return (
        <UserLayout>
            {isMobileOrTablet ? (
                /* Applying DashboardLayout for Tablet (912px) to fix navbar overlap */
                <DashboardLayout>{ProfileContent}</DashboardLayout>
            ) : (
                ProfileContent
            )}
        </UserLayout>
    );
}

export async function getServerSideProps(context) {
    try {
        // Ensure this path matches EXACTLY what worked in your Postman/Local tests
        const req = await serverAxios.get('/user/get_user_based_on_username', {
            params: { username: context.query.username }
        });
        
        return { 
            props: { 
                userProfile: req.data.profile || null 
            } 
        };
    } catch (error) {
        console.error("Profile Fetch Error:", error.response?.status);
        return {
            props: { 
                userProfile: null,
                error: "Profile not found" 
            }
        };
    }
}