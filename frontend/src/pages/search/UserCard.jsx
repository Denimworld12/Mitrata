import React from 'react';
import styles from './index.module.css'; // Adjust path if components directory is nested
import { Base_Url } from '@/config'; // Assuming Base_Url is accessible

export default function UserCard({ user }) {
    const profilePicUrl = user.profilePicture 
        ? `${Base_Url}/${user.profilePicture}` 
        : '/default.png'; // Use a fallback path

    return (
        <div className={styles.userCard}>
            <img 
                src={profilePicUrl} 
                alt={`${user.username}'s profile`} 
                className={styles.userProfilePicture}
            />
            <div className={styles.userInfo}>
                <p className={styles.userName}>{user.name || 'No Name'}</p>
                <span className={styles.userUsername}>@{user.username}</span>
            </div>
            
            {/* Example Action Button (e.g., Follow/View Profile) */}
            <button className={styles.actionButton}>
                View Profile
            </button>
        </div>
    );
}