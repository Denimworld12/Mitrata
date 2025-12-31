import React, { useState, useEffect, useRef, useMemo } from 'react';
import styles from './styles.module.css';
import UserLayout from '@/layout/userLayout';
import { useRouter } from 'next/router';
import { useSelector, useDispatch } from 'react-redux';
import { io } from "socket.io-client";
import { Base_Url } from '@/config';
import { pushMessage, resetMessages, removeDeletedMessages } from '@/config/redux/reducer/messageReducer';
import { getMessages, sendMessage, deleteMessages, deleteChat, deleteMessageForEveryone } from '@/config/redux/action/messageAction';
import { getAboutUser, getMyConnectionRequests } from '@/config/redux/action/authAction';

export default function Messaging() {
    const router = useRouter();
    const dispatch = useDispatch();
    const { username } = router.query;

    /* -------------------- REDUX -------------------- */
    const authState = useSelector(state => state.auth);
    const { messages } = useSelector(state => state.message);

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
    const deleteMenuRef = useRef(null);
    const longPressTimer = useRef(null);
    const fileInputRef = useRef(null);
    const messagesEndRef = useRef(null);
    const menuRef = useRef(null);

    /* -------------------- CHECK IF SIDEBAR ONLY -------------------- */
    const isSidebarOnly = !username || username === "sidebar_panel";

    /* -------------------- SOCKET -------------------- */
    const socket = useMemo(() => {
        if (typeof window !== 'undefined') {
            return io(Base_Url, {
                transports: ["websocket"],
                autoConnect: true
            });
        }
        return null;
    }, []);

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

        if (!authState.user) dispatch(getAboutUser({ token }));
        if (authState.connectionRequest.length === 0) {
            dispatch(getMyConnectionRequests({ token }));
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

    /* -------------------- SOCKET EVENTS -------------------- */
    useEffect(() => {
        const myId = authState.user?.userId?._id;
        if (!myId || !socket || isSidebarOnly) return;

        socket.emit("join", myId);

        const handleNewMessage = (data) => {
            const senderId = data.sender?.userId?._id || data.sender?._id || data.sender;
            if (senderId === activeChatUser?.userId?._id) {
                dispatch(pushMessage(data));
            }
        };

        const handleMessagesDeleted = (data) => {
            const { messageIds, deletedBy } = data;
            // Remove messages that were deleted by the other user
            if (deletedBy !== myId) {
                dispatch(removeDeletedMessages({ messageIds }));
            }
        };

        const handleMessageDeletedForEveryone = (data) => {
            const { messageId } = data;
            // Remove message deleted for everyone
            dispatch(removeDeletedMessages({ messageIds: [messageId] }));
        };

        socket.on("newMessage", handleNewMessage);
        socket.on("messagesDeleted", handleMessagesDeleted);
        socket.on("messageDeletedForEveryone", handleMessageDeletedForEveryone);

        return () => {
            socket.off("newMessage", handleNewMessage);
            socket.off("messagesDeleted", handleMessagesDeleted);
            socket.off("messageDeletedForEveryone", handleMessageDeletedForEveryone);
        };
    }, [authState.user, activeChatUser, socket, dispatch, isSidebarOnly]);

    /* -------------------- FETCH CHAT -------------------- */
    useEffect(() => {
        if (activeChatUser?.userId?._id) {
            dispatch(getMessages({ receiverId: activeChatUser.userId._id }));
        } else {
            dispatch(resetMessages());
        }
    }, [activeChatUser, dispatch]);

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

    /* -------------------- CLEANUP SOCKET -------------------- */
    useEffect(() => {
        return () => {
            if (socket) socket.disconnect();
        };
    }, [socket]);

    /* -------------------- FILE HANDLING -------------------- */
    const handleFileChange = (e) => {
        const files = Array.from(e.target.files);

        const validFiles = files.filter(f =>
            f.type.startsWith("image") || f.type.startsWith("video")
        );

        if (selectedFiles.length + validFiles.length > 5) {
            alert("You can send a maximum of 5 media files at a time.");
            return;
        }

        setSelectedFiles(prev => [...prev, ...validFiles]);
    };

    const removeFile = (index) => {
        setSelectedFiles(prev => prev.filter((_, idx) => idx !== index));
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
        } catch (error) {
            console.error("Error sending message:", error);
            alert("Failed to send message. Please try again.");
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
            alert("Chat cleared successfully");
        } catch (error) {
            console.error("Error clearing chat:", error);
            alert("Failed to clear chat. Please try again.");
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
            alert("Messages deleted successfully");
        } catch (error) {
            console.error("Error deleting messages:", error);
            alert("Failed to delete messages. Please try again.");
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
        <UserLayout>
            <div className={styles.messagingWrapper}>
                <div className={styles.messagingMainCard}>

                    {/* SIDEBAR */}
                    <div className={`${styles.sidebar} ${!isSidebarOnly ? styles.mobileHidden : ''}`}>
                        <div className={styles.sidebarHeader} onClick={() => router.push("/dashboard")}>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-6">
                                <path fillRule="evenodd" d="M9.53 2.47a.75.75 0 0 1 0 1.06L4.81 8.25H15a6.75 6.75 0 0 1 0 13.5h-3a.75.75 0 0 1 0-1.5h3a5.25 5.25 0 1 0 0-10.5H4.81l4.72 4.72a.75.75 0 1 1-1.06 1.06l-6-6a.75.75 0 0 1 0-1.06l6-6a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
                            </svg>

                            <h3>back to Home</h3>
                        </div>

                        <div className={styles.connectionsList}>
                            {connections.length === 0 ? (
                                <p className={styles.noData}>No connections found.</p>
                            ) : connections.map(conn => (
                                <div
                                    key={conn._id}
                                    className={`${styles.userCard} ${username === conn.userId?.username ? styles.activeUser : ''}`}
                                    onClick={() => handleUserSelect(conn.userId?.username)}
                                >
                                    <div className={styles.avatarWrapper}>
                                        <img
                                            src={conn.userId?.profilePicture || "/default-avatar.png"}
                                            alt={conn.userId?.name}
                                        />
                                        <div className={styles.onlineStatus}></div>
                                    </div>
                                    <div className={styles.userMeta}>
                                        <p className={styles.name}>{conn.userId?.name}</p>
                                        <p className={styles.lastMsg}>Click to chat</p>
                                    </div>
                                </div>
                            ))}
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
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="black" className="size-6">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                                                </svg>
                                            </button>

                                            <div className={styles.selectionInfo}>
                                                {selectedMessages.length} selected
                                            </div>

                                            <div className={styles.headerActions} ref={deleteMenuRef}>
                                                <button
                                                    className={styles.deleteBtn}
                                                    onClick={() => setShowDeleteMenu(prev => !prev)}
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-6">
                                                        <path fillRule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 0 1 3.878.512.75.75 0 1 1-.256 1.478l-.209-.035-1.005 13.07a3 3 0 0 1-2.991 2.77H8.084a3 3 0 0 1-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 0 1-.256-1.478A48.567 48.567 0 0 1 7.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 0 1 3.369 0c1.603.051 2.815 1.387 2.815 2.951Zm-6.136-1.452a51.196 51.196 0 0 1 3.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 0 0-6 0v-.113c0-.794.609-1.428 1.364-1.452Zm-.355 5.945a.75.75 0 1 0-1.5.058l.347 9a.75.75 0 1 0 1.499-.058l-.346-9Zm5.48.058a.75.75 0 1 0-1.498-.058l-.347 9a.75.75 0 0 0 1.5.058l.345-9Z" clipRule="evenodd" />
                                                    </svg>
                                                </button>

                                                {showDeleteMenu && (
                                                    <div className={styles.dropdownMenu}>
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
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="black" className="size-6">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                                                </svg>
                                            </button>

                                            <div className={styles.headerUserInfo}>
                                                <img
                                                    src={activeChatUser.userId.profilePicture || "/default-avatar.png"}
                                                    alt={activeChatUser.userId.name}
                                                    className={styles.headerAvatar}
                                                />
                                                <div className={styles.headerInfo}>
                                                    <h4 onClick={() => { router.push(`/view_profile/${activeChatUser.userId.username}`) }}>{activeChatUser.userId.name}</h4>
                                                    <span>Online</span>
                                                </div>
                                            </div>

                                            <div className={styles.headerActions} ref={menuRef}>
                                                <button
                                                    className={styles.menuBtn}
                                                    onClick={() => setShowMenu(!showMenu)}
                                                >
                                                    ⋮
                                                </button>

                                                {showMenu && (
                                                    <div className={styles.dropdownMenu}>
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
                                                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-5">
                                                                            <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z" />
                                                                            <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
                                                                        </svg>

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
                                            +
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
                                            onChange={e => setMessage(e.target.value)}
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
                                            {sending ? "Sending..." : "Send"}
                                        </button>
                                    </form>
                                </div>
                            </>
                        ) : (
                            <div className={styles.noChatPlaceholder}>
                                <div className={styles.placeholderContent}>
                                    <div className={styles.placeholderIcon}>💬</div>
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
                        <div className={styles.searchModalContent} onClick={e => e.stopPropagation()}>
                            <div className={styles.searchModalHeader}>
                                <h3>Search Messages</h3>
                                <button
                                    className={styles.closeBtn}
                                    onClick={() => {
                                        setShowSearchModal(false);
                                        setSearchQuery("");
                                    }}
                                >
                                    ×
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
                        <div className={styles.previewModalContent} onClick={e => e.stopPropagation()}>
                            <button
                                className={styles.previewCloseBtn}
                                onClick={() => setPreviewMedia(null)}
                            >
                                ×
                            </button>
                            <button
                                className={styles.previewDownloadBtn}
                                onClick={() => handleDownloadMedia(previewMedia.url, previewMedia.mediaType)}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-6">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                                </svg>


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
        </UserLayout>
    );
}