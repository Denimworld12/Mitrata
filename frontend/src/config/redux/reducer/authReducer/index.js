import { createSlice } from "@reduxjs/toolkit";
import { getAboutUser, loginUser, registerUser, getAllUser, getConnectionRequest, getMyConnectionRequests, acceptConnectionRequest, downloadResume, updateUserProfile, updateAccountSettings, blockUser, unblockUser, getBlockedUsers, logout, verifyOtp, resendOtp, sendOtp, resetPasswordAction, deleteAccount, switchAccountAction, verifyTwoFactorLogin, getTwoFactorStatus } from "../../action/authAction/index";
import { rememberAccount } from "../../../savedAccounts";



const initialState = {
    user: null,
    isError: false,
    isSuccess: false,
    isLoading: false,
    loggedIn: typeof window !== "undefined" && !!localStorage.getItem("token"),
    message: "",
    isTokenThere: typeof window !== "undefined" && localStorage.getItem("token") ? true : false,
    profileFetched: false,
    connection: [],
    all_user: [],
    connectionRequest: [],
    all_profile_fetched: false,
    blockedUsers: [],
    requires2FA: false,
    twoFactorChallengeToken: null,
    twoFactorEnabled: false
}

const authSlice = createSlice({
    name: "auth",
    initialState,
    reducers: {
        reset: () => initialState,
        handleLoginUser: (state) => {
            state.message = "Hello"
        },
        emptyMessage: (state) => {
            state.isError = false;
            state.isSuccess = false;
            state.isLoading = false;
            state.message = "";
        },
        setTokenThere: (state) => {
            state.isTokenThere = true
        },
        setTokenNotThere: (state) => {
            state.isTokenThere = false
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(loginUser.pending, (state) => {
                state.isLoading = true
                state.message = "knocking on the login page"

            })
            .addCase(loginUser.fulfilled, (state, action) => {
                state.isLoading = false
                if (action.payload?.requires2FA) {
                    state.isSuccess = false
                    state.requires2FA = true
                    state.twoFactorChallengeToken = action.payload.challengeToken
                    return
                }
                state.isSuccess = true
                state.isError = false
                state.loggedIn = true
                state.isTokenThere = true
                state.message = "login sucessfully"
            })
            .addCase(loginUser.rejected, (state, action) => {
                state.isLoading = false
                state.isError = true
                state.message = action.payload.message || 'Login failed';
            })
            .addCase(verifyTwoFactorLogin.pending, (state) => {
                state.isLoading = true
                state.isError = false
            })
            .addCase(verifyTwoFactorLogin.fulfilled, (state) => {
                state.isLoading = false
                state.isSuccess = true
                state.isError = false
                state.loggedIn = true
                state.isTokenThere = true
                state.requires2FA = false
                state.twoFactorChallengeToken = null
                state.message = "login sucessfully"
            })
            .addCase(verifyTwoFactorLogin.rejected, (state, action) => {
                state.isLoading = false
                state.isError = true
                state.message = action.payload.message || 'Invalid code';
            })
            .addCase(getTwoFactorStatus.fulfilled, (state, action) => {
                state.twoFactorEnabled = !!action.payload.enabled
            })
            .addCase(registerUser.pending, (state) => {
                state.isLoading = true
                state.isError = false
                state.isSuccess = false
                state.message = "waiting for completion register"
            })
            .addCase(registerUser.fulfilled, (state, action) => {
                state.isLoading = false;
                state.isError = false;
                state.isSuccess = true;
                // No token yet — the account exists but is unverified until
                // the OTP flow completes (see verifyOtp below), so this
                // shouldn't look logged-in.
                state.message = action.payload.message || "Registration successful";
            })
            .addCase(registerUser.rejected, (state, action) => {
                state.isLoading = false;
                state.isError = true;
                state.message = action.payload?.message || 'Registration failed';
            })
            .addCase(getAboutUser.fulfilled, (state, action) => {
                state.isLoading = false,
                    state.isError = false,
                    state.profileFetched = true
                state.user = action.payload
                state.isTokenThere = true

                // state.connection = action.payload.connection,
                // state.connectionRequest = action.payload.connectionRequest
                if (action.payload?.userId) rememberAccount(action.payload.userId);
            })
            .addCase(getAboutUser.rejected, (state) => {
                state.isLoading = false;
                state.isTokenThere = false;
                state.loggedIn = false;
                state.user = null;
                if (typeof window !== "undefined") localStorage.removeItem("token");
            })
            .addCase(getAllUser.fulfilled, (state, action) => {
                state.isError = false,
                    state.all_user = action.payload.profiles
                state.loggedIn = true
                state.isSuccess = true;
                state.all_profile_fetched = true
            })
            .addCase(getAllUser.rejected, (state, action) => {
                state.isError = true;
                state.isLoading = false
                state.all_profile_fetched = false
                state.message = action.payload
            })
            .addCase(getConnectionRequest.fulfilled, (state, action) => {
                state.isError = false,
                    state.connection = action.payload.connections || action.payload
            })
            .addCase(getConnectionRequest.rejected, (state, action) => {
                state.isError = true;
                state.message = action.payload
            })
            .addCase(getConnectionRequest.pending, (state) => {
                state.isLoading = true
            })
            .addCase(getMyConnectionRequests.fulfilled, (state, action) => {
                state.isError = false,
                    state.connectionRequest = Array.isArray(action.payload.myConnections)
                        ? action.payload.myConnections
                        : [];
            })
            .addCase(getMyConnectionRequests.rejected, (state, action) => {
                state.isError = true;
                state.message = action.payload
            })
            .addCase(getMyConnectionRequests.pending, (state) => {
                state.isLoading = true
            })
            .addCase(acceptConnectionRequest.fulfilled, (state, action) => {
                state.isError = false,
                    state.message = action.payload.message
            })
            .addCase(acceptConnectionRequest.rejected, (state, action) => {
                state.isError = true;
                state.message = action.payload
            })
            .addCase(acceptConnectionRequest.pending, (state) => {
                state.isLoading = true
            })

            .addCase(downloadResume.fulfilled, (state, action) => {
                state.message = action.payload
                state.isError = false,
                    state.isLoading = false

            })
            .addCase(updateUserProfile.fulfilled, (state, action) => {
                state.isLoading = false;
                state.isSuccess = true;
                // Update the local user object with the new Cloudinary path
                if (state.user && state.user.userId) {
                    state.user.userId.profilePicture = action.payload.profilePicture;
                }
                state.message = "Profile picture updated!";
            })
            .addCase(updateUserProfile.rejected, (state, action) => {
                state.isLoading = false,
                    state.isError = true,
                    state.isSuccess = false,
                    state.message = action.payload?.message || "Profile not updated"
            })
            .addCase(updateUserProfile.pending, (state) => {
                state.isLoading = true
            })
            .addCase(updateAccountSettings.fulfilled, (state, action) => {
                if (state.user?.userId) {
                    if (action.payload.username !== undefined) state.user.userId.username = action.payload.username;
                    if (action.payload.isPrivate !== undefined) state.user.userId.isPrivate = action.payload.isPrivate;
                    if (action.payload.pushEnabled !== undefined) state.user.userId.pushEnabled = action.payload.pushEnabled;
                }
            })
            .addCase(getBlockedUsers.fulfilled, (state, action) => {
                state.blockedUsers = action.payload.blockedUsers || [];
            })
            .addCase(blockUser.fulfilled, (state, action) => {
                // Optimistic-ish: remove from connections too, matches the
                // backend deleting the connection on block.
                state.connection = state.connection.filter(
                    (c) => c.userId?._id !== action.payload.targetId && c.connectionId?._id !== action.payload.targetId
                );
                state.connectionRequest = state.connectionRequest.filter(
                    (c) => c.userId?._id !== action.payload.targetId
                );
            })
            .addCase(unblockUser.fulfilled, (state, action) => {
                state.blockedUsers = state.blockedUsers.filter((u) => u._id !== action.payload.targetId);
            })
            .addCase(logout.fulfilled, (state) => {
                state.user = null;
                state.isError = false;
                state.isSuccess = true;
                state.isLoading = false;
                state.loggedIn = false;
                state.message = "Logged out";
                state.isTokenThere = false;
                state.profileFetched = false;
                state.connection = [];
                state.all_user = [];
                state.connectionRequest = [];
                state.all_profile_fetched = false;
            })
            .addCase(sendOtp.pending, (state) => {
                state.isLoading = true
                state.isError = false
            })
            .addCase(sendOtp.fulfilled, (state, action) => {
                state.isLoading = false
                state.isError = false
                state.message = action.payload.message
            })
            .addCase(sendOtp.rejected, (state, action) => {
                state.isLoading = false
                state.isError = true
                state.message = action.payload?.message || "Failed to send code"
            })
            .addCase(resendOtp.pending, (state) => {
                state.isLoading = true
            })
            .addCase(resendOtp.fulfilled, (state, action) => {
                state.isLoading = false
                state.isError = false
                state.message = action.payload.message
            })
            .addCase(resendOtp.rejected, (state, action) => {
                state.isLoading = false
                state.isError = true
                state.message = action.payload?.message || "Failed to resend code"
            })
            .addCase(verifyOtp.pending, (state) => {
                state.isLoading = true
                state.isError = false
            })
            .addCase(verifyOtp.fulfilled, (state, action) => {
                state.isLoading = false
                state.isError = false
                state.message = action.payload.message
                // Only the "signup" purpose auto-issues a session token —
                // reset_password hands back a resetToken instead, no login here.
                if (action.meta.arg?.purpose === "signup" && action.payload.token) {
                    state.loggedIn = true
                    state.isTokenThere = true
                }
            })
            .addCase(verifyOtp.rejected, (state, action) => {
                state.isLoading = false
                state.isError = true
                state.message = action.payload?.message || "Verification failed"
            })
            .addCase(resetPasswordAction.pending, (state) => {
                state.isLoading = true
                state.isError = false
            })
            .addCase(resetPasswordAction.fulfilled, (state, action) => {
                state.isLoading = false
                state.isError = false
                state.message = action.payload.message
            })
            .addCase(resetPasswordAction.rejected, (state, action) => {
                state.isLoading = false
                state.isError = true
                state.message = action.payload?.message || "Reset failed"
            })
            .addCase(deleteAccount.fulfilled, (state) => {
                state.user = null;
                state.isError = false;
                state.isLoading = false;
                state.loggedIn = false;
                state.isTokenThere = false;
                state.message = "Account deleted";
                state.profileFetched = false;
                state.connection = [];
                state.all_user = [];
                state.connectionRequest = [];
                state.all_profile_fetched = false;
            })
            .addCase(deleteAccount.rejected, (state, action) => {
                state.isLoading = false
                state.isError = true
                state.message = action.payload?.message || "Failed to delete account"
            })
            .addCase(deleteAccount.pending, (state) => {
                state.isLoading = true
            })
            .addCase(switchAccountAction.pending, (state) => {
                state.isLoading = true
                state.isError = false
            })
            .addCase(switchAccountAction.fulfilled, (state) => {
                state.isLoading = false
                state.isError = false
                state.loggedIn = true
                state.isTokenThere = true
                // Stale data from whichever account was active before —
                // every page refetches on the next mount anyway.
                state.user = null
                state.profileFetched = false
            })
            .addCase(switchAccountAction.rejected, (state, action) => {
                state.isLoading = false
                state.isError = true
                state.message = action.payload?.message || "Switch failed"
            })

    }
});

export const { emptyMessage, handleLoginUser, reset, setTokenNotThere, setTokenThere } = authSlice.actions
export default authSlice.reducer
