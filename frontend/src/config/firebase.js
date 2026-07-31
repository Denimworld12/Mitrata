import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, isSupported } from 'firebase/messaging';

// Public config — safe to ship in client code, this is how every Firebase
// web app identifies itself to Google's servers (auth/authorization happens
// separately, via the VAPID key + backend service account).
const firebaseConfig = {
    apiKey: 'AIzaSyBt-1BK_o2yOMu-sA5kYdL0bb7QkyofQuI',
    authDomain: 'mitrata-app.firebaseapp.com',
    projectId: 'mitrata-app',
    storageBucket: 'mitrata-app.firebasestorage.app',
    messagingSenderId: '571194128097',
    appId: '1:571194128097:web:765e7633f57765288569a0',
};

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

let appPromise = null;
const getFirebaseApp = () => {
    if (!appPromise) appPromise = initializeApp(firebaseConfig);
    return appPromise;
};

// Requests notification permission, registers the messaging service worker,
// and returns an FCM token for this browser — or null if push isn't set up
// yet (no VAPID key) or the browser doesn't support it (Safari on older
// versions, private/incognito in some browsers). Same "no-op until
// configured" convention as the mailer/Google login on the backend.
export const getFcmToken = async () => {
    if (typeof window === 'undefined' || !VAPID_KEY) return null;
    if (!(await isSupported().catch(() => false))) return null;

    try {
        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        const messaging = getMessaging(getFirebaseApp());
        return await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
    } catch (err) {
        console.warn('Could not get FCM token:', err.message);
        return null;
    }
};
