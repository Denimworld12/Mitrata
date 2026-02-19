import axios from "axios";

export const Base_Url = process.env.NEXT_PUBLIC_BACKEND_URL;

export const clientServer = axios.create({
    baseURL: Base_Url,
    timeout: 15000,
});

// Auto-attach JWT token to all requests
clientServer.interceptors.request.use((config) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Auto-handle 401 (expired/invalid token) — redirect to login
clientServer.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            if (typeof window !== "undefined") {
                localStorage.removeItem("token");
                // Only redirect if not already on login/register page
                if (!window.location.pathname.includes('/login') && !window.location.pathname.includes('/register')) {
                    window.location.href = "/login";
                }
            }
        }
        return Promise.reject(error);
    }
);
