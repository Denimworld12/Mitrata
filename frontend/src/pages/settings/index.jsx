import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSelector, useDispatch } from 'react-redux';
import styles from './Settings.module.css';
import { logout, deleteAccount } from '@/config/redux/action/authAction/index';
import { useToast } from '@/Components/Toast';
import {
    ChevronRight,
    Moon,
    Sun,
    MoonStar,
    ShieldCheck,
    CircleHelp,
    LogOut,
    Trash2,
    UsersRound,
    Bell,
    Search,
} from 'lucide-react';
import DashboardLayout from '@/layout/DashboardLayout';
import SettingsItem from '@/Components/ui/SettingsItem';
import { useNotification } from '@/Components/NotificationProvider';

const DELETE_CONFIRM_WORD = 'DELETE';

export default function Settings() {
    const router = useRouter();
    const dispatch = useDispatch();
    const toast = useToast();
    const { user } = useSelector(state => state.auth);
    const { unreadCount } = useNotification();
    const [theme, setTheme] = useState('system'); // light, dark, system
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deletePassword, setDeletePassword] = useState('');
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        const savedTheme = localStorage.getItem('theme') || 'system';
        setTheme(savedTheme);
    }, []);

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

    const hasPassword = !user?.userId?.googleId;

    const handleDeleteAccount = async () => {
        if (deleteConfirmText !== DELETE_CONFIRM_WORD) return;
        setDeleting(true);
        const result = await dispatch(deleteAccount({ password: deletePassword }));
        setDeleting(false);
        if (deleteAccount.fulfilled.match(result)) {
            toast.success('Account permanently deleted');
            router.push('/login');
        } else {
            toast.error(result.payload?.message || 'Failed to delete account');
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
                    <SettingsItem
                        icon={Search}
                        label="Explore"
                        sub="Find people to connect with"
                        onClick={() => router.push('/search')}
                    />
                </div>

                {/* Appearance */}
                <div className={styles.sectionTitle}>Appearance</div>
                <div className={`${styles.group} mt-enter`} style={{ animationDelay: '60ms' }}>
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
                <div className={styles.sectionTitle}>Privacy & Support</div>
                <div className={`${styles.group} mt-enter`} style={{ animationDelay: '120ms' }}>
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
                <div className={`${styles.group} mt-enter`} style={{ animationDelay: '180ms' }}>
                    <button className={`${styles.logoutBtn} mt-btn-lift`} onClick={handleLogout}>
                        <LogOut className={styles.logoutIcon} />
                        Log out
                    </button>
                </div>

                {/* Danger Zone */}
                <div className={styles.sectionTitle}>Danger Zone</div>
                <div className={`${styles.group} mt-enter`} style={{ animationDelay: '220ms' }}>
                    <button
                        className={`${styles.logoutBtn} mt-btn-lift`}
                        onClick={() => setShowDeleteModal(true)}
                    >
                        <Trash2 className={styles.logoutIcon} />
                        Delete my account permanently
                    </button>
                </div>

                {showDeleteModal && (
                    <div className={styles.modalOverlay} onClick={() => !deleting && setShowDeleteModal(false)}>
                        <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
                            <h3 className={styles.modalTitle}>Delete account permanently</h3>
                            <p className={styles.modalSub}>
                                This deletes your profile, posts, messages, connections and media forever.
                                This can't be undone.
                            </p>

                            {hasPassword && (
                                <input
                                    type="password"
                                    placeholder="Enter your password"
                                    value={deletePassword}
                                    onChange={(e) => setDeletePassword(e.target.value)}
                                    className={styles.modalInput}
                                />
                            )}

                            <label className={styles.modalLabel}>
                                Type <strong>{DELETE_CONFIRM_WORD}</strong> to confirm
                            </label>
                            <input
                                type="text"
                                value={deleteConfirmText}
                                onChange={(e) => setDeleteConfirmText(e.target.value)}
                                className={styles.modalInput}
                            />

                            <div className={styles.modalActions}>
                                <button
                                    className={styles.modalCancelBtn}
                                    onClick={() => setShowDeleteModal(false)}
                                    disabled={deleting}
                                >
                                    Cancel
                                </button>
                                <button
                                    className={styles.modalDeleteBtn}
                                    onClick={handleDeleteAccount}
                                    disabled={deleting || deleteConfirmText !== DELETE_CONFIRM_WORD || (hasPassword && !deletePassword)}
                                >
                                    {deleting ? 'Deleting…' : 'Delete permanently'}
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
