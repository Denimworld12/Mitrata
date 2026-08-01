    import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import { Base_Url, clientServer, decodeJwtUserId } from '@/config';
import { useRouter } from 'next/router';
import { useSelector } from 'react-redux';
import axios from 'axios';
import { useToast } from '@/Components/Toast';
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
    // useRouter()'s return value is a new object on every navigation — using
    // it directly in the socket effect's deps meant the whole socket was
    // torn down and reconnected on every single page change (confirmed via
    // the backend's connect/disconnect log churning on every navigation).
    // A ref sidesteps that while still giving the onClick callbacks below a
    // router that's actually current.
    const routerRef = useRef(router);
    routerRef.current = router;
    const toast = useToast();
    const authState = useSelector(state => state.auth);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [recentNotifs, setRecentNotifs] = useState([]);
    // recentNotifs.length === 0 reads identically whether nothing has loaded
    // yet or there's genuinely nothing there — the notifications page was
    // showing "No notifications yet" for a beat before the real fetch below
    // resolved, every single time.
    const [notificationsLoaded, setNotificationsLoaded] = useState(false);
    const [onlineUsers, setOnlineUsers] = useState(new Set());
    const [socketInstance, setSocketInstance] = useState(null);
    const socketRef = useRef(null);
    const hasShownWelcome = useRef(false);

    // The in-app toast below only reaches someone already looking at the tab.
    // A real OS notification is what actually reaches you on another tab,
    // another app, or with the screen off — this is the whole reason a
    // message could otherwise go unnoticed for hours. Only fires while the
    // tab is hidden: while it's visible/focused the in-app toast already
    // covers it, and duplicating both would be noisy.
    const fireNativeNotification = useCallback(({ title, message, avatar, onClick }) => {
        if (typeof window === 'undefined' || typeof Notification === 'undefined') return;
        if (Notification.permission !== 'granted' || !document.hidden) return;
        try {
            const n = new Notification(title, { body: message, icon: avatar || '/favicon-192.png' });
            n.onclick = () => {
                window.focus();
                onClick?.();
                n.close();
            };
        } catch { }
    }, []);

    // Show a floating notification popup
    const showNotification = useCallback(({ title, message, avatar, onClick, type = 'message', metadata = {} }) => {
        const id = ++nId;
        setNotifications(prev => [...prev, { id, title, message, avatar, onClick, type, exiting: false }]);
        fireNativeNotification({ title, message, avatar, onClick });

        // Add to recent history — metadata (e.g. requestId) has to travel
        // with it, not just the popup: the /notifications page's Accept/
        // Ignore buttons only render when it's present (see requestId
        // there), so a connection request notification that arrived live
        // instead of via the initial REST fetch was otherwise stuck
        // non-interactive until the page was refreshed.
        setRecentNotifs(prev => [{ id, title, message, avatar, type, time: new Date(), metadata }, ...prev].slice(0, 20));
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
        setRecentNotifs(prev => prev.map(n => ({ ...n, read: true })));
        // Also mark as read on backend
        const token = localStorage.getItem('token');
        if (token) {
            axios.patch(`${Base_Url}/api/notification/read`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            }).catch(() => { });
        }
    }, []);

    // Fetch persisted notifications on mount
    useEffect(() => {
        const fetchNotifications = async () => {
            const token = localStorage.getItem('token');
            if (!token) {
                setNotificationsLoaded(true);
                return;
            }
            try {
                const res = await axios.get(`${Base_Url}/api/notification/all`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const { notifications: notifs, unreadCount: count } = res.data;
                const TITLES = {
                    connection_request: 'Connection Request',
                    connection_accepted: 'Connection Accepted',
                    message: 'New Message',
                    like: 'New Reaction',
                    comment: 'New Comment',
                };
                setRecentNotifs(notifs.map(n => ({
                    id: n._id,
                    title: TITLES[n.type] || 'Notification',
                    message: n.message,
                    avatar: n.fromUser?.profilePicture || '/default-avatar.svg',
                    type: n.type === 'connection_request' || n.type === 'connection_accepted' ? 'connection' : n.type,
                    time: new Date(n.createdAt),
                    read: n.read,
                    metadata: n.metadata || {}
                })));
                setUnreadCount(count);
            } catch {
            } finally {
                setNotificationsLoaded(true);
            }
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
            // A function, not a static object — access tokens are 15-minute
            // JWTs, and this used to snapshot the token once at connect time.
            // REST calls silently refresh a stale token via the axios
            // interceptor, but nothing told the socket, so any reconnection
            // (network blip, phone backgrounding, laptop sleep — all common)
            // retried the handshake with the SAME expired token, got rejected
            // server-side (io.use's jwt.verify), and never recovered: the
            // user kept using the app fine over REST while their socket sat
            // dead, showing them as permanently "offline" to everyone else.
            // socket.io-client calls a function `auth` fresh before every
            // (re)connection attempt, so this always sends whatever's
            // current in localStorage.
            auth: (cb) => cb({ token: localStorage.getItem('token') }),
        });

        // Belt-and-suspenders for the rarer case where NO REST call happened
        // during the staleness window (e.g. a backgrounded tab with only the
        // socket active) — refresh the token once and let socket.io's own
        // reconnection backoff pick it up on the next attempt.
        socket.on('connect_error', async (err) => {
            if (!/token|auth/i.test(err.message || '')) return;
            try {
                const currentToken = localStorage.getItem('token');
                const userId = currentToken ? decodeJwtUserId(currentToken) : null;
                if (!userId) return;
                const { data } = await clientServer.post('/auth/refresh', { userId });
                localStorage.setItem('token', data.token);
            } catch {
                // Refresh itself failed (genuinely logged out, or backend
                // still cold-starting) — socket.io keeps retrying its own
                // backoff regardless; nothing more to do here.
            }
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
            const senderAvatar = msg.sender?.profilePicture || '/default-avatar.svg';
            const preview = msg.content
                ? (msg.content.length > 60 ? msg.content.substring(0, 60) + '...' : msg.content)
                : 'Sent media';

            showNotification({
                title: senderName,
                message: preview,
                avatar: senderAvatar,
                type: 'message',
                onClick: () => {
                    if (senderUsername) routerRef.current.push(`/messaging/${senderUsername}`);
                }
            });
        });

        // Connection request notifications
        socket.on('connectionRequest', (data) => {
            const fromUser = data.fromUser || {};
            showNotification({
                title: 'Connection Request',
                message: data.message || `${fromUser.name || 'Someone'} wants to connect`,
                avatar: fromUser.profilePicture || '/default-avatar.svg',
                type: 'connection',
                metadata: { requestId: data.requestId },
                onClick: () => routerRef.current.push('/my_network')
            });
        });

        // Connection accepted notifications
        socket.on('connectionAccepted', (data) => {
            const fromUser = data.fromUser || {};
            showNotification({
                title: 'Connection Accepted!',
                message: data.message || `${fromUser.name || 'Someone'} accepted your request`,
                avatar: fromUser.profilePicture || '/default-avatar.svg',
                type: 'connection',
                onClick: () => routerRef.current.push(`/view_profile/${fromUser.username}`)
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
    // Deliberately NOT depending on `router` (see routerRef above) or
    // `showNotification` (stable via useCallback) — this should connect
    // once per login session, not reconnect on every navigation.
    }, [authState.loggedIn]);

    // Ask once per login, not on every page load — permission persists once
    // granted/denied, and re-asking after a "no" just trains people to
    // reflexively dismiss it. A silent no-op on browsers without the API
    // (or if already decided) rather than an error.
    useEffect(() => {
        if (typeof window === 'undefined' || typeof Notification === 'undefined') return;
        if (!authState.loggedIn || Notification.permission !== 'default') return;
        Notification.requestPermission().catch(() => { });
    }, [authState.loggedIn]);

    // Registers this browser for push (reaches a fully closed tab, which
    // the in-tab Notification API above can't) — runs whenever permission
    // is already granted, not just right after requesting it, so a returning
    // visitor's browser re-registers too (tokens can rotate/expire).
    // $addToSet server-side makes calling this on every login harmless.
    useEffect(() => {
        if (typeof window === 'undefined' || typeof Notification === 'undefined') return;
        if (!authState.loggedIn || Notification.permission !== 'granted') return;
        const token = localStorage.getItem('token');
        if (!token) return;

        import('@/config/firebase').then(({ getFcmToken }) => getFcmToken()).then((fcmToken) => {
            if (!fcmToken) return;
            localStorage.setItem('fcmToken', fcmToken);
            axios.post(`${Base_Url}/api/user/fcm-token`, { token: fcmToken }, {
                headers: { Authorization: `Bearer ${token}` }
            }).catch(() => { });
        }).catch(() => { });
    }, [authState.loggedIn]);

    // Fallback for anyone who hasn't granted (or whose browser doesn't
    // support) native notifications: the tab title itself carries the
    // unread count while you're away, and reverts the moment you're back.
    useEffect(() => {
        if (typeof document === 'undefined') return;
        const baseTitle = 'Mitrata';
        const applyTitle = () => {
            document.title = (!document.hidden || unreadCount === 0)
                ? baseTitle
                : `(${unreadCount > 9 ? '9+' : unreadCount}) ${baseTitle}`;
        };
        applyTitle();
        document.addEventListener('visibilitychange', applyTitle);
        return () => {
            document.removeEventListener('visibilitychange', applyTitle);
            document.title = baseTitle;
        };
    }, [unreadCount]);

    // Welcome notification — once per browser session, not once per component
    // mount. hasShownWelcome (a ref) only survives re-renders, not a full page
    // refresh, which remounts this provider and re-fires the effect; that's
    // why the toast reappeared on every reload. sessionStorage survives the
    // refresh but still clears when the tab actually closes.
    useEffect(() => {
        if (
            authState.loggedIn &&
            authState.user?.userId?.name &&
            !hasShownWelcome.current &&
            !sessionStorage.getItem('mt-welcome-shown')
        ) {
            hasShownWelcome.current = true;
            sessionStorage.setItem('mt-welcome-shown', '1');
            const firstName = authState.user.userId.name.split(' ')[0];
            // A plain toast, not showNotification — this is a client-side
            // greeting, not a real event, so it shouldn't leave a permanent
            // row in the actual notifications list/badge count.
            toast.info(`Good to see you, ${firstName}`);
        }
    }, [authState.loggedIn, authState.user, toast]);

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
        <NotificationContext.Provider value={{ showNotification, unreadCount, clearUnread, recentNotifs, notificationsLoaded, socket: socketRef, socketInstance, onlineUsers }}>
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
