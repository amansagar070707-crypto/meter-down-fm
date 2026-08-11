import { consumeRateLimit } from "@/lib/cloud/upstash";
import { importPlaylistMetadata } from "@/lib/music/providers";
import { saveImportedPlaylist } from "@/lib/music/store";
import type { NormalizedPlaylist, NormalizedTrack } from "@/lib/music/types";
import { isAuthorizedAdmin, jsonError } from "@/lib/security/admin";

export const dynamic = "force-dynamic";

const MIN_SOURCES = 2;
const MAX_SOURCES = 8;
const DEFAULT_TRACK_LIMIT = 60;
const MAX_TRACK_LIMIT = 200;

function getClientKey(request: Request) {
  const address = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-real-ip") ?? "unknown";
  return `rate:playlist-mix:${address.slice(0, 64)}`;
}

async function createMixId(sourceIds: string[]) {
  const value = sourceIds.slice().sort().join(":");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return `mix-${Array.from(new Uint8Array(digest)).slice(0, 12).map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function interleaveUniqueTracks(playlists: NormalizedPlaylist[], limit: number) {
  const queues = playlists.map((playlist) => playlist.tracks.slice());
  const seen = new Set<string>();
  const tracks: NormalizedTrack[] = [];

  while (tracks.length < limit && queues.some((queue) => queue.length)) {
    for (const queue of queues) {
      let candidate = queue.shift();
      while (candidate && seen.has(candidate.sourceId)) candidate = queue.shift();
      if (!candidate) continue;
      seen.add(candidate.sourceId);
      tracks.push(candidate);
      if (tracks.length === limit) break;
    }
  }

  return tracks;
}

export async function POST(request: Request) {
  if (!(await isAuthorizedAdmin(request))) return jsonError("Unauthorized.", 401);
  if (!request.headers.get("content-type")?.includes("application/json")) return jsonError("JSON body required.", 415);

  try {
    const allowed = await consumeRateLimit(getClientKey(request), 5, 3_600).catch(() => true);
    if (!allowed) return jsonError("Too many playlist mix requests. Try again later.", 429);

    const body = (await request.json()) as {
      urls?: unknown;
      title?: unknown;
      slug?: unknown;
      maxTracks?: unknown;
      activate?: unknown;
    };
    if (!Array.isArray(body.urls) || body.urls.length < MIN_SOURCES || body.urls.length > MAX_SOURCES || body.urls.some((url) => typeof url !== "string")) {
      return jsonError(`urls must contain ${MIN_SOURCES} to ${MAX_SOURCES} YouTube playlist URLs.`, 400);
    }
    if (body.title !== undefined && (typeof body.title !== "string" || !body.title.trim() || body.title.length > 100)) {
      return jsonError("title must contain 1 to 100 characters.", 400);
    }
    if (body.slug !== undefined && (typeof body.slug !== "string" || !/^[a-z0-9-]{1,64}$/.test(body.slug))) {
      return jsonError("Slug must contain only lowercase letters, numbers, and hyphens.", 400);
    }
    if (body.maxTracks !== undefined && (!Number.isInteger(body.maxTracks) || Number(body.maxTracks) < 1 || Number(body.maxTracks) > MAX_TRACK_LIMIT)) {
      return jsonError(`maxTracks must be an integer from 1 to ${MAX_TRACK_LIMIT}.`, 400);
    }
    if (body.activate !== undefined && typeof body.activate !== "boolean") return jsonError("activate must be a boolean.", 400);

    const sources = await Promise.all((body.urls as string[]).map((url) => importPlaylistMetadata(url)));
    if (sources.some((playlist) => playlist.sourceProvider !== "youtube")) {
      return jsonError("Playlist mixes support only YouTube and YouTube Music sources.", 400);
    }

    const maxTracks = body.maxTracks === undefined ? DEFAULT_TRACK_LIMIT : Number(body.maxTracks);
    const tracks = interleaveUniqueTracks(sources, maxTracks);
    if (!tracks.length) return jsonError("The source playlists contain no available videos.", 400);

    const title = typeof body.title === "string" ? body.title.trim() : "Autowale Mixed Playlist";
    const playlist: NormalizedPlaylist = {
      title,
      description: `Curated round-robin mix of ${sources.length} public YouTube playlists.`,
      artworkUrl: sources.find((source) => source.artworkUrl)?.artworkUrl ?? null,
      sourceProvider: "youtube",
      sourceUrl: sources[0].sourceUrl,
      sourceId: await createMixId(sources.map((source) => source.sourceId)),
      tracks,
    };
    const saved = await saveImportedPlaylist(playlist, body.slug as string | undefined, body.activate === true);

    return Response.json({
      playlist: saved,
      mixedSources: sources.map((source) => ({ title: source.title, sourceUrl: source.sourceUrl, trackCount: source.tracks.length })),
      sourceTrackCount: sources.reduce((total, source) => total + source.tracks.length, 0),
      selectedUniqueTrackCount: tracks.length,
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Playlist mix failed.";
    return jsonError(message, 400);
  }
}
