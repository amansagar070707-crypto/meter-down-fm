export type SourceProvider = "spotify" | "youtube" | "manual";

export type NormalizedTrack = {
  title: string;
  artist: string;
  album: string;
  durationMs: number | null;
  artworkUrl: string | null;
  sourceProvider: SourceProvider;
  sourceUrl: string | null;
  sourceId: string;
};

export type NormalizedPlaylist = {
  title: string;
  description: string;
  artworkUrl: string | null;
  sourceProvider: SourceProvider;
  sourceUrl: string;
  sourceId: string;
  tracks: NormalizedTrack[];
};

export type PublicTrack = NormalizedTrack & {
  id: string;
  position: number;
};

export type PublicPlaylist = Omit<NormalizedPlaylist, "tracks"> & {
  id: string;
  slug: string;
  tracks: PublicTrack[];
};
