import React, { useEffect, useMemo } from 'react'
import styles from "./styles.module.css"
import { useRouter } from 'next/router'
import { useDispatch, useSelector } from 'react-redux';
import { setTokenThere } from '@/config/redux/reducer/authReducer';
import { getAllPosts } from '@/config/redux/action/postAction';
import { getAllUser } from '@/config/redux/action/authAction';
import { useNotification } from '@/Components/NotificationProvider';

export default function DashboardLayout({ children }) {
    const router = useRouter();
    const dispatch = useDispatch();
    const authState = useSelector((state) => state.auth);
    const { unreadCount } = useNotification();

    useEffect(() => {
        if (!localStorage.getItem("token")) {
            router.push('/login')
            return;
        }
        dispatch(getAllPosts());
        dispatch(setTokenThere())
        dispatch(getAllUser({ token: localStorage.getItem("token") }))
    }, []);

    const postState = useSelector((state) => state.post);

    const isActive = (path) => {
        return router.pathname === path || router.asPath === path;
    };

    // --- LOGIC: Sort Users by Post Count ---
    const topProfiles = useMemo(() => {
        if (!authState.all_user || !postState.posts) return [];
        const usersWithCounts = authState.all_user.map(user => {
            const userPostCount = postState.posts.filter(
                post => post.userId?._id === user.userId?._id
            ).length;
            return { ...user, postCount: userPostCount };
        });
        return usersWithCounts.sort((a, b) => b.postCount - a.postCount);
    }, [authState.all_user, postState.posts]);

    const navItems = [
        {
            path: '/dashboard',
            label: 'Home',
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                </svg>
            )
        },
        {
            path: '/search',
            label: 'Search',
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
                    <path fillRule="evenodd" d="M9.965 11.026a5 5 0 1 1 1.06-1.06l2.755 2.754a.75.75 0 1 1-1.06 1.06l-2.755-2.754ZM10.5 7a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z" clipRule="evenodd" />
                </svg>
            )
        },
        {
            path: '/my_network',
            label: 'My Network',
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="7.5" cy="6.5" r="4.5" />
                    <path d="M3 22v-6a3 3 0 013-3h3a3 3 0 013 3v6" />
                    <circle cx="17.5" cy="9.5" r="3.5" />
                    <path d="M14 22v-4.5a2.5 2.5 0 012.5-2.5h2a2.5 2.5 0 012.5 2.5V22" />
                </svg>
            )
        },
        {
            path: '/messaging/sidebar_panel',
            label: 'Chat',
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
                </svg>
            )
        },
        {
            path: '/settings',
            label: 'Settings',
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 0 1 0 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 0 1 0-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                </svg>
            )
        }
    ];

    return (
        <div className="container">
            <div className={styles.homeContainer}>
                <div className={styles.homeContainer_leftBar}>
                    {navItems.map((item) => (
                        <div
                            key={item.path}
                            className={`${styles.SideOptions} ${isActive(item.path) ? styles.SideOptionsActive : ''}`}
                            onClick={() => router.push(item.path)}
                        >
                            {item.icon}
                            <div className={styles.optionName}>{item.label}</div>
                            {item.label === 'Chat' && unreadCount > 0 && (
                                <span className={styles.sidebarBadge}>{unreadCount > 9 ? '9+' : unreadCount}</span>
                            )}
                        </div>
                    ))}
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
