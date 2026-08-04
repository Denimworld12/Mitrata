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

        // 4. Verify user still exists and is active
        const user = await User.findById(decoded.userId).select("_id active");
        if (!user) {
            return res.status(401).json({ message: "User no longer exists" });
        }
        if (user.active === false) {
            return res.status(401).json({ message: "Account suspended" });
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

// Requires verifyToken to have run first (needs req.userId)
export const isAdmin = async (req, res, next) => {
    try {
        const user = await User.findById(req.userId).select("role");
        if (!user || user.role !== "admin") {
            return res.status(403).json({ message: "Admin access required" });
        }
        next();
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};