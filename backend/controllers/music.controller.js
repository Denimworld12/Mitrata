// Audius (audius.co) instead of Spotify — Spotify requires the developer
// account itself to have an active Premium subscription just to call
// search, and killed preview_url for any app without extended quota
// (250k+ MAU) back in Nov 2024. Audius is free with no login/API-key/OAuth
// at all, and — unlike Deezer/iTunes/YouTube/SoundCloud — its terms are
// actually written to allow embedding a track as background audio in
// another app's user-generated content. Tradeoff: independent/underground
// catalog, not major-label chart music.
const AUDIUS_APP_NAME = "Mitrata";
const AUDIUS_API_BASE = "https://api.audius.co";

export const searchTracks = async (req, res) => {
    try {
        const q = req.query.q?.trim();
        if (!q) return res.json({ tracks: [] });

        const url = `${AUDIUS_API_BASE}/v1/tracks/search?query=${encodeURIComponent(q)}&app_name=${AUDIUS_APP_NAME}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Audius search failed: ${response.status}`);

        const data = await response.json();
        const tracks = (data.data || []).map((t) => ({
            id: t.id,
            title: t.title,
            artist: t.user?.name || t.user?.handle || "Unknown",
            albumArt: t.artwork?.["480x480"] || t.artwork?.["150x150"] || null,
            // A stable endpoint, not a resolved URL — Audius signs/redirects
            // to short-lived storage URLs (expire in minutes), so this must
            // be re-requested fresh at play time, not resolved once and
            // stored. Playback follows the redirect chain automatically.
            previewUrl: `${AUDIUS_API_BASE}/v1/tracks/${t.id}/stream?app_name=${AUDIUS_APP_NAME}`,
            durationMs: (t.duration || 30) * 1000,
        }));

        return res.json({ tracks });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};
