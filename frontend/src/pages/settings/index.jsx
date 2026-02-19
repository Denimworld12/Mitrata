import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSelector, useDispatch } from 'react-redux';
import styles from './Settings.module.css';
import { logout } from '@/config/redux/action/authAction/index';
// Import Heroicons (Solid for active/filled, Outline for general)
import {
    ChevronRightIcon,
    MoonIcon,
    SunIcon,
    UserCircleIcon,
    ShieldCheckIcon,
    QuestionMarkCircleIcon,
    ArrowRightOnRectangleIcon,
    SwatchIcon
} from '@heroicons/react/24/outline';

import { UserIcon } from '@heroicons/react/24/solid';
import UserLayout from '@/layout/userLayout';
import DashboardLayout from '@/layout/DashboardLayout';

export default function Settings() {
    const router = useRouter();
    const dispatch = useDispatch();
    const { user } = useSelector(state => state.auth);
    const [theme, setTheme] = useState('system'); // light, dark, system

    useEffect(() => {
        const savedTheme = localStorage.getItem('theme') || 'system';
        setTheme(savedTheme);
    }, []);

    const handleThemeChange = (newTheme) => {
        setTheme(newTheme);
        localStorage.setItem('theme', newTheme);
        // Toggle class on document element for global theme
        if (newTheme === 'dark') {
            document.documentElement.classList.add('dark');
        } else if (newTheme === 'light') {
            document.documentElement.classList.remove('dark');
        } else {
            // System preference
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
        }
    };

    const handleLogout = () => {
        if (window.confirm("Are you sure you want to log out?")) {
            dispatch(logout());
            router.push('/login');
        }
    };

    return (
        <UserLayout>
                <DashboardLayout>
        <div className={styles.container}>
            <header className={styles.header}>
                <h1 className={styles.title}>Settings</h1>
            </header>

            <div className={styles.content}>
                {/* Profile Section */}
                <div className={styles.profileCard} onClick={() => router.push('/profile')}>
                    <div className={styles.avatarContainer}>
                        <img
                            src={user?.profilePicture || 'https://res.cloudinary.com/detvfqvem/image/upload/v1767007231/default_qzkkui.jpg'}
                            alt="Profile"
                            className={styles.avatar}
                        />
                    </div>
                    <div className={styles.profileInfo}>
                        <h2 className={styles.name}>{user?.name || 'User Name'}</h2>
                        <p className={styles.username}>@{user?.username || 'username'}</p>
                        <p className={styles.editProfileText}>View Profile</p>
                    </div>
                    <ChevronRightIcon className={styles.arrowIcon} />
                </div>

                {/* Settings Groups */}

                {/* Appearance */}
                <div className={styles.sectionTitle}>Preferences</div>
                <div className={styles.group}>
                    <div className={styles.item}>
                        <div className={`${styles.iconBox} ${styles.blueIcon}`}>
                            <SwatchIcon className={styles.icon} />
                        </div>
                        <span className={styles.label}>Theme</span>
                        <div className={styles.themeSelector}>
                            <button
                                onClick={() => handleThemeChange('light')}
                                className={`${styles.themeBtn} ${theme === 'light' ? styles.activeTheme : ''}`}
                                title="Light Mode"
                            >
                                <SunIcon className={styles.themeIcon} />
                            </button>
                            <button
                                onClick={() => handleThemeChange('dark')}
                                className={`${styles.themeBtn} ${theme === 'dark' ? styles.activeTheme : ''}`}
                                title="Dark Mode"
                            >
                                <MoonIcon className={styles.themeIcon} />
                            </button>
                            <button
                                onClick={() => handleThemeChange('system')}
                                className={`${styles.themeBtn} ${theme === 'system' ? styles.activeTheme : ''}`}
                                title="System Default"
                            >
                                <span style={{ fontSize: '10px', fontWeight: 'bold' }}>AUTO</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Privacy & Support */}
                <div className={styles.sectionTitle}>Privacy & Support</div>
                <div className={styles.group}>
                    <div className={styles.item} onClick={() => router.push('/privacy_policy')}>
                        <div className={`${styles.iconBox} ${styles.greenIcon}`}>
                            <ShieldCheckIcon className={styles.icon} />
                        </div>
                        <span className={styles.label}>Privacy Policy</span>
                        <ChevronRightIcon className={styles.arrowIcon} />
                    </div>

                    <div className={styles.item}>
                        <div className={`${styles.iconBox} ${styles.orangeIcon}`}>
                            <QuestionMarkCircleIcon className={styles.icon} />
                        </div>
                        <span className={styles.label}>Help & Support</span>
                        <ChevronRightIcon className={styles.arrowIcon} />
                    </div>
                </div>

                {/* Account Actions */}
                <div className={styles.group}>
                    <div className={`${styles.item} ${styles.logoutItem}`} onClick={handleLogout}>
                        <div className={`${styles.iconBox} ${styles.redIcon}`}>
                            <ArrowRightOnRectangleIcon className={styles.icon} />
                        </div>
                        <span className={`${styles.label} ${styles.logoutText}`}>Log Out</span>
                    </div>
                </div>

                <div className={styles.footer}>
                    <p>Mitrata App v1.2.0</p>
                    <p>Made with ❤️ By Nikhil R Gupta</p>
                </div>
            </div>
        </div>
        </DashboardLayout>
    </UserLayout>    
    
    );
}
