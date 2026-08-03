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
            // Password's correct, but the account has 2FA on — no session yet,
            // the caller needs to prompt for a code and call verifyTwoFactorLogin.
            if (response.data.requires2FA) {
                return thunkApi.fulfillWithValue(response.data)
            }
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

export const verifyTwoFactorLogin = createAsyncThunk(
    "user/verifyTwoFactorLogin",
    async ({ challengeToken, code }, thunkApi) => {
        try {
            const response = await clientServer.post('/auth/2fa/verify-login', { challengeToken, code });
            if (!response.data.token) return thunkApi.rejectWithValue({ message: "token not provided" });
            startNewSession(response.data.token);
            return thunkApi.fulfillWithValue(response.data.token)
        } catch (error) {
            return thunkApi.rejectWithValue(error.response?.data || { message: "Invalid code" })
        }
    }
)

// Second half of the Google redirect flow — googleLoginCallback (a genuine
// cross-origin top-level navigation straight to the backend) can't set a
// same-origin session cookie itself, so it hands back a one-time code
// instead. This exchanges it via a normal proxied request, which DOES land
// the refresh cookie on the frontend's own origin like every other login path.
export const completeGoogleLogin = createAsyncThunk(
    "user/completeGoogleLogin",
    async (code, thunkApi) => {
        try {
            const response = await clientServer.post('/auth/google/complete', { code });
            if (!response.data.token) return thunkApi.rejectWithValue({ message: "token not provided" });
            startNewSession(response.data.token);
            return thunkApi.fulfillWithValue(response.data.token)
        } catch (error) {
            return thunkApi.rejectWithValue(error.response?.data || { message: "Google sign-in failed" })
        }
    }
)

// Second half of the Apple redirect flow — mirrors completeGoogleLogin
// exactly, see its comment for why a cookie can't be set on Apple's own
// cross-origin redirect response either.
export const completeAppleLogin = createAsyncThunk(
    "user/completeAppleLogin",
    async (code, thunkApi) => {
        try {
            const response = await clientServer.post('/auth/apple/complete', { code });
            if (!response.data.token) return thunkApi.rejectWithValue({ message: "token not provided" });
            startNewSession(response.data.token);
            return thunkApi.fulfillWithValue(response.data.token)
        } catch (error) {
            return thunkApi.rejectWithValue(error.response?.data || { message: "Apple sign-in failed" })
        }
    }
)

export const getTwoFactorStatus = createAsyncThunk(
    "user/getTwoFactorStatus",
    async (_arg, thunkApi) => {
        try {
            const response = await clientServer.get('/user/2fa/status');
            return thunkApi.fulfillWithValue(response.data)
        } catch (error) {
            return thunkApi.rejectWithValue(error.response?.data || { message: "Failed to load" })
        }
    }
)

export const setupTwoFactor = createAsyncThunk(
    "user/setupTwoFactor",
    async (_arg, thunkApi) => {
        try {
            const response = await clientServer.post('/user/2fa/setup');
            return thunkApi.fulfillWithValue(response.data)
        } catch (error) {
            return thunkApi.rejectWithValue(error.response?.data || { message: "Failed to start setup" })
        }
    }
)

export const verifyTwoFactorSetup = createAsyncThunk(
    "user/verifyTwoFactorSetup",
    async (code, thunkApi) => {
        try {
            const response = await clientServer.post('/user/2fa/verify', { code });
            return thunkApi.fulfillWithValue(response.data)
        } catch (error) {
            return thunkApi.rejectWithValue(error.response?.data || { message: "Invalid code" })
        }
    }
)

export const disableTwoFactor = createAsyncThunk(
    "user/disableTwoFactor",
    async (password, thunkApi) => {
        try {
            const response = await clientServer.post('/user/2fa/disable', { password });
            return thunkApi.fulfillWithValue(response.data)
        } catch (error) {
            return thunkApi.rejectWithValue(error.response?.data || { message: "Failed to disable" })
        }
    }
)

export const getSessions = createAsyncThunk(
    "user/getSessions",
    async (_arg, thunkApi) => {
        try {
            const response = await clientServer.get('/user/sessions');
            return thunkApi.fulfillWithValue(response.data)
        } catch (error) {
            return thunkApi.rejectWithValue(error.response?.data || { message: "Failed to load" })
        }
    }
)

export const revokeSession = createAsyncThunk(
    "user/revokeSession",
    async (sessionId, thunkApi) => {
        try {
            const response = await clientServer.delete(`/user/sessions/${sessionId}`);
            return thunkApi.fulfillWithValue({ sessionId, ...response.data })
        } catch (error) {
            return thunkApi.rejectWithValue(error.response?.data || { message: "Failed to sign out that device" })
        }
    }
)

export const revokeOtherSessions = createAsyncThunk(
    "user/revokeOtherSessions",
    async (_arg, thunkApi) => {
        try {
            const response = await clientServer.post('/user/sessions/revoke_others');
            return thunkApi.fulfillWithValue(response.data)
        } catch (error) {
            return thunkApi.rejectWithValue(error.response?.data || { message: "Failed to sign out other devices" })
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
            // status travels with the rejection so the reducer can tell a real
            // "session is gone" 401/403 apart from a network blip/timeout/5xx
            // (e.g. Render cold start) — see getAboutUser.rejected.
            return thunkApi.rejectWithValue({
                ...(error.response?.data || { message: "Failed to get user info" }),
                status: error.response?.status,
            })
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

// Username/privacy/push-preference — User-model fields, separate from
// updateUserProfile above which only ever touches the Profile document.
export const updateAccountSettings = createAsyncThunk(
    "user/updateAccountSettings",
    async (payload, thunkApi) => {
        try {
            const response = await clientServer.post('/user/setting/account_update', payload);
            return thunkApi.fulfillWithValue(response.data);
        } catch (error) {
            return thunkApi.rejectWithValue(error.response?.data || { message: "Update failed" });
        }
    }
);

export const blockUser = createAsyncThunk(
    "user/blockUser",
    async (targetId, thunkApi) => {
        try {
            const response = await clientServer.post('/user/block', { targetId });
            return thunkApi.fulfillWithValue({ targetId, ...response.data });
        } catch (error) {
            return thunkApi.rejectWithValue(error.response?.data || { message: "Failed to block user" });
        }
    }
);

export const unblockUser = createAsyncThunk(
    "user/unblockUser",
    async (targetId, thunkApi) => {
        try {
            const response = await clientServer.post('/user/unblock', { targetId });
            return thunkApi.fulfillWithValue({ targetId, ...response.data });
        } catch (error) {
            return thunkApi.rejectWithValue(error.response?.data || { message: "Failed to unblock user" });
        }
    }
);

export const getBlockedUsers = createAsyncThunk(
    "user/getBlockedUsers",
    async (_arg, thunkApi) => {
        try {
            const response = await clientServer.get('/user/blocked');
            return thunkApi.fulfillWithValue(response.data);
        } catch (error) {
            return thunkApi.rejectWithValue(error.response?.data || { message: "Failed to load blocked accounts" });
        }
    }
);



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
            // Backend now hands back the new request already in the shape
            // getConnectionRequest's list uses per-item — the reducer patches
            // it straight into state.connection, no need to refetch the
            // whole list just to show this one row.
            const response = await clientServer.post('/user/send_connection_request', {
                connectionId: user.connectionId
            })
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
