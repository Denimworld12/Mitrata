const { default: axios } = require("axios");

export const Base_Url = process.env.NEXT_PUBLIC_BACKEND_URL 

export const clientServer = axios.create({
    baseURL: Base_Url
})
