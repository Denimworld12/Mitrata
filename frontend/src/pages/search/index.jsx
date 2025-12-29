import { getAllUser } from '@/config/redux/action/authAction';
import DashboardLayout from '@/layout/DashboardLayout';
import UserLayout from '@/layout/userLayout';
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import styles from './index.module.css';
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
    // Filter users based on search input AND exclude current user
    // Filter users based on search input AND exclude current user
const filteredUsers = authState.all_user?.filter((item) => {
    // 1. Get IDs safely
    const loggedInId = authState.user?.userId?._id || authState.user?._id;
    const itemUserId = item?.userId?._id;

    // 2. Double Check: Exclude by ID OR by Username (Extra Safe)
    const isMe = (itemUserId === loggedInId) || (item?.userId?.username === authState.user?.userId?.username);

    if (isMe) return false; 

    // 3. Search Logic
    const name = item?.userId?.name?.toLowerCase() || "";
    const username = item?.userId?.username?.toLowerCase() || "";
    const search = searchTerm.toLowerCase();

    return name.includes(search) || username.includes(search);
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
                            onClick={() => {
                                router.push('/view_profile/' + user.userId?.username)
                            }}
                            key={user.userId?._id || user._id}
                            className={styles.userCard}
                        >
                            <img
                                src={user.userId?.profilePicture || "/default-avatar.png"}
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
