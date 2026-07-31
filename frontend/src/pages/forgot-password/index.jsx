import UserLayout from '@/layout/userLayout'
import { useRouter } from 'next/router'
import React, { useEffect, useRef, useState } from 'react'
import { useDispatch } from 'react-redux'
import styles from '../login/styles.module.css'
import { sendOtp, resendOtp, verifyOtp, resetPasswordAction } from '@/config/redux/action/authAction'
import { useToast } from '@/Components/Toast'
import Button from '@/Components/ui/Button'
import PasswordInput from '@/Components/ui/PasswordInput'

const RESEND_COOLDOWN_S = 60;

// 3-step flow: email -> otp + new password -> done. Reuses the login page's
// card styling so it looks like the same product, not a bolted-on page.
export default function ForgotPassword() {
  const router = useRouter();
  const dispatch = useDispatch();
  const toast = useToast();

  const [step, setStep] = useState('email'); // email | reset | done
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendIn, setResendIn] = useState(0);
  const resendTimerRef = useRef(null);

  useEffect(() => {
    if (resendIn <= 0) return;
    resendTimerRef.current = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(resendTimerRef.current);
  }, [resendIn]);

  const handleSendCode = async () => {
    if (!email.trim()) return;
    setLoading(true);
    setError('');
    const result = await dispatch(sendOtp({ email: email.trim(), purpose: 'reset_password' }));
    setLoading(false);
    if (sendOtp.fulfilled.match(result)) {
      setStep('reset');
      setResendIn(RESEND_COOLDOWN_S);
    } else {
      setError(result.payload?.message || 'Failed to send code');
    }
  };

  const handleResend = async () => {
    if (resendIn > 0) return;
    const result = await dispatch(resendOtp({ email, purpose: 'reset_password' }));
    if (resendOtp.fulfilled.match(result)) setResendIn(RESEND_COOLDOWN_S);
  };

  const handleReset = async () => {
    if (otp.length !== 6) return setError('Enter the 6-digit code');
    if (newPassword.length < 8) return setError('Password must be at least 8 characters');
    if (newPassword !== confirmPassword) return setError('Passwords do not match');

    setLoading(true);
    setError('');
    const verifyResult = await dispatch(verifyOtp({ email, otp, purpose: 'reset_password' }));
    if (!verifyOtp.fulfilled.match(verifyResult)) {
      setLoading(false);
      return setError(verifyResult.payload?.message || 'Incorrect code');
    }

    const resetResult = await dispatch(resetPasswordAction({
      resetToken: verifyResult.payload.resetToken,
      newPassword
    }));
    setLoading(false);
    if (resetPasswordAction.fulfilled.match(resetResult)) {
      setStep('done');
      toast.success('Password reset — please sign in');
    } else {
      setError(resetResult.payload?.message || 'Reset failed');
    }
  };

  return (
    <UserLayout>
      <div className={styles.container}>
        <div className={styles.cardContainer}>
          <div className={styles.cardContainer_left}>
            <p className={styles.cardHeading}>
              {step === 'done' ? 'Password reset' : 'Reset your password'}
            </p>

            {error && (
              <div className="text-sm mb-2.5 font-medium text-danger">{error}</div>
            )}

            <div className={styles.inputContainer}>
              {step === 'email' && (
                <>
                  <p className="text-sm mb-3" style={{ color: 'var(--mt-ink2)' }}>
                    Enter the email on your account and we'll send you a reset code.
                  </p>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    placeholder="Email"
                    className={styles.inputField}
                  />
                  <Button
                    onClick={handleSendCode}
                    className="w-full mt-3 !rounded-full !py-3.5 !text-base"
                    loading={loading}
                    disabled={!email.trim()}
                  >
                    Send code
                  </Button>
                </>
              )}

              {step === 'reset' && (
                <>
                  <p className="text-sm mb-3" style={{ color: 'var(--mt-ink2)' }}>
                    Enter the code sent to <strong>{email}</strong> and choose a new password.
                  </p>
                  <input
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    type="text"
                    inputMode="numeric"
                    placeholder="000000"
                    maxLength={6}
                    className={styles.inputField}
                    style={{ textAlign: 'center', fontSize: '1.4rem', letterSpacing: '0.4em' }}
                  />
                  <PasswordInput
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="New password"
                    className={styles.inputField}
                  />
                  <PasswordInput
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className={styles.inputField}
                  />
                  <Button
                    onClick={handleReset}
                    className="w-full mt-3 !rounded-full !py-3.5 !text-base"
                    loading={loading}
                  >
                    Reset password
                  </Button>
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resendIn > 0}
                    className="text-sm mt-3"
                    style={{ background: 'none', border: 'none', cursor: resendIn > 0 ? 'default' : 'pointer', color: resendIn > 0 ? 'var(--mt-ink3)' : 'var(--mt-accent, #0447ff)' }}
                  >
                    {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
                  </button>
                </>
              )}

              {step === 'done' && (
                <>
                  <p className="text-sm mb-3" style={{ color: 'var(--mt-ink2)' }}>
                    Your password has been reset. You can now sign in with your new password.
                  </p>
                  <Button
                    onClick={() => router.push('/login')}
                    className="w-full mt-1 !rounded-full !py-3.5 !text-base"
                  >
                    Go to sign in
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className={styles.cardContainer_right}>
            <img src="/brand/orb-violet.png" alt="" className={styles.rightOrb} />
            <div className={styles.rightContent}>
              <span className={styles.rightLogo} role="img" aria-label="Mitrata" />
              <span>Remembered it?</span>
              <span onClick={() => router.push('/login')} className={styles.accButton}>
                Back to sign in
              </span>
            </div>
          </div>
        </div>
      </div>
    </UserLayout>
  );
}
