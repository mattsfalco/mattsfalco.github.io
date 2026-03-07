// Spotify Web API — requires a refresh token for ongoing access.
//
// Setup:
// 1. Create an app at https://developer.spotify.com/dashboard
// 2. Set redirect URI to http://localhost:8888/callback
// 3. Get initial tokens via Authorization Code flow with scopes:
//    user-top-read, user-read-recently-played
// 4. Set these GitHub secrets:
//    SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REFRESH_TOKEN

const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const API_BASE = 'https://api.spotify.com/v1';

async function getAccessToken(clientId, clientSecret, refreshToken) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  const res = await globalThis.fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Spotify token refresh failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return data.access_token;
}

async function fetchApi(endpoint, accessToken) {
  const res = await globalThis.fetch(`${API_BASE}${endpoint}`, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Spotify API ${res.status}: ${await res.text()}`);
  }

  return res.json();
}

function parseTrack(t) {
  const track = t.track || t; // recently-played wraps in { track }
  return {
    name: track.name,
    artist: (track.artists || []).map((a) => a.name).join(', '),
    album: track.album?.name || '',
    album_image: track.album?.images?.[1]?.url || track.album?.images?.[0]?.url || '',
    url: track.external_urls?.spotify || '',
  };
}

function parseArtist(a) {
  return {
    name: a.name,
    genres: (a.genres || []).slice(0, 3),
    image: a.images?.[1]?.url || a.images?.[0]?.url || '',
    url: a.external_urls?.spotify || '',
  };
}

async function fetch_spotify(config) {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    console.log('No Spotify credentials set — keeping existing spotify.json');
    console.log('  Required secrets: SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REFRESH_TOKEN');
    return null;
  }

  console.log('Fetching Spotify data...');

  const accessToken = await getAccessToken(clientId, clientSecret, refreshToken);

  // Fetch top tracks (medium-term ~6 months)
  const topTracksData = await fetchApi('/me/top/tracks?time_range=medium_term&limit=10', accessToken);
  const topTracks = (topTracksData.items || []).map(parseTrack);

  // Fetch top artists (medium-term)
  const topArtistsData = await fetchApi('/me/top/artists?time_range=medium_term&limit=8', accessToken);
  const topArtists = (topArtistsData.items || []).map(parseArtist);

  // Fetch recently played
  const recentData = await fetchApi('/me/player/recently-played?limit=5', accessToken);
  const recentlyPlayed = (recentData.items || []).map(parseTrack);

  return {
    top_tracks: topTracks,
    top_artists: topArtists,
    recently_played: recentlyPlayed,
    _fetched_at: new Date().toISOString(),
  };
}

module.exports = fetch_spotify;
