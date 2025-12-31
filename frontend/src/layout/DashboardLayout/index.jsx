import React, { useEffect, useMemo } from 'react'
import styles from "./styles.module.css"
import { useRouter } from 'next/router'
import { useDispatch, useSelector } from 'react-redux';
import { setTokenThere } from '@/config/redux/reducer/authReducer';
import { getAllPosts } from '@/config/redux/action/postAction';
import { getAllUser } from '@/config/redux/action/authAction';
export default function DashboardLayout({ children }) {
    const router = useRouter();
    const dispatch = useDispatch();
    const authState = useSelector((state) => state.auth)
    useEffect(() => {
        if (!localStorage.getItem("token")) {
            router.push('/login')
            return;
        }
        dispatch(getAllPosts());
        dispatch(setTokenThere())
        dispatch(getAllUser({ token: localStorage.getItem("token") }))
    }, []);

    // useEffect(() => {
    //     if (authState.isTokenThere) {
    //        
    //         dispatch(getAboutUser({ token: localStorage.getItem("token") }))
    //     }
    // }, [authState.isTokenThere])
    // console.log(authState.user) 
    const postState = useSelector((state) => state.post);

    // --- LOGIC: Sort Users by Post Count ---
    const topProfiles = useMemo(() => {
        if (!authState.all_user || !postState.posts) return [];

        // 1. Map through users and attach their post count
        const usersWithCounts = authState.all_user.map(user => {
            const userPostCount = postState.posts.filter(
                post => post.userId?._id === user.userId?._id
            ).length;
            
            return { ...user, postCount: userPostCount };
        });

        // 2. Sort by postCount descending (highest first)
        return usersWithCounts.sort((a, b) => b.postCount - a.postCount);
    }, [authState.all_user, postState.posts]);
    return (
        <div className="container">
            <div className={styles.homeContainer} >
                <div className={styles.homeContainer_leftBar}>

                    <div className={styles.SideOptions}
                        onClick={() => router.push("/dashboard")}>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                        </svg>

                        <div className={styles.optionName}>Home</div>
                    </div>

                    <div className={styles.SideOptions}
                        onClick={() => router.push("/search")}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="size-4">
                            <path fillRule="evenodd" d="M9.965 11.026a5 5 0 1 1 1.06-1.06l2.755 2.754a.75.75 0 1 1-1.06 1.06l-2.755-2.754ZM10.5 7a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z" clipRule="evenodd" />
                        </svg>


                        <div className={styles.optionName}>Search</div>
                    </div>

                    <div className={styles.SideOptions}
                        onClick={() => router.push("/my_network")}>
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            width="24"
                            height="24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.5"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        >
                            <circle cx="7.5" cy="6.5" r="4.5" />
                            <path d="M3 22v-6a3 3 0 013-3h3a3 3 0 013 3v6" />
                            <circle cx="17.5" cy="9.5" r="3.5" />
                            <path d="M14 22v-4.5a2.5 2.5 0 012.5-2.5h2a2.5 2.5 0 012.5 2.5V22" />
                        </svg>



                        <div className={styles.optionName}>My Network</div>
                    </div>
                    <div className={styles.SideOptions}
                        onClick={() => router.push("/messaging/sidebar_panel")}>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
                        </svg>



                        <div className={styles.optionName}>Chat</div>
                    </div>
                </div>



                <div className={styles.homeContainer_feedContainer}>
                    {children}
                </div>
                <div className={styles.homeContainer_extraContainer}>
                    <h3>Top Profiles</h3>
                    {authState.all_profile_fetched && topProfiles.length > 0 ? (
                    topProfiles.slice(0, 5).map((profile) => (
                        <div 
                            key={profile._id} 
                            className={styles.topProfileCard}
                            onClick={() => router.push(`/view_profile/${profile.userId?.username}`)}
                            style={{ cursor: 'pointer' }}
                        >
                            <img
                                src={profile.userId?.profilePicture || "/default-avatar.png"}
                                alt="profile"
                                className={styles.topProfileImg}
                            />
                            <div className={styles.topProfileInfo}>
                                <p className={styles.topProfileName}>
                                    {profile.userId?.name}
                                </p>
                                <span className={styles.topProfileUsername}>
                                    @{profile.userId?.username}
                                </span>
                                {/* Optional: Show the post count badge */}
                                <p style={{ fontSize: '0.7rem', color: '#0a66c2', fontWeight: 'bold' }}>
                                    {profile.postCount} Posts
                                </p>
                            </div>
                        </div>
                    ))
                ) : (
                    <p>Loading profiles...</p>
                )}

                </div>
            </div>

        </div>
    )
}
