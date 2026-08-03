// Client Credentials flow — no user login involved, just server-to-server
// auth so the app can search Spotify's catalog. Same "disabled until
// configured" convention as firebase.js/mailer: search silently returns
// nothing if these aren't set, instead of crashing the server.
let cachedToken = null;
let cachedTokenExpiresAt = 0;

const hasCredentials = () => Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);

export const getSpotifyToken = async () => {
    if (!hasCredentials()) return null;
    if (cachedToken && Date.now() < cachedTokenExpiresAt) return cachedToken;

    const basic = Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString("base64");
    const response = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
            Authorization: `Basic ${basic}`,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
    });
    if (!response.ok) throw new Error(`Spotify token request failed: ${response.status}`);

    const data = await response.json();
    cachedToken = data.access_token;
    // Refresh a minute early so a request never races an expiring token.
    cachedTokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
    return cachedToken;
};
