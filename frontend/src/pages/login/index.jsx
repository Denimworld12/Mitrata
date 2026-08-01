import UserLayout from '@/layout/userLayout'
import { useRouter } from 'next/router'
import React, { useEffect, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import styles from './styles.module.css'
import { loginUser, registerUser, verifyOtp, resendOtp, switchAccountAction, getAboutUser, verifyTwoFactorLogin } from '@/config/redux/action/authAction'
import { emptyMessage } from '@/config/redux/reducer/authReducer'
import { getSavedAccounts } from '@/config/savedAccounts'
import Button from '@/Components/ui/Button'
import PasswordInput from '@/Components/ui/PasswordInput'
import GoogleLoginButton from '@/Components/ui/GoogleLoginButton'
import PageLoader from '@/Components/ui/PageLoader'

const RESEND_COOLDOWN_S = 60;

function LoginComponent() {
  const authState = useSelector((state) => state.auth);
  const router = useRouter();
  const dispatch = useDispatch();

  const [userLoginMethod, setUserLoginMethod] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  // Landing here from "Add another account" (or just visiting /login with no
  // explicit target) shouldn't strand you — if there's a still-valid session
  // for an account on this browser, offer to jump straight back into it
  // instead of only ever showing a blank sign-in form.
  const [savedAccounts, setSavedAccounts] = useState([]);
  const [showChooser, setShowChooser] = useState(false);
  const [switchingAccountId, setSwitchingAccountId] = useState(null);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [usernameError, setUsernameError] = useState("");

  // Set once registration succeeds (or an unverified account tries to log
  // in) — switches the whole form over to the OTP-entry screen below.
  const [verifyingEmail, setVerifyingEmail] = useState(null);
  const [otp, setOtp] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const resendTimerRef = useRef(null);
  const [twoFactorCode, setTwoFactorCode] = useState("");

  useEffect(() => {
    if (resendIn <= 0) return;
    resendTimerRef.current = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(resendTimerRef.current);
  }, [resendIn]);

  // Google sign-in now completes via a full-page redirect (see
  // GoogleLoginButton) rather than a popup, so the result lands here as
  // query params instead of a JS callback.
  const [googleAuthError, setGoogleAuthError] = useState(false);
  useEffect(() => {
    if (!router.isReady) return;
    if (router.query.googleToken) {
      localStorage.setItem("token", String(router.query.googleToken));
      localStorage.removeItem("recentSearches");
      dispatch(getAboutUser());
      router.replace('/dashboard');
    } else if (router.query.googleError) {
      setGoogleAuthError(true);
      router.replace('/login', undefined, { shallow: true });
    }
  }, [router.isReady, router.query.googleToken, router.query.googleError]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      router.replace('/dashboard');
    } else {
      setIsChecking(false);
    }
  }, []);

  // Arriving from the sidebar's "switch account" — prefill the picked
  // account's email straight into sign-in mode instead of the signup form.
  // With no specific target (e.g. plain "Add another account", or just
  // landing here directly), show the account chooser instead when there's
  // at least one still-possibly-valid saved session to offer.
  useEffect(() => {
    if (!router.isReady) return;
    if (router.query.email) {
      setEmail(String(router.query.email));
      setUserLoginMethod(true);
      setShowChooser(false);
      return;
    }
    const accounts = getSavedAccounts();
    setSavedAccounts(accounts);
    setShowChooser(accounts.length > 0);
  }, [router.isReady, router.query.email]);

  const handleChooserSwitch = async (acc) => {
    setSwitchingAccountId(acc.userId);
    const result = await dispatch(switchAccountAction({ userId: acc.userId }));
    setSwitchingAccountId(null);
    if (switchAccountAction.fulfilled.match(result)) {
      // Full reload, not a client-side push — see the identical note in
      // DashboardLayout's handleSwitchAccount for why.
      window.location.href = '/dashboard';
    } else {
      // That account's session actually expired — fall through to a normal,
      // prefilled sign-in instead of leaving them stuck.
      setEmail(acc.email);
      setUserLoginMethod(true);
      setShowChooser(false);
    }
  };

  useEffect(() => {
    dispatch(emptyMessage());
    setUsernameError(""); 
  }, [userLoginMethod, dispatch]);

  const handleLogin = async () => {
    const result = await dispatch(loginUser({ email, password }));
    if (loginUser.fulfilled.match(result) && !result.payload?.requires2FA) {
      router.push('/dashboard');
    } else if (result.payload?.needsVerification) {
      // Account exists but was never OTP-verified (e.g. they closed the tab
      // right after signing up) — send them to the same verify screen
      // instead of leaving them stuck on a "please verify" error message.
      setVerifyingEmail(result.payload.email || email);
      setResendIn(RESEND_COOLDOWN_S);
    }
  };

  /**
   * STRICT USERNAME VALIDATION
   * 1. Prevents spaces from being typed.
   * 2. Removes spaces on paste.
   * 3. Sets an error message for the user.
   */
  const onUsernameChange = (e) => {
    const val = e.target.value;
    
    // Check if the input contains any whitespace
    if (/\s/g.test(val)) {
      setUsernameError("Usernames cannot contain spaces.");
    } else {
      setUsernameError("");
    }

    // Strictly remove all spaces immediately
    const sanitizedValue = val.replace(/\s/g, "");
    setUsername(sanitizedValue);
  };

  const handleVerifyTwoFactor = async () => {
    const result = await dispatch(verifyTwoFactorLogin({
      challengeToken: authState.twoFactorChallengeToken,
      code: twoFactorCode
    }));
    if (verifyTwoFactorLogin.fulfilled.match(result)) {
      router.push('/dashboard');
    }
  };

  const handleRegister = async () => {
    // Final defensive check
    if (!username) {
      setUsernameError("Username is required.");
      return;
    }

    const result = await dispatch(registerUser({ username, name, email, password }));
    if (registerUser.fulfilled.match(result)) {
      setVerifyingEmail(email);
      setResendIn(RESEND_COOLDOWN_S);
    }
  };

  const handleVerifyOtp = async () => {
    const result = await dispatch(verifyOtp({ email: verifyingEmail, otp, purpose: 'signup' }));
    if (verifyOtp.fulfilled.match(result)) {
      router.push('/dashboard');
    }
  };

  const handleResendOtp = async () => {
    if (resendIn > 0) return;
    const result = await dispatch(resendOtp({ email: verifyingEmail, purpose: 'signup' }));
    if (resendOtp.fulfilled.match(result)) {
      setResendIn(RESEND_COOLDOWN_S);
    }
  };

  if (isChecking) return <PageLoader />;

  return (
    <UserLayout>
      <div className={styles.container}>
        <div className={styles.cardContainer}>
          <div className={styles.cardContainer_left}>
            <p className={styles.cardHeading}>
              {authState.requires2FA ? 'Two-step verification' : verifyingEmail ? 'Verify your email' : showChooser ? 'Choose an account' : (userLoginMethod ? 'SignIn' : 'Signup')}
            </p>

            {/* General API Status Messages */}
            {authState.message && (
              <div className={`text-sm mb-2.5 font-medium ${authState.isError ? 'text-danger' : 'text-success'}`}>
                {authState.message}
              </div>
            )}
            {googleAuthError && (
              <div className="text-sm mb-2.5 font-medium text-danger">
                Google sign-in failed. Please try again.
              </div>
            )}

            {/* Error specifically for Spaces */}
            {usernameError && !userLoginMethod && !verifyingEmail && (
               <div className="text-danger px-2.5 py-2 rounded-sm text-xs mb-2.5 border" style={{ background: 'var(--mt-grad-soft)', borderColor: 'var(--mt-danger)' }}>
                 {usernameError}
               </div>
            )}

            {authState.requires2FA ? (
              <div className={styles.inputContainer}>
                <p className="text-sm mb-3" style={{ color: 'var(--mt-ink2)' }}>
                  Enter the 6-digit code from your authenticator app, or one of your backup codes.
                </p>
                <input
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value.slice(0, 12))}
                  type="text"
                  inputMode="numeric"
                  placeholder="000000"
                  maxLength={12}
                  autoFocus
                  className={styles.inputField}
                  style={{ textAlign: 'center', fontSize: '1.4rem', letterSpacing: '0.2em' }}
                />

                <Button
                  onClick={handleVerifyTwoFactor}
                  className="w-full mt-3 !rounded-full !py-3.5 !text-base"
                  loading={authState.isLoading}
                  disabled={twoFactorCode.length < 6}
                >
                  Verify
                </Button>
              </div>
            ) : showChooser && !verifyingEmail ? (
              <div className={styles.inputContainer}>
                {savedAccounts.map((acc) => (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => !switchingAccountId && handleChooserSwitch(acc)}
                    disabled={!!switchingAccountId}
                    className={styles.accountChoice}
                  >
                    <img
                      src={acc.profilePicture || '/default-avatar.svg'}
                      alt=""
                      className={styles.accountChoiceAvatar}
                    />
                    <div className={styles.accountChoiceInfo}>
                      <p className={styles.accountChoiceName}>{acc.name}</p>
                      <span className={styles.accountChoiceEmail}>
                        {switchingAccountId === acc.userId ? 'Signing in…' : acc.email}
                      </span>
                    </div>
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => setShowChooser(false)}
                  className={styles.accountChoiceOther}
                  disabled={!!switchingAccountId}
                >
                  + Use another account
                </button>
              </div>
            ) : verifyingEmail ? (
              <div className={styles.inputContainer}>
                <p className="text-sm mb-3" style={{ color: 'var(--mt-ink2)' }}>
                  We sent a 6-digit code to <strong>{verifyingEmail}</strong>
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

                <Button
                  onClick={handleVerifyOtp}
                  className="w-full mt-3 !rounded-full !py-3.5 !text-base"
                  loading={authState.isLoading}
                  disabled={otp.length !== 6}
                >
                  Verify
                </Button>

                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendIn > 0}
                  className="text-sm mt-3"
                  style={{ background: 'none', border: 'none', cursor: resendIn > 0 ? 'default' : 'pointer', color: resendIn > 0 ? 'var(--mt-ink3)' : 'var(--mt-accent, #0447ff)' }}
                >
                  {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
                </button>

                <button
                  type="button"
                  onClick={() => { setVerifyingEmail(null); setOtp(""); dispatch(emptyMessage()); }}
                  className="text-sm mt-2"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mt-ink3)' }}
                >
                  Use a different email
                </button>
              </div>
            ) : (
            <div className={styles.inputContainer}>
              {!userLoginMethod && (
                <div className={styles.inputRow}>
                  <input
                    value={username}
                    onChange={onUsernameChange}
                    type="text"
                    placeholder="Username"
                    className={`${styles.inputField} ${usernameError ? styles.inputError : ''}`}
                  />
                  <input onChange={(e) => setName(e.target.value)} type="text" placeholder="Name" className={styles.inputField} />
                </div>
              )}
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="text" placeholder="Email" className={styles.inputField} />
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className={styles.inputField}
              />

              {userLoginMethod && (
                <div style={{ textAlign: 'right', marginTop: '2px' }}>
                  <span
                    onClick={() => router.push('/forgot-password')}
                    className="text-sm"
                    style={{ cursor: 'pointer', color: 'var(--mt-ink3)' }}
                  >
                    Forgot password?
                  </span>
                </div>
              )}

              <Button
                onClick={() => userLoginMethod ? handleLogin() : handleRegister()}
                className="w-full mt-3 !rounded-full !py-3.5 !text-base"
                loading={authState.isLoading}
                // Disable button if there is a space error
                disabled={!!usernameError && !userLoginMethod}
              >
                {userLoginMethod ? 'SignIn' : 'Signup'}
              </Button>

              <div className="flex items-center gap-3 my-3 text-xs text-gray-400">
                <span className="flex-1 h-px bg-gray-200" />
                or
                <span className="flex-1 h-px bg-gray-200" />
              </div>

              <GoogleLoginButton />
            </div>
            )}
          </div>

          <div className={styles.cardContainer_right}>
            <img src="/brand/orb-violet.png" alt="" className={styles.rightOrb} />
            <div className={styles.rightContent}>
              <span className={styles.rightLogo} role="img" aria-label="Mitrata" />
              {!showChooser && !verifyingEmail && !authState.requires2FA && (
                <>
                  <span>{userLoginMethod ? 'Create an account? ' : 'Already have an account? '}</span>
                  <span
                    onClick={() => setUserLoginMethod(!userLoginMethod)}
                    className={styles.accButton}>
                    {userLoginMethod ? 'Signup' : 'SignIn'}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </UserLayout>
  )
}

export default LoginComponent