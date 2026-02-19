import jwt from "jsonwebtoken";
import User from "../models/users.model.js";

export const verifyToken = async (req, res, next) => {
    try {
        // 1. Extract token from Authorization header ONLY (secure)
        const authHeader = req.headers["authorization"];
        let token = null;

        if (authHeader?.startsWith("Bearer ")) {
            token = authHeader.split(" ")[1];
        }

        // 2. Fallback: Check body/query for multipart form compatibility
        //    (multer populates req.body AFTER parsing, so token may be in body)
        if (!token && req.body?.token) {
            token = req.body.token;
        }

        if (!token) {
            return res.status(401).json({ message: "No token, authorization denied" });
        }

        // 3. Verify JWT
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // 4. Verify user still exists
        const user = await User.findById(decoded.userId).select("_id");
        if (!user) {
            return res.status(401).json({ message: "User no longer exists" });
        }

        // 5. Attach user ID to request
        req.userId = user._id;
        next();
    } catch (err) {
        if (err.name === "TokenExpiredError") {
            return res.status(401).json({ message: "Token has expired, please login again" });
        }
        if (err.name === "JsonWebTokenError") {
            return res.status(401).json({ message: "Invalid token" });
        }
        console.error("Auth Error:", err.message);
        res.status(401).json({ message: "Token is not valid" });
    }
};