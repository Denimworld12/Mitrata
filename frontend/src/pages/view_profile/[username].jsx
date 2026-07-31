import { Base_Url, clientServer } from '@/config'
import React, { useEffect, useState } from 'react'
import styles from './styles.module.css'
import DashboardLayout from '@/layout/DashboardLayout'
import { useRouter } from 'next/router'
import { useDispatch, useSelector } from 'react-redux'
import { getPostsByUsername } from '@/config/redux/action/postAction'
import { downloadResume, getConnectionRequest, sendConnectionRequest } from '@/config/redux/action/authAction'
import serverAxios from '@/config/serverAxios'
import { UserPlus, Check, Download, ArrowRight } from 'lucide-react'
import ReportMenu from '@/Components/ReportMenu'

export default function viewProfilePage({ userProfile }) {
    const router = useRouter()
    const dispatch = useDispatch()
    const postState = useSelector((state) => state.post)
    const userState = useSelector((state) => state.auth)

    const [mounted, setMounted] = useState(false);
    const [userPost, setUserPost] = useState([])
    const [isCurrentUserInConnection, setIsCurrentUserInConnection] = useState(false)
    const [isConnectionNull, setConnectionNull] = useState(true)
    const [connectionStatus, setConnectionStatus] = useState(undefined); // NEW STATE

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
                // status_accepted: true (Connected), null (Pending), false (Rejected)
                setConnectionStatus(foundConn.status_accepted);
            } else {
                setIsCurrentUserInConnection(false);
                setConnectionStatus(undefined);
            }
        }
    }, [userState.connection, userProfile?.userId?._id]);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            dispatch(getConnectionRequest())
        }
    }, [dispatch]);

    // Was filtering one page of the engagement-ranked global feed by
    // username — someone's own posts that didn't rank into that page were
    // invisible on their own profile. Queries their actual posts directly.
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token && router.query.username) {
            dispatch(getPostsByUsername({ username: router.query.username }));
        }
    }, [dispatch, router.query.username]);

    useEffect(() => {
        setUserPost(postState.userPosts || []);
    }, [postState.userPosts])

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

    // Placed after every hook above (not before, as this used to be) — a
    // conditional `return` before some of this component's hooks meant
    // client-side-navigating from a valid profile to a missing one reused
    // the same component instance with fewer hooks called on the next
    // render, which React throws on ("Rendered fewer hooks than expected").
    if (!userProfile) {
        return (
            <DashboardLayout>
                <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--mt-ink)" }}>
                    <h2 style={{ fontFamily: "var(--mt-font-display)", fontWeight: 500 }}>User not found</h2>
                    <p style={{ color: "var(--mt-ink2)" }}>The profile you are looking for does not exist or may have been removed.</p>
                    <button
                        onClick={() => router.push('/dashboard')}
                        style={{
                            marginTop: "20px",
                            padding: "10px 22px",
                            background: "var(--mt-grad)",
                            color: "#fff",
                            border: "none",
                            borderRadius: "999px",
                            fontWeight: 600,
                            fontSize: "13.5px",
                            cursor: "pointer"
                        }}
                    >
                        Go to Dashboard
                    </button>
                </div>
            </DashboardLayout>
        );
    }

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
                    src={userProfile.userId?.profilePicture || "/default-avatar.svg"}
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
                                {isCurrentUserInConnection && connectionStatus === true ? (
                                    <button className={styles.connectedButton}><Check size={15} strokeWidth={2} /> Connected</button>
                                ) :

                                    /* CASE 2: Pending (Sent but not yet accepted) */
                                    isCurrentUserInConnection && connectionStatus === null ? (
                                        <button className={styles.pendingButton} disabled>Pending</button>
                                    ) :

                                        /* CASE 3: Not connected OR Rejected (Show Connect button) */
                                        (
                                            <button className={`${styles.connectButton} mt-btn-lift`} onClick={() => {
                                                dispatch(sendConnectionRequest({
                                                    connectionId: userProfile.userId._id
                                                }));
                                            }}><UserPlus size={15} strokeWidth={2} /> Connect</button>
                                        )}
                                <button className={`${styles.resumeButton} mt-btn-lift`} onClick={handleDownloadResume}>
                                    <Download size={16} strokeWidth={1.8} />
                                    <p>Resume</p>
                                </button>
                                <ReportMenu targetType="user" targetId={userProfile.userId._id} />
                            </div>
                        </div>
                    </div>

                    <div className={`${styles.profileBio} mt-enter`}>
                        <h3>About</h3>
                        <p>{userProfile.bio || 'This user has not yet added a bio.'}</p>
                    </div>

                    <div className={`${styles.infoSection} mt-enter`} style={{ animationDelay: '60ms' }}>
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

                    <div className={`${styles.infoSection} mt-enter`} style={{ animationDelay: '120ms' }}>
                        <h3>Education</h3>
                        {userProfile.education?.length > 0 ? (
                            userProfile.education.map((edu, idx) => (
                                <div key={idx} className={styles.infoItem}>
                                    <h4>{edu.school}</h4>
                                    <p>{edu.degree}  {edu.feildStudy}</p>
                                </div>
                            ))
                        ) : <p className={styles.noDataText}>No education listed.</p>}
                    </div>
                </div>

                {/* RIGHT COLUMN: Recent Posts/Activity Sidebar */}
                <div className={styles.userActivitySidebar}>
                    <h3>Recent Activity</h3>

                    {userPost.length > 0 ? (
                        <>
                            {recentPosts.map((post) => (
                                <div key={post._id} className={styles.sidebarPostCard}>
                                    {post.media ? (
                                        <img src={post.media} className={styles.sidebarPostImage} alt="activity" />
                                    ) : (
                                        <p className={styles.sidebarPostText}>{post.body.substring(0, 60)}...</p>
                                    )}
                                </div>
                            ))}

                            {/* NEW: Button to see all activity */}
                            {userPost.length > 0 && (
                                <button
                                    className={`${styles.showAllActivityBtn} mt-btn-lift`}
                                    onClick={() => router.push(`/activity/${userProfile.userId.username}`)}
                                >
                                    Show all activity ({userPost.length})
                                    <ArrowRight size={16} strokeWidth={2} />
                                </button>
                            )}
                        </>
                    ) : (
                        <p className={styles.noDataText}>No recent activity to show.</p>
                    )}
                </div>
            </div>
        </div>
    );




    // CRITICAL: Ensure this logic runs AFTER ProfileContent is defined
    if (!mounted) return ProfileContent;

    return <DashboardLayout>{ProfileContent}</DashboardLayout>;
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