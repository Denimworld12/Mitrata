import UserLayout from '@/layout/userLayout'
import { useRouter } from 'next/router'
import React, { use, useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import styles from './styles.module.css'
import { loginUser, registerUser } from '@/config/redux/action/authAction'
import { UNSTABLE_REVALIDATE_RENAME_ERROR } from 'next/dist/lib/constants'
import { emptyMessage } from '@/config/redux/reducer/authReducer'
function LoginComponent() {
  const authState = useSelector((state) => state.auth)
  const router = useRouter()
  // CONSOLE_LOGGER('authState on login page', authState)
  const [userLoginMethod, setUserLoginMethod] = useState(false)

  useEffect(() => {
    if (authState.loggedIn) {
      router.push('/dashboard')
    }
  }, [authState.loggedIn])

  useEffect(() => {
    console.log("Auth State Changed:", authState);
    emptyMessage();
  }, [userLoginMethod]);

  useEffect(() => {
    if (localStorage.getItem("token")) {
      router.push('/dashboard')
    }
  }, [])

  const dispatch = useDispatch();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");

  const handleRegister = () => {
    console.log("register clicked");
    console.log({ username, name, email, password }); // log user input

    dispatch(registerUser({
      username,
      name,
      email,
      password
    }))
  }

  const handleLogin = () => {
    console.log("login clicked");
    dispatch(loginUser({
      email,
      password
    }))
  }

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