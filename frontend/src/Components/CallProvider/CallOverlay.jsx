import React from 'react';
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
    onAccept,
    onReject,
    onEnd,
    onToggleMute
}) {
    return (
        <div className={styles.overlay}>
            <div className={styles.callCard}>
                {/* Avatar */}
                <div className={styles.avatarRing}>
                    <img
                        src={remoteUser?.avatar || '/default-avatar.png'}
                        alt={remoteUser?.name}
                        className={styles.avatar}
                    />
                    {(callState === 'calling' || callState === 'ringing') && <div className={styles.pulseRing} />}
                </div>

                {/* Name */}
                <h2 className={styles.userName}>{remoteUser?.name || 'Unknown'}</h2>

                {/* Status */}
                {callState === 'calling' && (
                    <p className={styles.status}>
                        {remoteRinging ? 'Ringing...' : 'Calling...'}
                    </p>
                )}
                {callState === 'ringing' && (
                    <p className={styles.status}>Incoming Call</p>
                )}
                {callState === 'active' && (
                    <p className={styles.duration}>{formatDuration(callDuration)}</p>
                )}

                {/* Actions */}
                <div className={styles.actions}>
                    {/* INCOMING CALL: Accept + Reject */}
                    {callState === 'ringing' && (
                        <>
                            <button className={`${styles.callBtn} ${styles.rejectBtn}`} onClick={onReject}>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" width="28" height="28">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                                </svg>
                            </button>
                            <button className={`${styles.callBtn} ${styles.acceptBtn}`} onClick={onAccept}>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" width="28" height="28">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
                                </svg>
                            </button>
                        </>
                    )}

                    {/* OUTGOING: Cancel */}
                    {callState === 'calling' && (
                        <button className={`${styles.callBtn} ${styles.endBtn}`} onClick={onEnd}>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" width="28" height="28">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 3.75 18 6m0 0 2.25 2.25M18 6l2.25-2.25M18 6l-2.25 2.25m1.5 13.5c-8.284 0-15-6.716-15-15V4.5A2.25 2.25 0 0 1 6.75 2.25h1.372c.516 0 .966.351 1.091.852l1.106 4.423c.11.44-.055.902-.417 1.173l-1.293.97a1.062 1.062 0 0 0-.38 1.21 12.035 12.035 0 0 0 7.143 7.143c.441.162.928-.004 1.21-.38l.97-1.293a1.125 1.125 0 0 1 1.173-.417l4.423 1.106c.5.125.852.575.852 1.091V19.5a2.25 2.25 0 0 1-2.25 2.25h-2.25Z" />
                            </svg>
                        </button>
                    )}

                    {/* ACTIVE: Mute + End */}
                    {callState === 'active' && (
                        <>
                            <button
                                className={`${styles.callBtn} ${isMuted ? styles.mutedBtn : styles.muteBtn}`}
                                onClick={onToggleMute}
                            >
                                {isMuted ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" width="24" height="24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75 19.5 12m0 0 2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6v4.5m0 0-3.75 3.75M6.75 14.25 3 18m3.75-3.75h3.75m-3.75 0 3.75-3.75" />
                                    </svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" width="24" height="24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
                                    </svg>
                                )}
                            </button>
                            <button className={`${styles.callBtn} ${styles.endBtn}`} onClick={onEnd}>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" width="28" height="28">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 3.75 18 6m0 0 2.25 2.25M18 6l2.25-2.25M18 6l-2.25 2.25m1.5 13.5c-8.284 0-15-6.716-15-15V4.5A2.25 2.25 0 0 1 6.75 2.25h1.372c.516 0 .966.351 1.091.852l1.106 4.423c.11.44-.055.902-.417 1.173l-1.293.97a1.062 1.062 0 0 0-.38 1.21 12.035 12.035 0 0 0 7.143 7.143c.441.162.928-.004 1.21-.38l.97-1.293a1.125 1.125 0 0 1 1.173-.417l4.423 1.106c.5.125.852.575.852 1.091V19.5a2.25 2.25 0 0 1-2.25 2.25h-2.25Z" />
                                </svg>
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
