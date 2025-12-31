import UserLayout from '@/layout/userLayout'
import { useRouter } from 'next/router'
import React, { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import styles from './styles.module.css'
import { loginUser, registerUser } from '@/config/redux/action/authAction'
import { emptyMessage } from '@/config/redux/reducer/authReducer'

function LoginComponent() {
  const authState = useSelector((state) => state.auth);
  const router = useRouter();
  const dispatch = useDispatch();

  const [userLoginMethod, setUserLoginMethod] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [usernameError, setUsernameError] = useState(""); 

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      router.replace('/dashboard');
    } else {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    dispatch(emptyMessage());
    setUsernameError(""); 
  }, [userLoginMethod, dispatch]);

  const handleLogin = async () => {
    const result = await dispatch(loginUser({ email, password }));
    if (loginUser.fulfilled.match(result)) {
      router.push('/dashboard');
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

  const handleRegister = async () => {
    // Final defensive check
    if (!username) {
      setUsernameError("Username is required.");
      return;
    }

    const result = await dispatch(registerUser({ username, name, email, password }));
    if (registerUser.fulfilled.match(result)) {
      setUserLoginMethod(true);
    }
  };

  if (isChecking) return null;

  return (
    <UserLayout>
      <div className={styles.container}>
        <div className={styles.cardContainer}>
          <div className={styles.cardContainer_left}>
            <p className={styles.cardHeading}>{userLoginMethod ? 'SignIn' : 'Signup'}</p>
            
            {/* General API Status Messages */}
            {authState.message && (
              <div style={{ color: authState.isError ? "red" : "green", marginBottom: "10px" }}>
                {authState.message}
              </div>
            )}

            {/* Error specifically for Spaces */}
            {usernameError && !userLoginMethod && (
               <div style={{ 
                 background: '#fee2e2', 
                 color: '#b91c1c', 
                 padding: '8px', 
                 borderRadius: '4px', 
                 fontSize: '12px', 
                 marginBottom: '10px',
                 border: '1px solid #f87171' 
               }}>
                 ⚠️ {usernameError}
               </div>
            )}

            <div className={styles.inputContainer}>
              {!userLoginMethod && (
                <div className={styles.inputRow}>
                  <input 
                    value={username} 
                    onChange={onUsernameChange} 
                    type="text" 
                    placeholder="Username (No spaces)" 
                    className={`${styles.inputField} ${usernameError ? styles.inputError : ''}`} 
                  />
                  <input onChange={(e) => setName(e.target.value)} type="text" placeholder="Name" className={styles.inputField} />
                </div>
              )}
              <input onChange={(e) => setEmail(e.target.value)} type="text" placeholder="Email" className={styles.inputField} />
              <input onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Password" className={styles.inputField} />

              <button
                onClick={() => userLoginMethod ? handleLogin() : handleRegister()}
                className={styles.buttonWithOutline}
                // Disable button if there is a space error
                disabled={!!usernameError && !userLoginMethod}
              >
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