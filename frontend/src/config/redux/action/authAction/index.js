import { clientServer } from "@/config";
import { createAsyncThunk } from "@reduxjs/toolkit";



export const loginUser = createAsyncThunk(
    "user/login",
    async (user, thunkApi) => {
        try {
            const response = await clientServer.post('/login', {
                email: user.email,
                password: user.password
            })
            if (response.data.token)
                localStorage.setItem("token", response.data.token);
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



export const logout = createAsyncThunk(
    "user/logout",
    async (_, thunkApi) => {
        try {
            await clientServer.post('/logout');
            localStorage.removeItem("token");
            return thunkApi.fulfillWithValue({ message: "Logged out successfully" });
        } catch (error) {
            localStorage.removeItem("token");
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
