import React from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import styles from '../privacy_policy/PrivacyPolicy.module.css';
import { ChevronLeft } from 'lucide-react';
import UserLayout from '@/layout/userLayout';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://mitrata.vercel.app';
const ABOUT_DESCRIPTION = 'Mitrata is a social home for real friendships — a feed worth scrolling, a network worth keeping, and voice calls that just work.';

const SECTIONS = [
    {
        title: 'Our mission',
        body: (
            <p>Most social apps are built to hold your attention. Mitrata is built to hold your friendships — a feed that ends, a network of people you actually know, and calls that work without juggling five other apps.</p>
        ),
    },
    {
        title: 'What you get',
        body: (
            <ul>
                <li><strong>A feed that ends:</strong> posts from people you're connected to, not an endless algorithmic churn.</li>
                <li><strong>Voice, one tap:</strong> ring anyone in your network straight from chat.</li>
                <li><strong>Search & discover:</strong> find people by name, skills, or background.</li>
                <li><strong>Stay connected:</strong> send and accept connection requests, all in one place.</li>
            </ul>
        ),
    },
    {
        title: 'Get in touch',
        body: (
            <p>
                Questions, feedback, or just want to say hi — email us at{' '}
                <a href="mailto:mitrata.llp@gmail.com">mitrata.llp@gmail.com</a>.
            </p>
        ),
    },
];

export default function About() {
    const router = useRouter();

    return (
        <UserLayout>
            <Head>
                <title>About Mitrata — A social home for real friendships</title>
                <meta name="description" content={ABOUT_DESCRIPTION} />
                <link rel="canonical" href={`${SITE_URL}/about`} />
                <meta property="og:title" content="About Mitrata" />
                <meta property="og:description" content={ABOUT_DESCRIPTION} />
                <meta property="og:url" content={`${SITE_URL}/about`} />
            </Head>

            <div className={styles.container}>
                <header className={styles.header}>
                    <button className={styles.backBtn} onClick={() => router.push('/')}>
                        <ChevronLeft className={styles.backIcon} />
                        Back
                    </button>
                    <h1 className={styles.title}>About Mitrata</h1>
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
