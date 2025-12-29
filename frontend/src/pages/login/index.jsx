import UserLayout from '@/layout/userLayout'
import { useRouter } from 'next/router'
import React, {  useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import styles from './styles.module.css'
import { loginUser, registerUser } from '@/config/redux/action/authAction'
import { emptyMessage } from '@/config/redux/reducer/authReducer'
function LoginComponent() {
  const authState = useSelector((state) => state.auth);
  const router = useRouter();
  const dispatch = useDispatch();

  const [userLoginMethod, setUserLoginMethod] = useState(false);
  const [isChecking, setIsChecking] = useState(true); // New: prevents form flicker

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");

  // EFFECT 1: Run once on mount to check if user is already authenticated
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      router.replace('/dashboard'); // Use replace to prevent "Back" button loop
    } else {
      setIsChecking(false); // Only show the UI if no token exists
    }
  }, []);

  // EFFECT 2: Reset error messages when switching between Login and Signup
  useEffect(() => {
    dispatch(emptyMessage());
  }, [userLoginMethod, dispatch]);

  // HANDLER: Login with immediate navigation
  const handleLogin = async () => {
    const result = await dispatch(loginUser({ email, password }));
    // If login is successful, jump to dashboard immediately 
    // instead of waiting for another useEffect to fire
    if (loginUser.fulfilled.match(result)) {
      router.push('/dashboard');
    }
  };

  const handleRegister = async () => {
    const result = await dispatch(registerUser({ username, name, email, password }));
    if (registerUser.fulfilled.match(result)) {
      // If registration auto-logs in, go to dashboard. 
      // If not, switch to login view.
      setUserLoginMethod(true);
    }
  };

  // Hide everything while checking localStorage to make it feel fast
  if (isChecking) return null;
  return (
    <UserLayout>
      <div className={styles.container}>
        <div className={styles.cardContainer}>
          <div className={styles.cardContainer_left}>
            <p className={styles.cardHeading}>{userLoginMethod ? 'SignIn' : 'Signup'}</p>
            {authState.message && (
              <div style={{ color: authState.isError ? "red" : "green" }}>
                {authState.message}
              </div>
            )}

            <div className={styles.inputContainer}>
             {!userLoginMethod && (
               <div className={styles.inputRow} >
                <input onChange={(e) => setUsername(e.target.value)} type="text" placeholder="Username" className={styles.inputField} />
                <input onChange={(e) => setName(e.target.value)} type="text" placeholder="Name" className={styles.inputField} />
              </div>
              )}
              <input onChange={(e) => setEmail(e.target.value)} type="text" placeholder="Email" className={styles.inputField} />

              <input onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Password" className={styles.inputField} />

              <button
                onClick={(e) => {
                  if (userLoginMethod) {
                    console.log("login clicked");
                    handleLogin();
                  } else {
                    console.log("register clicked");
                    handleRegister();
                  }
                }}
                className={styles.buttonWithOutline}>
                {userLoginMethod ? 'SignIn' : 'Signup'}
              </button>
            </div>
          </div>

          <div className={styles.cardContainer_right}>
            {userLoginMethod ? 'Create an account? ' : 'Already have an account? '}
            <span
              onClick={() => setUserLoginMethod(!userLoginMethod)}
              className={styles.accButton}
              style={{ color: "blue", cursor: "pointer" }}>
              {userLoginMethod ? 'Signup' : 'SignIn'}
            </span>
          </div>

        </div>
      </div>
    </UserLayout>
  )
}

export default LoginComponent