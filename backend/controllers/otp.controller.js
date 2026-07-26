import crypto from "crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import User from "../models/users.model.js";
import Otp from "../models/otp.model.js";
import { sendMail } from "../config/mailer.js";
import { issueSession } from "../utils/session.js";

const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;
const RESET_TOKEN_TTL = "10m";

const hashOtp = (otp) => crypto.createHash("sha256").update(otp).digest("hex");
const generateOtp = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");

const otpEmailHtml = (otp, purpose) => `
  <div style="font-family: sans-serif; max-width: 420px; margin: auto;">
    <h2 style="color:#0447ff;">Mitrata</h2>
    <p>${purpose === "signup" ? "Use this code to verify your email:" : "Use this code to reset your password:"}</p>
    <p style="font-size: 32px; font-weight: 700; letter-spacing: 6px;">${otp}</p>
    <p style="color:#888; font-size: 13px;">This code expires in 10 minutes. If you didn't request this, you can ignore this email.</p>
  </div>
`;

// Shared by send-otp and the register/resend flows — invalidates any prior
// pending code for this (email, purpose) so only the most recent one works.
const issueOtp = async (email, purpose) => {
    const recent = await Otp.findOne({ email, purpose }).sort({ createdAt: -1 });
    if (recent && Date.now() - recent.createdAt.getTime() < RESEND_COOLDOWN_MS) {
        const waitSec = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - recent.createdAt.getTime())) / 1000);
        const err = new Error(`Please wait ${waitSec}s before requesting another code`);
        err.status = 429;
        throw err;
    }

    await Otp.deleteMany({ email, purpose });
    const otp = generateOtp();
    await Otp.create({ email, purpose, otpHash: hashOtp(otp) });
    await sendMail({
        to: email,
        subject: purpose === "signup" ? "Verify your Mitrata account" : "Reset your Mitrata password",
        html: otpEmailHtml(otp, purpose),
    });
};

export const sendOtp = async (req, res) => {
    try {
        const { email, purpose } = req.body;
        if (!email || !["signup", "reset_password"].includes(purpose)) {
            return res.status(400).json({ message: "email and a valid purpose are required" });
        }

        const user = await User.findOne({ email });

        if (purpose === "signup") {
            if (!user) return res.status(404).json({ message: "No account found for this email" });
            if (user.emailVerified) return res.status(400).json({ message: "Email already verified" });
        }
        // reset_password: respond the same way whether or not the account
        // exists, so this endpoint can't be used to enumerate registered emails.
        if (purpose === "reset_password" && !user) {
            return res.json({ message: "If that email has an account, a code has been sent" });
        }

        await issueOtp(email, purpose);
        return res.json({ message: "Verification code sent" });
    } catch (error) {
        return res.status(error.status || 500).json({ message: error.message });
    }
};

export const verifyOtp = async (req, res) => {
    try {
        const { email, otp, purpose } = req.body;
        if (!email || !otp || !["signup", "reset_password"].includes(purpose)) {
            return res.status(400).json({ message: "email, otp and a valid purpose are required" });
        }

        const record = await Otp.findOne({ email, purpose }).sort({ createdAt: -1 });
        if (!record) return res.status(400).json({ message: "Code expired or not found — request a new one" });

        if (record.attempts >= MAX_ATTEMPTS) {
            await Otp.deleteOne({ _id: record._id });
            return res.status(429).json({ message: "Too many attempts — request a new code" });
        }

        if (record.otpHash !== hashOtp(otp)) {
            record.attempts += 1;
            await record.save();
            return res.status(400).json({ message: "Incorrect code" });
        }

        await Otp.deleteOne({ _id: record._id });

        if (purpose === "signup") {
            const user = await User.findOne({ email });
            if (!user) return res.status(404).json({ message: "User not found" });
            user.emailVerified = true;
            // Auto-login on successful verification — matches the UX of every
            // other "confirm and continue" flow in the app rather than
            // bouncing the user to a separate login step right after signup.
            const accessToken = await issueSession(res, user);
            return res.json({ message: "Email verified", verified: true, token: accessToken });
        }

        // reset_password — hand back a short-lived token proving the OTP was
        // checked, so resetPassword doesn't need the OTP re-entered.
        const resetToken = jwt.sign(
            { email, purpose: "reset_password" },
            process.env.JWT_SECRET,
            { expiresIn: RESET_TOKEN_TTL }
        );
        return res.json({ resetToken });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

export const resendOtp = async (req, res) => {
    try {
        const { email, purpose } = req.body;
        if (!email || !["signup", "reset_password"].includes(purpose)) {
            return res.status(400).json({ message: "email and a valid purpose are required" });
        }
        await issueOtp(email, purpose);
        return res.json({ message: "Verification code resent" });
    } catch (error) {
        return res.status(error.status || 500).json({ message: error.message });
    }
};

export const resetPassword = async (req, res) => {
    try {
        const { resetToken, newPassword } = req.body;
        if (!resetToken || !newPassword) {
            return res.status(400).json({ message: "resetToken and newPassword are required" });
        }
        if (newPassword.length < 8) {
            return res.status(400).json({ message: "Password must be at least 8 characters" });
        }

        let decoded;
        try {
            decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
        } catch {
            return res.status(401).json({ message: "Reset link expired — start again" });
        }
        if (decoded.purpose !== "reset_password") {
            return res.status(401).json({ message: "Invalid reset token" });
        }

        const user = await User.findOne({ email: decoded.email });
        if (!user) return res.status(404).json({ message: "User not found" });

        user.password = await bcrypt.hash(newPassword, 10);
        // Reset invalidates every existing session, not just the current
        // device — a password reset is exactly the moment you want any
        // stolen/stale session logged out too.
        user.refreshTokenHash = null;
        await user.save();

        return res.json({ message: "Password reset successfully" });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

export { issueOtp };
