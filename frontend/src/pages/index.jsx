import { useRouter } from "next/router";
import styles from '../styles/Home.module.css'
import { useEffect, useState } from "react";
import { ArrowRight, Smartphone, LayoutList, PhoneCall, Search, UsersRound } from "lucide-react";
import serverAxios from "@/config/serverAxios";

const FEATURES = [
  {
    id: "feed",
    span: true,
    Icon: LayoutList,
    title: "A feed that ends",
    body: "No infinite churn — just posts from people you're actually connected to. Rich reactions instead of a single like, and a real \"load more\" instead of an endless scroll.",
  },
  {
    id: "voice-calls",
    grad: true,
    Icon: PhoneCall,
    title: "Voice, one tap",
    body: "Ring anyone you're connected to, right from chat. No apps to juggle, no numbers to exchange.",
  },
  {
    id: "search",
    Icon: Search,
    title: "Search & discover",
    body: "Find people by name, skills, or background — and see who Mitrata thinks you should meet.",
  },
  {
    Icon: UsersRound,
    title: "Stay connected",
    body: "Send requests, accept connections, and keep track of your network in one place.",
  },
  {
    sunken: true,
    Icon: Smartphone,
    title: "Native on both",
    body: "One design language, two shells — a sidebar on desktop, a thumb-reachable tab bar on mobile.",
  },
];

export default function Home({ trendingTags, totalUsers }) {
  const router = useRouter();
  const [isloggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    setIsLoggedIn(Boolean(token));
  }, []);

  const handleJoinClick = () => {
    router.push(isloggedIn ? "/dashboard" : "/login");
  };

  const scrollToFeatures = () => {
    document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
  };

  const scrollToFeature = (id) => () => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div className={styles.container}>
        <div className={styles.orbTopLeft} />
        <div className={styles.orbBottomRight} />

        {/* Nav */}
        <nav className={styles.nav}>
          <div className={styles.navLinks}>
            <a onClick={scrollToFeature("feed")} className={styles.navLink}>Feed</a>
            <a onClick={scrollToFeature("voice-calls")} className={styles.navLink}>Voice calls</a>
            <a onClick={scrollToFeature("search")} className={styles.navLink}>Search</a>
          </div>
          <div className={styles.navActions}>
            <button className={`${styles.navBtnOutline} mt-btn-lift`} onClick={() => router.push("/login")}>Log in</button>
            <button className={`${styles.navBtnGrad} mt-btn-lift`} onClick={handleJoinClick}>{isloggedIn ? "Go to dashboard" : "Join Mitrata"}</button>
          </div>
        </nav>

        {/* Hero */}
        <div className={styles.mainContainer}>
          <div className={styles.mainContainer_left}>
            <span className={`${styles.eyebrow} mt-enter-sm`}>
              <span className={styles.eyebrowDot} />
              Feed, chat and calls — one app
            </span>

            <h1 className={`${styles.heroTitle} mt-enter`} style={{ animationDelay: "60ms" }}>
              Everyone you like,{" "}
              <span className={styles.heroTitleGrad}>in one place</span>.
            </h1>

            <p className={`${styles.heroSub} mt-enter`} style={{ animationDelay: "120ms" }}>
              Mitrata is a social home for real friendships. A feed worth scrolling, a network worth keeping, and voice calls that just work.
            </p>

            <div className={`${styles.ctaRow} mt-enter`} style={{ animationDelay: "180ms" }}>
              <div onClick={handleJoinClick} className={`${styles.buttonJoin} mt-btn-lift`}>
                {isloggedIn ? "Go to Dashboard" : "Get started free"}
                <ArrowRight size={18} strokeWidth={2.25} />
              </div>
              <div onClick={scrollToFeatures} className={`${styles.buttonOutline} mt-btn-lift`}>
                <Smartphone size={18} strokeWidth={1.9} />
                See what's inside
              </div>
            </div>

            <div className={`${styles.proofRow} mt-enter`} style={{ animationDelay: "240ms" }}>
              <div className={styles.avatarStack}>
                <span className={styles.avatarDot} style={{ background: "linear-gradient(135deg,#0447ff,#7b5cf0)" }} />
                <span className={styles.avatarDot} style={{ background: "linear-gradient(135deg,#ff4704,#f0a85e)" }} />
                <span className={styles.avatarDot} style={{ background: "linear-gradient(135deg,#8aa86a,#9fb6d4)" }} />
                <span className={styles.avatarDot} style={{ background: "linear-gradient(135deg,#d98aa6,#8b86d6)" }} />
              </div>
              <span className={styles.proofText}>
                {totalUsers > 0 ? (
                  <>Join <strong>{totalUsers.toLocaleString()}</strong> people already building their network on Mitrata</>
                ) : (
                  "Join people already building their network on Mitrata"
                )}
              </span>
            </div>
          </div>

          <div className={styles.mainContainer_right}>
            <div className={`${styles.heroImageFrame} mt-enter`} style={{ animationDelay: "100ms" }}>
              <img src="/images/connectPeople.png" alt="Connect" className={styles.heroImage} />
            </div>
          </div>
        </div>

        {/* Trending marquee — hidden entirely (not backfilled with fake
            tags) until real hashtags exist */}
        {trendingTags.length > 0 && (
          <div className={styles.marqueeSection}>
            <span className={styles.marqueeLabel}>Trending today</span>
            <div className={styles.marqueeTrack}>
              <div className={styles.marqueeContent}>
                {[...trendingTags, ...trendingTags].map((tag, i) => (
                  <span key={i} className={styles.marqueeChip}>#{tag}</span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Feature grid */}
        <section id="features" className={styles.featuresSection}>
          <h2 className={styles.featuresTitle}>Five habits, one place worth staying.</h2>
          <p className={styles.featuresSub}>Nothing here is bolted on — the feed, search, network, and calls all know about the same people.</p>

          <div className={styles.featureGrid}>
            {FEATURES.map((f, i) => (
              <div
                key={f.title}
                id={f.id}
                className={`${styles.featureCard} ${f.span ? styles.featureCardSpan : ''} ${f.grad ? styles.featureCardGrad : ''} ${f.sunken ? styles.featureCardSunken : ''} mt-enter mt-card-hover`}
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <span className={styles.featureIcon}><f.Icon size={20} strokeWidth={1.85} /></span>
                <h3 className={styles.featureTitle}>{f.title}</h3>
                <p className={styles.featureBody}>{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA band */}
        <section className={styles.ctaBand}>
          <div className={styles.ctaBandOrbA} />
          <div className={styles.ctaBandOrbB} />
          <div className={styles.ctaBandContent}>
            <h2 className={styles.ctaBandTitle}>Bring your people. We'll keep it calm.</h2>
            <p className={styles.ctaBandSub}>Free to join. Your connections, your feed, your calls.</p>
            <button className={`${styles.ctaBandButton} mt-btn-lift`} onClick={handleJoinClick}>Create your account</button>
          </div>
        </section>

        {/* Footer */}
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

export async function getServerSideProps() {
  try {
    const [tagsRes, statsRes] = await Promise.all([
      serverAxios.get("/trending/tags", { params: { limit: 8 } }),
      serverAxios.get("/stats/public"),
    ]);
    return {
      props: {
        trendingTags: (tagsRes.data.tags || []).map((t) => t.tag),
        totalUsers: statsRes.data.totalUsers || 0,
      },
    };
  } catch (error) {
    console.error("Landing page stats fetch failed:", error.message);
    return { props: { trendingTags: [], totalUsers: 0 } };
  }
}
