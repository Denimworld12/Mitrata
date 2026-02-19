import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import { Base_Url } from '@/config';
import { useRouter } from 'next/router';
import { useSelector } from 'react-redux';
import axios from 'axios';
import styles from './Notification.module.css';

const NotificationContext = createContext(null);

export function useNotification() {
    const ctx = useContext(NotificationContext);
    if (!ctx) throw new Error('useNotification must be within <NotificationProvider>');
    return ctx;
}

let nId = 0;

export function NotificationProvider({ children }) {
    const router = useRouter();
    const authState = useSelector(state => state.auth);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [recentNotifs, setRecentNotifs] = useState([]);
    const [onlineUsers, setOnlineUsers] = useState(new Set());
    const [socketInstance, setSocketInstance] = useState(null);
    const socketRef = useRef(null);
    const hasShownWelcome = useRef(false);

    // ... (rest of the component)

    // Global socket connection
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const token = localStorage.getItem('token');
        if (!token) return;

        const socket = io(Base_Url, {
            transports: ['websocket'],
            autoConnect: true,
            auth: { token }
        });

        socketRef.current = socket;
        setSocketInstance(socket); // Trigger re-render for consumers

        // ... (rest of socket logic) ...

        return () => {
            socket.disconnect();
            socketRef.current = null;
            setSocketInstance(null);
        };
    }, [showNotification, router]);

    // ... (rest of code) ...

    return (
        <NotificationContext.Provider value={{ showNotification, unreadCount, clearUnread, recentNotifs, socket: socketRef, socketInstance, onlineUsers }}>
            {children}

            {/* Floating notification popups */}
            <div className={styles.notifContainer}>
                {notifications.map(notif => (
                    <div
                        key={notif.id}
                        className={`${styles.notifCard} ${styles[notif.type]} ${notif.exiting ? styles.exit : ''}`}
                        onClick={() => handleNotifClick(notif)}
                    >
                        <img src={notif.avatar} className={styles.notifAvatar} alt="" />
                        <div className={styles.notifBody}>
                            <p className={styles.notifTitle}>{notif.title}</p>
                            <p className={styles.notifMsg}>{notif.message}</p>
                        </div>
                        <button className={styles.notifClose} onClick={(e) => dismissNotif(e, notif.id)}>✕</button>
                    </div>
                ))}
            </div>
        </NotificationContext.Provider>
    );
}
