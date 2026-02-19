import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSelector, useDispatch } from 'react-redux';
import styles from './Settings.module.css'; // We'll create this next
import { logout } from '@/config/redux/action/authAction';

export default function Settings() {
    const router = useRouter();
    const dispatch = useDispatch();
    const { user } = useSelector(state => state.auth);
    const [theme, setTheme] = useState('system'); // light, dark, system

    useEffect(() => {
        // Load saved theme from local storage if any
        const savedTheme = localStorage.getItem('theme') || 'system';
        setTheme(savedTheme);
    }, []);

    const handleThemeChange = (newTheme) => {
        setTheme(newTheme);
        localStorage.setItem('theme', newTheme);
        // In a real app, you'd apply the theme class to body/html here
        // document.documentElement.setAttribute('data-theme', newTheme);
    };

    const handleLogout = () => {
        dispatch(logout());
        router.push('/login');
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1>Settings</h1>
            </header>

            <div className={styles.content}>
                {/* Profile Card */}
                <div className={styles.profileCard} onClick={() => router.push('/profile')}>
                    <img
                        src={user?.profilePicture || '/default-avatar.png'}
                        alt="Profile"
                        className={styles.avatar}
                    />
                    <div className={styles.profileInfo}>
                        <h2 className={styles.name}>{user?.name || 'User'}</h2>
                        <p className={styles.username}>@{user?.username || 'username'}</p>
                    </div>
                    <div className={styles.arrow}>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" width="20" height="20">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                        </svg>
                    </div>
                </div>

                {/* Group 1: Appearance */}
                <div className={styles.group}>
                    <div className={styles.groupLabel}>Appearance</div>
                    <div className={styles.item}>
                        <div className={styles.iconContainer} style={{ background: '#007AFF' }}>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="white" width="18" height="18">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
                            </svg>
                        </div>
                        <span className={styles.itemLabel}>Theme</span>
                        <select
                            value={theme}
                            onChange={(e) => handleThemeChange(e.target.value)}
                            className={styles.select}
                        >
                            <option value="light">Light</option>
                            <option value="dark">Dark</option>
                            <option value="system">System</option>
                        </select>
                    </div>
                </div>

                {/* Group 2: Privacy */}
                <div className={styles.group}>
                    <div className={styles.groupLabel}>Privacy & Security</div>
                    <div className={styles.item} onClick={() => router.push('/privacy_policy')}>
                        <div className={styles.iconContainer} style={{ background: '#34C759' }}>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="white" width="18" height="18">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                            </svg>
                        </div>
                        <span className={styles.itemLabel}>Privacy Policy</span>
                        <div className={styles.arrow}>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="#C7C7CC" width="16" height="16">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                            </svg>
                        </div>
                    </div>
                </div>

                {/* Group 3: Support */}
                <div className={styles.group}>
                    <div className={styles.groupLabel}>Support</div>
                    <div className={styles.item}>
                        <div className={styles.iconContainer} style={{ background: '#FF9500' }}>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="white" width="18" height="18">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
                            </svg>
                        </div>
                        <span className={styles.itemLabel}>Help & Support</span>
                        <div className={styles.arrow}>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="#C7C7CC" width="16" height="16">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                            </svg>
                        </div>
                    </div>
                </div>

                {/* Group 4: Logout */}
                <div className={styles.group}>
                    <div className={styles.item} onClick={handleLogout} style={{ justifyContent: 'center' }}>
                        <span className={styles.logoutText}>Log Out</span>
                    </div>
                </div>

                <div className={styles.footer}>
                    SocialMedia App v1.0.0
                </div>
            </div>
        </div>
    );
}
