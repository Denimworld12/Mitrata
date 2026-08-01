// Lightweight "recent accounts" list for the sidebar's switch-account menu —
// name/avatar/email/userId only, never a token or password. The backend
// keeps each account's refresh token as its own httpOnly cookie (see
// refreshCookieName), so switching to one of these is instant as long as
// that cookie is still valid (~30 days) — this list is just what points the
// switcher at the right account; the actual session lives in the cookie.
const KEY = "savedAccounts";
const MAX_ACCOUNTS = 5;

export const getSavedAccounts = () => {
    if (typeof window === "undefined") return [];
    try {
        return JSON.parse(localStorage.getItem(KEY) || "[]");
    } catch {
        return [];
    }
};

export const rememberAccount = (user) => {
    if (typeof window === "undefined" || !user?.email || !user?._id) return;
    const entry = {
        userId: user._id,
        email: user.email,
        name: user.name,
        username: user.username,
        profilePicture: user.profilePicture,
        // Whether this account signed up/links via Google — a Google-only
        // account has no password at all, so if the saved-session cookie
        // ever needs re-auth, the fallback must not be a password field it's
        // literally impossible to fill in.
        googleId: user.googleId || null,
    };
    const existing = getSavedAccounts().filter((a) => a.email !== entry.email);
    const next = [entry, ...existing].slice(0, MAX_ACCOUNTS);
    localStorage.setItem(KEY, JSON.stringify(next));
};

export const removeSavedAccount = (email) => {
    if (typeof window === "undefined") return;
    const next = getSavedAccounts().filter((a) => a.email !== email);
    localStorage.setItem(KEY, JSON.stringify(next));
};
