import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import styles from '../../styles/Home.module.css';
import { ArrowLeft, LayoutList, PhoneCall, Search, UsersRound } from 'lucide-react';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://mitrata.vercel.app';
const ABOUT_DESCRIPTION = 'Mitrata is a social home for real friendships — a feed worth scrolling, a network worth keeping, and voice calls that just work.';

// Same four as the landing page's feature grid — About restates them in the
// context of "why", landing states them in the context of "what".
const FEATURES = [
    { Icon: LayoutList, title: 'A feed that ends', body: "Posts from people you're actually connected to — not an endless algorithmic churn." },
    { Icon: PhoneCall, title: 'Voice, one tap', body: 'Ring anyone in your network straight from chat. No apps to juggle, no numbers to exchange.' },
    { Icon: Search, title: 'Search & discover', body: 'Find people by name, skills, or background.' },
    { Icon: UsersRound, title: 'Stay connected', body: 'Send and accept connection requests, all in one place.' },
];

export default function About() {
    const router = useRouter();
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    useEffect(() => {
        setIsLoggedIn(Boolean(localStorage.getItem('token')));
    }, []);

    return (
        <div className={styles.container}>
            <Head>
                <title>About Mitrata — A social home for real friendships</title>
                <meta name="description" content={ABOUT_DESCRIPTION} />
                <link rel="canonical" href={`${SITE_URL}/about`} />
                <meta property="og:title" content="About Mitrata" />
                <meta property="og:description" content={ABOUT_DESCRIPTION} />
                <meta property="og:url" content={`${SITE_URL}/about`} />
            </Head>

            <div className={styles.orbTopLeft} />
            <div className={styles.orbBottomRight} />

            <nav className={styles.nav}>
                <button className={`${styles.navBtnOutline} mt-btn-lift`} onClick={() => router.push('/')}>
                    <ArrowLeft size={16} strokeWidth={2.25} style={{ marginRight: 6, verticalAlign: -2 }} />
                    Home
                </button>
                <div className={styles.navActions}>
                    <button
                        className={`${styles.navBtnGrad} mt-btn-lift`}
                        onClick={() => router.push(isLoggedIn ? '/dashboard' : '/login')}
                    >
                        {isLoggedIn ? 'Go to dashboard' : 'Join Mitrata'}
                    </button>
                </div>
            </nav>

            <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center', padding: '40px 2rem 10px' }}>
                <span className={`${styles.eyebrow} mt-enter-sm`}>
                    <span className={styles.eyebrowDot} />
                    About Mitrata
                </span>
                <h1 className={`${styles.heroTitle} mt-enter`} style={{ animationDelay: '60ms' }}>
                    Built for friendship,{' '}
                    <span className={styles.heroTitleGrad}>not engagement metrics</span>.
                </h1>
                <p className={`${styles.heroSub} mt-enter`} style={{ animationDelay: '120ms', margin: '0 auto', maxWidth: 560 }}>
                    Most social apps are built to hold your attention. Mitrata is built to hold your
                    friendships — a feed that ends, a network of people you actually know, and calls
                    that work without juggling five other apps.
                </p>
            </div>

            <section className={styles.featuresSection}>
                <h2 className={styles.featuresTitle}>What you get</h2>
                <p className={styles.featuresSub}>Nothing here is bolted on — the feed, search, network, and calls all know about the same people.</p>

                <div className={styles.featureGrid}>
                    {FEATURES.map((f, i) => (
                        <div
                            key={f.title}
                            className={`${styles.featureCard} mt-enter mt-card-hover`}
                            style={{ animationDelay: `${i * 60}ms` }}
                        >
                            <span className={styles.featureIcon}><f.Icon size={20} strokeWidth={1.85} /></span>
                            <h3 className={styles.featureTitle}>{f.title}</h3>
                            <p className={styles.featureBody}>{f.body}</p>
                        </div>
                    ))}
                </div>
            </section>

            <section className={styles.ctaBand}>
                <div className={styles.ctaBandOrbA} />
                <div className={styles.ctaBandOrbB} />
                <div className={styles.ctaBandContent}>
                    <h2 className={styles.ctaBandTitle}>Questions, feedback, or just want to say hi?</h2>
                    <p className={styles.ctaBandSub}>We read every email.</p>
                    <a href="mailto:mitrata.llp@gmail.com" className={styles.ctaBandButton} style={{ textDecoration: 'none', display: 'inline-block' }}>
                        Email us
                    </a>
                </div>
            </section>

            <footer className={styles.footer}>
                <span className={styles.footerLogo}>mitrata</span>
                <span className={styles.footerTagline}>Made for friendship, not for engagement metrics.</span>
                <div className={styles.footerLinks}>
                    <a href="/privacy_policy" className={styles.footerLink}>Privacy</a>
                </div>
            </footer>
        </div>
    );
}
