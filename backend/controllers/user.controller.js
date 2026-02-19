

import User from "../models/users.model.js";

import Profile from "../models/profile.model.js";

import bcrypt from "bcrypt";

import jwt from "jsonwebtoken";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs"
import PDFDocument from "pdfkit";
import mongoose from "mongoose";
import ConnectionRequest from "../models/connection.model.js";
import Notification from "../models/notification.model.js";

import ConvertUserDataToPdf from "./PdfFormat.js";


export const register = async (req, res) => {
    console.log(req.body);
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
        return res.json({ message: "user registered successfully" })
    }

    catch (error) {
        return res.status(500).json({ message: error.message });
    }
}

export const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ message: "All fields are required" });

        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: "User does not exist" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

        // Sign JWT with userId and 7-day expiry
        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        return res.json({ token });

    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}

export const logout = async (req, res) => {
    // JWT is stateless — client removes the token
    // For extra security, you could add a token blacklist collection
    return res.json({ message: "Logged out successfully" });
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

export const updateUserProfile = async (req, res) => {
    try {
        const { newUserdata } = req.body;

        // req.userId from verifyToken middleware
        const userFound = await User.findById(req.userId);
        if (!userFound) return res.status(404).json({ message: "User not found" });

        const profile = await Profile.findOne({ userId: userFound._id });
        if (!profile) return res.status(404).json({ message: "Profile not found" });

        // Sanitize: only allow specific profile fields
        const allowedFields = ['bio', 'currentPost', 'pastWork', 'education'];
        const sanitized = {};
        for (const key of allowedFields) {
            if (newUserdata[key] !== undefined) {
                sanitized[key] = newUserdata[key];
            }
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
        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ message: "user not found" });
        }

        const userProfile = await Profile.findOne({ userId: user._id })
            .populate("userId", "name email username profilePicture createAt");

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

        // req.userId from verifyToken middleware
        const userProfile = await User.findById(req.userId);
        if (!userProfile) return res.status(404).json({ message: "user not found" });

        const profile_to_update = await Profile.findOne({ userId: userProfile._id });
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
        const profiles = await Profile.find().populate('userId', 'name username email profilePicture');
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
            message: `${user.name} sent you a connection request`
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
                message: `${user.name} sent you a connection request`
            });
        }

        return res.json({ message: "Request sent successfully" });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}

export const getMyConnectionRequest = async (req, res) => {
    try {
        // req.userId from verifyToken middleware
        const user = await User.findById(req.userId);
        if (!user) return res.status(400).json({ message: "user not found" });

        const connections = await ConnectionRequest.find({
            $or: [
                { userId: user._id },
                { connectionId: user._id }
            ]
        })
            .populate('userId', 'name username email profilePicture')
            .populate('connectionId', 'name username email profilePicture');

        const result = connections.map(conn => {
            const iAmSender = conn.userId._id.toString() === user._id.toString();
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
        // req.userId from verifyToken middleware
        const user = await User.findById(req.userId);
        if (!user) return res.status(400).json({ message: 'user not found' });

        const myConnections = await ConnectionRequest.find({
            $or: [
                { userId: user._id, status_accepted: true },
                { connectionId: user._id, status_accepted: true }
            ]
        })
            .populate('userId', 'name username email profilePicture')
            .populate('connectionId', 'name username email profilePicture');

        const result = myConnections.map(conn => {
            const iAmSender = conn.userId._id.toString() === user._id.toString();
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
            .populate('userId', 'name username email profilePicture');
        return res.json({ "profile": userProfile })
    } catch (error) {
        return res.status(500).json({ message: error.message })
    }
}

export const searchUsers = async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) return res.json([]);

        const regex = new RegExp(q, 'i'); // Case-insensitive search

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
        const suggestions = await User.aggregate([
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