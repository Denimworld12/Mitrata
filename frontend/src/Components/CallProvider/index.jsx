import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { useNotification } from '../NotificationProvider';
import { useSelector } from 'react-redux';
import CallOverlay from './CallOverlay';

const CallContext = createContext(null);

export function useCall() {
    const ctx = useContext(CallContext);
    if (!ctx) throw new Error('useCall must be within <CallProvider>');
    return ctx;
}

const ICE_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

export function CallProvider({ children }) {
    const { socket } = useNotification();
    const authState = useSelector(state => state.auth);

    // Call state: 'idle' | 'calling' | 'ringing' | 'active'
    // Call state: 'idle' | 'calling' | 'ringing' | 'active'
    const [callState, setCallState] = useState('idle');
    const [remoteUser, setRemoteUser] = useState(null); // { _id, name, avatar }
    const [isMuted, setIsMuted] = useState(false);
    const [callDuration, setCallDuration] = useState(0);
    const [remoteRinging, setRemoteRinging] = useState(false);

    const peerConnection = useRef(null);
    const localStream = useRef(null);
    const remoteAudio = useRef(null);
    const ringtoneAudio = useRef(null);
    const durationInterval = useRef(null);
    const callTimeout = useRef(null);
    const iceCandidateQueue = useRef([]);

    // Cleanup function
    const cleanupCall = useCallback(() => {
        if (peerConnection.current) {
            peerConnection.current.close();
            peerConnection.current = null;
        }
        if (localStream.current) {
            localStream.current.getTracks().forEach(track => track.stop());
            localStream.current = null;
        }
        if (durationInterval.current) {
            clearInterval(durationInterval.current);
            durationInterval.current = null;
        }
        if (callTimeout.current) {
            clearTimeout(callTimeout.current);
            callTimeout.current = null;
        }
        if (ringtoneAudio.current) {
            ringtoneAudio.current.pause();
            ringtoneAudio.current.currentTime = 0;
            ringtoneAudio.current = null;
        }
        iceCandidateQueue.current = [];
        setCallState('idle');
        setRemoteUser(null);
        setIsMuted(false);
        setCallDuration(0);
        setRemoteRinging(false);
    }, []);

    // Create peer connection
    const createPeerConnection = useCallback((targetUserId) => {
        const pc = new RTCPeerConnection(ICE_SERVERS);

        pc.onicecandidate = (event) => {
            if (event.candidate && socket.current) {
                socket.current.emit('iceCandidate', {
                    targetId: targetUserId,
                    candidate: event.candidate
                });
            }
        };

        pc.ontrack = (event) => {
            if (remoteAudio.current) {
                remoteAudio.current.srcObject = event.streams[0];
            }
        };

        pc.oniceconnectionstatechange = () => {
            if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
                cleanupCall();
            }
        };

        peerConnection.current = pc;
        return pc;
    }, [socket, cleanupCall]);

    // Start a call to someone
    const callUser = useCallback(async (userId, userInfo = {}) => {
        if (callState !== 'idle' || !socket.current) return;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            localStream.current = stream;

            setRemoteUser({
                _id: userId,
                name: userInfo.name || 'User',
                avatar: userInfo.avatar || '/default-avatar.png'
            });
            setCallState('calling');

            const pc = createPeerConnection(userId);
            stream.getTracks().forEach(track => pc.addTrack(track, stream));

            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            const myUser = authState.user?.userId;
            socket.current.emit('callUser', {
                receiverId: userId,
                offer: offer,
                callerInfo: {
                    name: myUser?.name || 'User',
                    avatar: myUser?.profilePicture || '/default-avatar.png'
                }
            });

            // 30s Timeout: End call if not active
            callTimeout.current = setTimeout(() => {
                if (socket.current) {
                    socket.current.emit('endCall', { targetId: userId });
                }
                cleanupCall();
                // We'd ideally show a toast here via a callback or event, but cleanupCall resets state
                // This will just close the overlay.
                // Could emit a local event or set a status message state.
            }, 30000);

        } catch (err) {
            console.error('Failed to start call:', err);
            cleanupCall();
        }
    }, [callState, socket, createPeerConnection, cleanupCall, authState.user]);

    // Answer an incoming call
    const answerCall = useCallback(async (callerId, offer) => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            localStream.current = stream;

            const pc = createPeerConnection(callerId);
            stream.getTracks().forEach(track => pc.addTrack(track, stream));

            await pc.setRemoteDescription(new RTCSessionDescription(offer));

            // Process queued ICE candidates
            for (const candidate of iceCandidateQueue.current) {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
            }
            iceCandidateQueue.current = [];

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            socket.current.emit('answerCall', {
                callerId: callerId,
                answer: answer
            });

            // Stop ringtone
            if (ringtoneAudio.current) {
                ringtoneAudio.current.pause();
                ringtoneAudio.current.currentTime = 0;
            }

            setCallState('active');
            // Start duration timer
            durationInterval.current = setInterval(() => {
                setCallDuration(prev => prev + 1);
            }, 1000);
        } catch (err) {
            console.error('Failed to answer call:', err);
            cleanupCall();
        }
    }, [socket, createPeerConnection, cleanupCall]);

    // End the call
    const endCall = useCallback(() => {
        if (socket.current && remoteUser) {
            socket.current.emit('endCall', { targetId: remoteUser._id });
        }
        cleanupCall();
    }, [socket, remoteUser, cleanupCall]);

    // Reject incoming call
    const rejectCall = useCallback((callerId) => {
        if (socket.current) {
            socket.current.emit('rejectCall', { callerId });
        }
        cleanupCall();
    }, [socket, cleanupCall]);

    // Toggle mute
    const toggleMute = useCallback(() => {
        if (localStream.current) {
            const audioTrack = localStream.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsMuted(!audioTrack.enabled);
            }
        }
    }, []);

    // Socket event listeners
    useEffect(() => {
        const s = socket?.current;
        if (!s) return;

        const handleIncomingCall = (data) => {
            if (callState !== 'idle') {
                // Already in a call, auto-reject
                s.emit('rejectCall', { callerId: data.callerId });
                return;
            }
            // Acknowledge receipt so caller shows "Ringing"
            s.emit('callDelivered', { callerId: data.callerId });

            // Play Ringtone
            try {
                const audio = new Audio('/ringtone/apple-ringtone-42992.mp3');
                audio.loop = true;
                audio.play().catch(e => console.error("Audio play failed", e));
                ringtoneAudio.current = audio;
            } catch (e) {
                console.error("Audio init failed", e);
            }

            setRemoteUser({
                _id: data.callerId,
                name: data.callerInfo?.name || 'User',
                avatar: data.callerInfo?.avatar || '/default-avatar.png'
            });
            setCallState('ringing');
            // Store the offer for when user accepts
            iceCandidateQueue.current = [];
            // Store offer on remoteUser ref
            peerConnection.current = null; // will be created on answer
            // Store offer temporarily
            window.__incomingOffer = data.offer;
        };

        const handleCallAnswered = async (data) => {
            if (peerConnection.current) {
                await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.answer));

                // Process queued ICE candidates
                for (const candidate of iceCandidateQueue.current) {
                    await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
                }
                iceCandidateQueue.current = [];

                setCallState('active');
                durationInterval.current = setInterval(() => {
                    setCallDuration(prev => prev + 1);
                }, 1000);
            }
        };

        const handleIceCandidate = async (data) => {
            if (peerConnection.current && peerConnection.current.remoteDescription) {
                await peerConnection.current.addIceCandidate(new RTCIceCandidate(data.candidate));
            } else {
                iceCandidateQueue.current.push(data.candidate);
            }
        };

        const handleCallEnded = () => {
            cleanupCall();
        };

        const handleCallRejected = () => {
            cleanupCall();
        };

        const handleCallDelivered = () => {
            setRemoteRinging(true);
        };

        s.on('incomingCall', handleIncomingCall);
        s.on('callAnswered', handleCallAnswered);
        s.on('iceCandidate', handleIceCandidate);
        s.on('callEnded', handleCallEnded);
        s.on('callRejected', handleCallRejected);
        s.on('callDelivered', handleCallDelivered);

        return () => {
            s.off('incomingCall', handleIncomingCall);
            s.off('callAnswered', handleCallAnswered);
            s.off('iceCandidate', handleIceCandidate);
            s.off('callEnded', handleCallEnded);
            s.off('callRejected', handleCallRejected);
            s.off('callDelivered', handleCallDelivered);
        };
    }, [socket, callState, cleanupCall]);

    // Handle answer from ringing state with stored offer
    const handleAcceptCall = useCallback(() => {
        if (callState === 'ringing' && remoteUser && window.__incomingOffer) {
            answerCall(remoteUser._id, window.__incomingOffer);
            delete window.__incomingOffer;
        }
    }, [callState, remoteUser, answerCall]);

    const handleRejectCall = useCallback(() => {
        if (remoteUser) {
            rejectCall(remoteUser._id);
        }
        delete window.__incomingOffer;
    }, [remoteUser, rejectCall]);

    return (
        <CallContext.Provider value={{ callUser, endCall, callState, remoteUser, isMuted, toggleMute, callDuration, remoteRinging }}>
            {children}
            {/* Hidden audio element for remote stream */}
            <audio ref={remoteAudio} autoPlay playsInline />
            {/* Call overlay UI */}
            {callState !== 'idle' && (
                <CallOverlay
                    callState={callState}
                    remoteUser={remoteUser}
                    remoteRinging={remoteRinging}
                    isMuted={isMuted}
                    callDuration={callDuration}
                    onAccept={handleAcceptCall}
                    onReject={handleRejectCall}
                    onEnd={endCall}
                    onToggleMute={toggleMute}
                />
            )}
        </CallContext.Provider>
    );
}
