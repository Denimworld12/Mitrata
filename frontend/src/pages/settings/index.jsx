import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSelector, useDispatch } from 'react-redux';
import styles from './Settings.module.css';
import { logout } from '@/config/redux/action/authAction/index';
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
} from 'lucide-react';
import DashboardLayout from '@/layout/DashboardLayout';
import SettingsItem from '@/Components/ui/SettingsItem';
import { useNotification } from '@/Components/NotificationProvider';

export default function Settings() {
    const router = useRouter();
    const dispatch = useDispatch();
    const { user } = useSelector(state => state.auth);
    const { unreadCount } = useNotification();
    const [theme, setTheme] = useState('system'); // light, dark, system

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

                {/* Deleting an account permanently is intentionally NOT a
                    direct action on this page anymore — it used to be a
                    button styled identically to (and sitting right next to)
                    Log out, which is exactly the kind of thing a misclick
                    lands on. It's reachable only through Help & Support's
                    guide now, adding real deliberate steps in between. */}

                <div className={styles.footer}>
                    <p>Mitrata App v1.2.0</p>
                    <p>Made with love by Nikhil R Gupta</p>
                </div>
            </div>
        </div>
        </DashboardLayout>

    );
}
