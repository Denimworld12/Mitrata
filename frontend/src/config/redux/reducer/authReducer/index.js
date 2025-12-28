import { createSlice } from "@reduxjs/toolkit";
import { getAboutUser, loginUser, registerUser, getAllUser, getConnectionRequest, getMyConnectionRequests, acceptConnectionRequest, downloadResume, updateUserProfile } from "../../action/authAction/index";
import { accessedDynamicData } from "next/dist/server/app-render/dynamic-rendering";
import { all, get } from "axios";


const initialState = {
    user: null,
    isError: false,
    isSuccess: false,
    isLoading: false,
    loggedIn: false,
    message: "",
    isTokenThere: typeof window !== "undefined" && localStorage.getItem("token") ? true : false,
    profileFetched: false,
    connection: [],
    all_user: [],
    connectionRequest: [],
    all_profile_fetched: false
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
                state.isSuccess = true
                state.isError = false
                state.loggedIn = true
                state.isTokenThere = true
                state.message = action.payload.message || "login sucessfully"
            })
            .addCase(loginUser.rejected, (state, action) => {
                state.isLoading = false
                state.isError = true
                state.message = action.payload.message || 'Login failed';
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
                state.loggedIn = true;
                state.isTokenThere = true

                state.user = action.payload.user || null;
                state.message = action.payload.message || "Registration success, please log in.";
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
                state.isLoading = false,
                    state.isError = false,
                    state.isSuccess = true,
                    state.message = action.payload?.message || "Profile updated successfully"
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

    }
});

export const { emptyMessage, handleLoginUser, reset, setTokenNotThere, setTokenThere } = authSlice.actions
export default authSlice.reducer
