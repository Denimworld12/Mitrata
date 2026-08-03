import { getSpotifyToken } from "../config/spotify.js";

// Proxies Spotify's track search so the client never sees the client
// secret. Returns just what a "pick a song for your post/story" UI needs —
// not Spotify's full track object.
export const searchTracks = async (req, res) => {
    try {
        const q = req.query.q?.trim();
        if (!q) return res.json({ tracks: [] });

        const token = await getSpotifyToken();
        if (!token) return res.json({ tracks: [] }); // not configured — no-op, same as sendPush without Firebase

        const url = `https://api.spotify.com/v1/search?type=track&limit=20&q=${encodeURIComponent(q)}`;
        const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (!response.ok) throw new Error(`Spotify search failed: ${response.status}`);

        const data = await response.json();
        const tracks = (data.tracks?.items || [])
            // A track with no preview_url has nothing to actually play as
            // background audio — filtering here means the UI never has to.
            .filter((t) => t.preview_url)
            .map((t) => ({
                id: t.id,
                title: t.name,
                artist: t.artists.map((a) => a.name).join(", "),
                albumArt: t.album?.images?.[1]?.url || t.album?.images?.[0]?.url || null,
                previewUrl: t.preview_url,
                durationMs: t.duration_ms,
            }));

        return res.json({ tracks });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};
