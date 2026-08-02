import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { useSelector, useDispatch } from 'react-redux';
import DashboardLayout from '@/layout/DashboardLayout';
import { deleteAccount } from '@/config/redux/action/authAction/index';
import PasswordInput from '@/Components/ui/PasswordInput';
import { useToast } from '@/Components/Toast';
import { ChevronLeft, TriangleAlert } from 'lucide-react';
import styles from './DeleteAccount.module.css';

const DELETE_CONFIRM_WORD = 'DELETE';

// Moved out of the main Settings page, next to Logout — a permanent,
// irreversible action sitting one tap away from a routine one (logging out)
// is exactly the kind of thing a misclick lands on. Reaching this now takes
// a deliberate trip through Help & Support first, and this page itself adds
// one more explicit step (the checkbox) before the actual form is usable.
export default function DeleteAccountPage() {
    const router = useRouter();
    const dispatch = useDispatch();
    const toast = useToast();
    const { user } = useSelector((state) => state.auth);
    const [understood, setUnderstood] = useState(false);
    const [password, setPassword] = useState('');
    const [confirmText, setConfirmText] = useState('');
    const [deleting, setDeleting] = useState(false);

    const hasPassword = !user?.userId?.googleId && !user?.userId?.appleId;

    const handleDelete = async () => {
        if (confirmText !== DELETE_CONFIRM_WORD) return;
        setDeleting(true);
        const result = await dispatch(deleteAccount({ password }));
        setDeleting(false);
        if (deleteAccount.fulfilled.match(result)) {
            toast.success('Account permanently deleted');
            router.push('/login');
        } else {
            toast.error(result.payload?.message || 'Failed to delete account');
        }
    };

    return (
        <DashboardLayout>
            <div className={styles.container}>
                <button className={styles.backBtn} onClick={() => router.push('/help_support')}>
                    <ChevronLeft className={styles.backIcon} />
                    Back to Help & Support
                </button>

                <div className={styles.iconBadge}>
                    <TriangleAlert size={26} strokeWidth={1.8} />
                </div>
                <h1 className={styles.title}>Delete your account permanently</h1>
                <p className={styles.sub}>
                    This is irreversible. Please read what's below carefully before continuing.
                </p>

                <div className={styles.list}>
                    <h3>This permanently deletes</h3>
                    <ul>
                        <li>Your profile, bio, and photos</li>
                        <li>All your posts, comments, and reactions</li>
                        <li>Your messages and conversations</li>
                        <li>Your connections and pending requests</li>
                        <li>All uploaded media (images, videos, stories)</li>
                    </ul>
                </div>

                <div className={styles.formCard}>
                    <div className={styles.confirmRow}>
                        <input
                            type="checkbox"
                            id="understand"
                            checked={understood}
                            onChange={(e) => setUnderstood(e.target.checked)}
                        />
                        <label htmlFor="understand">
                            I understand this cannot be undone and my data cannot be recovered.
                        </label>
                    </div>

                    {understood && (
                        <>
                            {hasPassword && (
                                <>
                                    <label className={styles.modalLabel}>Enter your password</label>
                                    <PasswordInput
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className={styles.modalInput}
                                    />
                                </>
                            )}
                            <label className={styles.modalLabel}>
                                Type <strong>{DELETE_CONFIRM_WORD}</strong> to confirm
                            </label>
                            <input
                                type="text"
                                value={confirmText}
                                onChange={(e) => setConfirmText(e.target.value)}
                                className={styles.modalInput}
                            />
                            <button
                                className={styles.deleteBtn}
                                onClick={handleDelete}
                                disabled={deleting || confirmText !== DELETE_CONFIRM_WORD || (hasPassword && !password)}
                            >
                                {deleting ? 'Deleting…' : 'Delete my account permanently'}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}
