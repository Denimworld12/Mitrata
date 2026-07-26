

import User from "../models/users.model.js";

import Profile from "../models/profile.model.js";

import bcrypt from "bcrypt";

import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs"
import PDFDocument from "pdfkit";
import mongoose from "mongoose";
import ConnectionRequest from "../models/connection.model.js";
import Notification from "../models/notification.model.js";
import Post from "../models/posts.model.js";
import Comment from "../models/comments.model.js";
import Message from "../models/message.model.js";
import Story from "../models/story.model.js";
import Report from "../models/report.model.js";

import ConvertUserDataToPdf from "./PdfFormat.js";
import { escapeRegex } from "../utils/regex.js";
import { issueOtp } from "./otp.controller.js";
import { issueSession, hashToken, refreshCookieName, refreshCookieOptions } from "../utils/session.js";

const googleClient = process.env.GOOGLE_CLIENT_ID ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID) : null;


export const register = async (req, res) => {
    try {
        const { name, email, password, username } = req.body;

        if (!name || !email || !password || !username) {
            return res.status(400).json({ message: "All fields are required" })
        }

        // Password strength validation
        if (password.length < 8) {
            return res.status(400).json({ message: "Password must be at least 8 characters" });
        }

        // Email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ message: "Invalid email format" });
        }

        // Username validation (alphanumeric + underscores only)
        const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
        if (!usernameRegex.test(username)) {
            return res.status(400).json({ message: "Username must be 3-30 characters, alphanumeric and underscores only" });
        }

        const user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ message: "User already exists" });
        }

        const existingUsername = await User.findOne({ username });
        if (existingUsername) {
            return res.status(400).json({ message: "Username already taken" });
        }

        const HashedPassword = await bcrypt.hash(password, 10)
        const newUser = new User({
            name,
            email,
            password: HashedPassword,
            username
        })
        await newUser.save();
        const profile = new Profile({
            userId: newUser._id
        });
        await profile.save();

        // Account exists but is unusable until the OTP sent here is verified
        // (see login's emailVerified gate below) — matches Play Store's
        // expectation of verified accounts without a separate signup step.
        await issueOtp(email, "signup");

        return res.json({ message: "Registered — check your email for a verification code", email, needsVerification: true })
    }

    catch (error) {
        // Two signups for the same email/username landing within the same
        // findOne-then-save window both pass the checks above and race to
        // insert — the unique index (see users.model.js) is what actually
        // stops the duplicate, so surface it as the same clean 400 those
        // checks would have given, not a raw Mongo error via 500.
        if (error.code === 11000) {
            const field = Object.keys(error.keyPattern || {})[0] || "field";
            return res.status(400).json({ message: `${field === "email" ? "User" : "Username"} already exists` });
        }
        return res.status(500).json({ message: error.message });
    }
}

export const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ message: "All fields are required" });

        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: "User does not exist" });
        if (!user.active) return res.status(403).json({ message: "This account has been suspended" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

        if (!user.emailVerified) {
            return res.status(403).json({
                message: "Please verify your email before logging in",
                needsVerification: true,
                email: user.email
            });
        }

        const accessToken = await issueSession(res, user);
        return res.json({ token: accessToken });

    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}

// Shared by both the popup flow (googleLogin) and the redirect-fallback
// flow (googleLoginCallback) — Safari's Intelligent Tracking Prevention and
// Edge's Tracking Prevention both block the popup+iframe handshake GSI's
// classic ux_mode:"popup" button relies on, so browsers that can't complete
// that handshake fall back to a full-page redirect instead.
const verifyAndUpsertGoogleUser = async (idToken) => {
    if (!googleClient) {
        const err = new Error("Google login is not configured on this server");
        err.status = 501;
        throw err;
    }
    if (!idToken) {
        const err = new Error("idToken is required");
        err.status = 400;
        throw err;
    }

    const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID
    });
    const payload = ticket.getPayload();

    let user = await User.findOne({ email: payload.email });
    if (!user) {
        const usernameBase = payload.email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "");
        let username = usernameBase;
        let suffix = 0;
        while (await User.findOne({ username })) {
            suffix += 1;
            username = `${usernameBase}${suffix}`;
        }
        user = new User({
            name: payload.name || usernameBase,
            email: payload.email,
            username,
            googleId: payload.sub,
            profilePicture: payload.picture || undefined,
            // Google already verified this address — no OTP step needed.
            emailVerified: true
        });
        await user.save();
        await new Profile({ userId: user._id }).save();
    } else if (!user.active) {
        const err = new Error("This account has been suspended");
        err.status = 403;
        throw err;
    } else if (!user.googleId || !user.emailVerified) {
        user.googleId = user.googleId || payload.sub;
        user.emailVerified = true;
        await user.save();
    }

    return user;
};

