import { getMyConnectionRequests, acceptConnectionRequest, getConnectionRequest } from '@/config/redux/action/authAction';
import { useToast } from '@/Components/Toast';
import { useNotification } from '@/Components/NotificationProvider';
import DashboardLayout from '@/layout/DashboardLayout'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import styles from './mynetwork.module.css'
import { useRouter } from 'next/router';
import { Phone, MessageCircle, Check, X, UsersRound, Inbox, SendHorizontal } from 'lucide-react';
import EmptyState from '@/Components/ui/EmptyState';
import PageLoader from '@/Components/ui/PageLoader';
import { useCall } from '@/Components/CallProvider';

export default function MyNetwork() {
    const dispatch = useDispatch();
    const authState = useSelector((state) => state.auth);
    const router = useRouter();
    const { socketInstance, onlineUsers } = useNotification();

    const [activeTab, setActiveTab] = useState('connections');
    const [isMounted, setIsMounted] = useState(false);
    const toast = useToast();
    const { callUser } = useCall();

    const refreshData = useCallback(() => {
        const token = localStorage.getItem("token");
        if (token) {
            dispatch(getMyConnectionRequests());
            dispatch(getConnectionRequest());
        }
    }, [dispatch]);

    useEffect(() => {
        setIsMounted(true);
        const token = localStorage.getItem("token");

        if (token) {
            refreshData();
        } else {
            router.replace('/login');
        }
    }, [refreshData, router]);

    // Live-refresh both directions — a request landing in "Received" for the
    // person it's sent to, and a sender's own "Sent"/"Connections" list
    // moving someone over once THEY accept — instead of only ever loading
    // once on mount and needing a manual page refresh to see either.
    useEffect(() => {
        if (!socketInstance) return;
        socketInstance.on('connectionRequest', refreshData);
        socketInstance.on('connectionAccepted', refreshData);
        return () => {
            socketInstance.off('connectionRequest', refreshData);
            socketInstance.off('connectionAccepted', refreshData);
        };
    }, [socketInstance, refreshData]);

    // FIXED: Separate the data properly
    const { pendingReceived, pendingSent, myConnections } = useMemo(() => {
        const allRequests = authState.connection || [];
        const acceptedConnections = authState.connectionRequest || [];

        return {
            // Requests I RECEIVED and are PENDING
            pendingReceived: allRequests.filter(
                req => req.status_accepted === null && !req.iAmSender
            ),
            // Requests I SENT and are PENDING
            pendingSent: allRequests.filter(
                req => req.status_accepted === null && req.iAmSender
            ),
            // ACCEPTED connections
            myConnections: acceptedConnections
        };
    }, [authState.connection, authState.connectionRequest]);

    const handleAction = async (requestId, action) => {
        try {
            await dispatch(acceptConnectionRequest({
                connectionId: requestId,
                action: action
            })).unwrap();

            refreshData();
        } catch (error) {
            console.error("Failed to update connection:", error);
            toast.error(error.message || "Failed to update connection");
        }
    };

    if (!isMounted) return <PageLoader />;

    return (
                    <DashboardLayout>
                <div className={styles.container}>
                    <div className={styles.pageHeader}>
                        <h1 className={styles.pageTitle}>My Network</h1>
                        <p className={styles.pageSub}>
                            {myConnections.length} connections
                            {pendingReceived.length > 0 && ` · ${pendingReceived.length} request${pendingReceived.length > 1 ? 's' : ''} waiting on you`}
                        </p>
                    </div>

                    <div className={styles.tabHeader}>
                        <button
                            className={activeTab === 'connections' ? styles.activeTab : styles.tabBtn}
                            onClick={() => setActiveTab('connections')}
                        >
                            Connections ({myConnections.length})
                        </button>
                        <button
                            className={activeTab === 'received' ? styles.activeTab : styles.tabBtn}
                            onClick={() => setActiveTab('received')}
                        >
                            Received ({pendingReceived.length})
                        </button>
                        <button
                            className={activeTab === 'sent' ? styles.activeTab : styles.tabBtn}
                            onClick={() => setActiveTab('sent')}
                        >
                            Sent ({pendingSent.length})
                        </button>
                    </div>

                    <div className={styles.contentArea}>
                        {activeTab === 'connections' && (
                            <div className={styles.connectionsList}>
                                {myConnections.length === 0 ? (
                                    <EmptyState
                                        icon={UsersRound}
                                        title="No connections yet"
                                        description="Accept requests or connect with people to grow your network."
                                    />
                                ) : (
                                    myConnections.map((conn, idx) => (
                                        <div key={conn._id} className={`${styles.userCard} mt-enter-sm`} style={{ animationDelay: `${idx * 60}ms` }}>
                                            <div className={styles.avatarRing}>
                                                <img src={conn.userId.profilePicture || "/default-avatar.svg"} alt="profile" />
                                                <span className={`${styles.onlineStatus} ${onlineUsers.has(conn.userId._id) ? styles.online : styles.offline}`} />
                                            </div>
                                            <div className={styles.userInfo} onClick={() => router.push(`/view_profile/${conn.userId.username}`)}>
                                                <h4>{conn.userId.name}</h4>
                                                <p>@{conn.userId.username}</p>
                                            </div>
                                            <button
                                                className={`${styles.iconBtn} mt-icon-btn`}
                                                title="Call"
                                                onClick={() => callUser(conn.userId._id, {
                                                    name: conn.userId.name,
                                                    avatar: conn.userId.profilePicture
                                                })}
                                            >
                                                <Phone size={17} strokeWidth={1.8} />
                                            </button>
                                            <button className={`${styles.msgBtn} mt-btn-lift`} onClick={() => router.push(`/messaging/${conn.userId.username}`)}>
                                                <MessageCircle size={15} strokeWidth={1.8} /> Message
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {activeTab === 'received' && (
                            <div className={styles.requestsList}>
                                {pendingReceived.length === 0 ? (
                                    <EmptyState
                                        icon={Inbox}
                                        title="No pending requests"
                                        description="Requests people send you will show up here."
                                    />
                                ) : (
                                    pendingReceived.map((req, idx) => (
                                        <div key={req._id} className={`${styles.userCard} mt-enter-sm`} style={{ animationDelay: `${idx * 60}ms` }}>
                                            <div className={styles.avatarRing}>
                                                <img src={req.userId.profilePicture || "/default-avatar.svg"} alt="profile" />
                                            </div>
                                            <div className={styles.userInfo} onClick={() => router.push(`/view_profile/${req.userId.username}`)}>
                                                <h4>{req.userId.name}</h4>
                                                <p>@{req.userId.username}</p>
                                            </div>
                                            <div className={styles.actionButtons}>
                                                <button
                                                    className={`${styles.acceptBtn} mt-btn-lift`}
                                                    onClick={() => handleAction(req._id, 'accept')}
                                                    title="Accept"
                                                >
                                                    <Check size={15} strokeWidth={2} /> Accept
                                                </button>
                                                <button
                                                    className={`${styles.ignoreBtn} mt-btn-lift`}
                                                    onClick={() => handleAction(req._id, 'reject')}
                                                    title="Ignore"
                                                >
                                                    <X size={15} strokeWidth={2} /> Ignore
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {activeTab === 'sent' && (
                            <div className={styles.requestsList}>
                                {pendingSent.length === 0 ? (
                                    <EmptyState
                                        icon={SendHorizontal}
                                        title="No sent requests"
                                        description="Connection requests you send will show up here."
                                    />
                                ) : (
                                    pendingSent.map((req, idx) => (
                                        <div key={req._id} className={`${styles.userCard} ${styles.pendingCard} mt-enter-sm`} style={{ animationDelay: `${idx * 60}ms` }}>
                                            <div className={styles.avatarRing}>
                                                <img src={req.userId.profilePicture || "/default-avatar.svg"} alt="profile" />
                                            </div>
                                            <div className={styles.userInfo} onClick={() => router.push(`/view_profile/${req.userId.username}`)}>
                                                <h4>{req.userId.name}</h4>
                                                <p>@{req.userId.username}</p>
                                            </div>
                                            <span className={styles.pendingBadge}>Pending</span>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </DashboardLayout>
    )
}