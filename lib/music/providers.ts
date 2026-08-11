import "server-only";
import type { NormalizedPlaylist, NormalizedTrack, SourceProvider } from "@/lib/music/types";

type PlaylistReference = {
  provider: Exclude<SourceProvider, "manual">;
  id: string;
  url: string;
};

function safeUrl(value: string) {
  if (value.length > 2_048) throw new Error("Playlist URL is too long.");
  try {
    return new URL(value);
  } catch {
    throw new Error("Enter a valid Spotify or YouTube playlist URL.");
  }
}

export function parsePlaylistReference(value: string): PlaylistReference {
  const url = safeUrl(value);
  if (url.protocol !== "https:") throw new Error("Playlist URLs must use HTTPS.");

  if (url.hostname === "open.spotify.com") {
    const match = url.pathname.match(/^\/playlist\/([A-Za-z0-9]+)\/?$/);
    if (!match) throw new Error("Enter a Spotify playlist URL, not a track or album URL.");
    return {
      provider: "spotify",
      id: match[1],
      url: `https://open.spotify.com/playlist/${match[1]}`,
    };
  }

  const youtubeHosts = new Set(["music.youtube.com", "www.youtube.com", "youtube.com"]);
  if (youtubeHosts.has(url.hostname) && url.pathname === "/playlist") {
    const playlistId = url.searchParams.get("list") ?? "";
    if (!/^[A-Za-z0-9_-]{10,100}$/.test(playlistId)) throw new Error("The YouTube playlist ID is invalid.");
    return {
      provider: "youtube",
      id: playlistId,
      url: `${url.hostname === "music.youtube.com" ? "https://music.youtube.com" : "https://www.youtube.com"}/playlist?list=${playlistId}`,
    };
  }

  throw new Error("Only open.spotify.com and public YouTube playlist URLs are accepted.");
}

async function fixedHostFetch(url: string, init?: RequestInit) {
  const target = new URL(url);
  const allowedHosts = new Set([
    "api.spotify.com",
    "www.googleapis.com",
  ]);
  if (target.protocol !== "https:" || !allowedHosts.has(target.hostname)) {
    throw new Error("Metadata provider host is not allowed.");
  }

  return fetch(target, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
}

type SpotifyImage = { url?: string };
type SpotifyItem = {
  item?: SpotifyTrack;
  track?: SpotifyTrack;
};
type SpotifyTrack = {
  id?: string;
  name?: string;
  duration_ms?: number;
  type?: string;
  external_urls?: { spotify?: string };
  artists?: Array<{ name?: string }>;
  album?: { name?: string; images?: SpotifyImage[] };
};

async function spotifyJson<T>(path: string) {
  const accessToken = process.env.SPOTIFY_ACCESS_TOKEN;
  if (!accessToken) throw new Error("Spotify metadata import is not configured.");
  const response = await fixedHostFetch(`https://api.spotify.com/v1${path}`, {
    headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` },
  });
  if (response.status === 401) throw new Error("The Spotify admin access token has expired.");
  if (response.status === 403) throw new Error("Spotify only permits importing a playlist owned by or shared with this admin account.");
  if (!response.ok) throw new Error(`Spotify metadata request failed (${response.status}).`);
  return response.json() as Promise<T>;
}

async function importSpotify(reference: PlaylistReference): Promise<NormalizedPlaylist> {
  const playlist = await spotifyJson<{
    name?: string;
    description?: string;
    images?: SpotifyImage[];
  }>(`/playlists/${encodeURIComponent(reference.id)}?fields=name,description,images`);

  const tracks: NormalizedTrack[] = [];
  let offset = 0;
  let total = 1;
  while (offset < total && offset < 1_000) {
    const page = await spotifyJson<{ items?: SpotifyItem[]; total?: number }>(
      `/playlists/${encodeURIComponent(reference.id)}/items?limit=50&offset=${offset}`,
    );
    const items = page.items ?? [];
    total = Math.min(page.total ?? items.length, 1_000);

    for (const entry of items) {
      const track = entry.item ?? entry.track;
      if (!track?.id || !track.name || (track.type && track.type !== "track")) continue;
      tracks.push({
        title: track.name,
        artist: track.artists?.map((artist) => artist.name).filter(Boolean).join(", ") || "Unknown artist",
        album: track.album?.name ?? "",
        durationMs: Number.isFinite(track.duration_ms) ? track.duration_ms! : null,
        artworkUrl: track.album?.images?.[0]?.url ?? null,
        sourceProvider: "spotify",
        sourceUrl: track.external_urls?.spotify ?? `https://open.spotify.com/track/${track.id}`,
        sourceId: track.id,
      });
    }
    offset += items.length || 50;
  }

  return {
    title: playlist.name?.trim() || "Spotify playlist",
    description: playlist.description?.trim() || "",
    artworkUrl: playlist.images?.[0]?.url ?? null,
    sourceProvider: "spotify",
    sourceUrl: reference.url,
    sourceId: reference.id,
    tracks,
  };
}

