"use client";

import Image from "next/image";
import {
  Music2,
  Pause,
  Play,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { shayari } from "@/lib/tracks";

type AudioTrack = {
  id: string;
  title: string;
  artist: string;
  album: string;
  durationMs: number | null;
  artworkUrl: string | null;
  sourceUrl: string | null;
  sourceProvider: "spotify" | "youtube" | "manual";
  sourceId: string;
};

type CloudPlaylist = {
  id: string;
  title: string;
  sourceUrl: string;
  sourceProvider: "spotify" | "youtube" | "manual";
  tracks: AudioTrack[];
};

type YouTubePlayer = {
  cueVideoById: (videoId: string) => void;
  destroy: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  loadVideoById: (videoId: string) => void;
  pauseVideo: () => void;
  playVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
};

type YouTubeNamespace = {
  Player: new (element: HTMLElement, options: {
    videoId: string;
    width: string;
    height: string;
    playerVars: Record<string, number | string>;
    events: {
      onReady: (event: { target: YouTubePlayer }) => void;
      onStateChange: (event: { data: number; target: YouTubePlayer }) => void;
      onError: () => void;
    };
  }) => YouTubePlayer;
  PlayerState: {
    BUFFERING: number;
    CUED: number;
    ENDED: number;
    PAUSED: number;
    PLAYING: number;
  };
};

declare global {
  interface Window {
    YT?: YouTubeNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let youTubeApiPromise: Promise<YouTubeNamespace> | null = null;
const LAST_TRACK_STORAGE_PREFIX = "meter-down-last-track";

function loadYouTubeApi() {
  if (typeof window === "undefined") return Promise.reject(new Error("YouTube playback requires a browser."));
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youTubeApiPromise) return youTubeApiPromise;

  youTubeApiPromise = new Promise<YouTubeNamespace>((resolve, reject) => {
    const previousReadyHandler = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousReadyHandler?.();
      if (window.YT?.Player) resolve(window.YT);
      else reject(new Error("YouTube Player API did not initialize."));
    };

    const existingScript = document.querySelector<HTMLScriptElement>('script[src="https://www.youtube.com/iframe_api"]');
    if (existingScript) return;

    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => {
      youTubeApiPromise = null;
      reject(new Error("YouTube Player API could not be loaded."));
    };
    document.head.appendChild(script);
  });

  return youTubeApiPromise;
}

function ListenerPill() {
  const [listeners, setListeners] = useState<number | null>(4);
  const [presenceLoading, setPresenceLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const storageKey = "meter-down-listener-session";
    let sessionId = window.sessionStorage.getItem(storageKey);
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      window.sessionStorage.setItem(storageKey, sessionId);
    }
    const heartbeat = async () => {
      try {
        const response = await fetch("/api/presence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
          cache: "no-store",
        });
        const payload = (await response.json()) as { online?: number | null };
        if (active && typeof payload.online === "number") setListeners(payload.online);
      } catch {
        // Presence is decorative and must not affect playback.
      } finally {
        if (active) setPresenceLoading(false);
      }
    };
    void heartbeat();
    const interval = window.setInterval(heartbeat, 45_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  return (
    <div
      className="listener-pill"
      aria-busy={presenceLoading}
      aria-label={presenceLoading ? "Loading online listener count" : listeners === null ? "Online listener count unavailable" : `${listeners} sawaari listening online`}
    >
      <span className="live-dot" aria-hidden="true" />
      <span className="listener-number">{listeners ?? 4}</span>
      <span>सवारी online</span>
    </div>
  );
}

function LocalClock() {
  const [time, setTime] = useState("--:--");

  useEffect(() => {
    const update = () => setTime(new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" }).format(new Date()));
    update();
    const interval = window.setInterval(update, 30_000);
    return () => window.clearInterval(interval);
  }, []);

  return <time className="local-clock">{time}</time>;
}

function PlatformLinks({ url, provider, loading }: { url?: string; provider?: CloudPlaylist["sourceProvider"]; loading: boolean }) {
  if (loading) {
    return (
      <div className="platform-links platform-links--loading" aria-label="Loading playlist source" aria-busy="true">
        <span className="platform-link-skeleton skeleton-block" aria-hidden="true" />
      </div>
    );
  }
  if (!url || !provider) return <span aria-hidden="true" />;
  const label = provider === "youtube" ? "YouTube Music" : provider === "spotify" ? "Spotify" : "playlist source";
  return (
    <nav className="platform-links" aria-label="Music source">
      <a href={url} target="_blank" rel="noreferrer" aria-label={`Open ${label} playlist`} title={`Open ${label} playlist`}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 0C5.376 0 0 5.376 0 12s5.376 12 12 12 12-5.376 12-12S18.624 0 12 0zm0 19.104c-3.924 0-7.104-3.18-7.104-7.104S8.076 4.896 12 4.896s7.104 3.18 7.104 7.104-3.18 7.104-7.104 7.104zm0-13.332c-3.432 0-6.228 2.796-6.228 6.228S8.568 18.228 12 18.228s6.228-2.796 6.228-6.228S15.432 5.772 12 5.772zM9.684 15.54V8.46L15.816 12l-6.132 3.54z" />
        </svg>
      </a>
    </nav>
  );
}

function ShayariLine() {
  const [index, setIndex] = useState(1);
  const words = shayari[index].split(" ");

  useEffect(() => {
    const interval = window.setInterval(() => {
      setIndex((current) => (current + 1) % shayari.length);
    }, 5_000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="shayari-line" aria-live="polite">
      <p key={index} className="shayari-line__text" aria-label={shayari[index]}>
        {words.map((word, wordIndex) => (
          <span
            key={`${word}-${wordIndex}`}
            aria-hidden="true"
            style={{ "--word-index": wordIndex } as React.CSSProperties}
          >
            {word}
          </span>
        ))}
      </p>
      <button type="button" onClick={() => setIndex((current) => (current + 1) % shayari.length)} aria-label="Show another line">
        <svg
          className="shayari-line__next-icon"
          xmlns="http://www.w3.org/2000/svg"
          width={24}
          height={24}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path stroke="none" d="M0 0h24v24H0z" fill="none" />
          <path d="M15 14l4 -4l-4 -4" />
          <path d="M19 10h-11a4 4 0 1 0 0 8h1" />
        </svg>
      </button>
    </div>
  );
}

function HornButton({ onHorn }: { onHorn: () => void }) {
  return (
    <button className="horn-button" type="button" onClick={onHorn} aria-label="Play auto horn">
      <span className="horn-button__icon" aria-hidden="true"><Volume2 size={16} /></span>
      <span><strong>हॉर्न ओके प्लीज़</strong><small>Horn ok pleaseeee</small></span>
    </button>
  );
}

function Hero({ onHorn, playlist, catalogLoading }: {
  onHorn: () => void;
  playlist: CloudPlaylist | null;
  catalogLoading: boolean;
}) {
  return (
    <section className="hero hero--night" aria-labelledby="hero-title">
      <Image
        className="hero__image hero__image--active"
        src="/auto-wala-interior.png"
        alt="Passenger view inside a Delhi auto-rickshaw, looking toward its glowing fare meter and handlebar"
        fill
        priority
        draggable={false}
        sizes="100vw"
      />
      <div className="hero__wash" aria-hidden="true" />
      <div className="hero__topbar">
        <LocalClock />
        <ListenerPill />
        <div className="hero__topbar-actions">
          <PlatformLinks url={playlist?.sourceUrl} provider={playlist?.sourceProvider} loading={catalogLoading} />
        </div>
      </div>
      <div className="hero__title-wrap">
        <span className="route-stamp">DL 01 · NIGHT ROUTE</span>
        <h1 id="hero-title">मीटर डाउन</h1>
        <div className="hero__fm" aria-hidden="true"><span>FM</span></div>
        <p className="hero__tagline">दिल्ली की सड़कों का अपना रेडियो</p>
      </div>
      <HornButton onHorn={onHorn} />
      <ShayariLine />
    </section>
  );
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;
}

function getTrackCredits(track: AudioTrack) {
  const publisherName = /(official|records?|music|vevo|topic|t-?series|tips|sony|saregama|zee)/i.test(track.artist);
  const labelledSinger = track.title.match(/(?:singer|singers|vocals?)\s*[:–-]\s*([^|•]+)/i)?.[1]?.trim();
  const titleSections = track.title.split(/[|•]/).map((section) => section.trim()).filter(Boolean);
  const inferredSinger = [...titleSections].reverse().find((section) =>
    /(?:,|&|\band\b)/i.test(section)
    && !/\b(video|song|movie|film|hits?|lyrics?|official|full|hd|4k|jukebox)\b/i.test(section),
  );
  const singer = labelledSinger ?? (!publisherName ? track.artist : inferredSinger);
  const writer = track.album.trim() || track.title.match(/(?:lyrics?|lyricist|writer|written by)\s*[:–-]\s*([^|•]+)/i)?.[1]?.trim();
  return { singer, writer };
}

function getInitialTrackIndex(playlist: CloudPlaylist | null) {
  if (!playlist?.tracks.length || typeof window === "undefined") return 0;

  try {
    const lastTrackId = window.localStorage.getItem(`${LAST_TRACK_STORAGE_PREFIX}:${playlist.id}`);
    if (!lastTrackId) return 0;
    const lastTrackIndex = playlist.tracks.findIndex((item) => item.id === lastTrackId);
    return lastTrackIndex >= 0 ? lastTrackIndex : 0;
  } catch {
    return 0;
  }
}

function PlayerSkeleton() {
  return (
    <aside className="minimal-player minimal-player--loading" aria-label="Loading Meter Down FM player" aria-busy="true" role="status">
      <span className="minimal-player__artwork player-skeleton__artwork skeleton-block" aria-hidden="true" />
      <div className="minimal-player__body player-skeleton__body" aria-hidden="true">
        <span className="player-skeleton__title skeleton-block" />
        <span className="player-skeleton__artist skeleton-block" />
        <span className="player-skeleton__progress skeleton-block" />
        <div className="player-skeleton__time"><span className="skeleton-block" /><span className="skeleton-block" /></div>
      </div>
      <div className="minimal-player__controls player-skeleton__controls" aria-hidden="true">
        <span className="player-skeleton__control player-skeleton__control--utility skeleton-block" />
        <span className="player-skeleton__control skeleton-block" />
        <span className="player-skeleton__control player-skeleton__control--play skeleton-block" />
        <span className="player-skeleton__control skeleton-block" />
        <span className="player-skeleton__control player-skeleton__control--utility skeleton-block" />
      </div>
      <span className="visually-hidden">Cloud playlist and playback controls are loading.</span>
    </aside>
  );
}

function MinimalPlayer({ playlist, catalogLoading, catalogError }: {
  playlist: CloudPlaylist | null;
  catalogLoading: boolean;
  catalogError: string;
}) {
  const youTubeHostRef = useRef<HTMLDivElement>(null);
  const youTubePlayerRef = useRef<YouTubePlayer | null>(null);
  const playlistToggleRef = useRef<HTMLButtonElement>(null);
  const activeTrackRef = useRef<HTMLButtonElement>(null);
  const changeTrackRef = useRef<(direction: -1 | 1, shouldAutoplay?: boolean) => void>(() => undefined);
  const autoplayNextRef = useRef(false);
  const [trackIndex, setTrackIndex] = useState(() => getInitialTrackIndex(playlist));
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPlaybackLoading, setIsPlaybackLoading] = useState(false);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [isShuffled, setIsShuffled] = useState(false);
  const [isPlaylistOpen, setIsPlaylistOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState("");
  const tracks = playlist?.tracks ?? [];
  const track = tracks[trackIndex];
  const credits = track ? getTrackCredits(track) : null;
  const lastTrackStorageKey = playlist ? `${LAST_TRACK_STORAGE_PREFIX}:${playlist.id}` : null;

  useEffect(() => {
    if (!lastTrackStorageKey || !track) return;

    try {
      window.localStorage.setItem(lastTrackStorageKey, track.id);
    } catch {
      // Ignore storage failures; playback should continue normally.
    }
  }, [lastTrackStorageKey, playlist?.id, track]);

  const changeTrack = useCallback((direction: -1 | 1, shouldAutoplay = isPlaying) => {
    if (!tracks.length) return;
    autoplayNextRef.current = shouldAutoplay;
    setCurrentTime(0);
    setDuration(0);
    setError("");
    setTrackIndex((current) => {
      if (isShuffled && tracks.length > 1) {
        let next = current;
        while (next === current) next = Math.floor(Math.random() * tracks.length);
        return next;
      }
      return (current + direction + tracks.length) % tracks.length;
    });
  }, [isPlaying, isShuffled, tracks.length]);

  const selectTrack = (index: number) => {
    setError("");
    setIsPlaylistOpen(false);

    if (index === trackIndex) {
      if (!isPlaying) {
        setIsPlaybackLoading(true);
        if (youTubePlayerRef.current && isPlayerReady) {
          youTubePlayerRef.current.playVideo();
        } else {
          autoplayNextRef.current = true;
        }
      }
      return;
    }

    autoplayNextRef.current = true;
    setIsPlaybackLoading(true);
    setCurrentTime(0);
    setDuration(0);
    setTrackIndex(index);
  };

  const togglePlaylist = () => {
    setIsPlaylistOpen((current) => !current);
  };

  useEffect(() => {
    changeTrackRef.current = changeTrack;
  }, [changeTrack]);

  useEffect(() => {
    if (!track || track.sourceProvider !== "youtube" || !youTubeHostRef.current) return;
    let cancelled = false;
    setIsPlaybackLoading(true);
    setIsPlayerReady(false);

    void loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !youTubeHostRef.current) return;
        const player = new YT.Player(youTubeHostRef.current, {
          videoId: track.sourceId,
          width: "100%",
          height: "100%",
          playerVars: {
            controls: 0,
            enablejsapi: 1,
            fs: 0,
            playsinline: 1,
            rel: 0,
            origin: window.location.origin,
          },
          events: {
            onReady: ({ target }) => {
              if (cancelled) return;
              youTubePlayerRef.current = target;
              setIsPlayerReady(true);
              setIsPlaybackLoading(false);
            },
            onStateChange: ({ data, target }) => {
              if (data === YT.PlayerState.PLAYING) {
                setIsPlaying(true);
                setIsPlaybackLoading(false);
                setDuration(target.getDuration() || 0);
              } else if (data === YT.PlayerState.PAUSED || data === YT.PlayerState.CUED) {
                setIsPlaying(false);
                setIsPlaybackLoading(false);
              } else if (data === YT.PlayerState.BUFFERING) {
                setIsPlaybackLoading(true);
              } else if (data === YT.PlayerState.ENDED) {
                setIsPlaying(false);
                changeTrackRef.current(1, true);
              }
            },
            onError: () => {
              setIsPlaybackLoading(false);
              setIsPlaying(false);
              setError("This video cannot be played in the embedded YouTube player. Try the next track.");
            },
          },
        });
        youTubePlayerRef.current = player;
      })
      .catch(() => {
        if (cancelled) return;
        setIsPlaybackLoading(false);
        setError("The official YouTube player could not be loaded.");
      });

    return () => {
      cancelled = true;
      youTubePlayerRef.current?.destroy();
      youTubePlayerRef.current = null;
    };
    // The player persists while the selected YouTube track changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(track && track.sourceProvider === "youtube")]);

  useEffect(() => {
    if (!isPlaylistOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setIsPlaylistOpen(false);
      playlistToggleRef.current?.focus();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlaylistOpen]);

  useEffect(() => {
    if (!isPlaylistOpen) return;
    const frame = window.requestAnimationFrame(() => activeTrackRef.current?.scrollIntoView({ block: "nearest" }));
    return () => window.cancelAnimationFrame(frame);
  }, [isPlaylistOpen]);

  useEffect(() => {
    if (!track || track.sourceProvider !== "youtube") return;
    const player = youTubePlayerRef.current;
    if (!player || !isPlayerReady) return;
    if (autoplayNextRef.current) {
      autoplayNextRef.current = false;
      player.loadVideoById(track.sourceId);
    } else {
      player.cueVideoById(track.sourceId);
    }
  }, [isPlayerReady, track]);

  useEffect(() => {
    if (!isPlayerReady) return;
    const interval = window.setInterval(() => {
      const player = youTubePlayerRef.current;
      if (!player) return;
      setCurrentTime(player.getCurrentTime() || 0);
      setDuration(player.getDuration() || (track?.durationMs ?? 0) / 1_000);
    }, 250);
    return () => window.clearInterval(interval);
  }, [isPlayerReady, track?.durationMs]);

  const togglePlayback = () => {
    const player = youTubePlayerRef.current;
    if (!player || !track || track.sourceProvider !== "youtube") return;
    setError("");

    if (isPlaying) {
      player.pauseVideo();
      return;
    }
    player.playVideo();
  };

  const seekTo = (value: number) => {
    const player = youTubePlayerRef.current;
    if (!player) return;
    player.seekTo(value, true);
    setCurrentTime(value);
  };

  if (catalogLoading) return <PlayerSkeleton />;

  return (
    <>
      {track?.sourceProvider === "youtube" ? (
        <div className="youtube-playback-engine" aria-hidden="true">
          <div ref={youTubeHostRef} />
        </div>
      ) : null}

      {isPlaylistOpen ? (
        <section className="playlist-panel" id="active-playlist-panel" aria-labelledby="active-playlist-title">
          <header className="playlist-panel__header">
            <div>
              <strong id="active-playlist-title">{playlist?.title ?? "Playlist"}</strong>
              <span>{tracks.length} tracks</span>
            </div>
            <span>Choose a track</span>
          </header>
          <ol className="playlist-panel__list">
            {tracks.map((item, index) => (
              <li key={item.id}>
                <button
                  ref={index === trackIndex ? activeTrackRef : undefined}
                  type="button"
                  className={index === trackIndex ? "is-active" : ""}
                  aria-current={index === trackIndex ? "true" : undefined}
                  onClick={() => selectTrack(index)}
                >
                  <span className="playlist-panel__number">{index + 1}</span>
                  <strong>{item.title}</strong>
                  <span className="playlist-panel__artist">{getTrackCredits(item).singer ?? "Credits unavailable"}</span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <aside className="minimal-player" aria-label="Meter Down FM YouTube player">
      <span className="liquid-glass-layer" aria-hidden="true">
        <svg className="liquid-glass-filter" width="0" height="0" focusable="false">
          <defs>
            <filter id="meter-down-liquid-glass" x="-35%" y="-100%" width="170%" height="300%" colorInterpolationFilters="sRGB">
              <feGaussianBlur in="SourceGraphic" stdDeviation="12" result="liquid-blur" />
              <feColorMatrix
                in="liquid-blur"
                mode="matrix"
                values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7"
              />
            </filter>
          </defs>
        </svg>
        <span className="liquid-glass-metaballs">
          <span className="liquid-glass-blob liquid-glass-blob--artwork" />
          <span className="liquid-glass-blob liquid-glass-blob--controls" />
        </span>
        <span className="liquid-glass-sheen" />
      </span>

      {track?.artworkUrl ? (
        <span
          className={`minimal-player__artwork ${isPlaying ? "is-spinning" : ""}`}
          aria-hidden="true"
          style={{ "--artwork-image": `url(${track.artworkUrl})` } as React.CSSProperties}
        />
      ) : <span className="minimal-player__artwork minimal-player__artwork--fallback"><Music2 aria-hidden="true" /></span>}

      <div className="minimal-player__body">
        <div className="minimal-player__copy" aria-live="polite">
          <strong>{track?.title ?? (catalogLoading ? "क्लाउड प्लेलिस्ट आ रही है…" : "Meter Down FM")}</strong>
          {track ? (
            <div className="track-credit-pills">
              {credits?.singer ? <span>{credits.singer}</span> : null}
              {credits?.writer ? <span>{credits.writer}</span> : null}
              {!credits?.singer && !credits?.writer ? <span>Credits unavailable</span> : null}
            </div>
          ) : <small>{playlist?.title ?? "Cloud playlist not configured"}</small>}
        </div>
        <input
          className="minimal-player__progress"
          type="range"
          min="0"
          max={duration || (track?.durationMs ?? 0) / 1_000}
          step="0.1"
          value={Math.min(currentTime, duration || (track?.durationMs ?? 0) / 1_000)}
          onChange={(event) => seekTo(Number(event.target.value))}
          disabled={!track || !isPlayerReady}
          aria-label="Track progress"
          aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration || (track?.durationMs ?? 0) / 1_000)}`}
          style={{ "--progress": `${duration ? (currentTime / duration) * 100 : 0}%` } as React.CSSProperties}
        />
        <div className="minimal-player__time">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration || (track?.durationMs ?? 0) / 1_000)}</span>
        </div>
      </div>

      <div className="minimal-player__controls" aria-label="Playback controls">
        <button
          className={`player-control player-control--utility ${isShuffled ? "is-active" : ""}`}
          type="button"
          onClick={() => setIsShuffled((current) => !current)}
          aria-label={isShuffled ? "Turn shuffle off" : "Turn shuffle on"}
          aria-pressed={isShuffled}
        ><Shuffle size={14} strokeWidth={2.4} /></button>
        <button className="player-control player-control--secondary" type="button" onClick={() => changeTrack(-1)} disabled={!track} aria-label="Previous track"><SkipBack size={14} strokeWidth={2.4} /></button>
        <button className="player-control player-control--play" type="button" onClick={togglePlayback} disabled={!track || !isPlayerReady || isPlaybackLoading || catalogLoading} aria-label={isPlaying ? "Pause" : "Play"}>
          {isPlaybackLoading || catalogLoading ? <span className="player-loader" aria-hidden="true" /> : isPlaying ? <Pause size={18} fill="currentColor" /> : <Play className="play-icon" size={18} fill="currentColor" />}
        </button>
        <button className="player-control player-control--secondary" type="button" onClick={() => changeTrack(1)} disabled={!track} aria-label="Next track"><SkipForward size={14} strokeWidth={2.4} /></button>
        <button
          ref={playlistToggleRef}
          className={`player-control player-control--queue ${isPlaylistOpen ? "is-active" : ""}`}
          type="button"
          onClick={togglePlaylist}
          aria-label={isPlaylistOpen ? "Close playlist" : "Open playlist"}
          aria-expanded={isPlaylistOpen}
          aria-controls="active-playlist-panel"
          disabled={!tracks.length}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 6h12M4 12h9M4 18h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="m16 15 4 3-4 3v-6Z" fill="currentColor" />
          </svg>
        </button>
      </div>

      <p className="minimal-player__status" role="status">{error || catalogError}</p>
      </aside>
    </>
  );
}

export function RadioExperience({ playerExperimentEnabled = false }: { playerExperimentEnabled?: boolean }) {
  const hornContextRef = useRef<AudioContext | null>(null);
  const [playlist, setPlaylist] = useState<CloudPlaylist | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    fetch("/api/playlists/active", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json()) as { playlist?: CloudPlaylist | null; error?: string };
        if (!response.ok || !payload.playlist) throw new Error(payload.error || "No active playlist.");
        if (!active) return;
        setPlaylist(payload.playlist);
        setCatalogError(payload.playlist.tracks.length ? "" : "Import and activate a YouTube playlist to begin playback.");
      })
      .catch((requestError: unknown) => {
        if (requestError instanceof DOMException && requestError.name === "AbortError") return;
        if (!active) return;
        setCatalogError("रेडियो अभी तैयार हो रहा है।");
      })
      .finally(() => active && setCatalogLoading(false));
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  const playHorn = useCallback(() => {
    const context = hornContextRef.current ?? new AudioContext();
    hornContextRef.current = context;
    if (context.state === "suspended") void context.resume();

    [0, 0.26].forEach((offset, blastIndex) => {
      const body = context.createOscillator();
      const overtone = context.createOscillator();
      const filter = context.createBiquadFilter();
      const gain = context.createGain();
      const start = context.currentTime + offset;
      body.type = "sawtooth";
      overtone.type = "square";
      body.frequency.setValueAtTime(blastIndex === 0 ? 320 : 300, start);
      body.frequency.exponentialRampToValueAtTime(blastIndex === 0 ? 235 : 220, start + 0.2);
      overtone.frequency.setValueAtTime(blastIndex === 0 ? 460 : 430, start);
      overtone.frequency.exponentialRampToValueAtTime(blastIndex === 0 ? 330 : 315, start + 0.2);
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(1_500, start);
      filter.Q.setValueAtTime(1.1, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.12, start + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
      body.connect(filter);
      overtone.connect(filter);
      filter.connect(gain).connect(context.destination);
      body.start(start);
      overtone.start(start);
      body.stop(start + 0.24);
      overtone.stop(start + 0.24);
    });
  }, []);

  return (
    <div className="app-shell app-shell--night" data-player-experiment={playerExperimentEnabled ? "on" : "off"}>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <main id="main-content" className="radio-room">
        <Hero
          onHorn={playHorn}
          playlist={playlist}
          catalogLoading={catalogLoading}
        />
      </main>
      <MinimalPlayer key={playlist?.id ?? "cloud-player"} playlist={playlist} catalogLoading={catalogLoading} catalogError={catalogError} />
    </div>
  );
}
