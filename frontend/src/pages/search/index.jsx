import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { clientServer } from '@/config';
import Layout from '@/layout/DashboardLayout';
import styles from './Search.module.css';
import { UserCircleIcon, BriefcaseIcon, AcademicCapIcon, SparklesIcon, MagnifyingGlassIcon, UserPlusIcon, CheckIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';

const Search = () => {
    const router = useRouter();
    const { q } = router.query;
    const [localQuery, setLocalQuery] = useState(q || '');
    const [results, setResults] = useState([]);
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (q) {
            setLocalQuery(q);
            fetchResults(q);
        } else {
            fetchSuggestions();
            setResults([]);
        }
    }, [q]);

    const fetchResults = async (query) => {
        setLoading(true);
        try {
            const response = await clientServer.get(`/user/search?q=${encodeURIComponent(query)}`);
            setResults(response.data);
        } catch (error) {
            console.error("Search failed", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchSuggestions = async () => {
        if (suggestions.length === 0) {
            setLoading(true);
            try {
                const response = await clientServer.get('/user/suggestions');
                setSuggestions(response.data);
            } catch (error) {
                console.error("Failed to fetch suggestions", error);
            } finally {
                setLoading(false);
            }
        }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        if (localQuery.trim()) {
            router.push(`/search?q=${encodeURIComponent(localQuery.trim())}`);
        }
    };

    const navToProfile = (username) => {
        router.push(`/view_profile/${username}`);
    }

    // Extracted UserCard component to handle its own connection state
    const UserCard = ({ user }) => {
        const [requestStatus, setRequestStatus] = useState(null); // null, 'pending', 'sent'
        const [loadingConn, setLoadingConn] = useState(false);

        const handleConnect = async (e) => {
            e.stopPropagation(); // Prevent card click
            setLoadingConn(true);
            try {
                await clientServer.post('/user/send_connection_request', {
                    connectionId: user._id
                });
                setRequestStatus('sent');
                // Optional: Show toast
                // toast.success(`Request sent to ${user.name}`);
            } catch (error) {
                console.error("Connection request failed", error);
                const msg = error.response?.data?.message || "Failed to connect";
                if (msg.includes("Already connected") || msg.includes("already pending")) {
                    setRequestStatus('sent'); // Treat as sent/connected
                } else {
                    // toast.error(msg);
                }
            } finally {
                setLoadingConn(false);
            }
        };

        return (
            <div className={styles.card} onClick={() => navToProfile(user.username)}>
                <div className={styles.cardHeader}>
                    <img
                        src={user.profilePicture || '/default-avatar.png'}
                        alt={user.name}
                        className={styles.avatar}
                    />
                    <div className={styles.userInfo}>
                        <h3 className={styles.name}>{user.name}</h3>
                        <p className={styles.username}>@{user.username}</p>
                    </div>

                    <button
                        className={`${styles.connectBtn} ${requestStatus === 'sent' ? styles.sent : ''}`}
                        onClick={handleConnect}
                        disabled={loadingConn || requestStatus === 'sent'}
                    >
                        {loadingConn ? (
                            <span className={styles.loadingDot}>•</span>
                        ) : requestStatus === 'sent' ? (
                            <CheckIcon className={styles.btnIcon} />
                        ) : (
                            <UserPlusIcon className={styles.btnIcon} />
                        )}
                    </button>
                </div>

                <div className={styles.cardBody}>
                    {/* Match reason removed as requested */}

                    {user.profile?.bio && (
                        <p className={styles.bio}>{user.profile.bio.substring(0, 60)}...</p>
                    )}

                    {user.profile?.skills?.length > 0 && (
                        <div className={styles.skills}>
                            {user.profile.skills.slice(0, 2).map((skill, index) => (
                                <span key={index} className={styles.skillTag}>{skill}</span>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <Layout>
            <div className={styles.container}>
                {/* Search Header */}
                <div className={styles.searchHeader}>
                    <form onSubmit={handleSearch} className={styles.searchForm}>
                        <MagnifyingGlassIcon className={styles.searchIcon} />
                        <input
                            type="text"
                            placeholder="Search people, skills, companies..."
                            value={localQuery}
                            onChange={(e) => setLocalQuery(e.target.value)}
                            className={styles.searchInput}
                        />
                        <button type="submit" className={styles.searchBtn}>Search</button>
                    </form>
                </div>

                {/* Suggestions Section (Horizontal Scroll) */}
                {!q && suggestions.length > 0 && (
                    <div className={styles.section}>
                        <h2 className={styles.sectionTitle}>
                            <SparklesIcon className={styles.titleIcon} />
                            Suggested for you
                        </h2>
                        <div className={styles.horizontalScroll}>
                            {suggestions.map(user => (
                                <div key={user._id} className={styles.scrollItem}>
                                    <UserCard user={user} />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Search Results Section */}
                {q && (
                    <div className={styles.section}>
                        <h2 className={styles.sectionTitle}>
                            {results.length > 0 ? `Results for "${q}"` : `No matches for "${q}"`}
                        </h2>

                        {loading ? (
                            <div className={styles.loading}>Searching...</div>
                        ) : results.length === 0 ? (
                            <div className={styles.empty}>
                                <div className={styles.emptyIcon}>🔍</div>
                                <p>We couldn't find anyone matching your search.</p>
                            </div>
                        ) : (
                            <div className={styles.grid}>
                                {results.map(user => (
                                    <UserCard key={user._id} user={user} />
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default Search;
