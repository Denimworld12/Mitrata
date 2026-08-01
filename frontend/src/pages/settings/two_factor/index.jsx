import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useDispatch, useSelector } from 'react-redux';
import DashboardLayout from '@/layout/DashboardLayout';
import PasswordInput from '@/Components/ui/PasswordInput';
import BlastLoader from '@/Components/ui/BlastLoader';
import { useToast } from '@/Components/Toast';
import { getTwoFactorStatus, setupTwoFactor, verifyTwoFactorSetup, disableTwoFactor } from '@/config/redux/action/authAction';
import { ChevronLeft, ShieldCheck, Copy } from 'lucide-react';
import styles from '../../help_support/delete_account/DeleteAccount.module.css';

export default function TwoFactorPage() {
    const router = useRouter();
    const dispatch = useDispatch();
    const toast = useToast();
    const { user, twoFactorEnabled } = useSelector((state) => state.auth);
    const hasPassword = !user?.userId?.googleId;

    const [loaded, setLoaded] = useState(false);
    const [setupData, setSetupData] = useState(null); // { secret, qrCodeDataUrl }
    const [code, setCode] = useState('');
    const [backupCodes, setBackupCodes] = useState(null);
    const [password, setPassword] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        dispatch(getTwoFactorStatus()).finally(() => setLoaded(true));
    }, [dispatch]);

    const handleStartSetup = async () => {
        setBusy(true);
        const result = await dispatch(setupTwoFactor());
        setBusy(false);
        if (setupTwoFactor.fulfilled.match(result)) {
            setSetupData(result.payload);
        } else {
            toast.error(result.payload?.message || 'Failed to start setup');
        }
    };

    const handleConfirm = async () => {
        setBusy(true);
        const result = await dispatch(verifyTwoFactorSetup(code));
        setBusy(false);
        if (verifyTwoFactorSetup.fulfilled.match(result)) {
            setBackupCodes(result.payload.backupCodes);
            setSetupData(null);
            setCode('');
            toast.success('Two-step verification enabled');
        } else {
            toast.error(result.payload?.message || 'Invalid code');
        }
    };

    const handleDisable = async () => {
        if (!window.confirm('Turn off two-step verification for your account?')) return;
        setBusy(true);
        const result = await dispatch(disableTwoFactor(password));
        setBusy(false);
        if (disableTwoFactor.fulfilled.match(result)) {
            setPassword('');
            toast.success('Two-step verification disabled');
        } else {
            toast.error(result.payload?.message || 'Failed to disable');
        }
    };

    return (
        <DashboardLayout>
            <div className={styles.container}>
                <button className={styles.backBtn} onClick={() => router.push('/settings')}>
                    <ChevronLeft className={styles.backIcon} />
                    Back to Settings
                </button>

                <div className={styles.iconBadge} style={{ background: 'var(--mt-grad-soft)', color: 'var(--mt-accent, #0447ff)' }}>
                    <ShieldCheck size={26} strokeWidth={1.8} />
                </div>
                <h1 className={styles.title}>Two-step verification</h1>
                <p className={styles.sub}>
                    Adds a second step at login using a code from an authenticator app (Google Authenticator, Authy, 1Password, etc.), on top of your password.
                </p>

                {!loaded ? (
                    <div className="w-full flex items-center justify-center py-12"><BlastLoader size={48} /></div>
                ) : backupCodes ? (
                    <div className={styles.formCard}>
                        <h3 style={{ margin: '0 0 8px', fontSize: 14, color: 'var(--mt-ink)' }}>Save your backup codes</h3>
                        <p className={styles.sub} style={{ margin: '0 0 14px' }}>
                            Each code works once, if you ever lose access to your authenticator. Store them somewhere safe — this is the only time they're shown.
                        </p>
                        <div style={{
                            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px',
                            fontFamily: 'monospace', fontSize: 14, background: 'var(--mt-canvas)',
                            border: '1px solid var(--mt-border)', borderRadius: 10, padding: 16, marginBottom: 16
                        }}>
                            {backupCodes.map((c) => <span key={c}>{c}</span>)}
                        </div>
                        <button
                            className={styles.deleteBtn}
                            style={{ background: 'var(--mt-grad)' }}
                            onClick={() => router.push('/settings')}
                        >
                            Done
                        </button>
                    </div>
                ) : twoFactorEnabled ? (
                    <div className={styles.formCard}>
                        <p style={{ margin: '0 0 16px', fontSize: 13.5, color: 'var(--mt-ink)' }}>
                            Two-step verification is <strong>on</strong> for your account.
                        </p>
                        {hasPassword && (
                            <>
                                <label className={styles.modalLabel}>Enter your password to turn it off</label>
                                <PasswordInput
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className={styles.modalInput}
                                />
                            </>
                        )}
                        <button
                            className={styles.deleteBtn}
                            onClick={handleDisable}
                            disabled={busy || (hasPassword && !password)}
                        >
                            {busy ? 'Turning off…' : 'Turn off two-step verification'}
                        </button>
                    </div>
                ) : setupData ? (
                    <div className={styles.formCard}>
                        <p style={{ margin: '0 0 12px', fontSize: 13.5, color: 'var(--mt-ink)' }}>
                            Scan this in your authenticator app:
                        </p>
                        <img src={setupData.qrCodeDataUrl} alt="2FA QR code" style={{ width: 180, height: 180, display: 'block', margin: '0 auto 14px' }} />
                        <p className={styles.sub} style={{ textAlign: 'center', marginBottom: 4 }}>Or enter this key manually:</p>
                        <p style={{
                            fontFamily: 'monospace', fontSize: 13, textAlign: 'center', wordBreak: 'break-all',
                            background: 'var(--mt-canvas)', border: '1px solid var(--mt-border)', borderRadius: 8, padding: 10, marginBottom: 18
                        }}>
                            {setupData.secret}
                        </p>
                        <label className={styles.modalLabel}>Enter the 6-digit code it shows</label>
                        <input
                            value={code}
                            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            type="text"
                            inputMode="numeric"
                            placeholder="000000"
                            className={styles.modalInput}
                            style={{ textAlign: 'center', fontSize: '1.2rem', letterSpacing: '0.3em' }}
                        />
                        <button
                            className={styles.deleteBtn}
                            style={{ background: 'var(--mt-grad)' }}
                            onClick={handleConfirm}
                            disabled={busy || code.length !== 6}
                        >
                            {busy ? 'Verifying…' : 'Confirm and enable'}
                        </button>
                    </div>
                ) : (
                    <div className={styles.formCard}>
                        <p style={{ margin: '0 0 16px', fontSize: 13.5, color: 'var(--mt-ink2)' }}>
                            Two-step verification is currently off.
                        </p>
                        <button
                            className={styles.deleteBtn}
                            style={{ background: 'var(--mt-grad)' }}
                            onClick={handleStartSetup}
                            disabled={busy}
                        >
                            {busy ? 'Starting…' : 'Set up two-step verification'}
                        </button>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
