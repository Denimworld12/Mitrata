const { default: axios } = require("axios");

export const Base_Url = "http://localhost:9080"

export const clientServer = axios.create({
    baseURL: Base_Url
})
