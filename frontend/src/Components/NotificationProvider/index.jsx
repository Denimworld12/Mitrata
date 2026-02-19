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

    // Show a floating notification popup
    const showNotification = useCallback(({ title, message, avatar, onClick, type = 'message' }) => {
        const id = ++nId;
        setNotifications(prev => [...prev, { id, title, message, avatar, onClick, type, exiting: false }]);

        // Add to recent history
        setRecentNotifs(prev => [{ id, title, message, avatar, type, time: new Date() }, ...prev].slice(0, 20));
        setUnreadCount(prev => prev + 1);

        setTimeout(() => {
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, exiting: true } : n));
            setTimeout(() => {
                setNotifications(prev => prev.filter(n => n.id !== id));
            }, 400);
        }, 5000);

        return id;
    }, []);

    const clearUnread = useCallback(() => {
        setUnreadCount(0);
        // Also mark as read on backend
        const token = localStorage.getItem('token');
        if (token) {
            axios.patch(`${Base_Url}/notification/read`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            }).catch(() => { });
        }
    }, []);

    // Fetch persisted notifications on mount
    useEffect(() => {
        const fetchNotifications = async () => {
            const token = localStorage.getItem('token');
            if (!token) return;
            try {
                const res = await axios.get(`${Base_Url}/notification/all`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const { notifications: notifs, unreadCount: count } = res.data;
                setRecentNotifs(notifs.map(n => ({
                    id: n._id,
                    title: n.type === 'connection_request' ? 'Connection Request'
                        : n.type === 'connection_accepted' ? 'Connection Accepted'
                            : n.type === 'message' ? 'New Message' : 'Notification',
                    message: n.message,
                    avatar: n.fromUser?.profilePicture || '/default-avatar.png',
                    type: n.type === 'connection_request' || n.type === 'connection_accepted' ? 'connection' : n.type,
                    time: new Date(n.createdAt),
                    read: n.read
                })));
                setUnreadCount(count);
            } catch { }
        };
        fetchNotifications();
    }, [authState.loggedIn]);

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

        // Listen for incoming messages (app-wide)
        socket.on('newMessage', (msg) => {
            // Don't show popup if already on that chat
            const currentPath = window.location.pathname;
            const senderUsername = msg.sender?.username || msg.senderUsername;
            if (currentPath.includes(`/messaging/${senderUsername}`)) return;

            const senderName = msg.sender?.name || msg.senderName || 'Someone';
            const senderAvatar = msg.sender?.profilePicture || '/default-avatar.png';
            const preview = msg.content
                ? (msg.content.length > 60 ? msg.content.substring(0, 60) + '...' : msg.content)
                : '📎 Sent media';

            showNotification({
                title: senderName,
                message: preview,
                avatar: senderAvatar,
                type: 'message',
                onClick: () => {
                    if (senderUsername) router.push(`/messaging/${senderUsername}`);
                }
            });
        });

        // Connection request notifications
        socket.on('connectionRequest', (data) => {
            const fromUser = data.fromUser || {};
            showNotification({
                title: 'Connection Request',
                message: data.message || `${fromUser.name || 'Someone'} wants to connect`,
                avatar: fromUser.profilePicture || '/default-avatar.png',
                type: 'connection',
                onClick: () => router.push('/my_network')
            });
        });

        // Connection accepted notifications
        socket.on('connectionAccepted', (data) => {
            const fromUser = data.fromUser || {};
            showNotification({
                title: 'Connection Accepted! 🎉',
                message: data.message || `${fromUser.name || 'Someone'} accepted your request`,
                avatar: fromUser.profilePicture || '/default-avatar.png',
                type: 'connection',
                onClick: () => router.push(`/view_profile/${fromUser.username}`)
            });
        });

        // Online presence tracking
        socket.on('onlineUsersList', (users) => {
            setOnlineUsers(new Set(users));
        });

        socket.on('userOnline', ({ userId }) => {
            setOnlineUsers(prev => new Set(prev).add(userId));
        });

        socket.on('userOffline', ({ userId }) => {
            setOnlineUsers(prev => {
                const newSet = new Set(prev);
                newSet.delete(userId);
                return newSet;
            });
        });

        return () => {
            socket.disconnect();
            socketRef.current = null;
            setSocketInstance(null);
        };
    }, [showNotification, router]);

    // Welcome notification on login
    useEffect(() => {
        if (authState.loggedIn && authState.user?.userId?.name && !hasShownWelcome.current) {
            hasShownWelcome.current = true;
            const firstName = authState.user.userId.name.split(' ')[0];
            showNotification({
                title: 'Welcome back! 👋',
                message: `Good to see you, ${firstName}`,
                avatar: authState.user.userId.profilePicture || '/default-avatar.png',
                type: 'welcome'
            });
        }
    }, [authState.loggedIn, authState.user, showNotification]);

    const handleNotifClick = (notif) => {
        if (notif.onClick) notif.onClick();
        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, exiting: true } : n));
        setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== notif.id));
        }, 400);
    };

    const dismissNotif = (e, id) => {
        e.stopPropagation();
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, exiting: true } : n));
        setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== id));
        }, 400);
    };

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
