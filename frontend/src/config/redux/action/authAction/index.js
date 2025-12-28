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
            return thunkApi.rejectWithValue(error.response.data)
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
            return thunkApi.rejectWithValue(error.response.data)
        }
    }
)



export const getAboutUser = createAsyncThunk(
    "user/getAboutUser",
    async (user, thunkApi) => {
        try {
            // const token = localStorage.getItem("token");
            const response = await clientServer.get('/get_user_and_profile', {
                params: {
                    token: user.token
                }
            })
            return thunkApi.fulfillWithValue(response.data)
        } catch (error) {
            return thunkApi.rejectWithValue(error.response.data)
        }
    }
)


export const updateUserProfile = createAsyncThunk(
    "user/updateUserProfile",
    async (user, thunkApi) => {
        try {
            const { token, ...newUserdata } = user;
            const response = await clientServer.post('/user/setting/user_update', {
                token: token,
                newUserdata: newUserdata
            })
            return thunkApi.fulfillWithValue(response.data)
        } catch (error) {
            return thunkApi.rejectWithValue(error.response.data)
        }
    }
)



export const getAllUser = createAsyncThunk(
    "user/findUser",
    async (user, thunkApi) => {
        try {
            const response = clientServer.get('/user/findinguser')
            return thunkApi.fulfillWithValue((await response).data)
        } catch (error) {
            return thunkApi.rejectWithValue(error.response.data
            )
        }
    }


)


export const sendConnectionRequest = createAsyncThunk(
    "user/sendConnectionRequest",
    async (user, thunkApi) => {
        try {
            const response = await clientServer.post('/user/send_connection_request', {
                token: user.token,
                connectionId: user.connectionId
            })
            thunkApi.dispatch(getConnectionRequest({ token: user.token }))
            return thunkApi.fulfillWithValue(response.data)
        } catch (error) {
            return thunkApi.rejectWithValue(error.response.data)
        }
    }
)



export const getConnectionRequest = createAsyncThunk(
    "user/getConnectionRequest",
    async (user, thunkApi) => {
        try {
            const response = await clientServer.get('/user/get_connection_request', {
                params: {
                    token: user.token
                }
            })
            return thunkApi.fulfillWithValue(response.data)

        } catch (error) {
            return thunkApi.rejectWithValue(error.response.data)
        }
    }
)

export const getMyConnectionRequests = createAsyncThunk(
    "user/getMyConnectionRequests",
    async (user, thunkApi) => {
        try {
            const response = await clientServer.get('/user/get_my_connections', {
                params: {
                    token: user.token
                }
            })
            return thunkApi.fulfillWithValue(response.data)

        } catch (error) {
            return thunkApi.rejectWithValue(error.response.data)
        }
    }
)

export const acceptConnectionRequest = createAsyncThunk(
    "user/acceptConnectionRequest",
    async (payload, thunkApi) => {
        try {
            const response = await clientServer.post('/user/is_accepted_connection_request', {
                token: payload.token,
                requestId: payload.connectionId, // This is the requestId passed from UI
                action_type: payload.action // Mapping 'action' to 'action_type'
            });
            return thunkApi.fulfillWithValue(response.data);
        } catch (error) {
            return thunkApi.rejectWithValue(error.response.data);
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
            return thunkApi.rejectWithValue( error.response?.data || { message: 'Download failed' })
        }
    }
)
