import { getMyConnectionRequests, acceptConnectionRequest, getConnectionRequest } from '@/config/redux/action/authAction';
import DashboardLayout from '@/layout/DashboardLayout'
import UserLayout from '@/layout/userLayout'
import React, { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import styles from './mynetwork.module.css'
import { Base_Url } from '@/config';
import { useRouter } from 'next/router';

export default function MyNetwork() {
    const dispatch = useDispatch();
    const authState = useSelector((state) => state.auth);
    const router = useRouter()
    // State to track which tab is active
    const [activeTab, setActiveTab] = useState('connections');

    useEffect(() => {
        dispatch(getMyConnectionRequests({ token: localStorage.getItem("token") }))
    }, [dispatch]);

    // Filtering logic
    const pendingRequests = authState.connectionRequest?.filter(req => req.status_accepted === null) || [];
    const myConnections = authState.connectionRequest?.filter(req => req.status_accepted === true) || [];

    const handleAction = (requestId, action) => {
        dispatch(acceptConnectionRequest({
            token: localStorage.getItem("token"),
            connectionId: requestId, // Mapping requestId to connectionId for the action
            action: action
        })).then(() => {
            dispatch(getMyConnectionRequests({ token: localStorage.getItem("token") }));
            dispatch(getConnectionRequest({ token: localStorage.getItem("token") }));
        });
    };

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
                                        <div key={conn._id} onClick={() => router.push(`/view_profile/${conn.userId.username}`)} className={styles.userCard}>
                                            <img src={`${Base_Url}/${conn.userId.profilePicture}`} alt="profile" />
                                            <div className={styles.userInfo}>
                                                <h4>{conn.userId.name}</h4>
                                                <p>@{conn.userId.username}</p>
                                            </div>
                                            <button className={styles.msgBtn}>Message</button>
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
                                            onClick={() => router.push(`/view_profile/${req.userId.username}`)}
                                        >
                                            <img src={`${Base_Url}/${req.userId.profilePicture}`} alt="profile" />
                                            <div className={styles.userInfo}>
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