import axios from "axios";

const serverAxios = axios.create({
    baseURL: process.env.BACKEND_URL || "http://localhost:9080",
    timeout: 10000,
});

export default serverAxios;
