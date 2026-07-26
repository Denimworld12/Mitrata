import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { useNotification } from '../NotificationProvider';
import { useSelector } from 'react-redux';
import { useToast } from '../Toast';
import CallOverlay from './CallOverlay';

const CallContext = createContext(null);

export function useCall() {
    const ctx = useContext(CallContext);
    if (!ctx) throw new Error('useCall must be within <CallProvider>');
    return ctx;
}

// getUserMedia failures (denied permission, no device, insecure origin) used to
// just console.error and reset to idle — clicking the call button would silently
// do nothing. Surface a real reason instead.
function describeMediaError(err) {
    if (!navigator.mediaDevices?.getUserMedia) {
        return "Calling needs a secure connection (HTTPS) — camera/mic access isn't available on this page.";
    }
    switch (err?.name) {
        case 'NotAllowedError':
            return "Camera/microphone access was blocked. Allow it in your browser's site settings and try again.";
        case 'NotFoundError':
            return "No camera or microphone was found on this device.";
        case 'NotReadableError':
            return "Your camera or microphone is already in use by another app.";
        default:
            return "Couldn't start the call. Check your camera/microphone and try again.";
    }
}

// STUN alone can't connect two peers when either is behind a symmetric/
// restrictive NAT (common on mobile data, corporate wifi, some home
// routers) — the offer/answer exchange succeeds but no media ever flows.
// A TURN relay is the fallback for exactly that case. Using Open Relay's
// free public TURN service; swap in dedicated TURN credentials if call
// volume grows past what its rate limits allow.
const ICE_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun.relay.metered.ca:80' },
        { urls: 'turn:global.relay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
        { urls: 'turn:global.relay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
        { urls: 'turn:global.relay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' }
    ]
};

