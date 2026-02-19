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
    const { socketInstance } = useNotification();
    const authState = useSelector(state => state.auth);

    // Call state: 'idle' | 'calling' | 'ringing' | 'active'
    const [callState, setCallState] = useState('idle');
    const [remoteUser, setRemoteUser] = useState(null); // { _id, name, avatar }
    const [isMuted, setIsMuted] = useState(false);
    const [callDuration, setCallDuration] = useState(0);
    const [remoteRinging, setRemoteRinging] = useState(false);

    // ... (refs same as before)
    const peerConnection = useRef(null);
    const localStream = useRef(null);
    const remoteAudio = useRef(null);
    const ringtoneAudio = useRef(null);
    const durationInterval = useRef(null);
    const callTimeout = useRef(null);
    const iceCandidateQueue = useRef([]);
    // Use a ref for socket logic inside callbacks where we don't want re-creation
    // but rely on socketInstance for effects

    // ... (cleanupCall same) ...

    const createPeerConnection = useCallback((targetUserId) => {
        const pc = new RTCPeerConnection(ICE_SERVERS);

        pc.onicecandidate = (event) => {
            if (event.candidate && socketInstance) {
                socketInstance.emit('iceCandidate', {
                    targetId: targetUserId,
                    candidate: event.candidate
                });
            }
        };

        // ... rest of createPeerConnection ...

        peerConnection.current = pc;
        return pc;
    }, [socketInstance, cleanupCall]);

    const callUser = useCallback(async (userId, userInfo = {}) => {
        if (callState !== 'idle' || !socketInstance) return;

        try {
            // ... (setup stream) ...
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
            socketInstance.emit('callUser', {
                receiverId: userId,
                offer: offer,
                callerInfo: {
                    name: myUser?.name || 'User',
                    avatar: myUser?.profilePicture || '/default-avatar.png'
                }
            });

            // 30s Timeout
            callTimeout.current = setTimeout(() => {
                if (socketInstance) {
                    socketInstance.emit('endCall', { targetId: userId });
                }
                cleanupCall();
            }, 30000);

        } catch (err) {
            console.error('Failed to start call:', err);
            cleanupCall();
        }
    }, [callState, socketInstance, createPeerConnection, cleanupCall, authState.user]);

    // ... (answerCall similar update for socketInstance) ...
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

            socketInstance.emit('answerCall', {
                callerId: callerId,
                answer: answer
            });

            // Stop ringtone
            if (ringtoneAudio.current) {
                ringtoneAudio.current.pause();
                ringtoneAudio.current.currentTime = 0;
            }

            setCallState('active');
            durationInterval.current = setInterval(() => {
                setCallDuration(prev => prev + 1);
            }, 1000);
        } catch (err) {
            console.error('Failed to answer call:', err);
            cleanupCall();
        }
    }, [socketInstance, createPeerConnection, cleanupCall]);

    // End call
    const endCall = useCallback(() => {
        if (socketInstance && remoteUser) {
            socketInstance.emit('endCall', { targetId: remoteUser._id });
        }
        cleanupCall();
    }, [socketInstance, remoteUser, cleanupCall]);

    // Reject
    const rejectCall = useCallback((callerId) => {
        if (socketInstance) {
            socketInstance.emit('rejectCall', { callerId });
        }
        cleanupCall();
    }, [socketInstance, cleanupCall]);

    // ... (toggleMute) ...

    // Socket event listeners
    useEffect(() => {
        if (!socketInstance) return;

        const handleIncomingCall = (data) => {
            if (callState !== 'idle') {
                // AUTO-REJECT IF BUSY
                socketInstance.emit('rejectCall', {
                    callerId: data.callerId,
                    reason: 'busy'
                });
                return;
            }

            socketInstance.emit('callDelivered', { callerId: data.callerId });

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
            iceCandidateQueue.current = [];
            peerConnection.current = null;
            window.__incomingOffer = data.offer;
        };

        const handleCallAnswered = async (data) => {
            if (peerConnection.current) {
                if (callTimeout.current) {
                    clearTimeout(callTimeout.current);
                    callTimeout.current = null;
                }

                await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.answer));

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
            // Optional: Show toast "Call ended"
        };

        const handleCallRejected = (data) => {
            // Optional: Handle 'busy' reason
            if (data?.reason === 'busy') {
                alert("User is currently on another call.");
            }
            cleanupCall();
        };

        const handleCallDelivered = () => {
            setRemoteRinging(true);
        };

        socketInstance.on('incomingCall', handleIncomingCall);
        socketInstance.on('callAnswered', handleCallAnswered);
        socketInstance.on('iceCandidate', handleIceCandidate);
        socketInstance.on('callEnded', handleCallEnded);
        socketInstance.on('callRejected', handleCallRejected);
        socketInstance.on('callDelivered', handleCallDelivered);

        return () => {
            socketInstance.off('incomingCall', handleIncomingCall);
            socketInstance.off('callAnswered', handleCallAnswered);
            socketInstance.off('iceCandidate', handleIceCandidate);
            socketInstance.off('callEnded', handleCallEnded);
            socketInstance.off('callRejected', handleCallRejected);
            socketInstance.off('callDelivered', handleCallDelivered);
        };
    }, [socketInstance, callState, cleanupCall]);

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
