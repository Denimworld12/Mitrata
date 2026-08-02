

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
import crypto from "crypto";
import { authenticator } from "otplib";
import QRCode from "qrcode";

import { issueOtp } from "./otp.controller.js";
import { issueSession, rotateSession, hashToken, refreshCookieName, refreshCookieOptions, signTwoFactorChallenge, verifyTwoFactorChallenge, describeDevice, signOAuthSessionCode, verifyOAuthSessionCode } from "../utils/session.js";
import { sendPush } from "../utils/push.js";

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
        // Lowercased before anything else touches it — otherwise "JohnDoe"
        // and "johndoe" pass the uniqueness check below as two different
        // values (Mongo string comparison is case-sensitive) and register as
        // separate accounts, and whatever case someone happened to type
        // becomes permanent everywhere it's displayed.
        const normalizedUsername = username.toLowerCase();

        const user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ message: "User already exists" });
        }

        const existingUsername = await User.findOne({ username: normalizedUsername });
        if (existingUsername) {
            return res.status(400).json({ message: "Username already taken" });
        }

        const HashedPassword = await bcrypt.hash(password, 10)
        const newUser = new User({
            name,
            email,
            password: HashedPassword,
            username: normalizedUsername,
            // Regular signup already collects name/username explicitly, unlike
            // Google/Apple's auto-generated values — but nobody gets asked for
            // a profile photo at signup either way, and the onboarding page
            // covers that for every account the same way rather than only
            // the OAuth ones.
            onboarded: false
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

        const user = await User.findOne({ email }).select("+twoFactor.enabled");
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

        // Password verified, but the session isn't issued yet — the browser
        // gets a short-lived challenge token instead, and only the matching
        // /auth/2fa/verify-login call (below) actually logs them in.
        if (user.twoFactor?.enabled) {
            return res.json({ requires2FA: true, challengeToken: signTwoFactorChallenge(user._id) });
        }

        const accessToken = await issueSession(res, user, req);
        return res.json({ token: accessToken });

    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}

// Completes a login that stopped at requires2FA above. `code` may be a
// 6-digit authenticator code or one of the one-time backup codes.
export const verifyTwoFactorLogin = async (req, res) => {
    try {
        const { challengeToken, code } = req.body || {};
        if (!challengeToken || !code) return res.status(400).json({ message: "Code is required" });

        let userId;
        try {
            userId = verifyTwoFactorChallenge(challengeToken);
        } catch {
            return res.status(401).json({ message: "Login session expired, please log in again" });
        }

        const user = await User.findById(userId).select("+twoFactor.enabled +twoFactor.secret +twoFactor.backupCodeHashes");
        if (!user || !user.active || !user.twoFactor?.enabled) {
            return res.status(401).json({ message: "Two-step verification is not active for this account" });
        }

        const cleanCode = String(code).replace(/\s/g, "");
        let usedBackupCode = false;

        if (!authenticator.check(cleanCode, user.twoFactor.secret)) {
            const normalized = cleanCode.replace(/-/g, "").toLowerCase();
            const matches = await Promise.all(
                user.twoFactor.backupCodeHashes.map((hash) => bcrypt.compare(normalized, hash))
            );
            const matchIndex = matches.findIndex(Boolean);
            if (matchIndex === -1) return res.status(400).json({ message: "Invalid code" });
            usedBackupCode = true;
            user.twoFactor.backupCodeHashes.splice(matchIndex, 1); // single-use
        }

        if (usedBackupCode) await user.save();

        const accessToken = await issueSession(res, user, req);
        return res.json({ token: accessToken, usedBackupCode });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

export const getTwoFactorStatus = async (req, res) => {
    try {
        const user = await User.findById(req.userId).select("+twoFactor.enabled");
        return res.json({ enabled: !!user?.twoFactor?.enabled });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// Step 1 of enabling: generates a pending secret and a QR code for it.
// Nothing takes effect until verifyTwoFactorSetup confirms the user can
// actually produce a valid code from it.
export const setupTwoFactor = async (req, res) => {
    try {
        const user = await User.findById(req.userId).select("+twoFactor.enabled +twoFactor.secret +twoFactor.backupCodeHashes");
        if (!user) return res.status(404).json({ message: "User not found" });
        if (user.twoFactor.enabled) return res.status(400).json({ message: "Two-step verification is already enabled" });

        const secret = authenticator.generateSecret();
        user.twoFactor.secret = secret;
        await user.save();

        const otpauth = authenticator.keyuri(user.email, "Mitrata", secret);
        const qrCodeDataUrl = await QRCode.toDataURL(otpauth);
        return res.json({ secret, qrCodeDataUrl });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// Step 2: confirms the code, turns 2FA on, and hands back one-time backup
// codes (shown once, stored only as hashes from here on — same handling as
// the password itself).
export const verifyTwoFactorSetup = async (req, res) => {
    try {
        const { code } = req.body || {};
        const user = await User.findById(req.userId).select("+twoFactor.enabled +twoFactor.secret +twoFactor.backupCodeHashes");
        if (!user) return res.status(404).json({ message: "User not found" });
        if (!user.twoFactor.secret) return res.status(400).json({ message: "Start setup first" });
        if (!code || !authenticator.check(String(code).replace(/\s/g, ""), user.twoFactor.secret)) {
            return res.status(400).json({ message: "Invalid code" });
        }

        const backupCodes = Array.from({ length: 8 }, () => crypto.randomBytes(5).toString("hex"));
        user.twoFactor.backupCodeHashes = await Promise.all(backupCodes.map((c) => bcrypt.hash(c, 10)));
        user.twoFactor.enabled = true;
        await user.save();

        return res.json({ message: "Two-step verification enabled", backupCodes });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

export const disableTwoFactor = async (req, res) => {
    try {
        const { password } = req.body || {};
        const user = await User.findById(req.userId).select("+twoFactor.enabled +twoFactor.secret +twoFactor.backupCodeHashes +password");
        if (!user) return res.status(404).json({ message: "User not found" });
        if (!user.twoFactor.enabled) return res.status(400).json({ message: "Two-step verification is not enabled" });

        if (user.password) {
            if (!password) return res.status(400).json({ message: "Password is required to disable two-step verification" });
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) return res.status(400).json({ message: "Incorrect password" });
        }

        user.twoFactor.enabled = false;
        user.twoFactor.secret = null;
        user.twoFactor.backupCodeHashes = [];
        await user.save();

        return res.json({ message: "Two-step verification disabled" });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// Powers Settings > Login activity. "isCurrent" is worked out by hashing
// this very request's own refresh cookie and matching it against the list —
// no separate "current session id" needs to be threaded through anywhere.
export const getSessions = async (req, res) => {
    try {
        const user = await User.findById(req.userId).select("sessions");
        const currentToken = req.cookies?.[refreshCookieName(req.userId)];
        const currentHash = currentToken ? hashToken(currentToken) : null;

        const sessions = (user?.sessions || [])
            .slice()
            .sort((a, b) => new Date(b.lastActiveAt) - new Date(a.lastActiveAt))
            .map((s) => ({
                id: s._id,
                device: describeDevice(s.userAgent),
                ip: s.ip,
                createdAt: s.createdAt,
                lastActiveAt: s.lastActiveAt,
                isCurrent: s.tokenHash === currentHash,
            }));

        return res.json({ sessions });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

export const revokeSession = async (req, res) => {
    try {
        const { id } = req.params;
        await User.findByIdAndUpdate(req.userId, { $pull: { sessions: { _id: id } } });
        return res.json({ message: "Signed out of that device" });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

export const revokeOtherSessions = async (req, res) => {
    try {
        const currentToken = req.cookies?.[refreshCookieName(req.userId)];
        const currentHash = currentToken ? hashToken(currentToken) : null;

        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ message: "User not found" });
        user.sessions = currentHash ? user.sessions.filter((s) => s.tokenHash === currentHash) : [];
        await user.save();

        return res.json({ message: "Signed out of all other devices" });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// Shared by both the popup flow (googleLogin) and the redirect-fallback
// flow (googleLoginCallback) — Safari's Intelligent Tracking Prevention and
// Edge's Tracking Prevention both block the popup+iframe handshake GSI's
// classic ux_mode:"popup" button relies on, so browsers that can't complete
// that handshake fall back to a full-page redirect instead.
// Google's own avatar CDN (lh3.googleusercontent.com/accounts.google.com)
// is on several ad/privacy-blocker filter lists and gets blocked outright by
// browser tracking prevention in third-party contexts — storing that URL
// directly meant a Google-signed-in user's avatar could silently fail to
// render everywhere in the app, on any browser/extension that blocks it.
// Re-hosting through our own Cloudinary once removes that dependency
// entirely; cloudinary.uploader.upload accepts a remote URL directly; it
// fetches server-side, no need to download the bytes ourselves here.
const rehostGoogleAvatar = async (pictureUrl) => {
    if (!pictureUrl) return null;
    try {
        const result = await cloudinary.uploader.upload(pictureUrl, { folder: "mitrata_social" });
        return result.secure_url;
    } catch (err) {
        console.error("Failed to re-host Google avatar:", err.message);
        return pictureUrl; // fall back to the original — better than nothing
    }
};

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
        const usernameBase = payload.email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "").toLowerCase();
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
            profilePicture: (await rehostGoogleAvatar(payload.picture)) || undefined,
            // Google already verified this address — no OTP step needed.
            emailVerified: true,
            // name/username are auto-generated from the Google profile, not
            // chosen by the user — send them through the mobile onboarding
            // page to actually pick both (and a photo) before their first feed load.
            onboarded: false
        });
        await user.save();
        await new Profile({ userId: user._id }).save();
    } else if (!user.active) {
        const err = new Error("This account has been suspended");
        err.status = 403;
        throw err;
    } else {
        let changed = false;
        if (!user.googleId) { user.googleId = payload.sub; changed = true; }
        if (!user.emailVerified) { user.emailVerified = true; changed = true; }
        // Existing accounts created before this fix still point straight at
        // Google's CDN — migrate them the next time they sign in instead of
        // needing a one-off backend script.
        if (!user.profilePicture || user.profilePicture.includes("googleusercontent.com")) {
            user.profilePicture = await rehostGoogleAvatar(payload.picture);
            changed = true;
        }
        if (changed) await user.save();
    }

    return user;
};

export const googleLogin = async (req, res) => {
    try {
        const user = await verifyAndUpsertGoogleUser(req.body.idToken);
        const accessToken = await issueSession(res, user, req);
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
        // No issueSession/cookie here — this response is to a genuine
        // cross-origin top-level navigation (see signOAuthSessionCode's
        // comment for why), so any cookie set on it would be scoped to the
        // wrong origin. The frontend exchanges this one-time code for a real
        // session via completeGoogleLogin below, over a normal same-origin
        // proxied request instead.
        const code = signOAuthSessionCode(user._id, "google");
        return res.redirect(`${process.env.FRONTEND_URL}/login?googleSessionCode=${code}`);
    } catch (error) {
        console.error("Google login callback error:", error.message);
        return res.redirect(failUrl);
    }
};

// Completes googleLoginCallback's redirect hop — called by the frontend as a
// normal proxied POST (same-origin from the browser's point of view), so the
// session cookie this issues actually lands on the frontend's own origin.
export const completeGoogleLogin = async (req, res) => {
    try {
        const { code } = req.body || {};
        if (!code) return res.status(400).json({ message: "Code is required" });

        let userId;
        try {
            userId = verifyOAuthSessionCode(code, "google");
        } catch {
            return res.status(401).json({ message: "Sign-in link expired, please try again" });
        }

        const user = await User.findById(userId);
        if (!user || !user.active) return res.status(401).json({ message: "Account unavailable" });

        const accessToken = await issueSession(res, user, req);
        return res.json({ token: accessToken });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// Apple's own JWKS (their public signing keys for Sign in with Apple) —
// cached in-memory since keys rotate rarely; refetched at most once an hour
// so a genuine rotation is picked up without hitting Apple on every login.
let appleKeysCache = { keys: null, fetchedAt: 0 };
const APPLE_KEYS_TTL_MS = 60 * 60 * 1000;

// The Flutter iOS app's bundle identifier — not a secret, it's baked into
// the shipped app. Native Sign in with Apple on iOS sets the id_token's
// `aud` to this instead of the web Services ID (see verifyAndUpsertAppleUser).
const IOS_BUNDLE_ID = "com.mitrata.mitrataMobile";

const getApplePublicKey = async (kid) => {
    if (!appleKeysCache.keys || Date.now() - appleKeysCache.fetchedAt > APPLE_KEYS_TTL_MS) {
        const response = await fetch("https://appleid.apple.com/auth/keys");
        const { keys } = await response.json();
        appleKeysCache = { keys, fetchedAt: Date.now() };
    }
    const jwk = appleKeysCache.keys.find((k) => k.kid === kid);
    if (!jwk) throw new Error("No matching Apple signing key found");
    return crypto.createPublicKey({ key: jwk, format: "jwk" });
};

// Verifies Apple's identity token (a JWT Apple signs, RS256) against Apple's
// own public keys — the same trust boundary Google's ID-token verification
// gives us via google-auth-library, just done by hand since there's no
// equivalent "apple-auth-library" dependency worth adding for one JWT
// verification (Node's own crypto.createPublicKey already accepts JWK format
// directly, so nothing extra to install).
//
// `appleUserJson` is Apple's separate `user` form field — a JSON string with
// {name: {firstName, lastName}} that Apple sends ONLY on the very first
// authorization (it never repeats the name on subsequent sign-ins), unlike
// the id_token's `email` claim which is present every time.
const verifyAndUpsertAppleUser = async (idToken, appleUserJson) => {
    if (!process.env.APPLE_SERVICES_ID) {
        const err = new Error("Apple login is not configured on this server");
        err.status = 501;
        throw err;
    }
    if (!idToken) {
        const err = new Error("idToken is required");
        err.status = 400;
        throw err;
    }

    const [headerB64] = idToken.split(".");
    const header = JSON.parse(Buffer.from(headerB64, "base64url").toString());
    const publicKey = await getApplePublicKey(header.kid);

    // Apple sets the token's `aud` claim to the Services ID for the web
    // OAuth flow, but to the app's own Bundle ID for native iOS/macOS sign-in
    // (Flutter's sign_in_with_apple on iOS) — accept either audience rather
    // than only the web one, or every native mobile sign-in fails here.
    const payload = jwt.verify(idToken, publicKey, {
        algorithms: ["RS256"],
        audience: [process.env.APPLE_SERVICES_ID, IOS_BUNDLE_ID].filter(Boolean),
        issuer: "https://appleid.apple.com",
    });

    let name = null;
    if (appleUserJson) {
        try {
            const parsed = JSON.parse(appleUserJson);
            if (parsed.name) name = `${parsed.name.firstName || ""} ${parsed.name.lastName || ""}`.trim();
        } catch {
            // Malformed/missing — fall through to the email-derived name below.
        }
    }

    let user = await User.findOne({ $or: [{ appleId: payload.sub }, { email: payload.email }] });
    if (!user) {
        const usernameBase = (payload.email || `apple${payload.sub}`).split("@")[0].replace(/[^a-zA-Z0-9_]/g, "").toLowerCase();
        let username = usernameBase;
        let suffix = 0;
        while (await User.findOne({ username })) {
            suffix += 1;
            username = `${usernameBase}${suffix}`;
        }
        user = new User({
            name: name || usernameBase,
            email: payload.email,
            username,
            appleId: payload.sub,
            // Apple already verified this address — no OTP step needed.
            emailVerified: true,
            // name/username are auto-generated (Apple only sends a real name
            // on the very first authorization, and even then not always) —
            // send them through the mobile onboarding page to actually pick
            // both (and a photo) before their first feed load.
            onboarded: false
        });
        await user.save();
        await new Profile({ userId: user._id }).save();
    } else if (!user.active) {
        const err = new Error("This account has been suspended");
        err.status = 403;
        throw err;
    } else {
        let changed = false;
        if (!user.appleId) { user.appleId = payload.sub; changed = true; }
        if (!user.emailVerified) { user.emailVerified = true; changed = true; }
        if (changed) await user.save();
    }

    return user;
};

// Native Sign in with Apple (Flutter's sign_in_with_apple package hands the
// app an idToken directly — no browser, no redirect hop needed). Mirrors
// googleLogin: verify once, issue our session, done in one round trip.
export const appleLogin = async (req, res) => {
    try {
        const user = await verifyAndUpsertAppleUser(req.body.idToken, req.body.user);
        const accessToken = await issueSession(res, user, req);
        return res.json({ token: accessToken });
    } catch (error) {
        console.error("Apple login error:", error.message);
        return res.status(error.status || 401).json({ message: error.status ? error.message : "Invalid Apple token" });
    }
};

// Apple POSTs here as a real top-level navigation (response_mode=form_post),
// exactly like Google's GSI redirect flow — same reasoning applies for why
// this can't set a session cookie directly (see signOAuthSessionCode).
export const appleLoginCallback = async (req, res) => {
    const failUrl = `${process.env.FRONTEND_URL}/login?appleError=1`;
    try {
        const user = await verifyAndUpsertAppleUser(req.body.id_token, req.body.user);
        const code = signOAuthSessionCode(user._id, "apple");
        return res.redirect(`${process.env.FRONTEND_URL}/login?appleSessionCode=${code}`);
    } catch (error) {
        console.error("Apple login callback error:", error.message);
        return res.redirect(failUrl);
    }
};

// sign_in_with_apple's Android path shows Apple's page in a Chrome Custom
// Tab, which needs a WebAuthenticationOptions.redirectUri to land on —
// unlike the web flow above, the app itself still verifies the id_token
// (via the existing native /auth/apple endpoint) once it's back in the
// foreground, so this route's only job is bouncing the browser back into
// the app with whatever Apple posted, per the plugin's documented contract.
export const appleAndroidCallback = (req, res) => {
    const params = new URLSearchParams(req.body).toString();
    res.send(`<!DOCTYPE html><html><body><script>
        window.location = "intent://callback?${params}#Intent;package=com.mitrata.mitrata_mobile;scheme=signinwithapple;end";
    </script></body></html>`);
};

// Completes appleLoginCallback's redirect hop — mirrors completeGoogleLogin.
export const completeAppleLogin = async (req, res) => {
    try {
        const { code } = req.body || {};
        if (!code) return res.status(400).json({ message: "Code is required" });

        let userId;
        try {
            userId = verifyOAuthSessionCode(code, "apple");
        } catch {
            return res.status(401).json({ message: "Sign-in link expired, please try again" });
        }

        const user = await User.findById(userId);
        if (!user || !user.active) return res.status(401).json({ message: "Account unavailable" });

        const accessToken = await issueSession(res, user, req);
        return res.json({ token: accessToken });
    } catch (error) {
        return res.status(500).json({ message: error.message });
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

        const accessToken = await rotateSession(res, user, hashToken(token), req);
        if (!accessToken) return res.status(401).json({ message: "Refresh token has been revoked" });
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
            const token = req.cookies?.[refreshCookieName(userId)];
            if (token) {
                await User.findByIdAndUpdate(userId, { $pull: { sessions: { tokenHash: hashToken(token) } } });
            }
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

        const accessToken = await rotateSession(res, user, hashToken(token), req);
        if (!accessToken) {
            res.clearCookie(cookieName, refreshCookieOptions());
            return res.status(401).json({ message: "Session expired, please log in again", needsLogin: true });
        }
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

// User-model account fields (username, privacy, push preference) — kept
// separate from updateUserProfile above, which only ever touched the
// Profile document's fields.
export const updateAccountSettings = async (req, res) => {
    try {
        const { name, username, isPrivate, pushEnabled, quietHours, onboarded } = req.body;
        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ message: "User not found" });

        if (name !== undefined) {
            const trimmed = String(name).trim();
            if (!trimmed) return res.status(400).json({ message: "Name cannot be empty" });
            user.name = trimmed.slice(0, 60);
        }

        if (username !== undefined) {
            const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
            if (!usernameRegex.test(username)) {
                return res.status(400).json({ message: "Username must be 3-30 characters, alphanumeric and underscores only" });
            }
            // Lowercased before the "did it actually change" / uniqueness
            // checks — same reasoning as register's normalizedUsername.
            const normalizedUsername = username.toLowerCase();
            if (normalizedUsername !== user.username) {
                const taken = await User.findOne({ username: normalizedUsername, _id: { $ne: user._id } });
                if (taken) return res.status(400).json({ message: "Username already taken" });
                user.username = normalizedUsername;
            }
        }

        if (isPrivate !== undefined) user.isPrivate = !!isPrivate;
        if (pushEnabled !== undefined) user.pushEnabled = !!pushEnabled;
        if (onboarded !== undefined) user.onboarded = !!onboarded;

        if (quietHours !== undefined) {
            const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
            if (quietHours.start !== undefined && !timeRegex.test(quietHours.start)) {
                return res.status(400).json({ message: "quietHours.start must be HH:mm" });
            }
            if (quietHours.end !== undefined && !timeRegex.test(quietHours.end)) {
                return res.status(400).json({ message: "quietHours.end must be HH:mm" });
            }
            if (quietHours.enabled !== undefined) user.quietHours.enabled = !!quietHours.enabled;
            if (quietHours.start !== undefined) user.quietHours.start = quietHours.start;
            if (quietHours.end !== undefined) user.quietHours.end = quietHours.end;
            if (quietHours.timezone !== undefined) user.quietHours.timezone = quietHours.timezone;
        }

        await user.save();
        return res.json({
            message: "Updated successfully!",
            name: user.name,
            isPrivate: user.isPrivate,
            pushEnabled: user.pushEnabled,
            username: user.username,
            quietHours: user.quietHours,
            onboarded: user.onboarded
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ message: "Username already taken" });
        }
        return res.status(500).json({ message: error.message });
    }
};

// Blocking someone removes any existing connection between you (so it
// disappears from both My Network lists) and prevents new connection
// requests/messages either direction, in addition to hiding a private
// account's content — see the isPrivate gate in getUserAndProfile.
export const blockUser = async (req, res) => {
    try {
        const { targetId } = req.body;
        if (!targetId || !mongoose.Types.ObjectId.isValid(targetId)) {
            return res.status(400).json({ message: "A valid targetId is required" });
        }
        if (targetId === req.userId.toString()) {
            return res.status(400).json({ message: "You can't block yourself" });
        }

        await User.updateOne({ _id: req.userId }, { $addToSet: { blockedUsers: targetId } });
        await ConnectionRequest.deleteMany({
            $or: [
                { userId: req.userId, connectionId: targetId },
                { userId: targetId, connectionId: req.userId }
            ]
        });

        return res.json({ message: "User blocked" });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

export const unblockUser = async (req, res) => {
    try {
        const { targetId } = req.body;
        if (!targetId || !mongoose.Types.ObjectId.isValid(targetId)) {
            return res.status(400).json({ message: "A valid targetId is required" });
        }
        await User.updateOne({ _id: req.userId }, { $pull: { blockedUsers: targetId } });
        return res.json({ message: "User unblocked" });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

export const getBlockedUsers = async (req, res) => {
    try {
        const user = await User.findById(req.userId)
            .populate('blockedUsers', 'name username profilePicture')
            .select('blockedUsers');
        return res.json({ blockedUsers: user?.blockedUsers || [] });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};



export const getUserAndProfile = async (req, res) => {
    try {
        // req.userId from verifyToken middleware
        // req.userId is already a verified-to-exist user (see verifyToken) —
        // no need to re-fetch the User doc just to read its own id back.
        const userProfile = await Profile.findOne({ userId: req.userId })
            .populate("userId", "name email username profilePicture coverPhoto createAt role googleId appleId isPrivate pushEnabled quietHours onboarded");

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

        const blocked = user.blockedUsers?.some((id) => id.toString() === connectionUser._id.toString())
            || connectionUser.blockedUsers?.some((id) => id.toString() === user._id.toString());
        if (blocked) {
            return res.status(403).json({ message: "Unable to connect with this user" });
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

        try {
            await request.save();
        } catch (saveError) {
            // The unique pairKey index catching a genuine race — someone else's
            // request for this exact pair landed between our findOne check
            // above and this save. Same friendly message as the check above,
            // not a raw 500.
            if (saveError.code === 11000) {
                return res.status(400).json({ message: "Request already pending" });
            }
            throw saveError;
        }

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
        sendPush(connectionUser._id, {
            title: "New connection request",
            body: `${user.name} sent you a connection request`,
            data: { type: "connection_request", requestId: request._id.toString() }
        }).catch((err) => console.error("sendPush failed:", err.message));

        // Same shape getMyConnectionRequest returns per-item — lets the
        // frontend patch this one new request straight into state instead
        // of refetching the entire connections list just to show it.
        return res.json({
            message: "Request sent successfully",
            connection: {
                _id: request._id,
                status_accepted: null,
                iAmSender: true,
                userId: {
                    _id: connectionUser._id,
                    name: connectionUser.name,
                    username: connectionUser.username,
                    email: connectionUser.email,
                    profilePicture: connectionUser.profilePicture
                }
            }
        });
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

        const connection = await ConnectionRequest.findOne({ _id: requestId })
            .populate('userId', 'name username email profilePicture');
        if (!connection) {
            return res.status(400).json({ message: "Connection request not found" });
        }

        // ONLY the receiver can accept/reject
        if (connection.connectionId.toString() !== user._id.toString()) {
            return res.status(403).json({
                message: "You can only accept requests sent to you"
            });
        }

        // Was unconditional — a double-click, a client retry after a slow
        // response, or the request simply being actioned twice re-created a
        // fresh Notification and re-emitted 'connectionAccepted' every
        // single time, regardless of whether anything actually changed.
        // That's the literal cause of "notification accepted, showing
        // multiple times" — only a genuine pending -> decided transition
        // should ever notify.
        const wasPending = connection.status_accepted === null;

        connection.status_accepted = (action_type === 'accept');
        await connection.save();

        const senderId = connection.userId._id;

        // If accepted, notify the sender — only on the actual transition
        if (wasPending && action_type === 'accept') {
            await Notification.create({
                userId: senderId,
                type: 'connection_accepted',
                fromUser: user._id,
                message: `${user.name} accepted your connection request`
            });

            const io = req.app.get('socketio');
            if (io) {
                io.to(senderId.toString()).emit('connectionAccepted', {
                    fromUser: {
                        _id: user._id,
                        name: user.name,
                        username: user.username,
                        profilePicture: user.profilePicture
                    },
                    message: `${user.name} accepted your connection request`
                });
            }
            sendPush(senderId, {
                title: "Connection accepted",
                body: `${user.name} accepted your connection request`,
                data: { type: "connection_accepted", username: user.username }
            }).catch((err) => console.error("sendPush failed:", err.message));
        }

        // Same shape getMyConnectionRequest returns per-item — lets the
        // frontend patch this one request's new status straight into state
        // instead of refetching the whole connections + requests lists.
        return res.status(200).json({
            message: action_type === 'accept'
                ? "Connection accepted"
                : "Connection rejected",
            connection: {
                _id: connection._id,
                status_accepted: connection.status_accepted,
                iAmSender: false,
                userId: connection.userId
            }
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}

export const getAllUserBasedOnUsername = async (req, res) => {
    const { username } = req.query
    try {
        const targetUser = await User.findOne({ username })
        if (!targetUser) return res.status(404).json({ message: 'user not found' })

        const viewerId = req.userId;
        const isSelf = viewerId && viewerId.toString() === targetUser._id.toString();

        if (targetUser.blockedUsers?.some((id) => id.toString() === viewerId?.toString())) {
            return res.status(404).json({ message: 'user not found' });
        }

        // Private account: only accepted connections (and the owner) see
        // the real profile — everyone else gets a limited card, same as
        // Instagram/X. Search/discovery is unaffected by this.
        let isConnection = isSelf;
        if (!isSelf && targetUser.isPrivate) {
            isConnection = !!(await ConnectionRequest.exists({
                status_accepted: true,
                $or: [
                    { userId: viewerId, connectionId: targetUser._id },
                    { userId: targetUser._id, connectionId: viewerId }
                ]
            }));
        }

        if (targetUser.isPrivate && !isSelf && !isConnection) {
            return res.json({
                profile: {
                    userId: {
                        _id: targetUser._id,
                        name: targetUser.name,
                        username: targetUser.username,
                        profilePicture: targetUser.profilePicture
                    },
                    isPrivateLocked: true
                }
            });
        }

        const userProfile = await Profile.findOne({ userId: targetUser._id })
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
                    // Suspended accounts shouldn't be discoverable via public
                    // search regardless of what matches.
                    active: true,
                    $or: [
                        { name: regex },
                        { username: regex },
                        // No email match: this route has no auth, so matching
                        // on email turned it into an account-enumeration
                        // oracle — feed in someone's email and a hit confirms
                        // they're registered and hands back their name,
                        // username, avatar, bio and work history.
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

        res.clearCookie(refreshCookieName(userId), refreshCookieOptions());
        return res.json({ message: "Account permanently deleted" });
    } catch (error) {
        console.error("Delete account error:", error);
        return res.status(500).json({ message: error.message });
    }
};

// Called once after login (web) / app start (Flutter) with whatever token
// Firebase handed that device — $addToSet so logging in from the same
// device repeatedly doesn't pile up duplicate entries.
export const registerFcmToken = async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) return res.status(400).json({ message: "token is required" });
        await User.updateOne({ _id: req.userId }, { $addToSet: { fcmTokens: token } });
        return res.json({ message: "Token registered" });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// Called on logout — a token that stays registered after logging out would
// keep pushing notifications for an account this device is no longer
// signed into.
export const unregisterFcmToken = async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) return res.status(400).json({ message: "token is required" });
        await User.updateOne({ _id: req.userId }, { $pull: { fcmTokens: token } });
        return res.json({ message: "Token unregistered" });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// PushKit token (iOS only) — see utils/voipPush.js for why this is separate
// from the FCM tokens above.
export const registerVoipToken = async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) return res.status(400).json({ message: "token is required" });
        await User.updateOne({ _id: req.userId }, { $addToSet: { voipTokens: token } });
        return res.json({ message: "Token registered" });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

export const unregisterVoipToken = async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) return res.status(400).json({ message: "token is required" });
        await User.updateOne({ _id: req.userId }, { $pull: { voipTokens: token } });
        return res.json({ message: "Token unregistered" });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};