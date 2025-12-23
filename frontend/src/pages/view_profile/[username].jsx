import { Base_Url, clientServer } from '@/config'
import React, { useEffect, useState } from 'react'
import styles from './styles.module.css'
import UserLayout from '@/layout/userLayout'
import { useRouter } from 'next/router'
import { useDispatch, useSelector } from 'react-redux'
import { getAllPosts } from '@/config/redux/action/postAction'
import { sendConnectionRequest } from '@/config/redux/action/authAction'
// Assume these actions are imported correctly elsewhere
// import { getConnectionRequest, sendConnectionRequest } from '@/config/redux/action/authAction'; 

export default function viewProfilePage({ userProfile }) {
    const router = useRouter()
    const dispatch = useDispatch()
    const postState = useSelector((state) => state.post)
    const userState = useSelector((state) => state.auth)

    // Display only the first 3 posts for the "Recent Posts" section
    const [userPost, setUserPost] = useState([])
    const [isCurrentUserInConnection, setIsCurrentUserInConnection] = useState(false)


    useEffect(() => {
        dispatch(getAllPosts({ token: localStorage.getItem('token') }))
    }, [dispatch]);

    // Filter posts for the current user being viewed
    useEffect(() => {
        let posts = postState.posts.filter((post) => {
            return post.userId.username === router.query.username
        })
        setUserPost(posts)
    }, [postState.posts, router.query.username])

    // Check connection status
    useEffect(() => {
        // IMPORTANT: The dependency array was broken (useState.connections should be userState.connection)
        // Also, add a check for array existence.
        if (userState.connection && userState.connection.some(conn => conn.connection._id === userProfile.userId._id)) {
            setIsCurrentUserInConnection(true);
        }
    }, [userState.connection, userProfile.userId._id]);


    // Limit to the first 3 recent posts for the activity section
    const recentPosts = userPost.slice(0, 3);
    const hasMorePosts = userPost.length > 3;


    return (
        <UserLayout>
            <div className={styles.container}>
                <div className={styles.coverWrapper}>
                    <div className={styles.backDropContainer}></div>

                    <img
                        className={styles.profileImage}
                        src={`${Base_Url}/${userProfile.userId?.profilePicture}`}
                        alt="profile"
                    />
                </div>

                {/* START: Main Content Wrapper for Two Columns */}
                <div className={styles.profileContentWrapper}>

                    {/* LEFT COLUMN: Main Profile Details */}
                    <div className={styles.profileDetails}>
                        <div className={styles.profileDetails_userName}>
                            <div className={styles.profileNameDetails}>

                                {/* Padding is now handled by the .profileNameDetails class */}
                                <div className={styles.profileNameDetails_div}>
                                    {/* Removed unnecessary empty div: <div className={styles.profileNameDetails_div}></div> */}
                                    <div className={styles.profileName}>
                                        <h2>{userProfile.userId.name}</h2>
                                    </div>
                                    <div className={styles.profileUsername}>
                                        <p>@{userProfile.userId.username}</p>
                                    </div>
                                </div>

                                {/* Connection Button */}
                                {isCurrentUserInConnection ?
                                    <button className={styles.connectedButton}>Connected</button>
                                    :
                                    <button className={styles.connectButton} onClick={() => {
                                        dispatch(sendConnectionRequest({
                                            token: localStorage.getItem('token'),
                                            user_id: userProfile.userId._id
                                        }))
                                        // alert('Connect action triggered!');
                                    }}>Connect</button>
                                }
                            </div>
                        </div>

                        {/* Profile Bio Section */}
                        <div className={styles.profileBio}>
                            <h3>About</h3>
                            <p> {userProfile.userId.bio || 'This user has not yet added a bio.'}</p>
                        </div>

                        {/* Add other main profile sections here (e.g., Experience, Education) */}
                        <div className={styles.mainContentSection}>
                            <h3>Activity/Feed (All Posts)</h3>
                            {/* This section would typically show the user's full feed or activity */}
                            {userPost.length === 0 && <p className={styles.noPostsMessage}>No posts found for this user.</p>}
                            {/* You can map ALL posts here if this is the main feed area */}
                        </div>

                    </div>

                    {/* RIGHT COLUMN: Recent Posts/Activity Snapshot */}
                    <div className={styles.userActivitySidebar}>
                        <h3>Recent Posts</h3>

                        {recentPosts.length > 0 ? (
                            <div className={styles.recentPostList}>
                                {recentPosts.map((post) => (
                                    <div key={post._id} className={styles.sidebarPostCard}>
                                        {/* Display only image OR content, not both */}
                                        {post.media ? (
                                            <img src={`${Base_Url}/${post.media}`} alt="post image" className={styles.sidebarPostImage} />
                                        ) : (
                                            // Show a snippet of the text content
                                            <p className={styles.sidebarPostText}>{post.body.substring(0, 80)}...</p>
                                        )}
                                    </div>
                                ))}

                                {hasMorePosts && (
                                    <button
                                        className={styles.showAllButton}
                                        onClick={() => router.push(`/activity/${router.query.username}`)}
                                    >
                                        Show All Posts ({userPost.length})
                                    </button>
                                )}
                            </div>
                        ) : (
                            <p className={styles.noPostsMessage}>No recent activity.</p>
                        )}
                    </div>

                </div>
                {/* END: Main Content Wrapper */}

            </div>
        </UserLayout>
    )
}

// getServerSideProps remains the same
export async function getServerSideProps(context) {
    // ... (Your existing getServerSideProps logic)
    const req = await clientServer.get('/user/get_user_based_on_username', {
        params: {
            username: context.query.username
        }
    })
    return { props: { userProfile: req.data.profile } }
}