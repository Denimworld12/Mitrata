import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useDispatch, useSelector } from 'react-redux';
import DashboardLayout from '@/layout/DashboardLayout';
import BlastLoader from '@/Components/ui/BlastLoader';
import EmptyState from '@/Components/ui/EmptyState';
import { useToast } from '@/Components/Toast';
import { getBlockedUsers, unblockUser } from '@/config/redux/action/authAction';
import { ChevronLeft, UserX } from 'lucide-react';
import styles from './BlockedAccounts.module.css';

export default function BlockedAccountsPage() {
    const router = useRouter();
    const dispatch = useDispatch();
    const toast = useToast();
    const { blockedUsers } = useSelector((state) => state.auth);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        dispatch(getBlockedUsers()).finally(() => setLoaded(true));
    }, [dispatch]);

    const handleUnblock = async (targetId) => {
        const result = await dispatch(unblockUser(targetId));
        if (unblockUser.fulfilled.match(result)) {
            toast.success('Account unblocked');
        } else {
            toast.error(result.payload?.message || 'Failed to unblock');
        }
    };

    return (
        <DashboardLayout>
            <div className={styles.container}>
                <button className={styles.backBtn} onClick={() => router.push('/settings')}>
                    <ChevronLeft className={styles.backIcon} />
                    Back to Settings
                </button>
                <h1 className={styles.title}>Blocked accounts</h1>

                {!loaded ? (
                    <div className="w-full flex items-center justify-center py-16">
                        <BlastLoader size={48} />
                    </div>
                ) : blockedUsers.length === 0 ? (
                    <EmptyState
                        icon={UserX}
                        title="No blocked accounts"
                        description="Accounts you block will show up here — you can unblock them anytime."
                    />
                ) : (
                    <div className={styles.group}>
                        {blockedUsers.map((u) => (
                            <div className={styles.row} key={u._id}>
                                <img src={u.profilePicture || '/default-avatar.svg'} alt="" className={styles.avatar} />
                                <div className={styles.info}>
                                    <h4>{u.name}</h4>
                                    <p>@{u.username}</p>
                                </div>
                                <button className={styles.unblockBtn} onClick={() => handleUnblock(u._id)}>
                                    Unblock
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
