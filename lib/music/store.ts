import "server-only";
import { getSupabaseAdmin, PlaylistDataError } from "@/lib/supabase/server";
import type { NormalizedPlaylist, PublicPlaylist, SourceProvider } from "@/lib/music/types";

type PlaylistRow = {
  id: string;
  slug: string;
  title: string;
  description: string;
  artwork_url: string | null;
  source_provider: SourceProvider;
  source_url: string | null;
  source_id: string | null;
  is_active: boolean;
};

type TrackRow = {
  id: string;
  playlist_id: string;
  position: number;
  title: string;
  artist: string;
  album: string;
  duration_ms: number | null;
  artwork_url: string | null;
  source_provider: SourceProvider;
  source_url: string | null;
  source_id: string | null;
  audio_url: string | null;
  is_enabled: boolean;
};

function slugify(value: string) {
  const slug = value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 64);
  return slug || `playlist-${crypto.randomUUID().slice(0, 8)}`;
}

function storageFailure(message: string): never {
  throw new PlaylistDataError(message);
}

export async function getActivePlaylist(): Promise<PublicPlaylist | null> {
  const supabase = getSupabaseAdmin();
  const playlistResult = await supabase
    .from("playlists")
    .select("id, slug, title, description, artwork_url, source_provider, source_url, source_id, is_active")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (playlistResult.error) storageFailure("Could not load the active Supabase playlist.");
  const playlist = playlistResult.data as PlaylistRow | null;
  if (!playlist) return null;

  const trackResult = await supabase
    .from("tracks")
    .select("id, playlist_id, position, title, artist, album, duration_ms, artwork_url, source_provider, source_url, source_id, audio_url, is_enabled")
    .eq("playlist_id", playlist.id)
    .eq("is_enabled", true)
    .eq("source_provider", "youtube")
    .order("position", { ascending: true });
  if (trackResult.error) storageFailure("Could not load tracks from Supabase.");
  const tracks = (trackResult.data ?? []) as TrackRow[];

  return {
    id: playlist.id,
    slug: playlist.slug,
    title: playlist.title,
    description: playlist.description,
    artworkUrl: playlist.artwork_url,
    sourceProvider: playlist.source_provider,
    sourceUrl: playlist.source_url ?? "",
    sourceId: playlist.source_id ?? "",
    tracks: tracks.flatMap((track) => track.source_id ? [{
      id: track.id,
      position: track.position,
      title: track.title,
      artist: track.artist,
      album: track.album,
      durationMs: track.duration_ms,
      artworkUrl: track.artwork_url,
      sourceProvider: track.source_provider,
      sourceUrl: track.source_url,
      sourceId: track.source_id,
    }] : []),
  };
}

