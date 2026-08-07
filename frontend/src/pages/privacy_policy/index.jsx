import React from 'react';
import { useRouter } from 'next/router';
import styles from './PrivacyPolicy.module.css';
import { ChevronLeft } from 'lucide-react';
import UserLayout from '@/layout/userLayout';

export const SUPPORT_EMAIL = 'mitrata.llp@gmail.com';

// Data-driven instead of six near-identical <section> blocks — also makes
// it obvious at a glance which numbered section is which when this needs
// updating later.
const SECTIONS = [
    {
        title: 'Introduction',
        body: (
            <p>Welcome to Mitrata. We value your privacy and are committed to protecting your personal information. This Privacy Policy explains how we collect, use, and share your data when you use our platform.</p>
        ),
    },
    {
        title: 'Information We Collect',
        body: (
            <ul>
                <li><strong>Account information:</strong> name, username, email address, and profile picture.</li>
                <li><strong>Content:</strong> posts, comments, reactions, stories, and messages you send.</li>
                <li><strong>Usage data:</strong> how you interact with our services, including device information and connection data.</li>
            </ul>
        ),
    },
    {
        title: 'How We Use Your Information',
        body: (
            <>
                <p>We use your data to:</p>
                <ul>
                    <li>Provide and improve our services.</li>
                    <li>Personalize your experience.</li>
                    <li>Facilitate communication between users (messaging, voice/video calls).</li>
                    <li>Ensure the safety and security of our platform.</li>
                </ul>
            </>
        ),
    },
    {
        title: 'Data Sharing',
        body: (
            <>
                <p>We do not sell your personal data. We may share information with:</p>
                <ul>
                    <li><strong>Service providers</strong> who help us operate the platform (e.g., cloud hosting, media storage, email delivery).</li>
                    <li><strong>Legal authorities</strong>, if required by law or to protect our rights.</li>
                </ul>
            </>
        ),
    },
    {
        title: 'Your Choices',
        body: (
            <p>
                You can update your profile information at any time via Settings.
                You can also permanently delete your account yourself — no need to
                contact us — from Settings → Danger Zone → &ldquo;Delete my account
                permanently&rdquo;. This removes your profile, posts, messages,
                connections, and media, and cannot be undone.
            </p>
        ),
    },
    {
        title: 'Contact Us',
        body: (
            <p>
                If you have questions about this policy, please contact us at{' '}
                <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
            </p>
        ),
    },
];

export default function PrivacyPolicy() {
    const router = useRouter();

    return (
        <UserLayout>
            <div className={styles.container}>
                <header className={styles.header}>
                    <button
                        className={styles.backBtn}
                        onClick={() => router.push(localStorage.getItem('token') ? '/settings' : '/')}
                    >
                        <ChevronLeft className={styles.backIcon} />
                        Back
                    </button>
                    <h1 className={styles.title}>Privacy Policy</h1>
                    <p className={styles.lastUpdated}>Last updated: February 20, 2026</p>
                </header>

                {SECTIONS.map((section, idx) => (
                    <section className={styles.section} key={section.title}>
                        <h2>
                            <span className={styles.sectionNum}>{idx + 1}</span>
                            {section.title}
                        </h2>
                        {section.body}
                    </section>
                ))}
            </div>
        </UserLayout>
    );
}
