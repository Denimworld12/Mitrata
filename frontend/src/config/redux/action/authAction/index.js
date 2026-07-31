import { clientServer, decodeJwtUserId } from "@/config";
import { createAsyncThunk } from "@reduxjs/toolkit";

// Anything stored per-browser rather than per-account (recentSearches is the
// only one today — see pages/search) needs to be reset at the start of every
// new session, not just cleared on logout — a fresh signup or a different
// account logging in on the same browser should never inherit it either.
const startNewSession = (token) => {
    localStorage.setItem("token", token);
    localStorage.removeItem("recentSearches");
};

// Leaving the current account to sign into a different one is NOT the same
// as logging out — logout() revokes that account's refresh cookie
// server-side (see /logout), which would break coming back to it via quick
// switch. This only clears what makes the browser show the login screen,
// leaving that account's session exactly as it was.
export const clearLocalSession = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("recentSearches");
};

export const loginUser = createAsyncThunk(
    "user/login",
    async (user, thunkApi) => {
        try {
            const response = await clientServer.post('/login', {
                email: user.email,
                password: user.password
            })
            if (response.data.token)
                startNewSession(response.data.token);
            else
                return thunkApi.rejectWithValue({ message: "token not provided" })
            return thunkApi.fulfillWithValue(response.data.token)

        } catch (error) {
            return thunkApi.rejectWithValue(error.response?.data || { message: "Login failed" })
        }
    }
)
export const registerUser = createAsyncThunk(
    "user/register",
    async (user, thunkApi) => {
        try {
            const response = await clientServer.post('/register', {
                username: user.username,
                password: user.password,
                email: user.email,
                name: user.name
            })
            return thunkApi.fulfillWithValue(response.data)
        } catch (error) {
            return thunkApi.rejectWithValue(error.response?.data || { message: "Registration failed" })
        }
    }
)

// purpose: "signup" | "reset_password"
export const sendOtp = createAsyncThunk(
    "user/sendOtp",
    async ({ email, purpose }, thunkApi) => {
        try {
            const response = await clientServer.post('/auth/send-otp', { email, purpose })
            return thunkApi.fulfillWithValue(response.data)
        } catch (error) {
            return thunkApi.rejectWithValue(error.response?.data || { message: "Failed to send code" })
        }
    }
)

export const resendOtp = createAsyncThunk(
    "user/resendOtp",
    async ({ email, purpose }, thunkApi) => {
        try {
            const response = await clientServer.post('/auth/resend-otp', { email, purpose })
            return thunkApi.fulfillWithValue(response.data)
        } catch (error) {
            return thunkApi.rejectWithValue(error.response?.data || { message: "Failed to resend code" })
        }
    }
)

// On the "signup" purpose the backend auto-logs the user in (returns a real
// access token) — reset_password instead returns a resetToken to hand to
// resetPasswordAction next, no token/localStorage involved here.
export const verifyOtp = createAsyncThunk(
    "user/verifyOtp",
    async ({ email, otp, purpose }, thunkApi) => {
        try {
            const response = await clientServer.post('/auth/verify-otp', { email, otp, purpose })
            if (purpose === "signup" && response.data.token) {
                startNewSession(response.data.token);
            }
            return thunkApi.fulfillWithValue(response.data)
        } catch (error) {
            return thunkApi.rejectWithValue(error.response?.data || { message: "Verification failed" })
        }
    }
)

export const resetPasswordAction = createAsyncThunk(
    "user/resetPassword",
    async ({ resetToken, newPassword }, thunkApi) => {
        try {
            const response = await clientServer.post('/auth/reset-password', { resetToken, newPassword })
            return thunkApi.fulfillWithValue(response.data)
        } catch (error) {
            return thunkApi.rejectWithValue(error.response?.data || { message: "Reset failed" })
        }
    }
)

export const deleteAccount = createAsyncThunk(
    "user/deleteAccount",
    async ({ password }, thunkApi) => {
        try {
            const response = await clientServer.post('/user/delete_account', { password })
            localStorage.removeItem("token");
            return thunkApi.fulfillWithValue(response.data)
        } catch (error) {
            return thunkApi.rejectWithValue(error.response?.data || { message: "Failed to delete account" })
        }
    }
)

// Instant switch to an already-logged-in account on this browser (see
// switchAccount on the backend) — succeeds with no password if that
// account's refresh cookie is still valid, otherwise rejects with
// needsLogin so the caller can fall back to a normal sign-in.
export const switchAccountAction = createAsyncThunk(
    "user/switchAccount",
    async ({ userId }, thunkApi) => {
        try {
            const response = await clientServer.post('/auth/switch-account', { userId })
            if (response.data.token) {
                startNewSession(response.data.token);
            }
            return thunkApi.fulfillWithValue(response.data)
        } catch (error) {
            return thunkApi.rejectWithValue(error.response?.data || { message: "Switch failed" })
        }
    }
)