export async function saveImportedPlaylist(playlist: NormalizedPlaylist, requestedSlug?: string, activate = false) {
  const supabase = getSupabaseAdmin();
  const existingPlaylistResult = await supabase
    .from("playlists")
    .select("id, slug, is_active")
    .eq("source_provider", playlist.sourceProvider)
    .eq("source_id", playlist.sourceId)
    .limit(1)
    .maybeSingle();
  if (existingPlaylistResult.error) storageFailure("Could not inspect the existing Supabase playlist.");
  const existingPlaylist = existingPlaylistResult.data as Pick<PlaylistRow, "id" | "slug" | "is_active"> | null;
  const playlistId = existingPlaylist?.id ?? crypto.randomUUID();
  const slug = existingPlaylist?.slug ?? slugify(requestedSlug || playlist.title);

  const existingTracksResult = await supabase
    .from("tracks")
    .select("id, source_provider, source_id, audio_url, is_enabled")
    .eq("playlist_id", playlistId);
  if (existingTracksResult.error) storageFailure("Could not inspect existing Supabase tracks.");
  const existingTracks = (existingTracksResult.data ?? []) as Array<Pick<TrackRow, "id" | "source_provider" | "source_id" | "audio_url" | "is_enabled">>;
  const attachedAudio = new Map(existingTracks.map((track) => [`${track.source_provider}:${track.source_id}`, track]));
  const now = new Date().toISOString();

  const playlistWrite = await supabase.from("playlists").upsert({
    id: playlistId,
    slug,
    title: playlist.title,
    description: playlist.description,
    artwork_url: playlist.artworkUrl,
    source_provider: playlist.sourceProvider,
    source_url: playlist.sourceUrl,
    source_id: playlist.sourceId,
    is_active: existingPlaylist?.is_active ?? false,
    updated_at: now,
  }, { onConflict: "source_provider,source_id" });
  if (playlistWrite.error) storageFailure("Could not save the imported playlist in Supabase.");

  const deleteResult = await supabase.from("tracks").delete().eq("playlist_id", playlistId);
  if (deleteResult.error) storageFailure("Could not replace the Supabase playlist tracks.");

  if (playlist.tracks.length) {
    const trackRows = playlist.tracks.map((track, position) => {
      const attached = attachedAudio.get(`${track.sourceProvider}:${track.sourceId}`);
      return {
        id: attached?.id ?? crypto.randomUUID(),
        playlist_id: playlistId,
        position,
        title: track.title,
        artist: track.artist,
        album: track.album,
        duration_ms: track.durationMs,
        artwork_url: track.artworkUrl,
        source_provider: track.sourceProvider,
        source_url: track.sourceUrl,
        source_id: track.sourceId,
        audio_url: attached?.audio_url ?? null,
        is_enabled: attached?.is_enabled ?? true,
        updated_at: now,
      };
    });
    const insertResult = await supabase.from("tracks").insert(trackRows);
    if (insertResult.error) storageFailure("Could not insert imported tracks into Supabase.");
  }

  if (activate && !(await activatePlaylist(playlistId))) storageFailure("Could not activate the imported Supabase playlist.");
  return { id: playlistId, slug, trackCount: playlist.tracks.length, active: activate || existingPlaylist?.is_active === true };
}

export async function attachTrackAudio(trackId: string, audioUrl: string | null | undefined, enabled?: boolean) {
  const supabase = getSupabaseAdmin();
  const update: { audio_url?: string | null; is_enabled?: boolean; updated_at: string } = { updated_at: new Date().toISOString() };
  if (audioUrl !== undefined) update.audio_url = audioUrl;
  if (enabled !== undefined) update.is_enabled = enabled;
  const result = await supabase.from("tracks").update(update).eq("id", trackId).select("id").maybeSingle();
  if (result.error) storageFailure("Could not update the Supabase track.");
  return Boolean(result.data);
}

export async function activatePlaylist(playlistId: string) {
  const { data, error } = await getSupabaseAdmin().rpc("activate_playlist", { target_playlist_id: playlistId });
  if (error) storageFailure("Could not activate the Supabase playlist.");
  return data === true;
}

export async function getAdminPlaylist(playlistId: string) {
  const supabase = getSupabaseAdmin();
  const playlistResult = await supabase
    .from("playlists")
    .select("id, slug, title, description, artwork_url, source_provider, source_url, source_id, is_active")
    .eq("id", playlistId)
    .limit(1)
    .maybeSingle();
  if (playlistResult.error) storageFailure("Could not load the Supabase playlist.");
  if (!playlistResult.data) return null;
  const trackResult = await supabase
    .from("tracks")
    .select("id, position, title, artist, album, duration_ms, artwork_url, source_provider, source_url, source_id, audio_url, is_enabled")
    .eq("playlist_id", playlistId)
    .order("position", { ascending: true });
  if (trackResult.error) storageFailure("Could not load the Supabase playlist tracks.");
  return { ...(playlistResult.data as PlaylistRow), tracks: (trackResult.data ?? []) as TrackRow[] };
}

export async function reorderPlaylist(playlistId: string, orderedTrackIds: string[]) {
  const { data, error } = await getSupabaseAdmin().rpc("reorder_playlist", {
    target_playlist_id: playlistId,
    ordered_track_ids: orderedTrackIds,
  });
  if (error) storageFailure("Could not reorder the Supabase playlist.");
  return data === true;
}
