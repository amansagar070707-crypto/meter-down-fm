import { consumeRateLimit } from "@/lib/cloud/upstash";
import { importPlaylistMetadata } from "@/lib/music/providers";
import { saveImportedPlaylist } from "@/lib/music/store";
import { isAuthorizedAdmin, jsonError } from "@/lib/security/admin";

export const dynamic = "force-dynamic";

function getClientKey(request: Request) {
  const address = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-real-ip") ?? "unknown";
  return `rate:playlist-import:${address.slice(0, 64)}`;
}

export async function POST(request: Request) {
  if (!(await isAuthorizedAdmin(request))) return jsonError("Unauthorized.", 401);
  if (!request.headers.get("content-type")?.includes("application/json")) return jsonError("JSON body required.", 415);

  try {
    const allowed = await consumeRateLimit(getClientKey(request), 10, 3_600).catch(() => true);
    if (!allowed) return jsonError("Too many playlist imports. Try again later.", 429);

    const body = (await request.json()) as { url?: unknown; slug?: unknown; activate?: unknown };
    if (typeof body.url !== "string") return jsonError("A playlist URL is required.", 400);
    if (body.slug !== undefined && (typeof body.slug !== "string" || !/^[a-z0-9-]{1,64}$/.test(body.slug))) {
      return jsonError("Slug must contain only lowercase letters, numbers, and hyphens.", 400);
    }
    if (body.activate !== undefined && typeof body.activate !== "boolean") return jsonError("activate must be a boolean.", 400);

    const playlist = await importPlaylistMetadata(body.url);
    const saved = await saveImportedPlaylist(playlist, body.slug as string | undefined, body.activate === true);
    return Response.json({ playlist: saved, importedMetadataOnly: true }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Playlist import failed.";
    return jsonError(message, 400);
  }
}