export const logout = createAsyncThunk(
    "user/logout",
    async (_, thunkApi) => {
        // recentSearches (see pages/search) is stored unscoped by user — left
        // behind, the next account signed into on this browser/device would
        // silently inherit whoever's search history was here before.
        //
        // userId tells the backend which account's refresh cookie to clear —
        // without it, logging out of one account would leave its cookie
        // behind (harmless) but the server has no other way to know which
        // of possibly several per-account cookies this browser is signing
        // out of.
        const userId = decodeJwtUserId(localStorage.getItem("token") || "");
        // Best-effort — a logged-out device that stays registered would keep
        // getting push notifications for an account it's no longer signed
        // into. Not worth blocking/failing logout over if this errors.
        const fcmToken = localStorage.getItem("fcmToken");
        if (fcmToken) {
            clientServer.delete('/user/fcm-token', { data: { token: fcmToken } }).catch(() => { });
            localStorage.removeItem("fcmToken");
        }
        try {
            await clientServer.post('/logout', { userId });
            localStorage.removeItem("token");
            localStorage.removeItem("recentSearches");
            return thunkApi.fulfillWithValue({ message: "Logged out successfully" });
        } catch (error) {
            localStorage.removeItem("token");
            localStorage.removeItem("recentSearches");
            return thunkApi.fulfillWithValue({ message: "Logged out locally" });
        }
    }
)


export const getAboutUser = createAsyncThunk(
    "user/getAboutUser",
    async (_user, thunkApi) => {
        try {
            // Token is auto-attached via axios interceptor
            const response = await clientServer.get('/get_user_and_profile')
            return thunkApi.fulfillWithValue(response.data)
        } catch (error) {
            return thunkApi.rejectWithValue(error.response?.data || { message: "Failed to get user info" })
        }
    }
)


export const updateUserProfile = createAsyncThunk(
    "user/updateUserProfile",
    async (user, thunkApi) => {
        try {
            const { token, ...newUserdata } = user;
            // Token is auto-attached via axios interceptor
            const response = await clientServer.post('/user/setting/user_update', {
                newUserdata: newUserdata
            })
            return thunkApi.fulfillWithValue(response.data)
        } catch (error) {
            return thunkApi.rejectWithValue(error.response?.data || { message: "Update failed" })
        }
    }
)



export const getAllUser = createAsyncThunk(
    "user/findUser",
    async (_user, thunkApi) => {
        try {
            // Token is auto-attached via axios interceptor
            const response = await clientServer.get('/user/findinguser')
            return thunkApi.fulfillWithValue(response.data)
        } catch (error) {
            return thunkApi.rejectWithValue(error.response?.data || { message: "Failed to find users" })
        }
    }
)


export const sendConnectionRequest = createAsyncThunk(
    "user/sendConnectionRequest",
    async (user, thunkApi) => {
        try {
            // Token is auto-attached via axios interceptor
            const response = await clientServer.post('/user/send_connection_request', {
                connectionId: user.connectionId
            })
            thunkApi.dispatch(getConnectionRequest())
            return thunkApi.fulfillWithValue(response.data)
        } catch (error) {
            return thunkApi.rejectWithValue(error.response?.data || { message: "Request failed" })
        }
    }
)



export const getConnectionRequest = createAsyncThunk(
    "user/getConnectionRequest",
    async (_user, thunkApi) => {
        try {
            // Token is auto-attached via axios interceptor
            const response = await clientServer.get('/user/get_connection_request')
            return thunkApi.fulfillWithValue(response.data)

        } catch (error) {
            return thunkApi.rejectWithValue(error.response?.data || { message: "Failed to get connections" })
        }
    }
)

export const getMyConnectionRequests = createAsyncThunk(
    "user/getMyConnectionRequests",
    async (_user, thunkApi) => {
        try {
            // Token is auto-attached via axios interceptor
            const response = await clientServer.get('/user/get_my_connections')
            return thunkApi.fulfillWithValue(response.data)

        } catch (error) {
            return thunkApi.rejectWithValue(error.response?.data || { message: "Failed to get connections" })
        }
    }
)

export const acceptConnectionRequest = createAsyncThunk(
    "user/acceptConnectionRequest",
    async (payload, thunkApi) => {
        try {
            // Token is auto-attached via axios interceptor
            const response = await clientServer.post('/user/is_accepted_connection_request', {
                requestId: payload.connectionId,
                action_type: payload.action
            });
            return thunkApi.fulfillWithValue(response.data);
        } catch (error) {
            return thunkApi.rejectWithValue(error.response?.data || { message: "Action failed" });
        }
    }
);


export const downloadResume = createAsyncThunk(
    '/user/downloadResume',
    async (user, thunkApi) => {
        try {
            const response = await clientServer.get('/user/download_resume', {
                params: {
                    id: user.connectionId
                }
            })
            return response.data
        } catch (error) {
            return thunkApi.rejectWithValue(error.response?.data || { message: 'Download failed' })
        }
    }
)
