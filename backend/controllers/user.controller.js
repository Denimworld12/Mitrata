

import User from "../models/users.model.js";

import Profile from "../models/profile.model.js";

import bcrypt from "bcrypt";

import crypto from "crypto"
import { v2 as cloudinary } from "cloudinary";
import fs from "fs"
import PDFDocument from "pdfkit";
import mongoose from "mongoose";
import ConnectionRequest from "../models/connection.model.js";

import ConvertUserDataToPdf from "./PdfFormat.js";


export const register = async (req, res) => {
    console.log(req.body);
    try {
        const { name, email, password, username } = req.body;

        if (!name || !email || !password || !username) {
            return res.status(400).json({ message: "All fields are required" })
        }
        const user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ message: "User already exists" });
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
        if (!email || !password) return res.status(400).json({ message: "All feild are required " });
        const user = await User.findOne({
            email
        })
        if (!user) return res.status(404).json({ message: "User does not exist" });
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: "Invalid creadential" });
        const token = crypto.randomBytes(32).toString("hex");
        await User.updateOne({ _id: user._id }, { $set: { token } });
        return res.json({ token })

    } catch (error) {
        return res.status(404).json({ error });
    }
}


export const uploadProfilePicture = async (req, res) => {
    try {
        const { token } = req.body;
        const user = await User.findOne({ token });
        if (!user) return res.status(404).json({ message: "Invalid credentials" });

        // --- NEW: DELETE OLD PICTURE FROM CLOUDINARY ---
        // Check if there is an existing picture and if it is a Cloudinary URL
        if (user.profilePicture && user.profilePicture.includes("cloudinary")) {
            try {
                // Example URL: .../upload/v1234/folder/image_name.jpg
                const urlParts = user.profilePicture.split('/');
                const fileNameWithExtension = urlParts[urlParts.length - 1];
                const folderName = urlParts[urlParts.length - 2]; // e.g., "profile_pics"
                
                const publicId = `${folderName}/${fileNameWithExtension.split('.')[0]}`;
                
                // Delete the old file from Cloudinary
                await cloudinary.uploader.destroy(publicId);
                console.log("Old profile picture deleted from Cloudinary:", publicId);
            } catch (cloudErr) {
                console.error("Cloudinary Delete Error:", cloudErr);
                // We don't block the upload if the old delete fails
            }
        }

        // --- SAVE NEW PICTURE ---
        // req.file.path contains the new Cloudinary URL provided by your storage config
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
        const { token, newUserdata } = req.body;

        // 1. Find the USER first because the token is stored there
        const userFound = await User.findOne({ token });
        if (!userFound) return res.status(404).json({ message: "User not found bhai" });

        // 2. Find the PROFILE using the User's ID (userFound._id)
        const profile = await Profile.findOne({ userId: userFound._id });
        if (!profile) return res.status(404).json({ message: "Profile not found bhai" });

        // 3. Update Profile fields (bio, currentPost, pastWork, education)
        // We use Object.assign to merge newUserdata into the profile document
        Object.assign(profile, newUserdata);
        await profile.save();

        // 4. Update User fields (name)
        if (newUserdata.name) {
            userFound.name = newUserdata.name;
            await userFound.save();
        }

        return res.json({ message: "Updated successfully mere bhai!" });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: error.message });
    }
}



export const getUserAndProfile = async (req, res) => {
    try {
        const { token } = req.query;

        // Find user by token
        const user = await User.findOne({ token });
        if (!user) {
            return res.status(404).json({ message: "user not found" });
        }

        // Find profile linked to this user
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
        const { token, ...newProfileData } = req.body
        const userProfile = await User.findOne({ token: token })
        if (!userProfile) return req.status(404).json({ message: "user not found" })
        const profile_to_update = await Profile.findOne({ userId: userProfile._id })
        Object.assign(profile_to_update, newProfileData)
        await profile_to_update.save()
        return res.json({ message: "profile updated sucessfully" })
    } catch (error) {
        return res.status(505).json({ message: error.message })
    }
}
export const findSearchUser = async (req, res) => {
    try {
        const profiles = await Profile.find().populate('userId', 'name username email profilePicture');
        return res.json({ profiles });
    } catch (error) {
        return res.status(505).json({ message: error.message })

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
    const { token, connectionId } = req.body;
    try {
        const user = await User.findOne({ token });
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
        return res.json({ message: "Request sent successfully" });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}

export const getMyConnectionRequest = async (req, res) => {
    const { token } = req.query;

    try {
        const user = await User.findOne({ token });
        if (!user) return res.status(400).json({ message: "user not found" });

        // Get ALL requests (sent + received)
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
    const { token } = req.query;
    
    try {
        const user = await User.findOne({ token });
        if (!user) return res.status(400).json({ message: 'user not found' });

        // Get ONLY ACCEPTED connections
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
    const { token, requestId, action_type } = req.body;

    try {
        const user = await User.findOne({ token });
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
        return res.status(505).json({ message: error.message })
    }
}