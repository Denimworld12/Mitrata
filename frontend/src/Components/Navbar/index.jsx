import React, { useEffect, useState, useRef } from 'react'
import styles from './styles.module.css'
import { useRouter } from 'next/router'
import { useDispatch, useSelector } from 'react-redux';
import { getAboutUser, logout, switchAccountAction, clearLocalSession } from '@/config/redux/action/authAction';
import { reset, setTokenNotThere, setTokenThere } from '@/config/redux/reducer/authReducer';
import { useNotification } from '@/Components/NotificationProvider';
import { getSavedAccounts } from '@/config/savedAccounts';
import { Search, MessageCircle, Bell, SunMoon, CircleUser, LogOut, ChevronsUpDown } from 'lucide-react';

export default function Navbar({ inShell = false }) {
    const router = useRouter();
    const dispatch = useDispatch();
    const authState = useSelector((state) => state.auth);
    const menuRef = useRef(null);
    const notifRef = useRef(null);
    const searchRef = useRef(null);

    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [showNotifDropdown, setShowNotifDropdown] = useState(false);
    const [isDark, setIsDark] = useState(false);

    const { unreadCount, clearUnread, recentNotifs } = useNotification();

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
        setIsDark(document.documentElement.getAttribute('data-mt-theme') === 'dark');
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

    // Cmd/Ctrl+K focuses the search box, matching the kbd hint shown next to it
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                searchRef.current?.focus();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const showUserUI = mounted && (authState.isTokenThere || authState.loggedIn);

    // Was clearing localStorage by hand instead of calling the real /logout
    // endpoint — that endpoint is what actually revokes this account's
    // server-side session (see refreshCookieName on the backend); skipping
    // it left the account's refresh cookie alive and unrevoked forever,
    // even though the UI looked logged out.
    const handleLogout = () => {
        dispatch(logout());
        router.push("/login");
        setIsMenuOpen(false);
    };

    // Switching accounts here works the same way as the sidebar's switcher
    // (see DashboardLayout) — each account keeps its own httpOnly refresh
    // cookie, so this is instant with no password as long as that cookie's
    // still valid, only falling back to a normal sign-in otherwise. This is
    // also the ONLY place mobile users can reach account switching from,
    // since the sidebar (and its switcher) is hidden entirely on mobile.
    const [switchingAccountId, setSwitchingAccountId] = useState(null);
    const savedAccounts = getSavedAccounts().filter((a) => a.email !== authState.user?.userId?.email);

    const handleSwitchAccount = async (acc) => {
        setIsMenuOpen(false);
        setSwitchingAccountId(acc.userId);
        const result = await dispatch(switchAccountAction({ userId: acc.userId }));
        setSwitchingAccountId(null);
        if (switchAccountAction.fulfilled.match(result)) {
            window.location.href = '/dashboard';
        } else {
            clearLocalSession();
            router.push(`/login?email=${encodeURIComponent(acc.email)}`);
        }
    };

    const handleAddAccount = () => {
        setIsMenuOpen(false);
        clearLocalSession();
        router.push('/login');
    };

    const handleNotifToggle = () => {
        setShowNotifDropdown(!showNotifDropdown);
        if (!showNotifDropdown) clearUnread();
    };

    const toggleTheme = () => {
        const next = !isDark;
        setIsDark(next);
        localStorage.setItem('theme', next ? 'dark' : 'light');
        document.documentElement.setAttribute('data-mt-theme', next ? 'dark' : 'light');
        document.documentElement.classList.toggle('dark', next);
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
        <div className={`${styles.container} ${inShell ? styles.inShell : ''}`}>
            <nav className={styles.navbar}>
                <div className={styles.logo} onClick={() => router.push(authState.isTokenThere ? "/dashboard" : "/")} role="img" aria-label="Mitrata" />

                <div className={styles.rightSection}>
                    {!mounted ? null : showUserUI ? (
                        <>
                            {/* Search Bar */}
                            <div className={styles.searchContainer}>
                                <div className={styles.searchWrapper}>
                                    <Search className={styles.searchIcon} strokeWidth={1.8} />
                                    <input
                                        ref={searchRef}
                                        type="text"
                                        placeholder="Search people, skills…"
                                        className={styles.searchInput}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && e.target.value.trim()) {
                                                router.push(`/search?q=${encodeURIComponent(e.target.value.trim())}`);
                                            }
                                        }}
                                    />
                                    <kbd className={styles.kbdChip}>⌘K</kbd>
                                </div>
                            </div>

                            {/* Theme toggle */}
                            <button className={`${styles.navIcon} ${styles.themeToggle}`} onClick={toggleTheme} title="Toggle theme">
                                <SunMoon strokeWidth={1.8} />
                            </button>

                            {/* Messaging Icon */}
                            <button
                                className={styles.navIcon}
                                onClick={() => router.push("/messaging/sidebar_panel")}
                                title="Messages"
                            >
                                <MessageCircle strokeWidth={1.8} />
                            </button>

                            {/* Notification Bell */}
                            <div className={styles.notifWrapper} ref={notifRef}>
                                <button
                                    className={styles.navIcon}
                                    onClick={handleNotifToggle}
                                    title="Notifications"
                                >
                                    <Bell strokeWidth={1.8} />
                                    {unreadCount > 0 && (
                                        <span className={styles.badge}>{unreadCount > 9 ? '9+' : unreadCount}</span>
                                    )}
                                </button>

                                {showNotifDropdown && (
                                    <div className={`${styles.notifDropdown} mt-dropdown-enter`}>
                                        <div className={styles.notifDropdownHeader}>
                                            <h4>Notifications</h4>
                                            <span
                                                style={{ cursor: 'pointer', fontSize: 12, color: 'var(--mt-accent)' }}
                                                onClick={() => { setShowNotifDropdown(false); router.push('/notifications'); }}
                                            >
                                                See all
                                            </span>
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

                            {/* Profile — click opens a small menu (Profile / Logout) instead
                                of navigating straight there; the old separate three-dot
                                menu was just a second, redundant way to reach Logout. */}
                            <div className={styles.menuWrapper} ref={menuRef}>
                                <div onClick={() => setIsMenuOpen(!isMenuOpen)} className={styles.appProfile}>
                                    <img
                                        src={authState.user?.userId?.profilePicture || "/default-avatar.svg"}
                                        className={styles.miniAvatar}
                                        alt="pfp"
                                    />
                                    <span className={styles.desktopName}>
                                        {authState.user?.userId?.name?.split(" ")[0] || "User"}
                                    </span>
                                </div>

                                {isMenuOpen && (
                                    <div className={`${styles.dropdownMenu} mt-dropdown-enter`}>
                                        <div
                                            onClick={() => { setIsMenuOpen(false); router.push("/profile"); }}
                                            className={styles.profileMenuItem}
                                        >
                                            <CircleUser size={16} strokeWidth={1.8} />
                                            Profile
                                        </div>

                                        {savedAccounts.length > 0 && (
                                            <>
                                                <div className={styles.menuDivider} />
                                                <p className={styles.menuOverline}>Switch account</p>
                                                {savedAccounts.map((acc) => (
                                                    <div
                                                        key={acc.email}
                                                        className={styles.profileMenuItem}
                                                        onClick={() => !switchingAccountId && handleSwitchAccount(acc)}
                                                        style={switchingAccountId ? { opacity: 0.6, pointerEvents: 'none' } : undefined}
                                                    >
                                                        <img
                                                            src={acc.profilePicture || '/default-avatar.svg'}
                                                            alt=""
                                                            className={styles.switchAccountAvatar}
                                                        />
                                                        {switchingAccountId === acc.userId ? 'Switching…' : acc.name}
                                                    </div>
                                                ))}
                                            </>
                                        )}

                                        <div className={styles.menuDivider} />
                                        <div className={styles.profileMenuItem} onClick={handleAddAccount}>
                                            <ChevronsUpDown size={16} strokeWidth={1.8} />
                                            Add another account
                                        </div>

                                        <div onClick={handleLogout} className={styles.logoutBtn}>
                                            <LogOut size={16} strokeWidth={1.8} />
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