type YouTubeThumbnail = { url?: string };
type YouTubeSnippet = {
  title?: string;
  description?: string;
  position?: number;
  channelTitle?: string;
  videoOwnerChannelTitle?: string;
  resourceId?: { videoId?: string };
  thumbnails?: Record<string, YouTubeThumbnail>;
};

function bestThumbnail(thumbnails?: Record<string, YouTubeThumbnail>) {
  return thumbnails?.maxres?.url ?? thumbnails?.standard?.url ?? thumbnails?.high?.url ?? thumbnails?.medium?.url ?? thumbnails?.default?.url ?? null;
}

function youtubeCredit(description: string | undefined, kind: "singer" | "writer") {
  if (!description) return "";
  const label = kind === "singer"
    ? "(?:singer(?:s)?|sung by|vocals?|playback singer(?:s)?)"
    : "(?:lyrics?|lyricist|writer|written by)";
  const pattern = new RegExp(`^\\s*${label}\\s*[:–-]\\s*(.+?)\\s*$`, "i");
  for (const line of description.split(/\r?\n/)) {
    const value = line.match(pattern)?.[1]?.trim();
    if (value) return value.replace(/\s*[|•].*$/, "").trim();
  }
  return "";
}

async function youtubeJson<T>(path: string, parameters: Record<string, string>) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) throw new Error("YouTube metadata import is not configured.");
  const url = new URL(`https://www.googleapis.com/youtube/v3/${path}`);
  for (const [key, value] of Object.entries({ ...parameters, key: apiKey })) url.searchParams.set(key, value);
  const response = await fixedHostFetch(url.toString(), { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`YouTube metadata request failed (${response.status}).`);
  return response.json() as Promise<T>;
}

async function importYouTube(reference: PlaylistReference): Promise<NormalizedPlaylist> {
  const details = await youtubeJson<{ items?: Array<{ snippet?: YouTubeSnippet }> }>("playlists", {
    part: "snippet",
    id: reference.id,
    maxResults: "1",
  });
  const playlistSnippet = details.items?.[0]?.snippet;
  if (!playlistSnippet) throw new Error("The YouTube playlist is private, unavailable, or does not exist.");

  const tracks: NormalizedTrack[] = [];
  let pageToken = "";
  do {
    const page = await youtubeJson<{
      nextPageToken?: string;
      items?: Array<{ snippet?: YouTubeSnippet }>;
    }>("playlistItems", {
      part: "snippet",
      playlistId: reference.id,
      maxResults: "50",
      ...(pageToken ? { pageToken } : {}),
    });

    for (const item of page.items ?? []) {
      const snippet = item.snippet;
      const videoId = snippet?.resourceId?.videoId;
      if (!videoId || !snippet?.title || snippet.title === "Deleted video" || snippet.title === "Private video") continue;
      const singer = youtubeCredit(snippet.description, "singer");
      const writer = youtubeCredit(snippet.description, "writer");
      tracks.push({
        title: snippet.title,
        artist: singer || snippet.videoOwnerChannelTitle || snippet.channelTitle || "YouTube artist",
        album: writer,
        durationMs: null,
        artworkUrl: bestThumbnail(snippet.thumbnails),
        sourceProvider: "youtube",
        sourceUrl: `https://www.youtube.com/watch?v=${videoId}`,
        sourceId: videoId,
      });
    }
    pageToken = page.nextPageToken ?? "";
  } while (pageToken && tracks.length < 1_000);

  return {
    title: playlistSnippet.title?.trim() || "YouTube playlist",
    description: playlistSnippet.description?.trim() || "",
    artworkUrl: bestThumbnail(playlistSnippet.thumbnails),
    sourceProvider: "youtube",
    sourceUrl: reference.url,
    sourceId: reference.id,
    tracks: tracks.slice(0, 1_000),
  };
}

export async function importPlaylistMetadata(value: string) {
  const reference = parsePlaylistReference(value);
  return reference.provider === "spotify" ? importSpotify(reference) : importYouTube(reference);
}
