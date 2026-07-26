import React, { useEffect, useRef, useState } from 'react';
import { Flag } from 'lucide-react';
import { clientServer } from '@/config';
import { useToast } from '@/Components/Toast';

const REASONS = ['Spam', 'Harassment', 'Nudity or violence', 'Misinformation', 'Other'];

// Flag-icon popover — the only UI entry point for POST /report, which
// already exists and works server-side (backend/controllers/admin.controller.js).
export default function ReportMenu({ targetType, targetId, className = '' }) {
    const [open, setOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const ref = useRef(null);
    const toast = useToast();

    useEffect(() => {
        const onClickOutside = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', onClickOutside);
        return () => document.removeEventListener('mousedown', onClickOutside);
    }, []);

    const submitReport = async (reason) => {
        setSubmitting(true);
        try {
            await clientServer.post('/report', { targetType, targetId, reason });
            toast.success('Report submitted — thanks for flagging this.');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to submit report');
        } finally {
            setSubmitting(false);
            setOpen(false);
        }
    };

    return (
        <div className={`relative ${className}`} ref={ref}>
            <button
                type="button"
                className="mt-icon-btn flex items-center justify-center size-8 rounded-full text-[var(--mt-ink3)] hover:bg-[var(--mt-sunken)] hover:text-[var(--mt-ink)]"
                onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
                title="Report"
            >
                <Flag size={16} strokeWidth={1.8} />
            </button>

            {open && (
                <div
                    className="absolute right-0 top-full mt-1 w-48 rounded-[14px] border border-[var(--mt-border)] bg-[var(--mt-surface)] shadow-[var(--mt-shadow-lg)] py-1.5 z-50"
                    onClick={(e) => e.stopPropagation()}
                >
                    {REASONS.map((reason) => (
                        <button
                            key={reason}
                            type="button"
                            disabled={submitting}
                            className="w-full text-left px-3.5 py-2 text-[13px] text-[var(--mt-ink)] hover:bg-[var(--mt-sunken)] disabled:opacity-50"
                            onClick={() => submitReport(reason)}
                        >
                            {reason}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
