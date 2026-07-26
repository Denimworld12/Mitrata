import mongoose from "mongoose";

const otpSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        index: true
    },
    otpHash: {
        type: String,
        required: true
    },
    purpose: {
        type: String,
        enum: ["signup", "reset_password"],
        required: true
    },
    attempts: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now,
        // TTL — a code is only ever valid for 10 minutes, same technique as
        // story/notification auto-expiry elsewhere in this app.
        expires: 10 * 60
    }
});

otpSchema.index({ email: 1, purpose: 1 });

const Otp = mongoose.model("Otp", otpSchema);
export default Otp;
