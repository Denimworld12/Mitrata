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

// One user account can have several concurrent sessions now (phone + laptop
// + a future Flutter app) — capped so a compromised/scripted account can't
// grow this array without bound; oldest dropped first.
const MAX_SESSIONS_PER_USER = 10;

// Rough device label parsed out of User-Agent for the login-activity list —
// deliberately not a full UA-parsing dependency, just enough to tell "Chrome
// on Windows" from "Safari on iPhone" at a glance.
export const describeDevice = (userAgent = "") => {
    const ua = userAgent || "";

    // The Flutter app identifies itself with this marker (see mobile's
    // ApiClient request interceptor) instead of dart:io's generic default —
    // callers of this function never need to know mobile exists as a
    // separate case, it's just a nicer label for the same session list.
    const mobileMatch = ua.match(/MitrataMobile\/[\d.]+ \((\w+)\)/);
    if (mobileMatch) return `Mitrata App on ${mobileMatch[1]}`;

    let os = "Unknown OS";
    if (/iPhone|iPad/.test(ua)) os = "iOS";
    else if (/Android/.test(ua)) os = "Android";
    else if (/Mac OS X/.test(ua)) os = "macOS";
    else if (/Windows/.test(ua)) os = "Windows";
    else if (/Linux/.test(ua)) os = "Linux";

    let browser = "Unknown browser";
    if (/Edg\//.test(ua)) browser = "Edge";
    else if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) browser = "Chrome";
    else if (/Firefox\//.test(ua)) browser = "Firefox";
    else if (/Safari\//.test(ua) && !/Chrome/.test(ua)) browser = "Safari";

    return `${browser} on ${os}`;
};

// Keyed per account rather than one fixed "refreshToken" cookie name — this
// is what lets a browser hold a real, long-lived (30-day) session for
// several accounts at once (see switchAccount) without ever putting a
// refresh token somewhere JS-readable like localStorage. Each cookie is
// still httpOnly; switching accounts only works instantly if that account's
// cookie is still there and unexpired, otherwise it's a normal re-login.
export const refreshCookieName = (userId) => `rt_${userId}`;

// Frontend (vercel.app) and backend (onrender.com) are different sites in
// production — a genuinely cross-site relationship, not just cross-port
// like local dev. SameSite=Lax cookies are never attached to cross-site
// XHR/fetch (only top-level GET navigations), so every /auth/refresh call
// silently carried no cookie at all once the 15-minute access token expired,
// bouncing the user to login. SameSite=None (paired with Secure, required
// alongside it) is what actually lets a cross-site XHR send this cookie;
// local dev stays "lax" since localhost:PORT is same-site regardless of port.
const isCrossSiteDeploy = process.env.NODE_ENV === "production";

export const refreshCookieOptions = () => ({
    httpOnly: true,
    secure: isCrossSiteDeploy,
    sameSite: isCrossSiteDeploy ? "none" : "lax",
    path: "/api"
});

const setRefreshCookie = (res, refreshToken, userId) => {
    res.cookie(refreshCookieName(userId), refreshToken, {
        ...refreshCookieOptions(),
        maxAge: REFRESH_TOKEN_TTL_MS
    });
};

// Shared by login, googleLogin, refreshAccessToken, switchAccount, and
// verifyOtp's signup-verified auto-login — every path that hands out a
// fresh session. `req` is optional (passed wherever available) purely to
// label the session for the login-activity list — a missing one just means
// that entry shows as "Unknown browser on Unknown OS", not a functional gap.
export const issueSession = async (res, user, req = null) => {
    const accessToken = signAccessToken(user._id);
    const refreshToken = signRefreshToken(user._id);

    user.sessions = user.sessions || [];
    user.sessions.push({
        tokenHash: hashToken(refreshToken),
        userAgent: req?.headers?.["user-agent"] || "",
        ip: req?.ip || "",
        createdAt: new Date(),
        lastActiveAt: new Date(),
    });
    if (user.sessions.length > MAX_SESSIONS_PER_USER) {
        user.sessions = user.sessions.slice(user.sessions.length - MAX_SESSIONS_PER_USER);
    }
    await user.save();
    setRefreshCookie(res, refreshToken, user._id);
    return accessToken;
};

// Rotates one existing session in place, keyed by its OLD token hash, via a
// single atomic findOneAndUpdate (positional operator) instead of the
// read-array/filter/push/save round trip issueSession does. That mattered
// because refreshCookieName is per-USER, not per-tab — every open tab of the
// same account on the same browser shares one cookie, so when two tabs' 15m
// access tokens expire around the same moment, both fire /auth/refresh with
// the IDENTICAL cookie value at nearly the same time. A read-modify-write
// there is a lost-update race: whichever save() landed second could silently
// overwrite the winner's rotation, leaving BOTH tabs' cookies invalid and
// forcing a real logout — which is exactly the "logging in kicks everyone
// else out" bug this was mistaken for. Here, only one concurrent call can
// match `sessions.tokenHash: oldTokenHash` (Mongo serializes writes to a
// single document); the loser just gets `null` back and no session is lost
// or corrupted, it was already rotated by the winner.
export const rotateSession = async (res, user, oldTokenHash, req = null) => {
    const accessToken = signAccessToken(user._id);
    const refreshToken = signRefreshToken(user._id);

    const Model = user.constructor;
    const updated = await Model.findOneAndUpdate(
        { _id: user._id, "sessions.tokenHash": oldTokenHash },
        {
            $set: {
                "sessions.$.tokenHash": hashToken(refreshToken),
                "sessions.$.lastActiveAt": new Date(),
                "sessions.$.userAgent": req?.headers?.["user-agent"] || "",
                "sessions.$.ip": req?.ip || "",
            }
        },
        { new: true }
    );
    if (!updated) return null; // another request already rotated this exact session

    setRefreshCookie(res, refreshToken, user._id);
    return accessToken;
};

// Bridges login's password step to the 2FA code step without a full session:
// short-lived on purpose (5m is plenty to type a 6-digit code), and its own
// `type` claim so it can never be replayed as an access token even if JWT_SECRET
// is shared with it.
const TWO_FA_CHALLENGE_TTL = "5m";

export const signTwoFactorChallenge = (userId) =>
    jwt.sign({ userId, type: "2fa_challenge" }, process.env.JWT_SECRET, { expiresIn: TWO_FA_CHALLENGE_TTL });

export const verifyTwoFactorChallenge = (token) => {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type !== "2fa_challenge") throw new Error("Invalid challenge token");
    return decoded.userId;
};

// Both Google's and Apple's redirect sign-in flows are genuine top-level
// browser navigations straight to this backend's own origin (their
// authorize/login endpoints POST directly to a redirect_uri here — there's
// no way to route that hop through the frontend's same-origin proxy the way
// every other request goes). A cookie set on THAT response would be scoped
// to the backend's own host, not the frontend's — useless for every later
// request, which all go through the proxy and only ever carry
// frontend-scoped cookies. So neither provider's callback sets a cookie at
// all; each hands back this one-time code instead, and the frontend
// exchanges it via a normal proxied POST (see completeGoogleLogin/
// completeAppleLogin), which DOES land the cookie on the right origin,
// exactly like every other login path. One shared implementation since
// nothing about it is actually provider-specific — only the `type` claim
// differs, so a code minted for one provider can't be replayed as the other's.
const OAUTH_SESSION_CODE_TTL = "2m";

export const signOAuthSessionCode = (userId, provider) =>
    jwt.sign({ userId, type: `${provider}_session_code` }, process.env.JWT_SECRET, { expiresIn: OAUTH_SESSION_CODE_TTL });

export const verifyOAuthSessionCode = (token, provider) => {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type !== `${provider}_session_code`) throw new Error("Invalid session code");
    return decoded.userId;
};

export { hashToken };
