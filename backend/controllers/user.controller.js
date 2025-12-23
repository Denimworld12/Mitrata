

import User from "../models/users.model.js";

import Profile from "../models/profile.model.js";

import bcrypt from "bcrypt";

import crypto from "crypto"

import fs from "fs"
import PDFDocument from "pdfkit";
import mongoose from "mongoose";
import ConnectionRequest from "../models/connection.model.js";


const ConvertUserDataToPdf = async (userData) => {
    if (!userData || !userData.userId) {
        throw new Error("Invalid user data: userId missing");
    }

    const doc = new PDFDocument();
    const OutputPath = crypto.randomBytes(32).toString('hex') + '.pdf';
    const stream = fs.createWriteStream("uploads/" + OutputPath);
    doc.pipe(stream);

    if (userData.userId.profilePicture) {
        doc.image(`uploads/${userData.userId.profilePicture}`, { align: "center", width: 100 });
    }

    doc.fontSize(14).text(`Name: ${userData.userId.name || ''}`);
    doc.fontSize(12).text(`Username: ${userData.userId.username || ''}`);
    doc.fontSize(12).text(`Email: ${userData.userId.email || ''}`);
    doc.fontSize(12).text(`Bio: ${userData.bio || ''}`);
    doc.fontSize(12).text(`Current Position: ${userData.currentPost || ''}`);
    doc.fontSize(12).text("Past Work:");

    if (Array.isArray(userData.pastWork)) {
        userData.pastWork.forEach(work => {
            doc.fontSize(12).text(`Company: ${work.company}`);
            doc.fontSize(12).text(`Position: ${work.position}`);
            doc.fontSize(12).text(`Years: ${work.years}`);
        });
    }

    doc.end();
    return OutputPath;
};



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
        if (!user) return res.status(404).json({ message: "invalid creadential hai " });
        user.profilePicture = req.file.filename;
        await user.save();
        return res.json({ message: "profile succcessfully uploaded mere bhai " });

    } catch (error) {
        return req.status(500).json({ message: res.status })
    }
}

export const updateUserProfile = async (req, res) => {
    try {
        const { token, newUserdata } = req.body
        const user = await user.findOne({ token })
        if (!user) res.status.json({ message: "user not found bhai " })
        const { username, email } = newUserdata
        const exisitUser = await user.findOne({ $or: [{ username }, { email }] });
        if (exisitUser) {
            if (String(exisitUser._id) !== String(user._id))
                return res.status(400).json({ message: "User already exist " });
        }
        Object.assign(user, newUserdata);
        await user.save();
        return res.json({ message: "updated bhai successfully" })
    } catch (error) {
        return res.status(505).json({ message: error });

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
        if (!user) return res.status(400).json({ message: 'user not found' })
        const connectionUser = await User.findOne({ _id: connectionId })
        if (!connectionUser) return res.status(404).json({ message: 'connection not found ' })
        const existingUser = await connectionRequest.findOne(
            {
                userId: user._id,
                connectionId: connectionUser._id
            }
        )
        if (existingUser) return res.status(400).json({ message: "Request already sent " })
        const request = new ConnectionRequest(
            {
                userId: user._id,
                connectionId: connectionUser._id
            }
        )
        await request.save();
        return res.json("request Sent ");
    }
    catch (error) {
        return res.status(505).json({ message: error.message });
    }
}

export const getMyConnectionRequest = async (req, res) => {
    const { token } = req.body;

    try {
        const user = await User.findOne({ token })
        if (!user) return res.status(400).json("user not found");
        const connections = await ConnectionRequest.find({ userId: user.__id })
            .populate('connectionId', 'name username email profilePicture');

        return res.json({ connections })
    } catch (error) {
        return res.status(505).json({ message: error.message })

    }
}

export const whatAreMyConnection = async (req, res) => {
    const { token } = req.body
    try {
        const user = await User.findOne({ token })
        if (!user) return res.status(400).json({ message: 'not found user ' })
        const myConnections = await ConnectionRequest.find({ connectionId: user._id })
            .populate('userId', 'name username email profilePicture')
        return res.json({ myConnections })
    } catch (error) {

    }
}

export const acceptConnectionRequest = async (req, res) => {
    const { token, requestId, actionType } = req.body;
    try {
        const user = await User.findOne({ token })
        if (!user) return res.status.json("user not found");
        const connection = await ConnectionRequest.findOne({ _id: requestId })
        if (!connection) return res.status(400).json({ message: 'connection not found' });
        if (actionType === 'accept') {
            connection.status_accepted = true
        }
        else {
            connection.status_accepted = false
        }
        connection.save();


    } catch (error) {
        return req.status(505).json({ message: error.message })
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