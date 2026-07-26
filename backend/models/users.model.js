import mongoose from "mongoose";


const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    username: {
        type: String,
        required: true,
        unique: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    active: {
        type: Boolean,
        default: true
    },
    emailVerified: {
        type: Boolean,
        default: false
    },
    password: {
        type: String,
        required: function () { return !this.googleId; }
    },
    googleId: {
        type: String,
        default: null
    },
    role: {
        type: String,
        enum: ["user", "admin"],
        default: "user"
    },
    refreshTokenHash: {
        type: String,
        default: null
    },
    profilePicture: {
        type: String,
        default: 'https://res.cloudinary.com/detvfqvem/image/upload/v1767007231/default_qzkkui.jpg'
    },
    coverPhoto: {
        type: String,
        default: ''
    },
    bookmarks: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "posts"
    }],
}, {
    timestamps: true
})

const User = mongoose.model("user", userSchema);
export default User;
