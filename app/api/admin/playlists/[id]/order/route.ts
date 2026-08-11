import { reorderPlaylist } from "@/lib/music/store";
import { isAuthorizedAdmin, jsonError } from "@/lib/security/admin";

export const dynamic = "force-dynamic";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isAuthorizedAdmin(request))) return jsonError("Unauthorized.", 401);
  if (!request.headers.get("content-type")?.includes("application/json")) return jsonError("JSON body required.", 415);
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return jsonError("Invalid playlist ID.", 400);

  try {
    const body = (await request.json()) as { trackIds?: unknown };
    if (!Array.isArray(body.trackIds) || body.trackIds.length > 1_000 || body.trackIds.some((trackId) => typeof trackId !== "string" || !/^[0-9a-f-]{36}$/i.test(trackId))) {
      return jsonError("trackIds must be an array of playlist track IDs.", 400);
    }
    return (await reorderPlaylist(id, body.trackIds))
      ? Response.json({ reordered: true })
      : jsonError("trackIds must contain every playlist track exactly once.", 400);
  } catch {
    return jsonError("Could not reorder the playlist.", 503);
  }
}

