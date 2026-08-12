import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const playlistId = "RDCLAK5uy_kNNx8o3LyD3XF_wKmbZZRMsdiYpo5GjrM";
const oldPlaylistId = "d27b68bb-7d93-4c9a-a170-60e2d3c701b6";
const playlistUrl = `https://music.youtube.com/playlist?list=${playlistId}`;

function log(message) {
  console.log(`${new Date().toISOString()} ${message}`);
}

function bestThumbnail(thumbnails) {
  return thumbnails?.maxres?.url ?? thumbnails?.standard?.url ?? thumbnails?.high?.url ?? thumbnails?.medium?.url ?? thumbnails?.default?.url ?? null;
}

function youtubeCredit(description, kind) {
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

async function youtubeJson(path, parameters) {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${path}`);
  for (const [key, value] of Object.entries({ ...parameters, key: process.env.YOUTUBE_API_KEY })) {
    url.searchParams.set(key, value);
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error(`YouTube ${path} failed (${response.status}): ${await response.text()}`);
  return response.json();
}

log("Fetching playlist metadata");
const details = await youtubeJson("playlists", { part: "snippet", id: playlistId, maxResults: "1" });
const playlistSnippet = details.items?.[0]?.snippet;
if (!playlistSnippet) throw new Error("The new YouTube playlist is unavailable.");

const tracks = [];
const seenVideoIds = new Set();
let pageToken = "";
do {
  log(`Fetching track page ${pageToken ? 2 : 1}`);
  const page = await youtubeJson("playlistItems", {
    part: "snippet",
    playlistId,
    maxResults: "50",
    ...(pageToken ? { pageToken } : {}),
  });
  for (const item of page.items ?? []) {
    const snippet = item.snippet;
    const videoId = snippet?.resourceId?.videoId;
    if (!videoId || !snippet?.title || snippet.title === "Deleted video" || snippet.title === "Private video" || seenVideoIds.has(videoId)) continue;
    seenVideoIds.add(videoId);
    tracks.push({
      id: crypto.randomUUID(),
      position: tracks.length,
      title: snippet.title,
      artist: youtubeCredit(snippet.description, "singer") || snippet.videoOwnerChannelTitle || snippet.channelTitle || "YouTube artist",
      album: youtubeCredit(snippet.description, "writer"),
      duration_ms: null,
      artwork_url: bestThumbnail(snippet.thumbnails),
      source_provider: "youtube",
      source_url: `https://www.youtube.com/watch?v=${videoId}`,
      source_id: videoId,
      audio_url: null,
      is_enabled: true,
      updated_at: new Date().toISOString(),
    });
  }
  pageToken = page.nextPageToken ?? "";
} while (pageToken && tracks.length < 200);

if (!tracks.length) throw new Error("The new playlist contains no available videos.");
log(`Fetched ${tracks.length} unique tracks`);

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const now = new Date().toISOString();
const existingResult = await supabase
  .from("playlists")
  .select("id,slug")
  .eq("source_provider", "youtube")
  .eq("source_id", playlistId)
  .limit(1)
  .maybeSingle();
if (existingResult.error) throw existingResult.error;

const newPlaylistId = existingResult.data?.id ?? crypto.randomUUID();
const slug = existingResult.data?.slug ?? "90s-bollywood";
log("Saving the new playlist");
const playlistWrite = await supabase.from("playlists").upsert({
  id: newPlaylistId,
  slug,
  title: playlistSnippet.title?.trim() || "'90s Bollywood",
  description: playlistSnippet.description?.trim() || "",
  artwork_url: bestThumbnail(playlistSnippet.thumbnails),
  source_provider: "youtube",
  source_url: playlistUrl,
  source_id: playlistId,
  is_active: false,
  updated_at: now,
}, { onConflict: "source_provider,source_id" });
if (playlistWrite.error) throw playlistWrite.error;

log("Replacing the new playlist's tracks");
const deleteTracks = await supabase.from("tracks").delete().eq("playlist_id", newPlaylistId);
if (deleteTracks.error) throw deleteTracks.error;
const insertTracks = await supabase.from("tracks").insert(tracks.map((track) => ({ ...track, playlist_id: newPlaylistId })));
if (insertTracks.error) throw insertTracks.error;

log("Activating the new playlist");
const activation = await supabase.rpc("activate_playlist", { target_playlist_id: newPlaylistId });
if (activation.error) throw activation.error;
if (activation.data !== true) throw new Error("The new playlist could not be activated.");

if (oldPlaylistId !== newPlaylistId) {
  log("Removing the old active playlist");
  const deletion = await supabase.from("playlists").delete().eq("id", oldPlaylistId);
  if (deletion.error) throw deletion.error;
}

log(JSON.stringify({ id: newPlaylistId, title: playlistSnippet.title, trackCount: tracks.length, active: true, oldPlaylistRemoved: oldPlaylistId !== newPlaylistId }));
