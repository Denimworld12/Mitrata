import jwt from "jsonwebtoken";
import crypto from "crypto";

// Access token: short-lived, sent in response body, kept in memory/localStorage by client.
// Refresh token: long-lived, sent ONLY as httpOnly cookie, hash stored on the user doc so it can be revoked on logout.
const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const signAccessToken = (userId) =>
    jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });

const signRefreshToken = (userId) =>
    jwt.sign({ userId, type: "refresh" }, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, {
        expiresIn: `${REFRESH_TOKEN_TTL_MS / 1000}s`
    });

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

// Keyed per account rather than one fixed "refreshToken" cookie name — this
// is what lets a browser hold a real, long-lived (30-day) session for
// several accounts at once (see switchAccount) without ever putting a
// refresh token somewhere JS-readable like localStorage. Each cookie is
// still httpOnly; switching accounts only works instantly if that account's
// cookie is still there and unexpired, otherwise it's a normal re-login.
export const refreshCookieName = (userId) => `rt_${userId}`;

const setRefreshCookie = (res, refreshToken, userId) => {
    res.cookie(refreshCookieName(userId), refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: REFRESH_TOKEN_TTL_MS,
        path: "/api"
    });
};

// Shared by login, googleLogin, refreshAccessToken, switchAccount, and
// verifyOtp's signup-verified auto-login — every path that hands out a
// fresh session.
export const issueSession = async (res, user) => {
    const accessToken = signAccessToken(user._id);
    const refreshToken = signRefreshToken(user._id);
    user.refreshTokenHash = hashToken(refreshToken);
    await user.save();
    setRefreshCookie(res, refreshToken, user._id);
    return accessToken;
};

export { hashToken };
