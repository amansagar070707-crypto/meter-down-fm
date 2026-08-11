import "server-only";
import { createClient } from "@supabase/supabase-js";

export class PlaylistDataError extends Error {
  constructor(message = "Playlist storage is unavailable.") {
    super(message);
    this.name = "PlaylistDataError";
  }
}

export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) throw new PlaylistDataError("Supabase is not configured.");

  return createClient(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

