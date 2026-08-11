import { attachTrackAudio } from "@/lib/music/store";
import { isAuthorizedAdmin, jsonError } from "@/lib/security/admin";

export const dynamic = "force-dynamic";

function validateAudioUrl(value: unknown) {
  if (value === null) return null;
  if (typeof value !== "string" || value.length > 2_048) throw new Error("audioUrl must be a valid Supabase Storage URL or null.");
  const configuredBase = process.env.AUDIO_PUBLIC_BASE_URL;
  if (!configuredBase) throw new Error("AUDIO_PUBLIC_BASE_URL is not configured.");

  let target: URL;
  let base: URL;
  try {
    target = new URL(value);
    base = new URL(configuredBase);
  } catch {
    throw new Error("audioUrl must be a valid HTTPS URL.");
  }
  const basePath = base.pathname.endsWith("/") ? base.pathname : `${base.pathname}/`;
  if (target.username || target.password || target.hash || target.protocol !== "https:" || target.origin !== base.origin || !`${target.pathname}/`.startsWith(basePath)) {
    throw new Error("audioUrl must belong to the configured Supabase Storage bucket.");
  }
  return target.toString();
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isAuthorizedAdmin(request))) return jsonError("Unauthorized.", 401);
  if (!request.headers.get("content-type")?.includes("application/json")) return jsonError("JSON body required.", 415);

  try {
    const { id } = await context.params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) return jsonError("Invalid track ID.", 400);
    const body = (await request.json()) as { audioUrl?: unknown; enabled?: unknown };
    if (!("audioUrl" in body) && !("enabled" in body)) return jsonError("Provide audioUrl or enabled.", 400);
    if (body.enabled !== undefined && typeof body.enabled !== "boolean") return jsonError("enabled must be a boolean.", 400);
    const audioUrl = "audioUrl" in body ? validateAudioUrl(body.audioUrl) : undefined;

    const updated = await attachTrackAudio(id, audioUrl, body.enabled as boolean | undefined);
    return updated ? Response.json({ updated: true }) : jsonError("Track not found.", 404);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Track update failed.", 400);
  }
}
