import { useRouter } from "next/router";
import styles from '../styles/Home.module.css'
import UserLayout from "@/layout/userLayout";
import { useEffect, useState } from "react";

export default function Home() {
  const router = useRouter();
  const [isloggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    setIsLoggedIn(Boolean(token));
  }, []);

  const handleJoinClick = () => {
    if (isloggedIn) {
      router.push("/dashboard");
    } else {
      router.push("/login");
    }
  };

  return (
    <UserLayout>
      <div className={styles.container}>
        <div className={styles.mainContainer}>
          <div className={styles.mainContainer_left}>
            <p>Connect with friends without disturbance</p>
            <p>A true social media platform, with Stories, no bluffs!</p>

            <div onClick={handleJoinClick} className={styles.buttonJoin}>
              {isloggedIn ? "Go to Dashboard" : "Join Now"}
            </div>
          </div>

          <div className={styles.mainContainer_right}>
            <img src="/images/connectPeople.png" alt="Connect" className={styles.heroImage} />
          </div>
        </div>
      </div>
    </UserLayout>
  );
}