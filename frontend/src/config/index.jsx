const { default: axios } = require("axios");

export const Base_Url = process.env.BACKEND_URL 

export const clientServer = axios.create({
    baseURL: Base_Url
})
