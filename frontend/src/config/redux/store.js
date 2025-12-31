import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./reducer/authReducer"
import postReducer from "./reducer/postReducer"
import  messageReducer from "./reducer/messageReducer"
// Steps in the state management 

// --- submit action 
// ---Handle "Action " in its reducer 
// ---Register here -> Reducer 

export const store = configureStore({
    reducer: {
        auth:authReducer,
        post:postReducer,
        message: messageReducer
    }
})