export const googleLogin = async (req, res) => {
    try {
        const user = await verifyAndUpsertGoogleUser(req.body.idToken);
        const accessToken = await issueSession(res, user);
        return res.json({ token: accessToken });
    } catch (error) {
        console.error("Google login error:", error.message);
        return res.status(error.status || 401).json({ message: error.status ? error.message : "Invalid Google token" });
    }
};

// GSI's redirect ux_mode POSTs here as a real top-level navigation (form
// submit), so it works even when the browser blocks the popup/iframe
// handshake. No separate CSRF check is needed on top of this: the real
// trust boundary is verifyAndUpsertGoogleUser's ID-token signature/audience
// verification below — a forged POST without a genuine Google-signed
// credential fails there regardless of anything else in the request.
export const googleLoginCallback = async (req, res) => {
    const failUrl = `${process.env.FRONTEND_URL}/login?googleError=1`;
    try {
        const user = await verifyAndUpsertGoogleUser(req.body.credential);
        const accessToken = await issueSession(res, user);
        return res.redirect(`${process.env.FRONTEND_URL}/login?googleToken=${accessToken}`);
    } catch (error) {
        console.error("Google login callback error:", error.message);
        return res.redirect(failUrl);
    }
};

// Client sends the userId of the session that's expiring (decoded client-side
// from its own — possibly just-expired — access token, not trusted on its
// own) purely to know which per-account cookie to look at. The actual trust
// boundary is still the signed refresh JWT + its hash match below.
export const refreshAccessToken = async (req, res) => {
    try {
        const { userId } = req.body || {};
        const token = userId ? req.cookies?.[refreshCookieName(userId)] : null;
        if (!token) return res.status(401).json({ message: "No refresh token" });

        const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);
        if (!user || !user.active) return res.status(401).json({ message: "User no longer exists" });
        if (user.refreshTokenHash !== hashToken(token)) {
            return res.status(401).json({ message: "Refresh token has been revoked" });
        }

        const accessToken = await issueSession(res, user); // rotate refresh token too
        return res.json({ token: accessToken });
    } catch (error) {
        return res.status(401).json({ message: "Refresh token invalid or expired, please login again" });
    }
};

// Only signs the current account out — other accounts' cookies (see
// switchAccount) are untouched so quick-switching still works afterward.
export const logout = async (req, res) => {
    try {
        const { userId } = req.body || {};
        if (userId) {
            await User.findByIdAndUpdate(userId, { refreshTokenHash: null });
            res.clearCookie(refreshCookieName(userId), refreshCookieOptions());
        }
        return res.json({ message: "Logged out successfully" });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// Instant switch to an already-logged-in account on this browser, no
// password re-entry — works as long as that account's refresh cookie is
// still there and unexpired (30 days). Falls back to a normal login
// whenever it isn't (e.g. first time switching to it, or it expired).
export const switchAccount = async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) return res.status(400).json({ message: "userId is required" });

        const cookieName = refreshCookieName(userId);
        const token = req.cookies?.[cookieName];
        if (!token) return res.status(401).json({ message: "Please log in to this account", needsLogin: true });

        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
        } catch {
            res.clearCookie(cookieName, refreshCookieOptions());
            return res.status(401).json({ message: "Session expired, please log in again", needsLogin: true });
        }

        const user = await User.findById(decoded.userId);
        if (!user || !user.active) {
            res.clearCookie(cookieName, refreshCookieOptions());
            return res.status(401).json({ message: "Account unavailable", needsLogin: true });
        }
        if (user.refreshTokenHash !== hashToken(token)) {
            res.clearCookie(cookieName, refreshCookieOptions());
            return res.status(401).json({ message: "Session expired, please log in again", needsLogin: true });
        }

        const accessToken = await issueSession(res, user);
        return res.json({ token: accessToken });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};


