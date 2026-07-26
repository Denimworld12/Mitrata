import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import styles from './styles.module.css';
import DashboardLayout from '@/layout/DashboardLayout';
import { useRouter } from 'next/router';
import { useSelector, useDispatch } from 'react-redux';
import { Base_Url } from '@/config';
import { pushMessage, resetMessages, removeDeletedMessages, markMyMessagesRead } from '@/config/redux/reducer/messageReducer';
import { getMessages, sendMessage, deleteMessages, deleteChat, deleteMessageForEveryone, getConversations, markMessagesRead } from '@/config/redux/action/messageAction';
import { getAboutUser, getMyConnectionRequests } from '@/config/redux/action/authAction';
import { useToast } from '@/Components/Toast';
import { useNotification } from "@/Components/NotificationProvider";
import { useCall } from "@/Components/CallProvider";
import { compressImage } from "@/utils/imageProcessing";
import EmptyState from "@/Components/ui/EmptyState";
import { ArrowLeft, Search, Phone, Video, MoreVertical, Trash2, Plus, Send, Download, X, MessageCircle, UsersRound, Check, CheckCheck } from "lucide-react";

export default function Messaging() {
    const router = useRouter();
    const dispatch = useDispatch();
    const { username } = router.query;

    /* -------------------- REDUX -------------------- */
    const authState = useSelector(state => state.auth);
    const { messages, conversations } = useSelector(state => state.message);

    /* -------------------- LOCAL STATE -------------------- */
    const [mounted, setMounted] = useState(false);
    const [message, setMessage] = useState("");
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [sending, setSending] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [showSearchModal, setShowSearchModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [previewMedia, setPreviewMedia] = useState(null);
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedMessages, setSelectedMessages] = useState([]);
    const [deleting, setDeleting] = useState(false);
    const [showDeleteMenu, setShowDeleteMenu] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const deleteMenuRef = useRef(null);
    const longPressTimer = useRef(null);
    const fileInputRef = useRef(null);
    const messagesEndRef = useRef(null);
    const menuRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const toast = useToast();
    /* -------------------- SHARED SOCKET & CONTEXT -------------------- */
    const { socket, onlineUsers } = useNotification();
    const { callUser } = useCall();


    /* -------------------- CHECK IF SIDEBAR ONLY -------------------- */
    const isSidebarOnly = !username || username === "sidebar_panel";

    /* -------------------- MOUNTING -------------------- */
    useEffect(() => {
        setMounted(true);
    }, []);

    /* -------------------- AUTH REHYDRATION -------------------- */
    useEffect(() => {
        if (!mounted) return;

        const token = localStorage.getItem("token");
        if (!token) {
            router.push("/login");
            return;
        }

        if (!authState.user) dispatch(getAboutUser());
        if (authState.connectionRequest.length === 0) {
            dispatch(getMyConnectionRequests());
        }
    }, [dispatch, authState.user, authState.connectionRequest.length, mounted, router]);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (
                deleteMenuRef.current &&
                !deleteMenuRef.current.contains(e.target)
            ) {
                setShowDeleteMenu(false);
            }
        };

        if (showDeleteMenu) {
            document.addEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [showDeleteMenu]);

    /* -------------------- CONNECTIONS -------------------- */
    const connections = authState.connectionRequest?.filter(
        r => r.status_accepted === true
    ) || [];

    const activeChatUser = connections.find(
        c => c.userId?.username === username
    );

    // Real conversation previews/unread counts (replaces the old hardcoded
    // "Click to chat" placeholder) — connections with an actual conversation
    // sort to the top by recency; message-less connections stay after, in
    // their existing order.
    useEffect(() => {
        dispatch(getConversations());
    }, [dispatch]);

    const conversationByUserId = useMemo(() => {
        const map = {};
        conversations.forEach((c) => { map[c.userId] = c; });
        return map;
    }, [conversations]);

    const sortedConnections = useMemo(() => {
        return [...connections].sort((a, b) => {
            const timeA = conversationByUserId[a.userId?._id]?.lastMessage?.createdAt;
            const timeB = conversationByUserId[b.userId?._id]?.lastMessage?.createdAt;
            if (!timeA && !timeB) return 0;
            if (!timeA) return 1;
            if (!timeB) return -1;
            return new Date(timeB) - new Date(timeA);
        });
    }, [connections, conversationByUserId]);

    /* -------------------- SOCKET EVENTS -------------------- */
    useEffect(() => {
        const myId = authState.user?.userId?._id;
        // Access socket.current since it comes from useNotification ref
        if (!myId || !socket.current || isSidebarOnly) return;

        const s = socket.current;
        s.emit("join", myId);

        const handleNewMessage = (data) => {
            const senderId = data.sender?.userId?._id || data.sender?._id || data.sender;
            if (senderId === activeChatUser?.userId?._id) {
                dispatch(pushMessage(data));
            }
        };

        const handleMessagesDeleted = (data) => {
            const { messageIds, deletedBy } = data;
            if (deletedBy !== myId) {
                dispatch(removeDeletedMessages({ messageIds }));
            }
        };

        const handleMessageDeletedForEveryone = (data) => {
            const { messageId } = data;
            dispatch(removeDeletedMessages({ messageIds: [messageId] }));
        };

        const handleTyping = (data) => {
            if (data.senderId === activeChatUser?.userId?._id) {
                setIsTyping(data.isTyping);
            }
        };

        s.on("newMessage", handleNewMessage);
        s.on("messagesDeleted", handleMessagesDeleted);
        s.on("messageDeletedForEveryone", handleMessageDeletedForEveryone);
        s.on("userTyping", handleTyping);

        // Online status is now handled globally in NotificationProvider, 
        // we just consume 'onlineUsers' from the hook.

        return () => {
            s.off("newMessage", handleNewMessage);
            s.off("messagesDeleted", handleMessagesDeleted);
            s.off("messageDeletedForEveryone", handleMessageDeletedForEveryone);
            s.off("userTyping", handleTyping);
        };
    }, [authState.user, activeChatUser, socket, dispatch, isSidebarOnly]);

    // Don't leave a stray "stopTyping" timer firing after the component (or
    // the active chat) is gone.
    useEffect(() => {
        return () => clearTimeout(typingTimeoutRef.current);
    }, [activeChatUser]);

    /* -------------------- FETCH CHAT -------------------- */
    useEffect(() => {
        if (activeChatUser?.userId?._id) {
            dispatch(getMessages({ receiverId: activeChatUser.userId._id }));
            dispatch(markMessagesRead({ senderId: activeChatUser.userId._id }));
        } else {
            dispatch(resetMessages());
        }
    }, [activeChatUser, dispatch]);

    // The other person read our messages while this thread is open — flip
    // our sent bubbles to the read state and refresh their unread badge.
    useEffect(() => {
        if (!socket.current) return;
        const handleRead = () => dispatch(markMyMessagesRead());
        socket.current.on("messagesRead", handleRead);
        return () => socket.current?.off("messagesRead", handleRead);
    }, [socket, activeChatUser, dispatch]);

    // Mark newly-arrived messages in the OPEN thread as read too — otherwise
    // they'd sit unread until the next thread switch/reload.
    useEffect(() => {
        if (activeChatUser?.userId?._id && messages.some(m => m.receiver?._id === authState.user?.userId?._id && !m.isRead)) {
            dispatch(markMessagesRead({ senderId: activeChatUser.userId._id }));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [messages]);

    /* -------------------- AUTO SCROLL -------------------- */
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    /* -------------------- CLOSE MENU ON OUTSIDE CLICK -------------------- */
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setShowMenu(false);
            }
        };

        if (showMenu) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showMenu]);



    /* -------------------- FILE HANDLING -------------------- */
    const handleFileChange = async (e) => {
        const files = Array.from(e.target.files);
        e.target.value = "";

        const validFiles = files.filter(f =>
            f.type.startsWith("image") || f.type.startsWith("video")
        );

        if (selectedFiles.length + validFiles.length > 5) {
            toast.warning("You can send a maximum of 5 media files at a time.");
            return;
        }

        // no-ops for videos — only compresses actual images
        const processed = await Promise.all(
            validFiles.map((f) => compressImage(f, { maxWidthOrHeight: 1280, quality: 0.8 }))
        );
        setSelectedFiles(prev => [...prev, ...processed]);
    };

    const removeFile = (index) => {
        setSelectedFiles(prev => prev.filter((_, idx) => idx !== index));
    };

    /* -------------------- TYPING INDICATOR -------------------- */
    const handleMessageChange = (e) => {
        setMessage(e.target.value);

        const receiverId = activeChatUser?.userId?._id;
        if (!socket.current || !receiverId) return;

        socket.current.emit("typing", { receiverId });

        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            socket.current?.emit("stopTyping", { receiverId });
        }, 1500);
    };

    /* -------------------- SEND MESSAGE -------------------- */
    const handleSend = async (e) => {
        e.preventDefault();
        if (sending) return;

        const receiverId = activeChatUser?.userId?._id;
        if (!receiverId) return;

        if (!message.trim() && selectedFiles.length === 0) return;

        setSending(true);

        try {
            await dispatch(sendMessage({
                receiverId,
                content: message,
                media: selectedFiles
            })).unwrap();

            setMessage("");
            setSelectedFiles([]);
            // Emit stop typing
            if (socket.current && activeChatUser?.userId?._id) {
                socket.current.emit("stopTyping", { receiverId: activeChatUser.userId._id });
            }
        } catch (error) {
            console.error("Error sending message:", error);
            toast.error("Failed to send message. Please try again.");
        } finally {
            setSending(false);
        }
    };

    /* -------------------- CLEAR CHAT -------------------- */
    const handleClearChat = async () => {
        if (!window.confirm("Are you sure you want to clear this chat? This action cannot be undone.")) {
            return;
        }

        const receiverId = activeChatUser?.userId?._id;
        if (!receiverId) return;

        try {
            await dispatch(deleteChat({ receiverId })).unwrap();
            setShowMenu(false);
            toast.success("Chat cleared successfully");
        } catch (error) {
            console.error("Error clearing chat:", error);
            toast.error("Failed to clear chat. Please try again.");
        }
    };

    /* -------------------- MESSAGE SELECTION -------------------- */
    const handleLongPressStart = (id) => {
        longPressTimer.current = setTimeout(() => {
            setSelectionMode(true);
            setSelectedMessages([id]);
        }, 600);
    };

    const handleLongPressEnd = () => {
        if (longPressTimer.current) clearTimeout(longPressTimer.current);
    };

    const handleMessageClick = (id) => {
        if (selectionMode) {
            setSelectedMessages(prev =>
                prev.includes(id) ? prev.filter(mId => mId !== id) : [...prev, id]
            );
        }
    };

    const handleCancelSelection = () => {
        setSelectionMode(false);
        setSelectedMessages([]);
    };


    const handleDeleteSelected = async () => {
        if (selectedMessages.length === 0) return;

        const confirmMsg = `Delete ${selectedMessages.length} message(s)? This will remove them from your view.`;
        if (!window.confirm(confirmMsg)) return;

        setDeleting(true);

        try {
            await dispatch(deleteMessages({ messageIds: selectedMessages })).unwrap();

            setSelectionMode(false);
            setSelectedMessages([]);
            toast.success("Messages deleted successfully");
        } catch (error) {
            console.error("Error deleting messages:", error);
            toast.error("Failed to delete messages. Please try again.");
        } finally {
            setDeleting(false);
        }
    };
    const handleDeleteClick = async () => {
        if (selectedMessages.length === 0) return;

        // Check if only one message is selected to enable "Delete for Everyone"
        const canDeleteForEveryone = selectedMessages.length === 1;

        let choice;
        if (canDeleteForEveryone) {
            const result = window.confirm("Delete for Everyone? (Cancel for 'Delete for Me')");
            if (result) {
                await dispatch(deleteMessageForEveryone({ messageId: selectedMessages[0] })).unwrap();
            } else {
                await dispatch(deleteMessages({ messageIds: selectedMessages })).unwrap();
            }
        } else {
            if (window.confirm(`Delete ${selectedMessages.length} messages for me?`)) {
                await dispatch(deleteMessages({ messageIds: selectedMessages })).unwrap();
            }
        }
        handleCancelSelection();
    };

    /* -------------------- SEARCH IN CHAT -------------------- */
    const filteredMessages = useMemo(() => {
        if (!searchQuery.trim()) return messages;

        return messages.filter(msg =>
            msg.content?.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [messages, searchQuery]);

    /* -------------------- CREATE PREVIEW URL -------------------- */
    const createPreviewUrl = (file) => {
        return URL.createObjectURL(file);
    };

    /* -------------------- HANDLE BACK BUTTON (MOBILE) -------------------- */
    const handleBackClick = () => {
        router.push('/messaging/sidebar_panel');
    };

    /* -------------------- HANDLE USER SELECT -------------------- */
    const handleUserSelect = (username) => {
        router.push(`/messaging/${username}`);
    };

    /* -------------------- MEDIA PREVIEW -------------------- */
    const handleMediaClick = (media) => {
        setPreviewMedia(media);
    };

    const handleDownloadMedia = (url, type) => {
        const link = document.createElement('a');
        link.href = url;
        link.download = `${type}_${Date.now()}`;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    const canDeleteEveryone = useMemo(() => {
        if (selectedMessages.length === 0) return false;

        // Check if EVERY selected message was sent by ME
        return selectedMessages.every(id => {
            const msg = messages.find(m => m._id === id);
            if (!msg) return false;
            const senderId = msg.sender?.userId?._id || msg.sender?._id || msg.sender;
            return senderId === authState.user?.userId?._id;
        });
    }, [selectedMessages, messages, authState.user]);

    /* -------------------- PREVENT FLASH -------------------- */
    if (!mounted) return null;

    /* -------------------- UI -------------------- */
    return (
        <DashboardLayout fullWidth>
        <div className={styles.messagingWrapper}>
            <div className={styles.messagingMainCard}>

                {/* SIDEBAR */}

                <div className={`${styles.sidebar} ${!isSidebarOnly ? styles.mobileHidden : ''}`}>

                    <div className={styles.sidebarHeader}>
                        <h3>Messages</h3>
                        <div className={styles.sidebarHeaderRight} onClick={() => router.push('/my_network')} title="Connections">
                            <UsersRound size={19} strokeWidth={1.8} />
                        </div>
                    </div>

                    <div className={styles.connectionsList}>
                        {connections.length === 0 ? (
                            <EmptyState
                                icon={UsersRound}
                                title="No connections yet"
                                description="Connect with people to start messaging them."
                            />
                        ) : sortedConnections.map((conn, idx) => {
                            const convo = conversationByUserId[conn.userId?._id];
                            const preview = !convo
                                ? "Click to chat"
                                : convo.lastMessage.content
                                    ? `${convo.lastMessage.isMine ? "You: " : ""}${convo.lastMessage.content}`
                                    : convo.lastMessage.hasMedia
                                        ? `${convo.lastMessage.isMine ? "You: " : ""}Media`
                                        : "Click to chat";
                            return (
                                <div
                                    key={conn._id}
                                    className={`${styles.userCard} ${username === conn.userId?.username ? styles.activeUser : ''} mt-enter-sm`}
                                    style={{ animationDelay: `${idx * 60}ms` }}
                                    onClick={() => handleUserSelect(conn.userId?.username)}
                                >
                                    <div className={styles.avatarWrapper}>
                                        <img
                                            src={conn.userId?.profilePicture || "/default-avatar.svg"}
                                            alt={conn.userId?.name}
                                        />
                                        <div className={`${styles.onlineStatus} ${onlineUsers.has(conn.userId?._id) ? styles.online : styles.offline}`}></div>
                                    </div>
                                    <div className={styles.userMeta}>
                                        <p className={styles.name}>{conn.userId?.name}</p>
                                        <p className={styles.lastMsg}>{preview}</p>
                                    </div>
                                    {convo?.unreadCount > 0 && (
                                        <span className={styles.unreadBadge}>{convo.unreadCount > 9 ? '9+' : convo.unreadCount}</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                </div>

                {/* CHAT PANEL */}
                <div className={`${styles.chatPanel} ${isSidebarOnly ? styles.mobileHidden : ''}`}>
                    {activeChatUser ? (
                        <>
                            {/* HEADER */}
                            <div className={styles.chatHeader}>
                                {selectionMode ? (
                                    <>
                                        <button className={styles.backBtn} onClick={handleCancelSelection}>
                                            <ArrowLeft size={20} strokeWidth={1.8} />
                                        </button>

                                        <div className={styles.selectionInfo}>
                                            {selectedMessages.length} selected
                                        </div>

                                        <div className={styles.headerActions} ref={deleteMenuRef}>
                                            <button
                                                className={styles.deleteBtn}
                                                onClick={() => setShowDeleteMenu(prev => !prev)}
                                            >
                                                <Trash2 size={19} strokeWidth={1.8} />
                                            </button>

                                            {showDeleteMenu && (
                                                <div className={`${styles.dropdownMenu} mt-dropdown-enter`}>
                                                    <button
                                                        className={styles.menuItem}
                                                        onClick={async () => {
                                                            await dispatch(deleteMessages({ messageIds: selectedMessages })).unwrap();
                                                            setShowDeleteMenu(false);
                                                            handleCancelSelection();
                                                        }}
                                                    >
                                                        Delete for me
                                                    </button>

                                                    {/* SMART CONDITION: Only show if all selected messages are mine */}
                                                    {canDeleteEveryone && (
                                                        <button
                                                            className={`${styles.menuItem} ${styles.danger}`}
                                                            onClick={async () => {
                                                                // Loop through all selected messages and delete each for everyone
                                                                for (const id of selectedMessages) {
                                                                    await dispatch(deleteMessageForEveryone({ messageId: id })).unwrap();
                                                                }
                                                                setShowDeleteMenu(false);
                                                                handleCancelSelection();
                                                            }}
                                                        >
                                                            Delete for everyone
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <button className={styles.backBtn} onClick={handleBackClick}>
                                            <ArrowLeft size={20} strokeWidth={1.8} />
                                        </button>

                                        <div className={styles.headerUserInfo}>
                                            <div className={styles.headerAvatarWrapper}>
                                                <img
                                                    src={activeChatUser.userId.profilePicture || "/default-avatar.svg"}
                                                    alt={activeChatUser.userId.name}
                                                    className={styles.headerAvatar}
                                                />
                                                <div className={`${styles.onlineStatus} ${onlineUsers.has(activeChatUser.userId._id) ? styles.online : styles.offline}`}></div>
                                            </div>
                                            <div className={styles.headerInfo}>
                                                <h4 onClick={() => { router.push(`/view_profile/${activeChatUser.userId.username}`) }}>{activeChatUser.userId.name}</h4>
                                                {isTyping ? (
                                                    <span className={styles.typingStatus}>
                                                        <span className={styles.typingDots}>
                                                            <i></i><i></i><i></i>
                                                        </span>
                                                        typing
                                                    </span>
                                                ) : (
                                                    <span className={onlineUsers.has(activeChatUser.userId._id) ? styles.onlineText : styles.offlineText}>
                                                        {onlineUsers.has(activeChatUser.userId._id) ? 'Online' : 'Offline'}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className={styles.headerActions} ref={menuRef}>
                                            <button
                                                className={styles.menuBtn}
                                                onClick={() => callUser(activeChatUser.userId._id, {
                                                    name: activeChatUser.userId.name,
                                                    avatar: activeChatUser.userId.profilePicture
                                                })}
                                                title="Voice Call"
                                            >
                                                <Phone size={19} strokeWidth={1.8} />
                                            </button>

                                            <button
                                                className={styles.menuBtn}
                                                onClick={() => callUser(activeChatUser.userId._id, {
                                                    name: activeChatUser.userId.name,
                                                    avatar: activeChatUser.userId.profilePicture
                                                }, true)}
                                                title="Video Call"
                                            >
                                                <Video size={19} strokeWidth={1.8} />
                                            </button>

                                            <button
                                                className={styles.menuBtn}
                                                onClick={() => setShowMenu(!showMenu)}
                                            >
                                                <MoreVertical size={19} strokeWidth={1.8} />
                                            </button>

                                            {showMenu && (
                                                <div className={`${styles.dropdownMenu} mt-dropdown-enter`}>
                                                    <button
                                                        className={styles.menuItem}
                                                        onClick={() => {
                                                            setShowSearchModal(true);
                                                            setShowMenu(false);
                                                        }}
                                                    >
                                                        Search Chat
                                                    </button>
                                                    <button
                                                        className={`${styles.menuItem} ${styles.danger}`}
                                                        onClick={handleClearChat}
                                                    >
                                                        Clear Chat
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* MESSAGES AREA */}
                            <div className={styles.messagesArea}>
                                {!showSearchModal && messages.length === 0 && (
                                    <EmptyState
                                        icon={MessageCircle}
                                        title="No messages yet"
                                        description={`Say hello to ${activeChatUser.userId?.name || 'your connection'} to start the conversation.`}
                                    />
                                )}
                                {(showSearchModal ? filteredMessages : messages).map((msg, idx) => {
                                    const senderId = msg.sender?.userId?._id || msg.sender?._id || msg.sender;
                                    const isMe = senderId === authState.user?.userId?._id;
                                    const isSelected = selectedMessages.includes(msg._id);

                                    return (
                                        <div
                                            key={msg._id || idx}
                                            className={`${isMe ? styles.sentMsg : styles.receivedMsg} ${isSelected ? styles.selectedMsg : ''
                                                } ${selectionMode ? styles.selectableMsg : ''}`}
                                            onMouseDown={() => handleLongPressStart(msg._id)}
                                            onMouseUp={handleLongPressEnd}
                                            onMouseLeave={handleLongPressEnd}
                                            onTouchStart={() => handleLongPressStart(msg._id)}
                                            onTouchEnd={handleLongPressEnd}
                                            onClick={() => handleMessageClick(msg._id)}
                                        >
                                            {selectionMode && (
                                                <div className={styles.selectionCheckbox}>
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => handleMessageClick(msg._id)}
                                                        onClick={(e) => e.stopPropagation()}
                                                    />
                                                </div>
                                            )}
                                            {msg.media && msg.media.length > 0 && (
                                                <div className={msg.media.length > 1 ? styles.mediaGrid : ''}>
                                                    {msg.media.map((m, i) => (
                                                        <div key={i} className={styles.mediaContainer}>
                                                            {m.mediaType === "video" ? (
                                                                <video
                                                                    src={m.url}
                                                                    controls
                                                                    className={styles.msgMedia}
                                                                    onClick={(e) => {
                                                                        if (!selectionMode) {
                                                                            e.stopPropagation();
                                                                            handleMediaClick(m);
                                                                        }
                                                                    }}
                                                                />
                                                            ) : (
                                                                <img
                                                                    src={m.url}
                                                                    alt="attachment"
                                                                    className={styles.msgMedia}
                                                                    onClick={(e) => {
                                                                        if (!selectionMode) {
                                                                            e.stopPropagation();
                                                                            handleMediaClick(m);
                                                                        }
                                                                    }}
                                                                />
                                                            )}
                                                            {!selectionMode && (
                                                                <button
                                                                    className={styles.downloadBtn}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleDownloadMedia(m.url, m.mediaType);
                                                                    }}
                                                                    title="Download"
                                                                >
                                                                    <Download size={17} strokeWidth={1.8} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            {msg.content && <p>{msg.content}</p>}
                                            <span className={styles.timeStamp}>
                                                {new Date(msg.createdAt).toLocaleTimeString([], {
                                                    hour: "2-digit",
                                                    minute: "2-digit"
                                                })}
                                                {isMe && (
                                                    msg.isRead
                                                        ? <CheckCheck size={13} strokeWidth={2} className={styles.readTick} />
                                                        : <Check size={13} strokeWidth={2} />
                                                )}
                                            </span>
                                        </div>
                                    );
                                })}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* INPUT SECTION */}
                            <div className={styles.inputSection}>
                                {selectedFiles.length > 0 && (
                                    <div className={styles.previewStrip}>
                                        {selectedFiles.map((f, i) => (
                                            <div key={i} className={styles.previewThumb}>
                                                {f.type.startsWith("image") ? (
                                                    <img src={createPreviewUrl(f)} alt="preview" />
                                                ) : (
                                                    <video src={createPreviewUrl(f)} />
                                                )}
                                                <button onClick={() => removeFile(i)}>×</button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <form onSubmit={handleSend} className={styles.inputContainer}>
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className={styles.attachBtn}
                                    >
                                        <Plus size={20} strokeWidth={1.8} />
                                    </button>

                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        hidden
                                        multiple
                                        accept="image/*,video/*"
                                        onChange={handleFileChange}
                                    />

                                    <textarea
                                        value={message}
                                        onChange={handleMessageChange}
                                        placeholder="Write a message..."
                                        onKeyDown={e => {
                                            if (e.key === "Enter" && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSend(e);
                                            }
                                        }}
                                    />

                                    <button
                                        type="submit"
                                        className={styles.sendBtn}
                                        disabled={sending || (!message.trim() && selectedFiles.length === 0)}
                                    >
                                        {sending ? <span className={styles.sendSpinner}></span> : <Send size={17} strokeWidth={2} />}
                                    </button>
                                </form>
                            </div>
                        </>
                    ) : (
                        <div className={styles.noChatPlaceholder}>
                            <div className={styles.placeholderContent}>
                                <div className={styles.placeholderIcon}><MessageCircle size={30} strokeWidth={1.6} /></div>
                                <h3>Select a connection to start chatting</h3>
                                <p>Choose someone from your connections to begin a conversation</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* SEARCH MODAL */}
            {showSearchModal && (
                <div className={styles.searchModal} onClick={() => setShowSearchModal(false)}>
                    <div className={`${styles.searchModalContent} mt-dropdown-enter`} onClick={e => e.stopPropagation()}>
                        <div className={styles.searchModalHeader}>
                            <h3>Search Messages</h3>
                            <button
                                className={styles.closeBtn}
                                onClick={() => {
                                    setShowSearchModal(false);
                                    setSearchQuery("");
                                }}
                            >
                                <X size={20} strokeWidth={1.8} />
                            </button>
                        </div>
                        <div className={styles.searchModalBody}>
                            <input
                                type="text"
                                className={styles.searchInput}
                                placeholder="Search in conversation..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                autoFocus
                            />
                            <div className={styles.searchResults}>
                                {filteredMessages.length === 0 ? (
                                    <p className={styles.noResults}>
                                        {searchQuery ? "No messages found" : "Start typing to search"}
                                    </p>
                                ) : (
                                    filteredMessages.map((msg, idx) => {
                                        const senderId = msg.sender?.userId?._id || msg.sender?._id || msg.sender;
                                        const isMe = senderId === authState.user?.userId?._id;

                                        return (
                                            <div key={idx} className={styles.searchResultItem}>
                                                <div className={isMe ? styles.sentMsg : styles.receivedMsg} style={{ maxWidth: '100%' }}>
                                                    {msg.content && <p>{msg.content}</p>}
                                                    <span className={styles.timeStamp}>
                                                        {new Date(msg.createdAt).toLocaleString()}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MEDIA PREVIEW MODAL */}
            {previewMedia && (
                <div className={styles.previewModal} onClick={() => setPreviewMedia(null)}>
                    <div className={`${styles.previewModalContent} mt-dropdown-enter`} onClick={e => e.stopPropagation()}>
                        <button
                            className={styles.previewCloseBtn}
                            onClick={() => setPreviewMedia(null)}
                        >
                            <X size={22} strokeWidth={1.8} />
                        </button>
                        <button
                            className={styles.previewDownloadBtn}
                            onClick={() => handleDownloadMedia(previewMedia.url, previewMedia.mediaType)}
                        >
                            <Download size={20} strokeWidth={1.8} />
                        </button>
                        {previewMedia.mediaType === 'video' ? (
                            <video
                                src={previewMedia.url}
                                controls
                                className={styles.previewMediaLarge}
                            />
                        ) : (
                            <img
                                src={previewMedia.url}
                                alt="Preview"
                                className={styles.previewMediaLarge}
                            />
                        )}
                    </div>
                </div>
            )}
        </div>
        </DashboardLayout>
    );
}