export function CallProvider({ children }) {
    const { socketInstance } = useNotification();
    const toast = useToast();
    const authState = useSelector(state => state.auth);

    // Call state: 'idle' | 'calling' | 'ringing' | 'active'
    const [callState, setCallState] = useState('idle');
    const [remoteUser, setRemoteUser] = useState(null); // { _id, name, avatar }
    const [isMuted, setIsMuted] = useState(false);
    const [callDuration, setCallDuration] = useState(0);
    const [remoteRinging, setRemoteRinging] = useState(false);
    const [isVideoCall, setIsVideoCall] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);

    // ... (refs same as before)
    const peerConnection = useRef(null);
    const localStream = useRef(null);
    const remoteAudio = useRef(null);
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const ringtoneAudio = useRef(null);
    const ringbackAudio = useRef(null);
    const durationInterval = useRef(null);
    const callTimeout = useRef(null);
    const iceCandidateQueue = useRef([]);
    const pendingIncomingIsVideo = useRef(false);
    // Use a ref for socket logic inside callbacks where we don't want re-creation
    // but rely on socketInstance for effects

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
        if (ringbackAudio.current) {
            ringbackAudio.current.pause();
            ringbackAudio.current.currentTime = 0;
            ringbackAudio.current = null;
        }
        if (localVideoRef.current) localVideoRef.current.srcObject = null;
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
        iceCandidateQueue.current = [];
        setCallState('idle');
        setRemoteUser(null);
        setIsMuted(false);
        setCallDuration(0);
        setRemoteRinging(false);
        setIsVideoCall(false);
        setIsVideoOff(false);
        setIsMinimized(false);
    }, []);

    // The full overlay is a real modal (you shouldn't be able to scroll the
    // page underneath while it's up); minimizing it is the escape hatch —
    // same idea as a browser's native PiP window for an ongoing call — so
    // the page becomes scrollable again as soon as it's not full-screen.
    useEffect(() => {
        const shouldLock = callState !== 'idle' && !isMinimized;
        document.body.style.overflow = shouldLock ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
    }, [callState, isMinimized]);

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

        pc.ontrack = (event) => {
            // Same stream drives both elements — the audio element ignores
            // any video track, the video element plays both, so one incoming
            // stream correctly serves voice-only and video calls alike.
            if (remoteAudio.current) {
                remoteAudio.current.srcObject = event.streams[0];
            }
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = event.streams[0];
            }
        };

        pc.oniceconnectionstatechange = () => {
            if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
                cleanupCall();
            }
        };

        peerConnection.current = pc;
        return pc;
    }, [socketInstance, cleanupCall]);

    const callUser = useCallback(async (userId, userInfo = {}, isVideo = false) => {
        if (callState !== 'idle') return;
        if (!socketInstance) {
            toast.error("Not connected to the server yet — try again in a moment.");
            return;
        }

        try {
            // ... (setup stream) ...
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: isVideo });
            localStream.current = stream;
            setIsVideoCall(isVideo);
            if (isVideo && localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }

            // Play Ringback Tone
            try {
                const audio = new Audio('/ringtone/soundreality-telephone-ring-129620.mp3');
                audio.loop = true;
                audio.play().catch(e => console.error("Ringback play failed", e));
                ringbackAudio.current = audio;
            } catch (e) {
                console.error("Audio init failed", e);
            }

            setRemoteUser({
                _id: userId,
                name: userInfo.name || 'User',
                avatar: userInfo.avatar || '/default-avatar.svg'
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
                    avatar: myUser?.profilePicture || '/default-avatar.svg'
                },
                isVideo
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
            toast.error(describeMediaError(err));
            cleanupCall();
        }
    }, [callState, socketInstance, createPeerConnection, cleanupCall, authState.user, toast]);

    // ... (answerCall similar update for socketInstance) ...
    const answerCall = useCallback(async (callerId, offer) => {
        try {
            const isVideo = pendingIncomingIsVideo.current;
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: isVideo });
            localStream.current = stream;
            setIsVideoCall(isVideo);
            if (isVideo && localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }

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
            toast.error(describeMediaError(err));
            cleanupCall();
        }
    }, [socketInstance, createPeerConnection, cleanupCall, toast]);

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

    const toggleVideo = useCallback(() => {
        if (localStream.current) {
            const videoTrack = localStream.current.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setIsVideoOff(!videoTrack.enabled);
            }
        }
    }, []);

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
                avatar: data.callerInfo?.avatar || '/default-avatar.svg'
            });
            setCallState('ringing');
            pendingIncomingIsVideo.current = !!data.isVideo;
            setIsVideoCall(!!data.isVideo);
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

                // Stop ringback tone
                if (ringbackAudio.current) {
                    ringbackAudio.current.pause();
                    ringbackAudio.current.currentTime = 0;
                    ringbackAudio.current = null;
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
                toast.warning("User is currently on another call.");
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
        <CallContext.Provider value={{
            callUser, endCall, callState, remoteUser, isMuted, toggleMute, callDuration, remoteRinging,
            isVideoCall, isVideoOff, toggleVideo, isMinimized,
        }}>
            {children}
            {/* Remote audio track always plays here — for video calls the same
                stream is ALSO attached to the video element inside CallOverlay
                (see pc.ontrack), so audio keeps working even before that
                element mounts. */}
            <audio ref={remoteAudio} autoPlay playsInline />
            {/* Call overlay UI */}
            {callState !== 'idle' && (
                <CallOverlay
                    callState={callState}
                    remoteUser={remoteUser}
                    remoteRinging={remoteRinging}
                    isMuted={isMuted}
                    callDuration={callDuration}
                    isVideoCall={isVideoCall}
                    isVideoOff={isVideoOff}
                    localVideoRef={localVideoRef}
                    remoteVideoRef={remoteVideoRef}
                    onAccept={handleAcceptCall}
                    onReject={handleRejectCall}
                    onEnd={endCall}
                    onToggleMute={toggleMute}
                    onToggleVideo={toggleVideo}
                    isMinimized={isMinimized}
                    onMinimize={() => setIsMinimized(true)}
                    onExpand={() => setIsMinimized(false)}
                />
            )}
        </CallContext.Provider>
    );
}
