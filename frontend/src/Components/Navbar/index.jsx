import React, { useDebugValue, useEffect, useState } from 'react'
import styles from './styles.module.css'

import { useRouter } from 'next/router'
import { useDispatch, useSelector } from 'react-redux';
import { getAboutUser } from '@/config/redux/action/authAction';
import { reset, setTokenNotThere, setTokenThere } from '@/config/redux/reducer/authReducer';

export default function Navbar() {
    const router = useRouter();
    const dispatch = useDispatch();
    const authState = useSelector((state) => state.auth);
    // const [isloggedIn, setToken] = React.useState(false)
    useEffect(() => {
        const token = localStorage.getItem("token");

        if (token) {
            // CRITICAL CHANGE: Always dispatch setTokenThere/setTokenNotThere.
            // This is a synchronous action that should update authState.isTokenThere.
            dispatch(setTokenThere()); 

            // FIX: Always start fetching user data if the token exists.
            // We use the local token value here to ensure the action is dispatched.
            // We removed the `if (!authState.user)` check to force the refresh on reload.
            dispatch(getAboutUser({ token })); 
            
        } else {
            // If no token, set token state to not present and reset user data.
            dispatch(setTokenNotThere());
            dispatch(reset()); 
            // Optional: If this is a component visible on public pages, DO NOT redirect.
            // If this is part of a protected layout, you might need to redirect in the parent/layout component.
        }
    }, [dispatch]);

    // const isloggedIn = authState.loggedIn;

    return (
        <div className={styles.container}>
            <nav className={styles.navbar}>
                <h1 onClick={() => router.push("/")}>Mitrata</h1>

                <div className={styles.navbarOptionContainer}>
                    {authState.loggedIn ? (
                        <div className={styles.namePallet}>
                            <div>
                                Hey! {authState.user?.userId?.name
                                    ?.split(" ")[0]
                                    ?.toLowerCase()
                                    ?.replace(/^\w/, c => c.toUpperCase())
                                    || ""}
                            </div>
                            <div
                                onClick={() => router.push("/dashboard")}
                                className={styles.buttonJoin}
                            >
                                Profile
                            </div>
                            <div
                                onClick={() => {
                                    localStorage.removeItem('token')
                                    router.push("/login")
                                    dispatch(reset())
                                }}
                                className={styles.buttonJoin}
                            >
                                logout
                            </div>
                        </div>
                    ) : (

                        <div
                            onClick={() => router.push("/login")}
                            className={styles.buttonJoin}
                        >
                            Be a part / login
                        </div>
                    )}
                </div>


            </nav>
        </div>
    );
}
