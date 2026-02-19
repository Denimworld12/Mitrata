import React, { useEffect, useState, useRef } from 'react'
import styles from './styles.module.css'
import { useRouter } from 'next/router'
import { useDispatch, useSelector } from 'react-redux';
import { getAboutUser } from '@/config/redux/action/authAction';
import { reset, setTokenNotThere, setTokenThere } from '@/config/redux/reducer/authReducer';
import { useNotification } from '@/Components/NotificationProvider';

export default function Navbar() {
    const router = useRouter();
    const dispatch = useDispatch();
    const authState = useSelector((state) => state.auth);
    const menuRef = useRef(null);
    const notifRef = useRef(null);

    const [prevScrollPos, setPrevScrollPos] = useState(0);
    const [visible, setVisible] = useState(true);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [showNotifDropdown, setShowNotifDropdown] = useState(false);

    const { unreadCount, clearUnread, recentNotifs } = useNotification();

    useEffect(() => {
        const handleScroll = () => {
            const currentScrollPos = window.pageYOffset;
            setVisible(prevScrollPos > currentScrollPos || currentScrollPos < 10);
            setPrevScrollPos(currentScrollPos);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, [prevScrollPos]);

    useEffect(() => {
        setMounted(true);
        const token = localStorage.getItem("token");
        if (token) {
            dispatch(setTokenThere());
            dispatch(getAboutUser());
        } else {
            dispatch(setTokenNotThere());
            dispatch(reset());
        }
    }, [dispatch]);

    // Close menus on outside click
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsMenuOpen(false);
            }
            if (notifRef.current && !notifRef.current.contains(event.target)) {
                setShowNotifDropdown(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const showUserUI = mounted && (authState.isTokenThere || authState.loggedIn);

    const handleLogout = () => {
        localStorage.removeItem('token');
        router.push("/login");
        dispatch(reset());
        setIsMenuOpen(false);
    };

    const handleNotifToggle = () => {
        setShowNotifDropdown(!showNotifDropdown);
        if (!showNotifDropdown) clearUnread();
    };

    const formatTime = (date) => {
        const d = new Date(date);
        const now = new Date();
        const diff = now - d;
        if (diff < 60000) return 'just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return d.toLocaleDateString();
    };

    return (
        <div className={`${styles.container} ${visible ? styles.navVisible : styles.navHidden}`}>
            <nav className={styles.navbar}>
                <h1 className={styles.logo} onClick={() => router.push(authState.isTokenThere ? "/dashboard" : "/")}>Mitrata</h1>

                <div className={styles.rightSection}>
                    {!mounted ? null : showUserUI ? (
                        <>
                            {/* Search Bar */}
                            <div className={styles.searchContainer}>
                                <div className={styles.searchWrapper}>
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={styles.searchIcon}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                                    </svg>
                                    <input
                                        type="text"
                                        placeholder="Search users, skills..."
                                        className={styles.searchInput}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && e.target.value.trim()) {
                                                router.push(`/search?q=${encodeURIComponent(e.target.value.trim())}`);
                                            }
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Messaging Icon */}
                            <button
                                className={styles.navIcon}
                                onClick={() => router.push("/messaging/sidebar_panel")}
                                title="Messages"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
                                </svg>
                            </button>

                            {/* Notification Bell */}
                            <div className={styles.notifWrapper} ref={notifRef}>
                                <button
                                    className={styles.navIcon}
                                    onClick={handleNotifToggle}
                                    title="Notifications"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
                                    </svg>
                                    {unreadCount > 0 && (
                                        <span className={styles.badge}>{unreadCount > 9 ? '9+' : unreadCount}</span>
                                    )}
                                </button>

                                {showNotifDropdown && (
                                    <div className={styles.notifDropdown}>
                                        <div className={styles.notifDropdownHeader}>
                                            <h4>Notifications</h4>
                                        </div>
                                        <div className={styles.notifDropdownList}>
                                            {recentNotifs.length === 0 ? (
                                                <p className={styles.notifEmpty}>No notifications yet</p>
                                            ) : (
                                                recentNotifs.map(n => (
                                                    <div key={n.id} className={styles.notifDropdownItem}>
                                                        <img src={n.avatar} alt="" className={styles.notifDropdownAvatar} />
                                                        <div className={styles.notifDropdownBody}>
                                                            <p className={styles.notifDropdownTitle}>{n.title}</p>
                                                            <p className={styles.notifDropdownMsg}>{n.message}</p>
                                                        </div>
                                                        <span className={styles.notifDropdownTime}>{formatTime(n.time)}</span>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Profile */}
                            <div onClick={() => router.push("/profile")} className={styles.appProfile}>
                                <img
                                    src={authState.user?.userId?.profilePicture || "/default-avatar.png"}
                                    className={styles.miniAvatar}
                                    alt="pfp"
                                />
                                <span className={styles.desktopName}>
                                    {authState.user?.userId?.name?.split(" ")[0] || "User"}
                                </span>
                            </div>

                            {/* Three-dot menu for Logout */}
                            <div className={styles.menuWrapper} ref={menuRef}>
                                <div className={styles.mobileToggle} onClick={() => setIsMenuOpen(!isMenuOpen)}>
                                    <span></span><span></span><span></span>
                                </div>

                                {isMenuOpen && (
                                    <div className={styles.dropdownMenu}>
                                        <div className={styles.welcomeTextMobile}>
                                            Hey, {authState.user?.userId?.name?.split(" ")[0]}
                                        </div>
                                        <div onClick={handleLogout} className={styles.logoutBtn}>
                                            Logout
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div onClick={() => router.push("/login")} className={styles.buttonJoin}>
                            Login
                        </div>
                    )}
                </div>
            </nav>
        </div>
    );
}