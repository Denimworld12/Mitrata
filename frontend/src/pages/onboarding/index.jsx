import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { useDispatch, useSelector } from 'react-redux';
import { getAboutUser, updateUserProfile, updateAccountSettings } from '@/config/redux/action/authAction';
import { clientServer } from '@/config';
import { compressImage } from '@/utils/imageProcessing';
import { useToast } from '@/Components/Toast';
import PageLoader from '@/Components/ui/PageLoader';
import Button from '@/Components/ui/Button';
import { Camera } from 'lucide-react';
import styles from './styles.module.css';

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,30}$/;

// One-time "finish setting up your account" page — the first thing a brand
// new account sees (see users.model.js's `onboarded` field and
// DashboardLayout's redirect gate). Standalone, not wrapped in
// DashboardLayout: there's no sidebar/nav worth showing before this is done,
// same reasoning /login stays standalone.
export default function OnboardingPage() {
    const router = useRouter();
    const dispatch = useDispatch();
    const toast = useToast();
    const authState = useSelector((state) => state.auth);
    const fileInputRef = useRef(null);

    const [checking, setChecking] = useState(true);
    const [name, setName] = useState('');
    const [username, setUsername] = useState('');
    const [usernameError, setUsernameError] = useState('');
    const [avatarFile, setAvatarFile] = useState(null);
    const [avatarPreview, setAvatarPreview] = useState(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (!localStorage.getItem('token')) {
            router.replace('/login');
            return;
        }
        if (!authState.user) dispatch(getAboutUser());
    }, []);

    useEffect(() => {
        const user = authState.user?.userId;
        if (!user) return;
        // Already done — landing here directly (bookmark, back button)
        // shouldn't re-run onboarding.
        if (user.onboarded) {
            router.replace('/dashboard');
            return;
        }
        setName(user.name || '');
        setUsername(user.username || '');
        setAvatarPreview(user.profilePicture || null);
        setChecking(false);
    }, [authState.user]);

    // Revoke the object URL when it's replaced or the page unmounts — it's
    // otherwise held in memory for as long as the tab stays open.
    useEffect(() => {
        return () => {
            if (avatarPreview?.startsWith('blob:')) URL.revokeObjectURL(avatarPreview);
        };
    }, [avatarPreview]);

    const handleAvatarPick = (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setAvatarFile(file);
        setAvatarPreview(URL.createObjectURL(file));
    };

    const handleUsernameChange = (e) => {
        setUsernameError('');
        setUsername(e.target.value.replace(/\s/g, '').toLowerCase());
    };

    const handleContinue = async () => {
        if (saving) return;
        if (!name.trim()) {
            toast.error('Please enter your name');
            return;
        }
        if (!USERNAME_REGEX.test(username)) {
            setUsernameError('3-30 characters, letters, numbers, and underscores only');
            return;
        }

        setSaving(true);
        try {
            if (avatarFile) {
                const compressed = await compressImage(avatarFile, { maxWidthOrHeight: 600, quality: 0.85 });
                const formData = new FormData();
                formData.append('profilePicture', compressed);
                await clientServer.post('/user/update_profile_picture', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
            }

            const profileResult = await dispatch(updateUserProfile({ name: name.trim() }));
            if (!updateUserProfile.fulfilled.match(profileResult)) {
                toast.error(profileResult.payload?.message || 'Failed to save your name');
                setSaving(false);
                return;
            }

            const settingsResult = await dispatch(updateAccountSettings({ username, onboarded: true }));
            if (!updateAccountSettings.fulfilled.match(settingsResult)) {
                setUsernameError(settingsResult.payload?.message || 'Username already taken');
                setSaving(false);
                return;
            }

            await dispatch(getAboutUser());
            router.push('/dashboard');
        } catch (error) {
            toast.error('Something went wrong — please try again');
            setSaving(false);
        }
    };

    if (checking) return <PageLoader />;

    return (
        <div className={styles.container}>
            <div className={styles.cardContainer}>
                <div className={styles.cardContainer_left}>
                    <span className={styles.brandMark} role="img" aria-label="Mitrata" />
                    <h1 className={styles.heading}>Welcome to Mitrata</h1>
                    <p className={styles.subheading}>
                        Let's finish setting up your account — you can always change this later in Settings.
                    </p>

                    <div className={styles.avatarPicker}>
                        <button
                            type="button"
                            className={styles.avatarButton}
                            onClick={() => fileInputRef.current?.click()}
                            aria-label="Upload profile photo"
                        >
                            <img
                                src={avatarPreview || '/default-avatar.svg'}
                                alt=""
                                className={styles.avatarImg}
                            />
                            <span className={styles.avatarOverlay}>
                                <Camera size={18} strokeWidth={2} />
                            </span>
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleAvatarPick}
                            style={{ display: 'none' }}
                        />
                        <span className={styles.avatarHint}>Add a profile photo</span>
                    </div>

                    <div className={styles.formGroup}>
                        <label>Your name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Full name"
                            className={styles.inputField}
                            maxLength={80}
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label>Username</label>
                        <div className={styles.usernameInputWrap}>
                            <span className={styles.usernamePrefix}>@</span>
                            <input
                                type="text"
                                value={username}
                                onChange={handleUsernameChange}
                                placeholder="username"
                                className={`${styles.inputField} ${styles.usernameInput} ${usernameError ? styles.inputError : ''}`}
                                maxLength={30}
                            />
                        </div>
                        {usernameError && <p className={styles.fieldError}>{usernameError}</p>}
                    </div>

                    <Button
                        onClick={handleContinue}
                        loading={saving}
                        className="w-full mt-3 !rounded-full !py-3.5 !text-base"
                    >
                        Continue to Mitrata
                    </Button>
                </div>

                <div className={styles.cardContainer_right}>
                    <img src="/brand/orb-violet.png" alt="" className={styles.rightOrb} />
                    <div className={styles.rightContent}>
                        <span className={styles.rightLogo} role="img" aria-label="Mitrata" />
                        <p>Friendship, first.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
