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

    // --- 1. Persistent Data Fetching ---
    // Memoize the refresh function to prevent unnecessary re-renders
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
            // Only fetch if the data isn't already in Redux (Caching)
            if (!authState.connectionRequest || authState.connectionRequest.length === 0) {
                refreshData();
            }
        } else {
            router.replace('/login');
        }
    }, [refreshData, router]); // Removed authState from deps to prevent infinite loops

    // --- 2. Optimized Filtering (Memoized) ---
    const { pendingRequests, myConnections } = useMemo(() => {
        const requests = authState.connectionRequest || [];
        return {
            pendingRequests: requests.filter(req => req.status_accepted === null),
            myConnections: requests.filter(req => req.status_accepted === true)
        };
    }, [authState.connectionRequest]);

    const handleAction = async (requestId, action) => {
        const token = localStorage.getItem("token");
        
        // Use async/await for cleaner flow
        try {
            await dispatch(acceptConnectionRequest({
                token,
                connectionId: requestId,
                action: action
            })).unwrap(); // .unwrap() ensures we catch errors correctly
            
            // Silent refresh in the background
            refreshData();
        } catch (error) {
            console.error("Failed to update connection:", error);
        }
    };

    // Prevent Hydration mismatch error in Next.js
    if (!isMounted) return null;

    return (
        <UserLayout>
            <DashboardLayout>
                <div className={styles.container}>

                    {/* Tab Navigation */}
                    <div className={styles.tabHeader}>
                        <button
                            className={activeTab === 'connections' ? styles.activeTab : styles.tabBtn}
                            onClick={() => setActiveTab('connections')}
                        >
                            Connections ({myConnections.length})
                        </button>
                        <button
                            className={activeTab === 'requests' ? styles.activeTab : styles.tabBtn}
                            onClick={() => setActiveTab('requests')}
                        >
                            Requests ({pendingRequests.length})
                        </button>
                    </div>

                    <div className={styles.contentArea}>
                        {activeTab === 'connections' ? (
                            <div className={styles.connectionsList}>
                                <h3>Your Connections</h3>
                                {myConnections.length === 0 ? <p>No connections yet.</p> : (
                                    myConnections.map((conn) => (
                                        <div key={conn._id}  className={styles.userCard}>
                                            <img src={conn.userId.profilePicture || "/default-avatar.png"} alt="profile" />
                                            <div className={styles.userInfo} onClick={() => router.push(`/view_profile/${conn.userId.username}`)}>
                                                <h4>{conn.userId.name}</h4>
                                                <p>@{conn.userId.username}</p>
                                            </div>
                                            <button className={styles.msgBtn} onClick={() => router.push(`/messaging/${conn.userId.username}`)}>Message</button>
                                        </div>
                                    ))
                                )}
                            </div>
                        ) : (
                            <div className={styles.requestsList}>
                                <h3>Pending Invitations</h3>
                                {pendingRequests.length === 0 ? <p>No new requests.</p> : (
                                    pendingRequests.map((req) => (
                                        <div key={req._id} className={styles.userCard}
                                        
                                        >
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
                    </div>
                </div>
            </DashboardLayout>
        </UserLayout>
    )
}