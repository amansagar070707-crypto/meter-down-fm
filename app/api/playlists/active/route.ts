import { getActivePlaylist } from "@/lib/music/store";
import { PlaylistDataError } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const playlist = await getActivePlaylist();
    if (!playlist) {
      return Response.json(
        { playlist: null, error: "No cloud playlist is active yet." },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }
    return Response.json(
      { playlist },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof PlaylistDataError ? error.message : "Playlist storage is unavailable.";
    return Response.json({ playlist: null, error: message }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
