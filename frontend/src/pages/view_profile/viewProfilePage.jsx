// ... existing imports
import { downloadProfile } from '@/config/redux/action/authAction' // Ensure this is exported

export default function viewProfilePage({ userProfile }) {
    // ... existing state and effects

    const handleDownloadResume = async () => {
        try {
            // This calls your backend endpoint /user/download_profile?id=...
            const response = await clientServer.get(`/user/download_profile`, {
                params: { id: userProfile.userId._id }
            });
            if (response.data.file) {
                // Open the generated PDF in a new tab
                window.open(`${Base_Url}/${response.data.file}`, '_blank');
            }
        } catch (error) {
            console.error("Download failed", error);
            alert("Could not generate resume at this time.");
        }
    };

    return (
        <UserLayout>
            <div className={styles.container}>
                <div className={styles.coverWrapper}>
                    <div className={styles.backDropContainer}></div>
                    <img
                        className={styles.profileImage}
                        src={`${Base_Url}/${userProfile.userId?.profilePicture}`}
                        alt="profile"
                    />
                </div>

                <div className={styles.profileContentWrapper}>
                    <div className={styles.profileDetails}>
                        <div className={styles.profileDetails_userName}>
                            <div className={styles.profileNameDetails}>
                                <div className={styles.profileNameDetails_div}>
                                    <div className={styles.profileName}>
                                        <h2>{userProfile.userId.name}</h2>
                                    </div>
                                    <div className={styles.profileUsername}>
                                        <p>@{userProfile.userId.username}</p>
                                    </div>
                                    {/* NEW: Current Post Display */}
                                    {userProfile.currentPost && (
                                        <div className={styles.currentPost}>
                                            <p>{userProfile.currentPost}</p>
                                        </div>
                                    )}
                                </div>

                                <div className={styles.actionButtons}>
                                    {/* Connection Button */}
                                    {isCurrentUserInConnection ? (
                                        isConnectionNull ? (
                                            <button className={styles.pendingButton}>Pending</button>
                                        ) : (
                                            <button className={styles.connectedButton}>Connected</button>
                                        )
                                    ) : (
                                        <button className={styles.connectButton} onClick={() => {
                                            dispatch(sendConnectionRequest({
                                                token: localStorage.getItem('token'),
                                                connectionId: userProfile.userId._id
                                            }));
                                        }}>Connect</button>
                                    )}

                                    {/* NEW: Download Resume Button */}
                                    <button className={styles.resumeButton} onClick={handleDownloadResume}>
                                        Download Resume
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className={styles.profileBio}>
                            <h3>About</h3>
                            <p>{userProfile.bio || 'This user has not yet added a bio.'}</p>
                        </div>

                        {/* NEW: Experience Section */}
                        <div className={styles.infoSection}>
                            <h3>Experience</h3>
                            {userProfile.pastWork?.length > 0 ? (
                                userProfile.pastWork.map((work, index) => (
                                    <div key={index} className={styles.infoItem}>
                                        <h4>{work.position}</h4>
                                        <p>{work.company} • {work.years} years</p>
                                    </div>
                                ))
                            ) : <p className={styles.noDataText}>No experience added.</p>}
                        </div>

                        {/* NEW: Education Section */}
                        <div className={styles.infoSection}>
                            <h3>Education</h3>
                            {userProfile.education?.length > 0 ? (
                                userProfile.education.map((edu, index) => (
                                    <div key={index} className={styles.infoItem}>
                                        <h4>{edu.school}</h4>
                                        <p>{edu.degree} • {edu.fieldOfStudy}</p>
                                    </div>
                                ))
                            ) : <p className={styles.noDataText}>No education added.</p>}
                        </div>
                    </div>

                    <div className={styles.userActivitySidebar}>
                        {/* ... Existing sidebar code ... */}
                    </div>
                </div>
            </div>
        </UserLayout>
    )
}