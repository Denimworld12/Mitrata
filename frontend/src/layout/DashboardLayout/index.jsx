import React, { useEffect } from 'react'
import styles from "./styles.module.css"
import { useRouter } from 'next/router'
import { useDispatch, useSelector } from 'react-redux';
import {  setTokenThere } from '@/config/redux/reducer/authReducer';
import { getAllPosts } from '@/config/redux/action/postAction';
import { getAllUser } from '@/config/redux/action/authAction';
import { Base_Url } from '@/config';
export default function DashboardLayout({ children }) {
    const router = useRouter();
    const dispatch = useDispatch();
    const authState = useSelector((state) => state.auth)
    useEffect(() => {
        if (!localStorage.getItem("token")) {
            router.push('/login')
            return;
        }
        dispatch(getAllPosts());
        dispatch(setTokenThere())
        dispatch(getAllUser({ token: localStorage.getItem("token") }))
    }, []);

    // useEffect(() => {
    //     if (authState.isTokenThere) {
    //        
    //         dispatch(getAboutUser({ token: localStorage.getItem("token") }))
    //     }
    // }, [authState.isTokenThere])
    // console.log(authState.user) 
    return (
        <div className="container">
            <div className={styles.homeContainer} >
                <div className={styles.homeContainer_leftBar}>

                    <div className={styles.SideOptions}
                        onClick={() => router.push("/dashboard")}>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                        </svg>

                        <div className={styles.optionName}>Home</div>
                    </div>

                    <div className={styles.SideOptions}
                        onClick={() => router.push("/search")}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="size-4">
                            <path fillRule="evenodd" d="M9.965 11.026a5 5 0 1 1 1.06-1.06l2.755 2.754a.75.75 0 1 1-1.06 1.06l-2.755-2.754ZM10.5 7a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z" clipRule="evenodd" />
                        </svg>


                        <div className={styles.optionName}>Search</div>
                    </div>

                    <div className={styles.SideOptions}
                        onClick={() => router.push("/my_network")}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" data-supported-dps="24x24" fill="currentColor" class="mercado-match" width="24" height="24" focusable="false">
                            <path d="M12 16v6H3v-6a3 3 0 013-3h3a3 3 0 013 3zm5.5-3A3.5 3.5 0 1014 9.5a3.5 3.5 0 003.5 3.5zm1 2h-2a2.5 2.5 0 00-2.5 2.5V22h7v-4.5a2.5 2.5 0 00-2.5-2.5zM7.5 2A4.5 4.5 0 1012 6.5 4.49 4.49 0 007.5 2z"></path>
                        </svg>


                        <div className={styles.optionName}>My Network</div>
                    </div>
                </div>



                <div className={styles.homeContainer_feedContainer}>
                    {children}
                </div>
                <div className={styles.homeContainer_extraContainer}>
                    <h3>Top Profiles</h3>
                    {authState.all_profile_fetched && authState.all_user &&
                        authState.all_user.slice(0, 5).map((profile) => {
                            return (
                                <div key={profile._id} className={styles.topProfileCard}>

                                    <img
                                        src={profile.userId?.profilePicture
                                            ? `${Base_Url}/${profile.userId.profilePicture}`
                                            : "/default-avatar.png"}
                                        alt="profile"
                                        className={styles.topProfileImg}
                                    />

                                    <div className={styles.topProfileInfo}>
                                        <p className={styles.topProfileName}>
                                            {profile.userId?.name}
                                        </p>
                                        <span className={styles.topProfileUsername}>
                                            @{profile.userId?.username}
                                        </span>
                                    </div>

                                </div>
                            );
                        })
                    }

                </div>
            </div>

        </div>
    )
}
