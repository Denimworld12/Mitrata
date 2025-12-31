import { getMyConnectionRequests, acceptConnectionRequest, getConnectionRequest } from '@/config/redux/action/authAction';
import DashboardLayout from '@/layout/DashboardLayout'
import UserLayout from '@/layout/userLayout'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import styles from './mynetwork.module.css'
import { useRouter } from 'next/router';

export default function MyNetwork() {
    const dispatch = useDispatch();
    const authState = useSelector((state) => state.auth);
    const router = useRouter();
    
    const [activeTab, setActiveTab] = useState('connections');
    const [isMounted, setIsMounted] = useState(false);

    const refreshData = useCallback(() => {
        const token = localStorage.getItem("token");
        if (token) {
            dispatch(getMyConnectionRequests({ token }));
            dispatch(getConnectionRequest({ token }));
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
        const token = localStorage.getItem("token");
        
        try {
            await dispatch(acceptConnectionRequest({
                token,
                connectionId: requestId,
                action: action
            })).unwrap();
            
            refreshData();
        } catch (error) {
            console.error("Failed to update connection:", error);
            alert(error.message || "Failed to update connection");
        }
    };

    if (!isMounted) return null;

    return (
        <UserLayout>
            <DashboardLayout>
                <div className={styles.container}>
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
                                <h3>Your Connections</h3>
                                {myConnections.length === 0 ? (
                                    <p>No connections yet.</p>
                                ) : (
                                    myConnections.map((conn) => (
                                        <div key={conn._id} className={styles.userCard}>
                                            <img src={conn.userId.profilePicture || "/default-avatar.png"} alt="profile" />
                                            <div className={styles.userInfo} onClick={() => router.push(`/view_profile/${conn.userId.username}`)}>
                                                <h4>{conn.userId.name}</h4>
                                                <p>@{conn.userId.username}</p>
                                            </div>
                                            <button className={styles.msgBtn} onClick={() => router.push(`/messaging/${conn.userId.username}`)}>
                                                Message
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {activeTab === 'received' && (
                            <div className={styles.requestsList}>
                                <h3>Received Requests</h3>
                                {pendingReceived.length === 0 ? (
                                    <p>No pending requests.</p>
                                ) : (
                                    pendingReceived.map((req) => (
                                        <div key={req._id} className={styles.userCard}>
                                            <img src={req.userId.profilePicture || "/default-avatar.png"} alt="profile" />
                                            <div className={styles.userInfo} onClick={() => router.push(`/view_profile/${req.userId.username}`)}>
                                                <h4>{req.userId.name}</h4>
                                                <p>@{req.userId.username}</p>
                                            </div>
                                            <div className={styles.circleButtons}>
                                                <button
                                                    className={styles.acceptCircle}
                                                    onClick={() => handleAction(req._id, 'accept')}
                                                    title="Accept"
                                                >
                                                    ✓
                                                </button>
                                                <button
                                                    className={styles.rejectCircle}
                                                    onClick={() => handleAction(req._id, 'reject')}
                                                    title="Reject"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {activeTab === 'sent' && (
                            <div className={styles.requestsList}>
                                <h3>Sent Requests</h3>
                                {pendingSent.length === 0 ? (
                                    <p>No pending sent requests.</p>
                                ) : (
                                    pendingSent.map((req) => (
                                        <div key={req._id} className={styles.userCard}>
                                            <img src={req.userId.profilePicture || "/default-avatar.png"} alt="profile" />
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
        </UserLayout>
    )
}