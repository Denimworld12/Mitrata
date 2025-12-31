import React, { useEffect, useState, useRef } from 'react'
import styles from './styles.module.css'
import { useRouter } from 'next/router'
import { useDispatch, useSelector } from 'react-redux';
import { getAboutUser } from '@/config/redux/action/authAction';
import { reset, setTokenNotThere, setTokenThere } from '@/config/redux/reducer/authReducer';

export default function Navbar() {
    const router = useRouter();
    const dispatch = useDispatch();
    const authState = useSelector((state) => state.auth);
    const menuRef = useRef(null);

    const [prevScrollPos, setPrevScrollPos] = useState(0);
    const [visible, setVisible] = useState(true);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            const currentScrollPos = window.pageYOffset;
            setVisible(prevScrollPos > currentScrollPos || currentScrollPos < 10);
            setPrevScrollPos(currentScrollPos);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, [prevScrollPos]);

    useEffect(() => {
        setMounted(true);
        const token = localStorage.getItem("token");
        if (token) {
            dispatch(setTokenThere());
            dispatch(getAboutUser({ token }));
        } else {
            dispatch(setTokenNotThere());
            dispatch(reset());
        }
    }, [dispatch]);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const showUserUI = mounted && (authState.isTokenThere || authState.loggedIn);

    const handleLogout = () => {
        localStorage.removeItem('token');
        router.push("/login");
        dispatch(reset());
        setIsMenuOpen(false);
    };

    return (
        <div className={`${styles.container} ${visible ? styles.navVisible : styles.navHidden}`}>
            <nav className={styles.navbar}>
                <h1 className={styles.logo} onClick={() => router.push(authState.isTokenThere ? "/dashboard" : "/")}>Mitrata</h1>

                <div className={styles.rightSection}>
                    {!mounted ? null : showUserUI ? (
                        <>
                            {/* App Style Profile - Always visible on the main bar */}
                            <div onClick={() => router.push("/profile")} className={styles.appProfile}>
                                <img
                                    src={authState.user?.userId?.profilePicture || "/default-avatar.png"}
                                    className={styles.miniAvatar}
                                    alt="pfp"
                                />
                                <span className={styles.desktopName}>
                                    {authState.user?.userId?.name?.split(" ")[0] || "User"}
                                </span>
                            </div>

                            {/* Three-dot menu for Logout */}
                            <div className={styles.menuWrapper} ref={menuRef}>
                                <div className={styles.mobileToggle} onClick={() => setIsMenuOpen(!isMenuOpen)}>
                                    <span></span><span></span><span></span>
                                </div>

                                {isMenuOpen && (
                                    <div className={styles.dropdownMenu}>
                                        <div className={styles.welcomeTextMobile}>
                                            Hey, {authState.user?.userId?.name?.split(" ")[0]}
                                        </div>
                                        <div onClick={handleLogout} className={styles.logoutBtn}>
                                            Logout
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div onClick={() => router.push("/login")} className={styles.buttonJoin}>
                            Login
                        </div>
                    )}
                </div>
            </nav>
        </div>
    );
}