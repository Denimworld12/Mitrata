import React from 'react';
import { useRouter } from 'next/router';
import styles from './PrivacyPolicy.module.css';
import { ChevronLeftIcon } from '@heroicons/react/24/outline';
import UserLayout from '@/layout/userLayout';

export default function PrivacyPolicy() {
    const router = useRouter();

    return (
        <UserLayout>
        <div className={styles.container}>
            <div className={styles.header}>
                <button onClick={() => router.back()} className={styles.backBtn}>
                    <ChevronLeftIcon className={styles.backIcon} />
                    Back
                </button>
                <h1 className={styles.title}>Privacy Policy</h1>
            </div>

            <div className={styles.content}>
                <p className={styles.lastUpdated}>Last Updated: February 20, 2026</p>

                <section className={styles.section}>
                    <h2>1. Introduction</h2>
                    <p>Welcome to SocialMedia. We value your privacy and are committed to protecting your personal information. This Privacy Policy explains how we collect, use, and share your data when you use our platform.</p>
                </section>

                <section className={styles.section}>
                    <h2>2. Information We Collect</h2>
                    <ul>
                        <li><strong>Account Information:</strong> Name, username, email address, and profile picture.</li>
                        <li><strong>Content:</strong> Posts, comments, likes, and messages you send.</li>
                        <li><strong>Usage Data:</strong> Information about how you interact with our services, including device information and connection data.</li>
                    </ul>
                </section>

                <section className={styles.section}>
                    <h2>3. How We Use Your Information</h2>
                    <p>We use your data to:</p>
                    <ul>
                        <li>Provide and improve our services.</li>
                        <li>Personalize your experience.</li>
                        <li>Facilitate communication between users (messaging, voice calls).</li>
                        <li>Ensure the safety and security of our platform.</li>
                    </ul>
                </section>

                <section className={styles.section}>
                    <h2>4. Data Sharing</h2>
                    <p>We do not sell your personal data. We may share information with:</p>
                    <ul>
                        <li><strong>Service Providers:</strong> Who help us operate the platform (e.g., cloud hosting, image storage).</li>
                        <li><strong>Legal Authorities:</strong> If required by law or to protect our rights.</li>
                    </ul>
                </section>

                <section className={styles.section}>
                    <h2>5. Your Choices</h2>
                    <p>You can update your profile information at any time via Settings. You can also delete your account by contacting support.</p>
                </section>

                <section className={styles.section}>
                    <h2>6. Contact Us</h2>
                    <p>If you have questions about this policy, please contact us at <a href="mailto:privacy@socialmedia.com">privacy@socialmedia.com</a>.</p>
                </section>
            </div>
        </div>
        </UserLayout>
    );
}
