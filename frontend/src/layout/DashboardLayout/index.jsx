import React, { useEffect, useState } from 'react'
import styles from "./styles.module.css"
import { useRouter } from 'next/router'
import { useDispatch, useSelector } from 'react-redux';
import { setTokenThere } from '@/config/redux/reducer/authReducer';
import { getAboutUser, switchAccountAction, clearLocalSession } from '@/config/redux/action/authAction';
import { getSavedAccounts } from '@/config/savedAccounts';
import { useNotification } from '@/Components/NotificationProvider';
import { clientServer } from '@/config';
import Navbar from '@/Components/Navbar';
import { REELS_ENABLED, GROUPS_ENABLED } from '@/config/featureFlags';
import {
    House, Search, UsersRound, Users, MessageCircle, Settings, ShieldCheck,
    ChevronsUpDown, LayoutDashboard, Flag, ArrowLeft, PlayCircle, Plus, Feather,
    UserPlus, Check,
} from 'lucide-react';

// Desktop sidebar row height (see .SideOptions in styles.module.css) + its
// margin-bottom — the sliding active pill translates in multiples of this.
const NAV_ROW_HEIGHT = 46;

// The mobile bottom bar is a curated 5-slot layout: Home, Explore, +,
// Messages, Settings — My Network/Profile/Admin stay reachable from the
// desktop sidebar and the top bar (search, profile avatar) rather than
// crowding a thumb-reach bar. Reels/Groups replace Explore/Settings in the
// two flanking slots once their feature flag is on (kept out of the bar
// entirely while off, rather than linking to a page that's been pulled).
const MOBILE_TABS = [
    { path: '/dashboard', label: 'Home', Icon: House },
    REELS_ENABLED
        ? { path: '/reels', label: 'Reels', Icon: PlayCircle }
        : { path: '/search', label: 'Explore', Icon: Search },
    { path: '/messaging/sidebar_panel', label: 'Chats', Icon: MessageCircle },
    GROUPS_ENABLED
        ? { path: '/groups', label: 'Groups', Icon: Users }
        : { path: '/settings', label: 'Settings', Icon: Settings },
];

