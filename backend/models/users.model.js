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
    password: {
        type: String,
        required: true
    },
    profilePicture: {
        type: String,
        default: 'https://res.cloudinary.com/detvfqvem/image/upload/v1767007231/default_qzkkui.jpg'
    },
    createAt: {
        type: Date,
        default: Date.now
    },
    token: {
        type: String,
        default: '',
        index: true
    }
}, {
    timestamps: true
})
userSchema.index({ token: 1 });
const User = mongoose.model('user', userSchema);
export default User;

