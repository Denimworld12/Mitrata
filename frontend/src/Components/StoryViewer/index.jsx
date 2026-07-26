import React, { useEffect, useRef, useState } from 'react';
import { X, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { clientServer } from '@/config';

const IMAGE_DURATION_MS = 5000;

// Full-screen story viewer — one author's group at a time, segmented
// progress bars, tap-left/right or auto-advance between that author's own
// stories, Esc/X/backdrop to close. Marks each story viewed on open.
export default function StoryViewer({ groups, startIndex, onClose, onDeleted }) {
    const [groupIndex, setGroupIndex] = useState(startIndex);
    const [storyIndex, setStoryIndex] = useState(0);
    const [progress, setProgress] = useState(0);
    const timerRef = useRef(null);
    const startRef = useRef(0);

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

    if (!group || !story) return null;

    return (
        <div
            className="fixed inset-0 z-[10050] flex items-center justify-center"
            style={{ background: 'rgba(11,10,9,.92)' }}
            onClick={onClose}
        >
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
                <div className="absolute top-8 left-3 right-3 flex items-center gap-2 z-10">
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
                            onEnded={goNext}
                        />
                    ) : (
                        <img src={story.media} alt="" className="w-full h-full object-contain" />
                    )}

                    {/* Tap zones */}
                    <button className="absolute inset-y-0 left-0 w-1/3" onClick={goPrev} aria-label="Previous" />
                    <button className="absolute inset-y-0 right-0 w-1/3" onClick={goNext} aria-label="Next" />
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
        </div>
    );
}