export const uploadProfilePicture = async (req, res) => {
    try {
        // req.userId is set by verifyToken middleware
        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ message: "User not found" });

        // Delete old picture from Cloudinary
        if (user.profilePicture && user.profilePicture.includes("cloudinary")) {
            try {
                const urlParts = user.profilePicture.split('/');
                const fileNameWithExtension = urlParts[urlParts.length - 1];
                const folderName = urlParts[urlParts.length - 2];
                const publicId = `${folderName}/${fileNameWithExtension.split('.')[0]}`;
                await cloudinary.uploader.destroy(publicId);
                console.log("Old profile picture deleted from Cloudinary:", publicId);
            } catch (cloudErr) {
                console.error("Cloudinary Delete Error:", cloudErr);
            }
        }

        // Save new picture
        user.profilePicture = req.file.path;
        await user.save();

        return res.json({
            message: "Profile successfully updated",
            profilePicture: user.profilePicture
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
}

// Same shape as uploadProfilePicture — old banner cleaned up in Cloudinary
// before the new one is saved. The frontend resizes/crops to the exact
// banner size before this ever gets called; this doesn't re-validate
// dimensions server-side (trusting the client here, same as every other
// image upload in this app).
export const uploadCoverPhoto = async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ message: "User not found" });

        if (user.coverPhoto && user.coverPhoto.includes("cloudinary")) {
            try {
                const urlParts = user.coverPhoto.split('/');
                const fileNameWithExtension = urlParts[urlParts.length - 1];
                const folderName = urlParts[urlParts.length - 2];
                const publicId = `${folderName}/${fileNameWithExtension.split('.')[0]}`;
                await cloudinary.uploader.destroy(publicId);
                console.log("Old cover photo deleted from Cloudinary:", publicId);
            } catch (cloudErr) {
                console.error("Cloudinary Delete Error:", cloudErr);
            }
        }

        user.coverPhoto = req.file.path;
        await user.save();

        return res.json({
            message: "Cover photo updated",
            coverPhoto: user.coverPhoto
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
}

// Generic image upload — the cover picker for Profile Highlights (and
// anything else that just needs "give me a URL for this image") reuses this
// instead of a bespoke multer route per feature.
export const uploadImage = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: "No image provided" });
        return res.json({ url: req.file.path });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
}

export const updateUserProfile = async (req, res) => {
    try {
        const { newUserdata } = req.body;

        // req.userId from verifyToken middleware
        const userFound = await User.findById(req.userId);
        if (!userFound) return res.status(404).json({ message: "User not found" });

        const profile = await Profile.findOne({ userId: userFound._id });
        if (!profile) return res.status(404).json({ message: "Profile not found" });

        // Sanitize: only allow specific profile fields
        const allowedFields = ['bio', 'currentPost', 'pastWork', 'education', 'highlights'];
        const sanitized = {};
        for (const key of allowedFields) {
            if (newUserdata[key] !== undefined) {
                sanitized[key] = newUserdata[key];
            }
        }

        // Highlights come straight from client input — validate at this trust
        // boundary rather than trusting array length/field shape.
        if (Array.isArray(sanitized.highlights)) {
            sanitized.highlights = sanitized.highlights
                .slice(0, 10)
                .filter((h) => h && typeof h.cover === 'string' && h.cover)
                .map((h) => ({
                    title: typeof h.title === 'string' ? h.title.slice(0, 40) : '',
                    cover: h.cover
                }));
        }

        Object.assign(profile, sanitized);
        await profile.save();

        // Update User name if provided
        if (newUserdata.name) {
            userFound.name = newUserdata.name;
            await userFound.save();
        }

        return res.json({ message: "Updated successfully!" });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: error.message });
    }
}



