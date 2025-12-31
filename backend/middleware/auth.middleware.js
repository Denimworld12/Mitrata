import User from "../models/users.model.js";

export const verifyToken = async (req, res, next) => {
    try {
        // 1. Check Header first, then Body, then Query
        const authHeader = req.headers["authorization"];
        let token = authHeader?.startsWith("Bearer ") 
            ? authHeader.split(" ")[1] 
            : (req.body?.token || req.query?.token);

        if (!token) {
            return res.status(401).json({ message: "No token, authorization denied" });
        }

        // 2. If token is a hash (not JWT), find user by token in database
        // This assumes you store the token in your User model
        const user = await User.findOne({ token: token });

        if (!user) {
            return res.status(401).json({ message: "Token is not valid" });
        }

        // 3. Attach user ID to request
        req.userId = user._id;
        next();
    } catch (err) {
        console.error("Auth Error:", err.message);
        res.status(401).json({ message: "Token is not valid" });
    }
};

// Alternative: If you store token in a separate Session/Token collection
export const verifyTokenAlt = async (req, res, next) => {
    try {
        const authHeader = req.headers["authorization"];
        let token = authHeader?.startsWith("Bearer ") 
            ? authHeader.split(" ")[1] 
            : (req.body?.token || req.query?.token);

        if (!token) {
            return res.status(401).json({ message: "No token, authorization denied" });
        }

        // Find session/token in your database
        // Adjust model name based on your schema
        const session = await Session.findOne({ token: token }).populate('userId');

        if (!session || !session.userId) {
            return res.status(401).json({ message: "Token is not valid" });
        }

        // Check if token is expired (if you have expiry)
        if (session.expiresAt && new Date() > session.expiresAt) {
            return res.status(401).json({ message: "Token has expired" });
        }

        req.userId = session.userId._id;
        next();
    } catch (err) {
        console.error("Auth Error:", err.message);
        res.status(401).json({ message: "Token is not valid" });
    }
};