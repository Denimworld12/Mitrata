import { getAllUser } from '@/config/redux/action/authAction';
import DashboardLayout from '@/layout/DashboardLayout';
import UserLayout from '@/layout/userLayout';
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import styles from './index.module.css';
import { Base_Url } from '@/config';
import { useRouter } from 'next/router';

export default function Search() {
    const dispatch = useDispatch();
    const authState = useSelector((state) => state.auth);
    const router = useRouter()
    const [searchTerm, setSearchTerm] = useState('');

    // Fetch all users once
    useEffect(() => {
        if (!authState.all_profile_fetched) {
            dispatch(getAllUser({ token: localStorage.getItem("token") }));
        }
    }, [authState.all_profile_fetched]);

    // Filter users based on search input
    const filteredUsers = authState.all_user?.filter((item) => {
        const name = item?.userId?.name?.toLowerCase() || "";
        const username = item?.userId?.username?.toLowerCase() || "";

        return (
            name.includes(searchTerm.toLowerCase()) ||
            username.includes(searchTerm.toLowerCase())
        );
    }) || [];

    return (
        <UserLayout>
            <DashboardLayout>

                {/* ✔ Search Bar Component */}
                <div className={styles.searchBarContainer}>
                    <input
                        type="text"
                        placeholder="Search users by name or username..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className={styles.searchInput}
                    />
                    {/* Search Icon SVG */}
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={styles.searchIcon}>
                        <path fillRule="evenodd" d="M10.5 3.75a6.75 6.75 0 1 0 0 13.5 6.75 6.75 0 0 0 0-13.5ZM2.25 10.5a8.25 8.25 0 1 1 14.59 5.28l4.61 4.61a.75.75 0 1 1-1.06 1.06l-4.6-4.6A8.25 8.25 0 0 1 2.25 10.5Z" clipRule="evenodd" />
                    </svg>
                </div>
                {/* ✔ Show Users */}
                {filteredUsers.length > 0 ? (
                    filteredUsers.map((user) => (
                        <div
                        onClick={()=>{
                            router.push('/view_profile/'+user.userId?.username)
                        }}
                            key={user.userId?._id || user._id}
                            className={styles.userCard}
                        >
                            <img
                                src={`${Base_Url}/${user.userId?.profilePicture}`}
                                alt={`${user.userId?.username}`}
                                className={styles.userProfilePicture}
                            />

                            <div className={styles.userInfo}>
                                <p className={styles.userName}>
                                    {user.userId?.name || "No Name"}
                                </p>
                                <span className={styles.userUsername}>
                                    @{user.userId?.username}
                                </span>
                            </div>

                            <button className={styles.actionButton}>
                                View Profile
                            </button>
                        </div>
                    ))
                ) : (
                    <p className={styles.noResultsText}>No users found</p>
                )}

            </DashboardLayout>
        </UserLayout>
    );
}