export const getUserAndProfile = async (req, res) => {
    try {
        // req.userId from verifyToken middleware
        // req.userId is already a verified-to-exist user (see verifyToken) —
        // no need to re-fetch the User doc just to read its own id back.
        const userProfile = await Profile.findOne({ userId: req.userId })
            .populate("userId", "name email username profilePicture coverPhoto createAt role googleId");

        if (!userProfile) {
            return res.status(404).json({ message: "profile not found" });
        }

        return res.json(userProfile);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};


export const updateProfileData = async (req, res) => {
    try {
        const { ...newProfileData } = req.body;

        // Same redundant-fetch note as getUserAndProfile above.
        const profile_to_update = await Profile.findOne({ userId: req.userId });
        if (!profile_to_update) return res.status(404).json({ message: "profile not found" });

        // Sanitize: remove any token or userId fields from the update
        delete newProfileData.token;
        delete newProfileData.userId;

        Object.assign(profile_to_update, newProfileData);
        await profile_to_update.save();
        return res.json({ message: "profile updated successfully" });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}

export const findSearchUser = async (req, res) => {
    try {
        // No caller in the app uses this unfiltered anymore (see getSuggestions
        // / searchUsers for the real "find people" flows) — capped rather than
        // deleted, in case something external still hits it, since returning
        // literally every profile in the database on one call doesn't scale.
        const profiles = await Profile.find()
            .populate('userId', 'name username email profilePicture')
            .limit(200)
            .lean();
        return res.json({ profiles });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}


export const downloadProfile = async (req, res) => {
    try {
        const user_id = req.query.id;
        if (!user_id) {
            return res.status(400).json({ message: "Missing user_id in request" });
        }

        const userProfile = await Profile.findOne({ userId: new mongoose.Types.ObjectId(user_id) })
            .populate('userId', 'name username email profilePicture');

        if (!userProfile) {
            return res.status(404).json({ message: "Profile not found" });
        }

        const OutputPath = await ConvertUserDataToPdf(userProfile);
        return res.json({ message: "PDF generated", file: OutputPath });

    } catch (error) {
        console.error("Error generating PDF:", error);
        return res.status(500).json({ message: error.message });
    }
};


export const sendconnectionrequest = async (req, res) => {
    const { connectionId } = req.body;
    try {
        // req.userId from verifyToken middleware
        const user = await User.findById(req.userId);
        if (!user) return res.status(400).json({ message: 'user not found' });

        const connectionUser = await User.findOne({ _id: connectionId });
        if (!connectionUser) return res.status(404).json({ message: 'connection not found' });

        // Prevent sending request to yourself
        if (user._id.toString() === connectionUser._id.toString()) {
            return res.status(400).json({ message: "Cannot send request to yourself" });
        }

        // Check if request already exists IN EITHER DIRECTION
        const existingRequest = await ConnectionRequest.findOne({
            $or: [
                { userId: user._id, connectionId: connectionUser._id },
                { userId: connectionUser._id, connectionId: user._id }
            ]
        });

        if (existingRequest) {
            if (existingRequest.status_accepted === true) {
                return res.status(400).json({ message: "Already connected" });
            } else if (existingRequest.status_accepted === null) {
                return res.status(400).json({ message: "Request already pending" });
            } else {
                return res.status(400).json({ message: "Request was rejected" });
            }
        }

        const request = new ConnectionRequest({
            userId: user._id,
            connectionId: connectionUser._id,
            status_accepted: null
        });

        await request.save();

        // Create persistent notification
        await Notification.create({
            userId: connectionUser._id,
            type: 'connection_request',
            fromUser: user._id,
            message: `${user.name} sent you a connection request`,
            metadata: { requestId: request._id }
        });

        // Emit real-time socket event
        const io = req.app.get('socketio');
        if (io) {
            io.to(connectionUser._id.toString()).emit('connectionRequest', {
                fromUser: {
                    _id: user._id,
                    name: user.name,
                    username: user.username,
                    profilePicture: user.profilePicture
                },
                message: `${user.name} sent you a connection request`,
                requestId: request._id
            });
        }

        return res.json({ message: "Request sent successfully" });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}

export const getMyConnectionRequest = async (req, res) => {
    try {
        // req.userId from verifyToken middleware — already confirmed to exist
        // there, so re-fetching the User doc here just to read its own _id
        // back was a wasted round trip on every call.
        const userId = req.userId;

        const connections = await ConnectionRequest.find({
            $or: [
                { userId },
                { connectionId: userId }
            ]
        })
            .populate('userId', 'name username email profilePicture')
            .populate('connectionId', 'name username email profilePicture')
            .limit(1000)
            .lean();

        const result = connections.map(conn => {
            const iAmSender = conn.userId._id.toString() === userId.toString();
            const otherUser = iAmSender ? conn.connectionId : conn.userId;

            return {
                _id: conn._id,
                status_accepted: conn.status_accepted,
                iAmSender: iAmSender,
                userId: otherUser
            };
        });

        return res.json({ connections: result });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}

export const whatAreMyConnection = async (req, res) => {
    try {
        // Same redundant-fetch note as getMyConnectionRequest above.
        const userId = req.userId;

        const myConnections = await ConnectionRequest.find({
            $or: [
                { userId, status_accepted: true },
                { connectionId: userId, status_accepted: true }
            ]
        })
            .populate('userId', 'name username email profilePicture')
            .populate('connectionId', 'name username email profilePicture')
            .limit(1000)
            .lean();

        const result = myConnections.map(conn => {
            const iAmSender = conn.userId._id.toString() === userId.toString();
            const otherUser = iAmSender ? conn.connectionId : conn.userId;

            return {
                _id: conn._id,
                status_accepted: conn.status_accepted,
                userId: otherUser
            };
        });

        return res.json({ myConnections: result });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}

export const acceptConnectionRequest = async (req, res) => {
    const { requestId, action_type } = req.body;

    try {
        // req.userId from verifyToken middleware
        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ message: "User not found" });

        const connection = await ConnectionRequest.findOne({ _id: requestId });
        if (!connection) {
            return res.status(400).json({ message: "Connection request not found" });
        }

        // ONLY the receiver can accept/reject
        if (connection.connectionId.toString() !== user._id.toString()) {
            return res.status(403).json({
                message: "You can only accept requests sent to you"
            });
        }

        connection.status_accepted = (action_type === 'accept');
        await connection.save();

        // If accepted, notify the sender
        if (action_type === 'accept') {
            const senderUser = await User.findById(connection.userId);
            await Notification.create({
                userId: connection.userId,
                type: 'connection_accepted',
                fromUser: user._id,
                message: `${user.name} accepted your connection request`
            });

            const io = req.app.get('socketio');
            if (io) {
                io.to(connection.userId.toString()).emit('connectionAccepted', {
                    fromUser: {
                        _id: user._id,
                        name: user.name,
                        username: user.username,
                        profilePicture: user.profilePicture
                    },
                    message: `${user.name} accepted your connection request`
                });
            }
        }

        return res.status(200).json({
            message: action_type === 'accept'
                ? "Connection accepted"
                : "Connection rejected"
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}

export const getAllUserBasedOnUsername = async (req, res) => {
    const { username } = req.query
    try {
        const users = await User.findOne({ username })
        if (!users) return res.status(404).json({ message: 'user not found' })
        const userProfile = await Profile.findOne({ userId: users._id })
            .populate('userId', 'name username email profilePicture coverPhoto');
        return res.json({ "profile": userProfile })
    } catch (error) {
        return res.status(500).json({ message: error.message })
    }
}

export const searchUsers = async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) return res.json([]);

        // Escaped so regex metacharacters in user input (".", "(", "+", etc.)
        // can't throw, match garbage, or — with a crafted pattern — pin a CPU
        // core via catastrophic backtracking (ReDoS) on an unauthenticated route.
        const regex = new RegExp(escapeRegex(q.slice(0, 100)), 'i');

        const results = await User.aggregate([
            {
                $lookup: {
                    from: 'profiles',
                    localField: '_id',
                    foreignField: 'userId',
                    as: 'profile'
                }
            },
            {
                $unwind: {
                    path: '$profile',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $match: {
                    $or: [
                        { name: regex },
                        { username: regex },
                        { email: regex },
                        { 'profile.bio': regex },
                        { 'profile.skills': regex },
                        { 'profile.education.school': regex },
                        { 'profile.pastWork.company': regex },
                        { 'profile.pastWork.position': regex }
                    ]
                }
            },
            {
                $project: {
                    _id: 1,
                    name: 1,
                    username: 1,
                    profilePicture: 1,
                    'profile.bio': 1,
                    'profile.skills': 1,
                    'profile.education': 1,
                    'profile.pastWork': 1,
                    matchReason: {
                        $switch: {
                            branches: [
                                { case: { $regexMatch: { input: "$name", regex: regex } }, then: "Name match" },
                                { case: { $regexMatch: { input: "$username", regex: regex } }, then: "Username match" },
                                { case: { $regexMatch: { input: { $ifNull: ["$profile.bio", ""] }, regex: regex } }, then: "Bio match" },
                                // Add more complex matching logic if needed for arrays
                            ],
                            default: "Related match"
                        }
                    }
                }
            },
            { $limit: 20 }
        ]);

        return res.json(results);
    } catch (error) {
        console.error("Search Error:", error);
        return res.status(500).json({ message: "Search failed" });
    }
}

export const getSuggestions = async (req, res) => {
    try {
        const myConnections = await ConnectionRequest.find({
            $or: [{ userId: req.userId }, { connectionId: req.userId }]
        });
        const excludedIds = [req.userId, ...myConnections.map(c =>
            String(c.userId) === String(req.userId) ? c.connectionId : c.userId
        )];

        const suggestions = await User.aggregate([
            { $match: { _id: { $nin: excludedIds.map(id => new mongoose.Types.ObjectId(id)) } } },
            { $sample: { size: 10 } },
            {
                $lookup: {
                    from: 'profiles',
                    localField: '_id',
                    foreignField: 'userId',
                    as: 'profile'
                }
            },
            {
                $unwind: {
                    path: '$profile',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $project: {
                    _id: 1,
                    name: 1,
                    username: 1,
                    profilePicture: 1,
                    'profile.bio': 1,
                    'profile.skills': 1,
                    'profile.education': 1,
                    'profile.pastWork': 1,
                    matchReason: { $literal: "Suggested for you" }
                }
            }
        ]);
        return res.json(suggestions);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}

const cloudinaryPublicId = (url) => {
    const urlParts = url.split('/');
    const fileNameWithExtension = urlParts[urlParts.length - 1];
    const folderName = urlParts[urlParts.length - 2];
    return `${folderName}/${fileNameWithExtension.split('.')[0]}`;
};

// Play Store requires an in-app path to permanently delete an account and
// its data — this removes everything the user owns or is referenced in,
// not just the User document itself.
export const deleteMyAccount = async (req, res) => {
    try {
        const { password } = req.body;
        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ message: "User not found" });

        // Password-based accounts must confirm with their password right
        // before an irreversible delete; Google-only accounts have no
        // password to check, so the (already-required) auth token is the
        // only confirmation available for them.
        if (user.password) {
            if (!password) return res.status(400).json({ message: "Password is required to delete your account" });
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) return res.status(400).json({ message: "Incorrect password" });
        }

        const userId = user._id;

        const myPosts = await Post.find({ userId }).select("_id media").lean();
        const postIds = myPosts.map((p) => p._id);

        const myMessages = await Message.find({ $or: [{ sender: userId }, { receiver: userId }] })
            .select("media")
            .lean();

        const myStories = await Story.find({ userId }).select("media mediaType").lean();

        // Cloudinary cleanup — best-effort, same pattern as every other
        // delete path in this app (a failed remote delete shouldn't block
        // the account from actually being removed).
        const cloudDeletes = [];
        for (const post of myPosts) {
            if (post.media && post.media.includes("cloudinary")) {
                cloudDeletes.push(cloudinary.uploader.destroy(cloudinaryPublicId(post.media)));
            }
        }
        for (const msg of myMessages) {
            for (const m of msg.media || []) {
                if (m.publicId) {
                    cloudDeletes.push(cloudinary.uploader.destroy(m.publicId, { resource_type: m.mediaType === "video" ? "video" : "image" }));
                }
            }
        }
        for (const story of myStories) {
            if (story.media && story.media.includes("cloudinary")) {
                cloudDeletes.push(cloudinary.uploader.destroy(cloudinaryPublicId(story.media), { resource_type: story.mediaType === "video" ? "video" : "image" }));
            }
        }
        if (user.profilePicture?.includes("cloudinary")) {
            cloudDeletes.push(cloudinary.uploader.destroy(cloudinaryPublicId(user.profilePicture)));
        }
        if (user.coverPhoto?.includes("cloudinary")) {
            cloudDeletes.push(cloudinary.uploader.destroy(cloudinaryPublicId(user.coverPhoto)));
        }
        await Promise.allSettled(cloudDeletes);

        await Promise.all([
            Comment.deleteMany({ $or: [{ post_Id: { $in: postIds } }, { userId }] }),
            Post.deleteMany({ userId }),
            Message.deleteMany({ $or: [{ sender: userId }, { receiver: userId }] }),
            Story.deleteMany({ userId }),
            ConnectionRequest.deleteMany({ $or: [{ userId }, { connectionId: userId }] }),
            Notification.deleteMany({ $or: [{ userId }, { fromUser: userId }] }),
            Report.deleteMany({ reporterId: userId }),
            Profile.deleteOne({ userId }),
        ]);

        await User.deleteOne({ _id: userId });

        res.clearCookie("refreshToken", refreshCookieOptions());
        return res.json({ message: "Account permanently deleted" });
    } catch (error) {
        console.error("Delete account error:", error);
        return res.status(500).json({ message: error.message });
    }
};