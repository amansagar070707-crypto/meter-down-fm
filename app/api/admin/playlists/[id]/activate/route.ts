import { activatePlaylist } from "@/lib/music/store";
import { isAuthorizedAdmin, jsonError } from "@/lib/security/admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isAuthorizedAdmin(request))) return jsonError("Unauthorized.", 401);
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return jsonError("Invalid playlist ID.", 400);
  try {
    return (await activatePlaylist(id)) ? Response.json({ active: true }) : jsonError("Playlist not found.", 404);
  } catch {
    return jsonError("Could not activate the playlist.", 503);
  }
}

