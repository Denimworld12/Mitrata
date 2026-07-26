import axios from "axios";

export const Base_Url = process.env.NEXT_PUBLIC_BACKEND_URL;

// Reads the userId claim out of a JWT without verifying it — just base64url
// decoding the payload segment. This is never trusted as a credential on its
// own; it only tells the server which per-account refresh cookie to check
// (see refreshCookieName on the backend), and that cookie's signature is
// what's actually verified.
export const decodeJwtUserId = (token) => {
    try {
        const payload = token.split(".")[1];
        const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
        return JSON.parse(json).userId || null;
    } catch {
        return null;
    }
};

export const clientServer = axios.create({
    baseURL: `${Base_Url}/api`,
    timeout: 15000,
    withCredentials: true, // send/receive the httpOnly refresh-token cookie
});

// Auto-attach JWT token to all requests
clientServer.interceptors.request.use((config) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Access tokens are short-lived (15m). On a 401, try the refresh-cookie flow once
// before giving up and sending the user back to login.
let refreshPromise = null;

const goToLogin = () => {
    if (typeof window === "undefined") return;
    localStorage.removeItem("token");
    if (!window.location.pathname.includes('/login') && !window.location.pathname.includes('/register')) {
        window.location.href = "/login";
    }
};

// Auth endpoints hand back a deliberate, permanent 401 (wrong password,
// "log in to this account", expired reset link, ...) — none of those are
// fixed by silently refreshing the CURRENT session and retrying, and doing
// so anyway was actively harmful for switch-account: it would refresh and
// restore the account you were switching AWAY from before finally falling
// through to "please log in", making a failed switch look like it briefly
// worked and then reverted.
const isAuthEndpoint = (url = "") => /\/(login|register|auth\/)/.test(url);

clientServer.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        if (
            error.response?.status === 401 &&
            !originalRequest?._retried &&
            !isAuthEndpoint(originalRequest?.url) &&
            typeof window !== "undefined"
        ) {
            originalRequest._retried = true;
            try {
                if (!refreshPromise) {
                    const expiringToken = localStorage.getItem("token");
                    const userId = expiringToken ? decodeJwtUserId(expiringToken) : null;
                    refreshPromise = clientServer.post('/auth/refresh', { userId }).finally(() => { refreshPromise = null; });
                }
                const { data } = await refreshPromise;
                localStorage.setItem("token", data.token);
                originalRequest.headers.Authorization = `Bearer ${data.token}`;
                return clientServer(originalRequest);
            } catch (refreshError) {
                goToLogin();
                return Promise.reject(refreshError);
            }
        }
        return Promise.reject(error);
    }
);
