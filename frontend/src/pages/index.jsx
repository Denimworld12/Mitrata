
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

  return (

    <UserLayout>

      <div className={styles.container}>

        <div className={styles.mainContainer}>
          <div className={styles.mainContainer_left}>
            <p>Connect with friend without disturbance </p>
            <p> A true social media platform, with Stories no blufs!</p>

            <div onClick={() => router.push("/login")} className={styles.buttonJoin}>

              {isloggedIn ? <p>Go to Dashboard</p> : <p>Join Noww </p>}
            </div>
          </div>


          <div className={styles.mainContainer_right}>
            <img src="/images/connectPeople.png" alt="" style={{ height: "420px" }} />
          </div>
        </div>
      </div>
    </UserLayout>


  );
}
