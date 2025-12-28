import React, { useEffect, useState } from 'react'
import styles from './styles.module.css'
import { useRouter } from 'next/router'
import { useDispatch, useSelector } from 'react-redux';
import { getAboutUser } from '@/config/redux/action/authAction';
import { reset, setTokenNotThere, setTokenThere } from '@/config/redux/reducer/authReducer';
import { Base_Url } from '@/config';

export default function Navbar() {
    const router = useRouter();
    const dispatch = useDispatch();
    const authState = useSelector((state) => state.auth);
    
    // Scroll logic states
    const [prevScrollPos, setPrevScrollPos] = useState(0);
    const [visible, setVisible] = useState(true);
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            const currentScrollPos = window.pageYOffset;
            // Visible if scrolling up OR at the very top
            setVisible(prevScrollPos > currentScrollPos || currentScrollPos < 10);
            setPrevScrollPos(currentScrollPos);
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, [prevScrollPos]);

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (token) {
            dispatch(setTokenThere()); 
            dispatch(getAboutUser({ token })); 
        } else {
            dispatch(setTokenNotThere());
            dispatch(reset()); 
        }
    }, [dispatch]);

    const handleLogout = () => {
        localStorage.removeItem('token');
        router.push("/login");
        dispatch(reset());
    };
    const handleRoute = ()=>{
        if (!localStorage.getItem("token")) {
            router.push("/");
        }
        else{
            router.push("/dashboard");
        }
    }

    return (
        <div className={`${styles.container} ${visible ? styles.navVisible : styles.navHidden}`}>
            <nav className={styles.navbar}>
                <h1 className={styles.logo} onClick={() =>handleRoute()}>Mitrata</h1>

                {/* Mobile Three-Dot / Notch Toggle */}
                <div className={styles.mobileToggle} onClick={() => setIsMenuOpen(!isMenuOpen)}>
                    <span></span>
                    <span></span>
                    <span></span>
                </div>

                <div className={`${styles.navbarOptionContainer} ${isMenuOpen ? styles.menuOpen : ""}`}>
                    {authState.loggedIn ? (
                        <div className={styles.namePallet}>
                            <div className={styles.welcomeText}>
                                Hey! {authState.user?.userId?.name?.split(" ")[0]?.toLowerCase()?.replace(/^\w/, c => c.toUpperCase()) || ""}
                            </div>
                            
                            {/* Profile with Icon */}
                            <div onClick={() => {router.push("/profile"); setIsMenuOpen(false)}} className={styles.navItem}>
                                <img 
                                    src={authState.user?.userId?.profilePicture ? `${Base_Url}/${authState.user.userId.profilePicture}` : "/default-avatar.png"} 
                                    className={styles.miniAvatar} 
                                    alt="pfp" 
                                />
                                <span>Profile</span>
                            </div>

                            <div onClick={handleLogout} className={styles.logoutBtn}>
                                Logout
                            </div>
                        </div>
                    ) : (
                        <div onClick={() => {router.push("/login"); setIsMenuOpen(false)}} className={styles.buttonJoin}>
                            Be a part / login
                        </div>
                    )}
                </div>
            </nav>
        </div>
    );
}