export default function DashboardLayout({ children, fullWidth = false }) {
    const router = useRouter();
    const dispatch = useDispatch();
    const authState = useSelector((state) => state.auth);
    const { unreadCount } = useNotification();
    const isAdmin = authState.user?.userId?.role === 'admin';
    const inAdminPortal = router.pathname.startsWith('/admin');
    const [switcherOpen, setSwitcherOpen] = useState(false);
    const [pendingReports, setPendingReports] = useState(0);
    const [connectStatus, setConnectStatus] = useState({});
    const [trendingTags, setTrendingTags] = useState([]);
    const [suggestedProfiles, setSuggestedProfiles] = useState([]);
    const [suggestionsFetched, setSuggestionsFetched] = useState(false);

    useEffect(() => {
        if (!localStorage.getItem("token")) {
            router.push('/login')
            return;
        }
        dispatch(setTokenThere())
        // Every page using this layout needs the current user (role, name, avatar) —
        // fetch it here instead of relying on whichever page happened to load first.
        if (!authState.user) {
            dispatch(getAboutUser());
        }
    }, []);

    useEffect(() => {
        clientServer.get('/trending/tags', { params: { limit: 5 } })
            .then(({ data }) => setTrendingTags(data.tags || []))
            .catch(() => {});
        // Real suggestions (excludes self + existing connections server-side,
        // see getSuggestions) — replaces the old "sort every user by post
        // count" hack, which never excluded people already connected to.
        clientServer.get('/user/suggestions')
            .then(({ data }) => setSuggestedProfiles(Array.isArray(data) ? data : []))
            .catch(() => {})
            .finally(() => setSuggestionsFetched(true));
    }, []);

    useEffect(() => {
        if (!isAdmin) return;
        clientServer.get('/admin/reports', { params: { status: 'pending' } })
            .then(({ data }) => setPendingReports(data.reports?.length || 0))
            .catch(() => {});
    }, [isAdmin]);

    const isActive = (path) => {
        return router.pathname === path || router.asPath === path;
    };

    const appNavItems = [
        { path: '/dashboard', label: 'Home', Icon: House },
        ...(REELS_ENABLED ? [{ path: '/reels', label: 'Reels', Icon: PlayCircle }] : []),
        { path: '/search', label: 'Explore', Icon: Search },
        ...(GROUPS_ENABLED ? [{ path: '/groups', label: 'Groups', Icon: Users }] : []),
        { path: '/messaging/sidebar_panel', label: 'Messages', Icon: MessageCircle },
        { path: '/my_network', label: 'My Network', Icon: UsersRound },
        { path: '/settings', label: 'Settings', Icon: Settings },
    ];

    if (isAdmin) {
        appNavItems.push({ path: '/admin', label: 'Admin', Icon: ShieldCheck });
    }

    const portalNavItems = [
        { path: '/admin', label: 'Overview', Icon: LayoutDashboard },
        { path: '/admin/reports', label: 'Reports', Icon: Flag, badge: pendingReports },
        { path: '/admin/members', label: 'Members', Icon: UsersRound },
    ];

    const navItems = inAdminPortal ? portalNavItems : appNavItems;
    const activeIndex = navItems.findIndex((item) => isActive(item.path));

    const savedAccounts = getSavedAccounts().filter((a) => a.email !== authState.user?.userId?.email);

    // Each account keeps its own httpOnly refresh cookie (see
    // refreshCookieName on the backend) — so switching is instant as long as
    // that cookie hasn't expired (~30 days), no password needed. Only falls
    // back to a normal (prefilled) sign-in the first time, or once that
    // cookie's actually expired.
    const [switchingAccountId, setSwitchingAccountId] = useState(null);
    const handleSwitchAccount = async (acc) => {
        setSwitcherOpen(false);
        setSwitchingAccountId(acc.userId);
        const result = await dispatch(switchAccountAction({ userId: acc.userId }));
        setSwitchingAccountId(null);
        if (switchAccountAction.fulfilled.match(result)) {
            // A router.push to the page we're already on (the common case —
            // switching while sitting on /dashboard) doesn't remount it, so
            // none of the per-account Redux state (posts, notifications,
            // connections, suggestions...) would actually refetch — every
            // page here builds its own data purely from mount effects with
            // no dependency on which account is active. A full reload is
            // what a normal login already gets for free (it always lands
            // here from a different route), so this just matches that.
            window.location.href = '/dashboard';
        } else {
            clearLocalSession();
            router.push(`/login?email=${encodeURIComponent(acc.email)}`);
        }
    };

    const handleAddAccount = () => {
        setSwitcherOpen(false);
        clearLocalSession();
        router.push('/login');
    };

    const handleConnect = async (e, user) => {
        e.stopPropagation();
        const id = user._id;
        setConnectStatus((prev) => ({ ...prev, [id]: 'loading' }));
        try {
            await clientServer.post('/user/send_connection_request', { connectionId: user._id });
            setConnectStatus((prev) => ({ ...prev, [id]: 'sent' }));
        } catch (error) {
            const msg = error.response?.data?.message || '';
            setConnectStatus((prev) => ({ ...prev, [id]: msg.toLowerCase().includes('already') ? 'sent' : null }));
        }
    };

    return (
        <div className={styles.shellRoot}>
            <div className={styles.orbTopLeft} aria-hidden="true" />
            <div className={styles.orbBottomRight} aria-hidden="true" />

            <aside className={styles.sidebar}>
                <div className={styles.sidebarLogoRow}>
                    <div className={styles.sidebarLogo} onClick={() => router.push('/dashboard')}>
                        <span className={styles.sidebarLogoMark} />
                        <div>
                            <span className={styles.sidebarLogoWordmark}>mitrata</span>
                            <p className={styles.sidebarLogoTagline}>friendship, first</p>
                        </div>
                    </div>
                </div>
                {inAdminPortal && <p className={styles.portalOverline}>Admin portal</p>}

                {/* Desktop sidebar nav — full list, with a single sliding pill that
                    animates between rows instead of a per-item static highlight. */}
                <div className={`${styles.navList} ${inAdminPortal ? styles.navListPortal : ''}`}>
                    {activeIndex > -1 && (
                        <div
                            className={styles.activePill}
                            style={{ transform: `translateY(${activeIndex * NAV_ROW_HEIGHT}px)` }}
                        />
                    )}
                    {navItems.map((item) => (
                        <div
                            key={item.path}
                            className={`${styles.SideOptions} ${isActive(item.path) ? styles.SideOptionsActive : ''}`}
                            onClick={() => router.push(item.path)}
                        >
                            <item.Icon strokeWidth={1.8} className={styles.navIcon} />
                            <div className={styles.optionName}>{item.label}</div>
                            {item.label === 'Messages' && unreadCount > 0 && (
                                <span className={styles.sidebarBadge}>{unreadCount > 9 ? '9+' : unreadCount}</span>
                            )}
                            {item.badge > 0 && (
                                <span className={styles.sidebarBadge}>{item.badge > 9 ? '9+' : item.badge}</span>
                            )}
                        </div>
                    ))}
                </div>

                {!inAdminPortal && (
                    <button
                        type="button"
                        className={styles.newPostBtn}
                        onClick={() => router.push('/dashboard?compose=1')}
                    >
                        <Feather size={17} strokeWidth={2} />
                        New post
                    </button>
                )}

                {inAdminPortal && (
                    <div className={styles.backToAppBtn} onClick={() => router.push('/dashboard')}>
                        <ArrowLeft size={16} strokeWidth={1.8} />
                        <span>Back to Mitrata</span>
                    </div>
                )}

                {/* Mobile bottom tab bar — curated 5-slot layout, only for the app
                    shell (the admin portal's 3-item nav above already fits the bar). */}
                {!inAdminPortal && (
                    <nav className={styles.mobileNavList}>
                        {MOBILE_TABS.map((item, i) => (
                            <React.Fragment key={item.path}>
                                {i === Math.ceil(MOBILE_TABS.length / 2) && (
                                    <button
                                        type="button"
                                        className={styles.mobileFab}
                                        aria-label="New post"
                                        onClick={() => router.push('/dashboard?compose=1')}
                                    >
                                        <Plus size={22} strokeWidth={2.25} />
                                    </button>
                                )}
                                <div
                                    className={`${styles.mobileTabItem} ${isActive(item.path) ? styles.mobileTabActive : ''}`}
                                    onClick={() => router.push(item.path)}
                                >
                                    <item.Icon strokeWidth={1.8} className={styles.navIcon} />
                                    <span className={styles.mobileTabLabel}>{item.label}</span>
                                    {item.label === 'Chats' && unreadCount > 0 && (
                                        <span className={styles.mobileTabBadge}>{unreadCount > 9 ? '9+' : unreadCount}</span>
                                    )}
                                </div>
                            </React.Fragment>
                        ))}
                    </nav>
                )}

                {authState.user?.userId && (
                    <div className={styles.userChipWrap}>
                        {switcherOpen && (
                            <div className={`${styles.portalSwitcherMenu} ${styles.portalSwitcherMenuUp} mt-dropdown-enter`}>
                                <div
                                    className={`${styles.portalSwitcherItem} ${!inAdminPortal ? styles.portalSwitcherItemActive : ''}`}
                                    onClick={() => { setSwitcherOpen(false); router.push('/dashboard'); }}
                                >
                                    <p className={styles.portalSwitcherTitle}>Mitrata</p>
                                    <p className={styles.portalSwitcherSubtitle}>Social app</p>
                                </div>
                                {isAdmin && (
                                    <div
                                        className={`${styles.portalSwitcherItem} ${inAdminPortal ? styles.portalSwitcherItemActive : ''}`}
                                        onClick={() => { setSwitcherOpen(false); router.push('/admin'); }}
                                    >
                                        <p className={styles.portalSwitcherTitle}>Admin portal</p>
                                        <p className={styles.portalSwitcherSubtitle}>Moderation & members</p>
                                    </div>
                                )}

                                {savedAccounts.length > 0 && (
                                    <>
                                        <div className={styles.portalSwitcherDivider} />
                                        <p className={styles.portalSwitcherOverline}>Switch account</p>
                                        {savedAccounts.map((acc) => (
                                            <div
                                                key={acc.email}
                                                className={styles.portalSwitcherItem}
                                                onClick={() => !switchingAccountId && handleSwitchAccount(acc)}
                                                style={switchingAccountId ? { opacity: 0.6, pointerEvents: 'none' } : undefined}
                                            >
                                                <div className={styles.portalSwitcherAccountRow}>
                                                    <img
                                                        src={acc.profilePicture || '/default-avatar.svg'}
                                                        alt=""
                                                        className={styles.portalSwitcherAccountAvatar}
                                                    />
                                                    <div>
                                                        <p className={styles.portalSwitcherTitle}>{acc.name}</p>
                                                        <p className={styles.portalSwitcherSubtitle}>
                                                            {switchingAccountId === acc.userId ? 'Switching…' : `@${acc.username}`}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </>
                                )}

                                <div className={styles.portalSwitcherDivider} />
                                <div className={styles.portalSwitcherItem} onClick={handleAddAccount}>
                                    <p className={styles.portalSwitcherTitle}>+ Add another account</p>
                                </div>
                            </div>
                        )}
                        <div className={styles.userChip} onClick={() => router.push('/profile')}>
                            <img
                                src={authState.user.userId.profilePicture || '/default-avatar.svg'}
                                alt=""
                                className={styles.userChipAvatar}
                            />
                            <div className={styles.userChipInfo}>
                                <p className={styles.userChipName}>{authState.user.userId.name}</p>
                                <span className={styles.userChipHandle}>@{authState.user.userId.username}</span>
                            </div>
                            <button
                                type="button"
                                className={styles.userChipSwitchBtn}
                                onClick={(e) => { e.stopPropagation(); setSwitcherOpen((v) => !v); }}
                                aria-label="Switch account"
                            >
                                <ChevronsUpDown size={15} strokeWidth={1.8} />
                            </button>
                        </div>
                    </div>
                )}
            </aside>

            <div className={styles.contentColumn}>
                <Navbar inShell />
                <div className={`${styles.mainRow} ${router.pathname.startsWith('/messaging') ? styles.mainRowFlush : ''}`}>
                    <div
                        className={styles.feedContainer}
                        style={fullWidth || router.pathname !== '/dashboard' ? { flex: 1, maxWidth: '100%', height: '100%' } : {}}
                    >
                        {children}
                    </div>
                    {router.pathname === '/dashboard' && (
                        <div className={styles.extraContainer}>
                            {trendingTags.length > 0 && (
                                <div className={styles.trendingCard}>
                                    <h3>Trending now</h3>
                                    {trendingTags.map((t) => (
                                        <div key={t.tag} className={styles.trendingRow}>
                                            <span className={styles.trendingTag}>#{t.tag}</span>
                                            <span className={styles.trendingCount}>{t.count} post{t.count === 1 ? '' : 's'}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <h3>People you may know</h3>
                            {suggestedProfiles.length > 0 ? (
                                suggestedProfiles.slice(0, 5).map((user) => {
                                    const status = connectStatus[user._id];
                                    return (
                                        <div
                                            key={user._id}
                                            className={styles.topProfileCard}
                                            onClick={() => router.push(`/view_profile/${user.username}`)}
                                        >
                                            <img
                                                src={user.profilePicture || "/default-avatar.svg"}
                                                alt="profile"
                                                className={styles.topProfileImg}
                                            />
                                            <div className={styles.topProfileInfo}>
                                                <p className={styles.topProfileName}>
                                                    {user.name}
                                                </p>
                                                <span className={styles.topProfileUsername}>
                                                    @{user.username}
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                className={`${styles.connectBtn} ${status === 'sent' ? styles.connectBtnSent : ''}`}
                                                onClick={(e) => handleConnect(e, user)}
                                                disabled={status === 'loading' || status === 'sent'}
                                                aria-label={status === 'sent' ? 'Request sent' : 'Connect'}
                                            >
                                                {status === 'sent' ? <Check size={14} strokeWidth={2.25} /> : <UserPlus size={14} strokeWidth={2} />}
                                            </button>
                                        </div>
                                    );
                                })
                            ) : (
                                <p>{suggestionsFetched ? 'No suggestions right now' : 'Loading profiles...'}</p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
