import axios from "axios";

const serverAxios = axios.create({
    baseURL: `${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:9080"}/api`,
    timeout: 10000,
});

export default serverAxios;
