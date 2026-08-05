import React, { useEffect, useRef, useState } from 'react';
import { X, ChevronLeft, ChevronRight, Trash2, Volume2, VolumeX, Heart, Send, Eye } from 'lucide-react';
import { clientServer } from '@/config';

const IMAGE_DURATION_MS = 5000;

// Full-screen story viewer — one author's group at a time, segmented
// progress bars, tap-left/right or auto-advance between that author's own
// stories, Esc/X/backdrop to close. Marks each story viewed on open.
// Music (if attached) auto-plays/pauses with the story, gated by a local
// mute toggle; replies/likes are sent as a DM to the story's owner, same
// convention the mobile app uses instead of a separate comment system.
export default function StoryViewer({ groups, startIndex, onClose, onDeleted }) {
    const [groupIndex, setGroupIndex] = useState(startIndex);
    const [storyIndex, setStoryIndex] = useState(0);
    const [progress, setProgress] = useState(0);
    const [muted, setMuted] = useState(false);
    const [replyText, setReplyText] = useState('');
    const [sending, setSending] = useState(false);
    const [viewersOpen, setViewersOpen] = useState(false);
    const [viewers, setViewers] = useState(null);
    const [viewersError, setViewersError] = useState(null);
    const timerRef = useRef(null);
    const startRef = useRef(0);
    const audioRef = useRef(null);

    const group = groups[groupIndex];
    const story = group?.stories[storyIndex];

    const goNext = () => {
        if (!group) return;
        if (storyIndex < group.stories.length - 1) {
            setStoryIndex((i) => i + 1);
        } else if (groupIndex < groups.length - 1) {
            setGroupIndex((i) => i + 1);
            setStoryIndex(0);
        } else {
            onClose();
        }
    };

    const goPrev = () => {
        if (storyIndex > 0) {
            setStoryIndex((i) => i - 1);
        } else if (groupIndex > 0) {
            const prevGroup = groups[groupIndex - 1];
            setGroupIndex((i) => i - 1);
            setStoryIndex(prevGroup.stories.length - 1);
        }
    };

    // Mark viewed + drive the auto-advance progress bar.
    useEffect(() => {
        if (!story) return;
        if (!story.viewed && !story.isMine) {
            clientServer.post(`/story/${story._id}/view`).catch(() => {});
        }

        setReplyText('');
        setViewersOpen(false);
        setViewers(null);
        setProgress(0);
        startRef.current = Date.now();
        clearInterval(timerRef.current);

        if (story.mediaType === 'video') return; // video's own onEnded drives advance

        timerRef.current = setInterval(() => {
            const pct = Math.min(100, ((Date.now() - startRef.current) / IMAGE_DURATION_MS) * 100);
            setProgress(pct);
            if (pct >= 100) goNext();
        }, 50);

        return () => clearInterval(timerRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [groupIndex, storyIndex]);

    // Start/stop the attached song alongside the current story.
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;
        if (story?.music) {
            audio.src = story.music.previewUrl;
            audio.currentTime = 0;
            audio.muted = muted;
            audio.play().catch(() => {}); // browser autoplay policies can reject silently
        } else {
            audio.pause();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [groupIndex, storyIndex]);

    useEffect(() => {
        if (audioRef.current) audioRef.current.muted = muted;
    }, [muted]);

    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowRight') goNext();
            if (e.key === 'ArrowLeft') goPrev();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [groupIndex, storyIndex, groups]);

    const handleDelete = async () => {
        if (!story || !window.confirm('Delete this story?')) return;
        try {
            await clientServer.delete(`/story/${story._id}`);
            onDeleted?.(story._id);
            goNext();
        } catch {
            // silent — the viewer staying open with the same story is an
            // acceptable failure mode here, no dedicated toast plumbing in this overlay
        }
    };

    const sendToOwner = async (content) => {
        if (!content.trim() || sending) return;
        setSending(true);
        try {
            await clientServer.post('/user/send_message', { receiverId: group.user._id, content: content.trim() });
            setReplyText('');
        } catch {
            // silent, same failure convention as the rest of this overlay
        } finally {
            setSending(false);
        }
    };

    const openViewers = async () => {
        setViewersOpen(true);
        if (viewers !== null) return; // already loaded for this story
        try {
            const res = await clientServer.get(`/story/${story._id}/viewers`);
            setViewers(res.data.viewers || []);
        } catch {
            setViewersError("Couldn't load viewers");
        }
    };

    if (!group || !story) return null;

    return (
        <div
            className="fixed inset-0 z-[10050] flex items-center justify-center"
            style={{ background: 'rgba(11,10,9,.92)' }}
            onClick={onClose}
        >
            <audio ref={audioRef} />
            <div
                className="relative w-full flex flex-col items-center"
                style={{ maxWidth: 400 }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Progress bars */}
                <div className="absolute top-3 left-3 right-3 flex gap-1.5 z-10">
                    {group.stories.map((s, i) => (
                        <div key={s._id} className="flex-1 h-[3px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,.3)' }}>
                            <div
                                className="h-full bg-white"
                                style={{
                                    width: i < storyIndex ? '100%' : i === storyIndex ? `${progress}%` : '0%',
                                    transition: i === storyIndex ? 'none' : 'width .2s'
                                }}
                            />
                        </div>
                    ))}
                </div>

                {/* Header */}
                <div className="absolute top-8 left-3 right-3 z-10">
                    <div className="flex items-center gap-2">
                        <img src={group.user.profilePicture || '/default-avatar.svg'} alt="" className="size-8 rounded-full object-cover border border-white/40" />
                        <span className="text-white text-sm font-semibold">{group.user.name}</span>
                        <div className="flex-1" />
                        {story.isMine && (
                            <button onClick={handleDelete} className="text-white/80 hover:text-white p-1.5" title="Delete story">
                                <Trash2 size={18} strokeWidth={1.8} />
                            </button>
                        )}
                        <button onClick={onClose} className="text-white/80 hover:text-white p-1.5" title="Close">
                            <X size={20} strokeWidth={2} />
                        </button>
                    </div>
                    {story.music && (
                        <div className="flex items-center gap-1.5 mt-1 pl-1 text-white/70 text-xs">
                            <span>♪</span>
                            <span className="truncate">{story.music.title} · {story.music.artist}</span>
                        </div>
                    )}
                </div>

                {/* Media */}
                <div
                    className="relative w-full overflow-hidden bg-black flex items-center justify-center"
                    style={{ aspectRatio: '9 / 16', borderRadius: 18 }}
                >
                    {story.mediaType === 'video' ? (
                        <video
                            src={story.media}
                            className="w-full h-full object-contain"
                            autoPlay
                            muted={muted}
                            onEnded={goNext}
                        />
                    ) : (
                        <img src={story.media} alt="" className="w-full h-full object-contain" />
                    )}

                    {/* Tap zones */}
                    <button className="absolute inset-y-0 left-0 w-1/3" onClick={goPrev} aria-label="Previous" />
                    <button className="absolute inset-y-0 right-0 w-1/3" onClick={goNext} aria-label="Next" />

                    {(story.music || story.mediaType === 'video') && (
                        <button
                            onClick={() => setMuted((m) => !m)}
                            className="absolute bottom-3 right-3 z-10 size-8 rounded-full flex items-center justify-center text-white"
                            style={{ background: 'rgba(0,0,0,.45)' }}
                            title={muted ? 'Unmute' : 'Mute'}
                        >
                            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                        </button>
                    )}
                </div>

                {/* Reply bar (others' stories) / viewers pill (your own) */}
                <div className="w-full flex items-center gap-2 mt-3 px-1" onClick={(e) => e.stopPropagation()}>
                    {story.isMine ? (
                        <button
                            onClick={openViewers}
                            className="flex items-center gap-2 px-4 h-11 rounded-full text-white/80 text-sm"
                            style={{ background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.25)' }}
                        >
                            <Eye size={16} />
                            Views
                        </button>
                    ) : (
                        <>
                            <input
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && sendToOwner(replyText)}
                                placeholder={`Reply to ${group.user.name}…`}
                                className="flex-1 h-11 rounded-full px-4 text-sm text-white placeholder-white/50 bg-transparent outline-none"
                                style={{ background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.25)' }}
                            />
                            <button onClick={() => sendToOwner('❤️')} className="text-white p-1.5" title="Like">
                                <Heart size={20} />
                            </button>
                            <button onClick={() => sendToOwner(replyText)} className="text-white p-1.5" disabled={sending} title="Send">
                                <Send size={20} />
                            </button>
                        </>
                    )}
                </div>

                {/* Desktop chevrons */}
                {(groupIndex > 0 || storyIndex > 0) && (
                    <button
                        onClick={goPrev}
                        className="hidden sm:flex absolute left-[-56px] top-1/2 -translate-y-1/2 size-10 rounded-full items-center justify-center text-white"
                        style={{ background: 'rgba(255,255,255,.14)' }}
                    >
                        <ChevronLeft size={20} />
                    </button>
                )}
                <button
                    onClick={goNext}
                    className="hidden sm:flex absolute right-[-56px] top-1/2 -translate-y-1/2 size-10 rounded-full items-center justify-center text-white"
                    style={{ background: 'rgba(255,255,255,.14)' }}
                >
                    <ChevronRight size={20} />
                </button>
            </div>

            {/* Viewers list — a sibling of the (width-capped) story card, not
                nested inside it, so it spans the full screen width instead of
                being squeezed to the card's 400px max-width. */}
            {viewersOpen && (
                <div
                    className="fixed inset-x-0 bottom-0 z-10 rounded-t-2xl p-4 max-h-[50%] overflow-y-auto"
                    style={{ background: '#1c1c1e' }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-white font-semibold text-sm">
                            {viewersError || (viewers ? `${viewers.length} ${viewers.length === 1 ? 'view' : 'views'}` : 'Loading…')}
                        </span>
                        <button onClick={() => setViewersOpen(false)} className="text-white/70">
                            <X size={18} />
                        </button>
                    </div>
                    {viewers?.length === 0 && <p className="text-white/60 text-sm py-4">No views yet</p>}
                    {viewers?.map((v) => (
                        <div key={v._id} className="flex items-center gap-3 py-2">
                            <img src={v.profilePicture || '/default-avatar.svg'} alt="" className="size-8 rounded-full object-cover" />
                            <span className="text-white text-sm">{v.username}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
