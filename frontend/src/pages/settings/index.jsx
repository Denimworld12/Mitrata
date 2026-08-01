import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSelector, useDispatch } from 'react-redux';
import styles from './Settings.module.css';
import { logout, updateAccountSettings, getTwoFactorStatus } from '@/config/redux/action/authAction/index';
import { useToast } from '@/Components/Toast';
import {
    ChevronRight,
    Moon,
    Sun,
    MoonStar,
    ShieldCheck,
    CircleHelp,
    LogOut,
    UsersRound,
    Bell,
    UserCog,
    Mail,
    KeyRound,
    Lock,
    UserX,
    BellRing,
    ShieldPlus,
} from 'lucide-react';
import DashboardLayout from '@/layout/DashboardLayout';
import SettingsItem from '@/Components/ui/SettingsItem';
import Toggle from '@/Components/ui/Toggle';
import { useNotification } from '@/Components/NotificationProvider';

export default function Settings() {
    const router = useRouter();
    const dispatch = useDispatch();
    const toast = useToast();
    const { user, twoFactorEnabled } = useSelector(state => state.auth);
    const { unreadCount } = useNotification();
    const [theme, setTheme] = useState('system'); // light, dark, system
    const [showUsernameModal, setShowUsernameModal] = useState(false);
    const [usernameInput, setUsernameInput] = useState('');
    const [savingUsername, setSavingUsername] = useState(false);
    const [loaded2FA, setLoaded2FA] = useState(false);
    const [dismissedTwoFactorNudge, setDismissedTwoFactorNudge] = useState(true);

    useEffect(() => {
        const savedTheme = localStorage.getItem('theme') || 'system';
        setTheme(savedTheme);
    }, []);

    useEffect(() => {
        setDismissedTwoFactorNudge(localStorage.getItem('dismissed2faNudge') === '1');
        dispatch(getTwoFactorStatus()).finally(() => setLoaded2FA(true));
    }, [dispatch]);

    const handleThemeChange = (newTheme) => {
        setTheme(newTheme);
        localStorage.setItem('theme', newTheme);
        const isDark = newTheme === 'dark' || (newTheme === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
        // data-mt-theme drives tokens.css (the design system's actual dark-mode source of truth);
        // .dark class kept in sync in case any Tailwind dark: utility is added later.
        document.documentElement.setAttribute('data-mt-theme', isDark ? 'dark' : 'light');
        document.documentElement.classList.toggle('dark', isDark);
    };

    const handleLogout = () => {
        if (window.confirm("Are you sure you want to log out?")) {
            dispatch(logout());
            router.push('/login');
        }
    };

    const openUsernameModal = () => {
        setUsernameInput(user?.userId?.username || '');
        setShowUsernameModal(true);
    };

    const handleSaveUsername = async () => {
        const trimmed = usernameInput.trim();
        if (!trimmed || trimmed === user?.userId?.username) {
            setShowUsernameModal(false);
            return;
        }
        setSavingUsername(true);
        const result = await dispatch(updateAccountSettings({ username: trimmed }));
        setSavingUsername(false);
        if (updateAccountSettings.fulfilled.match(result)) {
            toast.success('Username updated');
            setShowUsernameModal(false);
        } else {
            toast.error(result.payload?.message || 'Failed to update username');
        }
    };

    const handleTogglePrivate = async (next) => {
        const result = await dispatch(updateAccountSettings({ isPrivate: next }));
        if (updateAccountSettings.fulfilled.match(result)) {
            toast.success(next ? 'Your account is now private' : 'Your account is now public');
        } else {
            toast.error(result.payload?.message || 'Failed to update');
        }
    };

    const handleTogglePush = async (next) => {
        const result = await dispatch(updateAccountSettings({ pushEnabled: next }));
        if (!updateAccountSettings.fulfilled.match(result)) {
            toast.error(result.payload?.message || 'Failed to update');
        }
    };

    const quietHours = user?.userId?.quietHours || { enabled: false, start: '22:00', end: '07:00' };
    const [quietStart, setQuietStart] = useState(quietHours.start);
    const [quietEnd, setQuietEnd] = useState(quietHours.end);

    useEffect(() => {
        setQuietStart(quietHours.start);
        setQuietEnd(quietHours.end);
    }, [quietHours.start, quietHours.end]);

    const handleToggleQuietHours = async (next) => {
        const result = await dispatch(updateAccountSettings({
            quietHours: {
                enabled: next,
                start: quietStart,
                end: quietEnd,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            }
        }));
        if (!updateAccountSettings.fulfilled.match(result)) {
            toast.error(result.payload?.message || 'Failed to update');
        }
    };

    const handleSaveQuietHoursWindow = async () => {
        const result = await dispatch(updateAccountSettings({
            quietHours: {
                enabled: true,
                start: quietStart,
                end: quietEnd,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            }
        }));
        if (updateAccountSettings.fulfilled.match(result)) {
            toast.success('Quiet hours updated');
        } else {
            toast.error(result.payload?.message || 'Failed to update');
        }
    };

    return (
                        <DashboardLayout>
        <div className={styles.container}>
            <header className={styles.header}>
                <h1 className={styles.title}>Settings</h1>
            </header>

            <div className={styles.content}>
                {/* Profile Section */}
                <div className={`${styles.profileCard} mt-enter`} onClick={() => router.push('/profile')}>
                    <div className={styles.avatarContainer}>
                        <img
                            src={user?.userId?.profilePicture || 'https://res.cloudinary.com/detvfqvem/image/upload/v1767007231/default_qzkkui.jpg'}
                            alt="Profile"
                            className={styles.avatar}
                        />
                    </div>
                    <div className={styles.profileInfo}>
                        <h2 className={styles.name}>{user?.userId?.name || 'User Name'}</h2>
                        <p className={styles.username}>@{user?.userId?.username || 'username'}</p>
                        <p className={styles.editProfileText}>View Profile</p>
                    </div>
                    <ChevronRight className={styles.arrowIcon} />
                </div>

                {/* Settings Groups */}

                {/* Quick Access — some pages (My Network, notably) never had a
                    direct link on mobile: no bottom-bar slot, no menu entry,
                    only reachable by chance through another page's button.
                    Centralizing shortcuts here means there's always at least
                    one guaranteed way to find them, on any screen size. */}
                <div className={styles.sectionTitle}>Quick Access</div>
                <div className={`${styles.group} mt-enter`} style={{ animationDelay: '30ms' }}>
                    <SettingsItem
                        icon={UsersRound}
                        label="My Network"
                        sub="Connections and requests"
                        onClick={() => router.push('/my_network')}
                    />
                    <SettingsItem
                        icon={Bell}
                        label="Notifications"
                        sub="Requests, likes and comments"
                        badge={unreadCount}
                        onClick={() => router.push('/notifications')}
                    />
                </div>

                {/* Account */}
                <div className={styles.sectionTitle}>Account</div>
                <div className={`${styles.group} mt-enter`} style={{ animationDelay: '50ms' }}>
                    <SettingsItem
                        icon={UserCog}
                        label="Username"
                        sub={`@${user?.userId?.username || ''}`}
                        onClick={openUsernameModal}
                    />
                    <SettingsItem
                        icon={Mail}
                        label="Email"
                        sub={user?.userId?.email || ''}
                    />
                    {!user?.userId?.googleId && (
                        <SettingsItem
                            icon={KeyRound}
                            label="Password"
                            sub="Change your password"
                            onClick={() => router.push('/forgot-password')}
                        />
                    )}
                    <SettingsItem
                        icon={ShieldPlus}
                        label="Two-step verification"
                        sub={twoFactorEnabled ? "On — using an authenticator app" : "Add an extra step at login"}
                        onClick={() => router.push('/settings/two_factor')}
                    />
                </div>

                {/* A quiet, dismissible nudge rather than a modal/interstitial —
                    security prompts that block the page train people to click
                    through them without reading. Dismissing just hides it for
                    this browser; it comes back if 2FA is still off next visit
                    somewhere without that flag (a fresh browser, cleared storage). */}
                {loaded2FA && !twoFactorEnabled && !dismissedTwoFactorNudge && (
                    <div className={`${styles.group} mt-enter`} style={{ animationDelay: '60ms', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <ShieldPlus size={20} strokeWidth={1.8} style={{ color: 'var(--mt-accent, #0447ff)', flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--mt-ink)' }}>Secure your account</p>
                            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--mt-ink3)' }}>Turn on two-step verification to protect your account, even if your password leaks.</p>
                        </div>
                        <button
                            onClick={() => router.push('/settings/two_factor')}
                            style={{ flexShrink: 0, padding: '7px 14px', borderRadius: 999, border: 'none', background: 'var(--mt-grad)', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
                        >
                            Turn on
                        </button>
                        <button
                            onClick={() => { localStorage.setItem('dismissed2faNudge', '1'); setDismissedTwoFactorNudge(true); }}
                            style={{ flexShrink: 0, background: 'none', border: 'none', color: 'var(--mt-ink3)', fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: 4 }}
                            aria-label="Dismiss"
                        >
                            ×
                        </button>
                    </div>
                )}

                {/* Privacy */}
                <div className={styles.sectionTitle}>Privacy</div>
                <div className={`${styles.group} mt-enter`} style={{ animationDelay: '70ms' }}>
                    <SettingsItem
                        icon={Lock}
                        label="Private account"
                        sub="Only connections can see your profile and posts"
                        right={
                            <Toggle
                                checked={!!user?.userId?.isPrivate}
                                onChange={handleTogglePrivate}
                            />
                        }
                    />
                    <SettingsItem
                        icon={UserX}
                        label="Blocked accounts"
                        sub="People you've blocked"
                        onClick={() => router.push('/settings/blocked_accounts')}
                    />
                </div>

                {/* Notifications */}
                <div className={styles.sectionTitle}>Notifications</div>
                <div className={`${styles.group} mt-enter`} style={{ animationDelay: '90ms' }}>
                    <SettingsItem
                        icon={BellRing}
                        label="Push notifications"
                        sub="Get notified even when the tab is closed"
                        right={
                            <Toggle
                                checked={user?.userId?.pushEnabled !== false}
                                onChange={handleTogglePush}
                            />
                        }
                    />
                    <SettingsItem
                        icon={MoonStar}
                        label="Quiet hours"
                        sub={quietHours.enabled ? `Muted ${quietStart}–${quietEnd}` : "Mute push notifications overnight"}
                        right={
                            <Toggle
                                checked={!!quietHours.enabled}
                                onChange={handleToggleQuietHours}
                            />
                        }
                    />
                    {quietHours.enabled && (
                        <div className={styles.item} style={{ paddingTop: 0 }}>
                            <div className={styles.labelBlock} style={{ flex: 'none' }} />
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                                <input
                                    type="time"
                                    value={quietStart}
                                    onChange={(e) => setQuietStart(e.target.value)}
                                    onBlur={handleSaveQuietHoursWindow}
                                    className={styles.modalInput}
                                    style={{ width: 'auto', marginBottom: 0 }}
                                />
                                <span style={{ color: 'var(--mt-ink3)', fontSize: 12.5 }}>to</span>
                                <input
                                    type="time"
                                    value={quietEnd}
                                    onChange={(e) => setQuietEnd(e.target.value)}
                                    onBlur={handleSaveQuietHoursWindow}
                                    className={styles.modalInput}
                                    style={{ width: 'auto', marginBottom: 0 }}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Appearance */}
                <div className={styles.sectionTitle}>Appearance</div>
                <div className={`${styles.group} mt-enter`} style={{ animationDelay: '110ms' }}>
                    <div className={styles.item}>
                        <div className={styles.iconBox}>
                            <MoonStar className={styles.icon} />
                        </div>
                        <div className={styles.labelBlock}>
                            <span className={styles.label}>Theme</span>
                            <span className={styles.sub}>Switch between light and dark</span>
                        </div>
                        <div className={styles.themeSelector}>
                            <button
                                onClick={() => handleThemeChange('light')}
                                className={`${styles.themeBtn} ${theme === 'light' ? styles.activeTheme : ''}`}
                                title="Light Mode"
                            >
                                <Sun className={styles.themeIcon} />
                            </button>
                            <button
                                onClick={() => handleThemeChange('dark')}
                                className={`${styles.themeBtn} ${theme === 'dark' ? styles.activeTheme : ''}`}
                                title="Dark Mode"
                            >
                                <Moon className={styles.themeIcon} />
                            </button>
                            <button
                                onClick={() => handleThemeChange('system')}
                                className={`${styles.themeBtn} ${theme === 'system' ? styles.activeTheme : ''}`}
                                title="System Default"
                            >
                                <span className={styles.autoLabel}>AUTO</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Privacy & Support */}
                <div className={styles.sectionTitle}>Support</div>
                <div className={`${styles.group} mt-enter`} style={{ animationDelay: '130ms' }}>
                    <SettingsItem
                        icon={ShieldCheck}
                        label="Privacy Policy"
                        sub="How we handle your data"
                        onClick={() => router.push('/privacy_policy')}
                    />
                    <SettingsItem
                        icon={CircleHelp}
                        label="Help & Support"
                        sub="FAQs and how to reach us"
                        onClick={() => router.push('/help_support')}
                    />
                </div>

                {/* Account Actions */}
                <div className={`${styles.group} mt-enter`} style={{ animationDelay: '150ms' }}>
                    <button className={`${styles.logoutBtn} mt-btn-lift`} onClick={handleLogout}>
                        <LogOut className={styles.logoutIcon} />
                        Log out
                    </button>
                </div>

                {/* Deleting an account permanently is intentionally NOT a
                    direct action on this page anymore — it used to be a
                    button styled identically to (and sitting right next to)
                    Log out, which is exactly the kind of thing a misclick
                    lands on. It's reachable only through Help & Support's
                    guide now, adding real deliberate steps in between. */}

                {showUsernameModal && (
                    <div className={styles.modalOverlay} onClick={() => !savingUsername && setShowUsernameModal(false)}>
                        <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
                            <h3 className={styles.modalTitle}>Change username</h3>
                            <input
                                type="text"
                                value={usernameInput}
                                onChange={(e) => setUsernameInput(e.target.value.replace(/\s/g, ''))}
                                className={styles.modalInput}
                                placeholder="username"
                            />
                            <div className={styles.modalActions}>
                                <button
                                    className={styles.modalCancelBtn}
                                    onClick={() => setShowUsernameModal(false)}
                                    disabled={savingUsername}
                                >
                                    Cancel
                                </button>
                                <button
                                    className={styles.modalDeleteBtn}
                                    onClick={handleSaveUsername}
                                    disabled={savingUsername || !usernameInput.trim()}
                                    style={{ background: 'var(--mt-grad)' }}
                                >
                                    {savingUsername ? 'Saving…' : 'Save'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <div className={styles.footer}>
                    <p>Mitrata App v1.2.0</p>
                    <p>Made with love by Nikhil R Gupta</p>
                </div>
            </div>
        </div>
        </DashboardLayout>

    );
}
