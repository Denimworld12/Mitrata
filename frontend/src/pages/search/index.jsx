import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { clientServer } from '@/config';
import Layout from '@/layout/DashboardLayout';
import styles from './Search.module.css';
import { Search as SearchIcon, UserPlus, Check, X } from 'lucide-react';
import { useToast } from '@/Components/Toast';
import Skeleton from '@/Components/ui/Skeleton';
import EmptyState from '@/Components/ui/EmptyState';

const RECENT_SEARCHES_KEY = 'recentSearches';
const MAX_RECENT = 5;

function loadRecentSearches() {
    try {
        return JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || '[]');
    } catch {
        return [];
    }
}

function saveRecentSearch(query) {
    const trimmed = query.trim();
    if (!trimmed) return loadRecentSearches();
    const existing = loadRecentSearches().filter(
        (item) => item.toLowerCase() !== trimmed.toLowerCase()
    );
    const next = [trimmed, ...existing].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
    return next;
}

// Was defined inside Search() — a fresh function identity every render, so
// React remounted every card (resetting requestStatus back to null) on any
// re-render of the parent, including every keystroke in the search box.
// That let the same "Connect" click fire twice: the button visually reset
// to its un-pressed state a moment after actually sending the request.
function UserCard({ user }) {
    const router = useRouter();
    const toast = useToast();
    const [requestStatus, setRequestStatus] = useState(null); // null, 'pending', 'sent'
    const [loadingConn, setLoadingConn] = useState(false);

    const navToProfile = () => router.push(`/view_profile/${user.username}`);

    const handleConnect = async (e) => {
        e.stopPropagation(); // Prevent card click
        setLoadingConn(true);
        try {
            await clientServer.post('/user/send_connection_request', {
                connectionId: user._id
            });
            setRequestStatus('sent');
            toast.success(`Request sent to ${user.name}`);
        } catch (error) {
            console.error("Connection request failed", error);
            const msg = error.response?.data?.message || "Failed to connect";
            if (msg.includes("Already connected") || msg.includes("already pending")) {
                setRequestStatus('sent'); // Treat as sent/connected
            } else {
                toast.error(msg);
            }
        } finally {
            setLoadingConn(false);
        }
    };

    return (
        <div className={styles.card} onClick={navToProfile}>
            <div className={styles.cardHeader}>
                <img
                    src={user.profilePicture || '/default-avatar.svg'}
                    alt={user.name}
                    className={styles.avatar}
                />
                <div className={styles.userInfo}>
                    <h3 className={styles.name}>{user.name}</h3>
                    <p className={styles.username}>@{user.username}</p>
                </div>

                <button
                    className={`${styles.connectBtn} ${requestStatus === 'sent' ? styles.sent : ''} mt-btn-lift`}
                    onClick={handleConnect}
                    disabled={loadingConn || requestStatus === 'sent'}
                >
                    {loadingConn ? (
                        <span className={styles.loadingDot}>•</span>
                    ) : requestStatus === 'sent' ? (
                        <Check className={styles.btnIcon} />
                    ) : (
                        <UserPlus className={styles.btnIcon} />
                    )}
                </button>
            </div>

            <div className={styles.cardBody}>
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
}

const Search = () => {
    const router = useRouter();
    const toast = useToast();
    const { q } = router.query;
    const [localQuery, setLocalQuery] = useState(q || '');
    const [results, setResults] = useState([]);
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [recentSearches, setRecentSearches] = useState([]);

    useEffect(() => {
        setRecentSearches(loadRecentSearches());
    }, []);

    useEffect(() => {
        if (q) {
            setLocalQuery(q);
            fetchResults(q);
            setRecentSearches(saveRecentSearch(q));
        } else {
            fetchSuggestions();
            setResults([]);
        }
    }, [q]);

    // Debounce: fire search 300ms after the user stops typing.
    useEffect(() => {
        if (!localQuery.trim() || localQuery === q) return;
        const timer = setTimeout(() => {
            router.push(`/search?q=${encodeURIComponent(localQuery.trim())}`);
        }, 300);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [localQuery]);

    const removeRecentSearch = (query) => {
        const next = loadRecentSearches().filter((item) => item !== query);
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
        setRecentSearches(next);
    };

    const runRecentSearch = (query) => {
        setLocalQuery(query);
        router.push(`/search?q=${encodeURIComponent(query)}`);
    };

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

    return (
        <Layout>
            <div className={styles.container}>
                <div className={styles.pageHeader}>
                    <h1 className={styles.pageTitle}>Explore</h1>
                    <p className={styles.pageSub}>Find people to connect with across Mitrata.</p>
                </div>

                {/* Search Header */}
                <div className={styles.searchHeader}>
                    <form onSubmit={handleSearch} className={styles.searchForm}>
                        <SearchIcon className={styles.searchIcon} />
                        <input
                            type="text"
                            placeholder="Search people, skills, companies..."
                            value={localQuery}
                            onChange={(e) => setLocalQuery(e.target.value)}
                            className={styles.searchInput}
                        />
                        <button type="submit" className={`${styles.searchBtn} mt-btn-lift`}>Search</button>
                    </form>
                </div>

                {/* Recent Searches (shown only when query is empty) */}
                {!q && recentSearches.length > 0 && (
                    <div className={styles.section}>
                        <h2 className={styles.sectionTitle}>Recent searches</h2>
                        <div className="flex flex-wrap gap-2">
                            {recentSearches.map((item, idx) => (
                                <span
                                    key={item}
                                    className={`${styles.recentChip} mt-enter-sm`}
                                    style={{ animationDelay: `${idx * 60}ms` }}
                                    onClick={() => runRecentSearch(item)}
                                >
                                    {item}
                                    <X
                                        className={styles.recentChipClose}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            removeRecentSearch(item);
                                        }}
                                    />
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Suggestions Section (Horizontal Scroll) */}
                {!q && suggestions.length > 0 && (
                    <div className={styles.section}>
                        <h2 className={styles.sectionTitle}>People worth following</h2>
                        <div className={styles.horizontalScroll}>
                            {suggestions.map((user, idx) => (
                                <div key={user._id} className={`${styles.scrollItem} mt-enter-sm`} style={{ animationDelay: `${idx * 60}ms` }}>
                                    <UserCard user={user} />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Loading state (only relevant before results/suggestions have arrived) */}
                {loading && suggestions.length === 0 && !q && (
                    <div className={styles.section}>
                        <Skeleton rows={3} />
                    </div>
                )}

                {/* Search Results Section */}
                {q && (
                    <div className={styles.section}>
                        <h2 className={styles.sectionTitle}>
                            {loading ? `Searching for "${q}"` : results.length > 0 ? `Results for "${q}"` : `No matches for "${q}"`}
                        </h2>

                        {loading ? (
                            <Skeleton rows={3} />
                        ) : results.length === 0 ? (
                            <EmptyState
                                icon={SearchIcon}
                                title="No one found"
                                description="We couldn't find anyone matching your search."
                            />
                        ) : (
                            <div className={styles.grid}>
                                {results.map((user, idx) => (
                                    <div key={user._id} className="mt-enter-sm" style={{ animationDelay: `${idx * 60}ms` }}>
                                        <UserCard user={user} />
                                    </div>
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
