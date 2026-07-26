import React from 'react';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff } from 'lucide-react';
import styles from './Call.module.css';

function formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export default function CallOverlay({
    callState,
    remoteUser,
    remoteRinging,
    isMuted,
    callDuration,
    isVideoCall,
    isVideoOff,
    localVideoRef,
    remoteVideoRef,
    onAccept,
    onReject,
    onEnd,
    onToggleMute,
    onToggleVideo,
}) {
    const isPulsing = callState === 'calling' || callState === 'ringing';
    const isConnecting = callState !== 'active';

    if (isVideoCall) {
        return (
            <div className={styles.overlay}>
                <div className={styles.videoStage}>
                    <video ref={remoteVideoRef} className={styles.remoteVideo} autoPlay playsInline />

                    {isConnecting && (
                        <div className={styles.videoConnectingScrim}>
                            <div className={styles.avatarRing}>
                                <div className={styles.pulseRing} />
                                <div className={`${styles.pulseRing} ${styles.pulseRingDelay}`} />
                                <img src={remoteUser?.avatar || '/default-avatar.svg'} alt={remoteUser?.name} className={styles.avatar} />
                            </div>
                            <h2 className={styles.userNameLight}>{remoteUser?.name || 'Unknown'}</h2>
                            <p className={styles.statusLight}>
                                {callState === 'ringing' ? 'Incoming video call' : remoteRinging ? 'Ringing…' : 'Calling…'}
                            </p>
                        </div>
                    )}

                    {!isConnecting && (
                        <div className={styles.videoNameChip}>
                            <img src={remoteUser?.avatar || '/default-avatar.svg'} alt="" />
                            <span>{remoteUser?.name || 'Unknown'}</span>
                            <span className={styles.videoNameChipDuration}>{formatDuration(callDuration)}</span>
                        </div>
                    )}

                    <div className={`${styles.localVideoPip} ${isVideoOff ? styles.localVideoPipHidden : ''}`}>
                        <video ref={localVideoRef} autoPlay playsInline muted />
                    </div>

                    <div className={styles.videoControlBar}>
                        {callState === 'ringing' ? (
                            <>
                                <button className={`${styles.glassBtn} ${styles.glassBtnDanger}`} onClick={onReject} aria-label="Decline">
                                    <PhoneOff size={20} strokeWidth={2} />
                                </button>
                                <button className={`${styles.glassBtn} ${styles.glassBtnAccept}`} onClick={onAccept} aria-label="Accept">
                                    <Video size={20} strokeWidth={2} />
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    className={`${styles.glassBtn} ${isMuted ? styles.glassBtnActive : ''}`}
                                    onClick={onToggleMute}
                                    aria-label={isMuted ? 'Unmute' : 'Mute'}
                                >
                                    {isMuted ? <MicOff size={18} strokeWidth={2} /> : <Mic size={18} strokeWidth={2} />}
                                </button>
                                <button
                                    className={`${styles.glassBtn} ${isVideoOff ? styles.glassBtnActive : ''}`}
                                    onClick={onToggleVideo}
                                    aria-label={isVideoOff ? 'Turn camera on' : 'Turn camera off'}
                                >
                                    {isVideoOff ? <VideoOff size={18} strokeWidth={2} /> : <Video size={18} strokeWidth={2} />}
                                </button>
                                <button className={`${styles.glassBtn} ${styles.glassBtnEnd}`} onClick={onEnd} aria-label="End call">
                                    <PhoneOff size={18} strokeWidth={2} />
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.overlay}>
            <div className={styles.callCard}>
                <span className={styles.overline}>Voice call</span>

                {/* Avatar */}
                <div className={styles.avatarRing}>
                    {isPulsing && (
                        <>
                            <div className={styles.pulseRing} />
                            <div className={`${styles.pulseRing} ${styles.pulseRingDelay}`} />
                        </>
                    )}
                    <img
                        src={remoteUser?.avatar || '/default-avatar.svg'}
                        alt={remoteUser?.name}
                        className={styles.avatar}
                    />
                </div>

                {/* Name */}
                <h2 className={styles.userName}>{remoteUser?.name || 'Unknown'}</h2>

                {/* Status */}
                {callState === 'calling' && (
                    <p className={styles.status}>
                        {remoteRinging ? 'Ringing…' : 'Calling…'}
                    </p>
                )}
                {callState === 'ringing' && (
                    <p className={styles.status}>Incoming voice call</p>
                )}
                {callState === 'active' && (
                    <p className={styles.duration}>{formatDuration(callDuration)}</p>
                )}

                {/* Actions */}
                <div className={styles.actions}>
                    {/* INCOMING CALL: Accept + Reject */}
                    {callState === 'ringing' && (
                        <>
                            <div className={styles.actionCol}>
                                <button className={`${styles.callBtn} ${styles.rejectBtn}`} onClick={onReject} aria-label="Decline">
                                    <PhoneOff size={26} strokeWidth={2} />
                                </button>
                                <span className={styles.actionLabel}>Decline</span>
                            </div>
                            <div className={styles.actionCol}>
                                <button className={`${styles.callBtn} ${styles.acceptBtn}`} onClick={onAccept} aria-label="Accept">
                                    <Phone size={26} strokeWidth={2} />
                                </button>
                                <span className={styles.actionLabel}>Accept</span>
                            </div>
                        </>
                    )}

                    {/* OUTGOING: Cancel */}
                    {callState === 'calling' && (
                        <div className={styles.actionCol}>
                            <button className={`${styles.callBtn} ${styles.endBtn}`} onClick={onEnd} aria-label="Cancel call">
                                <PhoneOff size={26} strokeWidth={2} />
                            </button>
                            <span className={styles.actionLabel}>Cancel</span>
                        </div>
                    )}

                    {/* ACTIVE: Mute + End */}
                    {callState === 'active' && (
                        <>
                            <div className={styles.actionCol}>
                                <button
                                    className={`${styles.callBtn} ${styles.ghostBtn} ${isMuted ? styles.ghostBtnActive : ''}`}
                                    onClick={onToggleMute}
                                    aria-label={isMuted ? 'Unmute' : 'Mute'}
                                >
                                    {isMuted ? <MicOff size={20} strokeWidth={2} /> : <Mic size={20} strokeWidth={2} />}
                                </button>
                                <span className={styles.actionLabel}>{isMuted ? 'Unmute' : 'Mute'}</span>
                            </div>
                            <div className={styles.actionCol}>
                                <button className={`${styles.callBtn} ${styles.endBtn}`} onClick={onEnd} aria-label="End call">
                                    <PhoneOff size={26} strokeWidth={2} />
                                </button>
                                <span className={styles.actionLabel}>End</span>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
