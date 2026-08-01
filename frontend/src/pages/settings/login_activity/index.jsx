import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useDispatch } from 'react-redux';
import DashboardLayout from '@/layout/DashboardLayout';
import BlastLoader from '@/Components/ui/BlastLoader';
import { useToast } from '@/Components/Toast';
import { getSessions, revokeSession, revokeOtherSessions } from '@/config/redux/action/authAction';
import { ChevronLeft, Laptop } from 'lucide-react';
import styles from './LoginActivity.module.css';

const timeAgo = (iso) => {
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.round(diffMs / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(iso).toLocaleDateString();
};

export default function LoginActivityPage() {
    const router = useRouter();
    const dispatch = useDispatch();
    const toast = useToast();
    const [sessions, setSessions] = useState([]);
    const [loaded, setLoaded] = useState(false);
    const [busyId, setBusyId] = useState(null);
    const [busyOthers, setBusyOthers] = useState(false);

    const loadSessions = async () => {
        const result = await dispatch(getSessions());
        if (getSessions.fulfilled.match(result)) {
            setSessions(result.payload.sessions || []);
        }
        setLoaded(true);
    };

    useEffect(() => {
        loadSessions();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleSignOut = async (id) => {
        setBusyId(id);
        const result = await dispatch(revokeSession(id));
        setBusyId(null);
        if (revokeSession.fulfilled.match(result)) {
            setSessions((prev) => prev.filter((s) => s.id !== id));
            toast.success('Signed out of that device');
        } else {
            toast.error(result.payload?.message || 'Failed to sign out that device');
        }
    };

    const handleSignOutOthers = async () => {
        if (!window.confirm("Sign out of every other device you're logged into?")) return;
        setBusyOthers(true);
        const result = await dispatch(revokeOtherSessions());
        setBusyOthers(false);
        if (revokeOtherSessions.fulfilled.match(result)) {
            setSessions((prev) => prev.filter((s) => s.isCurrent));
            toast.success('Signed out of all other devices');
        } else {
            toast.error(result.payload?.message || 'Failed to sign out other devices');
        }
    };

    const hasOthers = sessions.some((s) => !s.isCurrent);

    return (
        <DashboardLayout>
            <div className={styles.container}>
                <button className={styles.backBtn} onClick={() => router.push('/settings')}>
                    <ChevronLeft className={styles.backIcon} />
                    Back to Settings
                </button>

                <div className={styles.titleRow}>
                    <h1 className={styles.title}>Login activity</h1>
                    {hasOthers && (
                        <button className={styles.signOutOthersBtn} onClick={handleSignOutOthers} disabled={busyOthers}>
                            {busyOthers ? 'Signing out…' : 'Sign out of all other devices'}
                        </button>
                    )}
                </div>
                <p className={styles.sub}>Where you're currently signed in to Mitrata.</p>

                {!loaded ? (
                    <div className="w-full flex items-center justify-center py-16">
                        <BlastLoader size={48} />
                    </div>
                ) : (
                    <div className={styles.group}>
                        {sessions.map((s) => (
                            <div className={styles.row} key={s.id}>
                                <div className={styles.deviceIcon}>
                                    <Laptop size={18} strokeWidth={1.8} />
                                </div>
                                <div className={styles.info}>
                                    <h4>
                                        {s.device}
                                        {s.isCurrent && <span className={styles.currentTag}>This device</span>}
                                    </h4>
                                    <p>{s.ip ? `${s.ip} · ` : ''}Active {timeAgo(s.lastActiveAt)}</p>
                                </div>
                                {!s.isCurrent && (
                                    <button
                                        className={styles.signOutBtn}
                                        onClick={() => handleSignOut(s.id)}
                                        disabled={busyId === s.id}
                                    >
                                        {busyId === s.id ? 'Signing out…' : 'Sign out'}
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
