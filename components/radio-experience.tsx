"use client";

import Image from "next/image";
import {
  ArrowDown,
  ExternalLink,
  Headphones,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Youtube,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { CoverArt } from "@/components/cover-art";
import { shayari, tracks, type Track } from "@/lib/tracks";

function ListenerPill() {
  const [listeners, setListeners] = useState(44);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setListeners((current) => Math.max(38, Math.min(52, current + (Math.random() > 0.48 ? 1 : -1))));
    }, 6000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="listener-pill" aria-label={`${listeners} sawaari listening online`}>
      <span className="live-dot" aria-hidden="true" />
      <span className="listener-number">{listeners}</span>
      <span>सवारी online</span>
    </div>
  );
}

function PlatformLinks() {
  return (
    <nav className="platform-links" aria-label="Listen on other platforms">
      <a href="https://open.spotify.com/" target="_blank" rel="noreferrer" aria-label="Open Meter Down FM on Spotify">
        <Headphones size={16} aria-hidden="true" />
        <span>Spotify</span>
        <ExternalLink size={12} aria-hidden="true" />
      </a>
      <a href="https://music.youtube.com/" target="_blank" rel="noreferrer" aria-label="Open Meter Down FM on YouTube Music">
        <Youtube size={17} aria-hidden="true" />
        <span>YT Music</span>
        <ExternalLink size={12} aria-hidden="true" />
      </a>
    </nav>
  );
}

function TailboardMarquee() {
  const phrases = shayari.slice(0, 4);
  return (
    <div className="marquee" aria-label={`Auto tailboard sayings: ${phrases.join("; ")}`}>
      <div className="marquee__track" aria-hidden="true">
        {[...phrases, ...phrases].map((phrase, index) => (
          <span key={`${phrase}-${index}`}>
            {phrase}<b>✦</b>
          </span>
        ))}
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <Image
        className="hero__image"
        src="/hero-auto.png"
        alt="Illustrated green-and-yellow Delhi auto-rickshaw at a chai stand in warm evening light"
        fill
        priority
        sizes="100vw"
      />
      <div className="hero__wash" aria-hidden="true" />
      <div className="hero__topbar">
        <ListenerPill />
        <PlatformLinks />
      </div>
      <div className="hero__title-wrap">
        <p className="route-stamp">दिल्ली की सड़कों का अपना रेडियो · स्टैंड नं. 42</p>
        <h1 id="hero-title">मीटर डाउन</h1>
        <div className="hero__fm"><span>FM</span><i aria-hidden="true" /></div>
        <p className="hero__tagline">मीटर नीचे। आवाज़ ऊपर।</p>
      </div>
      <a className="scroll-cue" href="#queue">
        <span>आज की सवारी</span>
        <ArrowDown size={16} aria-hidden="true" />
      </a>
      <TailboardMarquee />
    </section>
  );
}

function TrackGrid({ activeId, onSelect }: { activeId: string; onSelect: (track: Track) => void }) {
  return (
    <section className="queue" id="queue" aria-labelledby="queue-title">
      <header className="section-heading">
        <div>
          <p>रूट पर आगे</p>
          <h2 id="queue-title">आज की सवारी</h2>
        </div>
        <span>{tracks.length.toString().padStart(2, "0")} गाने · नॉन-स्टॉप</span>
      </header>
      <div className="track-grid">
        {tracks.map((track, index) => {
          const active = track.id === activeId;
          return (
            <button
              className="track-card"
              type="button"
              key={track.id}
              onClick={() => onSelect(track)}
              aria-label={`${track.title} by ${track.artist}${active ? ", currently selected" : ""}`}
              aria-pressed={active}
            >
              <span className="track-card__index">{String(index + 1).padStart(2, "0")}</span>
              <CoverArt palette={track.palette} />
              <span className="track-card__copy">
                <strong>{track.title}</strong>
                <span>{track.artist}</span>
              </span>
              <span className="track-card__plays">{track.plays.toLocaleString("en-IN")} सवारी</span>
              <span className="track-card__action" aria-hidden="true">{active ? "NOW" : "PLAY"}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return "0:00";
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;
}

type PlayerProps = {
  track: Track;
  trackIndex: number;
  isPlaying: boolean;
  isLoading: boolean;
  error: string;
  currentTime: number;
  duration: number;
  volume: number;
  onToggle: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onSeek: (value: number) => void;
  onVolume: (value: number) => void;
};

function NowPlayingDock({
  track,
  trackIndex,
  isPlaying,
  isLoading,
  error,
  currentTime,
  duration,
  volume,
  onToggle,
  onPrevious,
  onNext,
  onSeek,
  onVolume,
}: PlayerProps) {
  const fare = (currentTime * 1.35).toFixed(2);

  return (
    <aside className="player-dock" aria-label="Now playing">
      <div className="player-track">
        <CoverArt palette={track.palette} compact />
        <div className="player-track__copy">
          <span>NOW PLAYING · {String(trackIndex + 1).padStart(2, "0")}</span>
          <strong>{track.title}</strong>
          <small>{track.artist}</small>
        </div>
      </div>

      <div className="transport" aria-label="Playback controls">
        <button type="button" onClick={onPrevious} aria-label="Previous song"><SkipBack size={18} /></button>
        <button
          className="play-button"
          type="button"
          onClick={onToggle}
          aria-label={isPlaying ? "Pause radio" : "Play radio"}
          disabled={isLoading}
        >
          {isLoading ? <span className="loading-bars" aria-hidden="true">•••</span> : isPlaying ? <Pause size={20} /> : <Play size={20} />}
        </button>
        <button type="button" onClick={onNext} aria-label="Next song"><SkipForward size={18} /></button>
      </div>

      <div className="fare-meter">
        <div className="fare-meter__top">
          <span>TRIP FARE</span>
          <span className={isPlaying ? "hire-flag hire-flag--active" : "hire-flag"}>
            {isPlaying ? "सवारी में" : "ख़ाली"}
          </span>
        </div>
        <output className="fare-meter__value" aria-live="off"><span>₹</span>{fare}</output>
        <div className="fare-meter__time">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
        <input
          className="progress"
          type="range"
          min="0"
          max={duration || 0}
          step="0.1"
          value={Math.min(currentTime, duration || 0)}
          onChange={(event) => onSeek(Number(event.target.value))}
          aria-label="Track progress"
          aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
          style={{ "--progress": `${duration ? (currentTime / duration) * 100 : 0}%` } as React.CSSProperties}
        />
      </div>

      <div className="volume-control">
        <button type="button" onClick={() => onVolume(volume > 0 ? 0 : 0.72)} aria-label={volume > 0 ? "Mute radio" : "Unmute radio"}>
          {volume > 0 ? <Volume2 size={18} /> : <VolumeX size={18} />}
        </button>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={volume}
          onChange={(event) => onVolume(Number(event.target.value))}
          aria-label="Volume"
        />
      </div>
      <p className="player-status" role="status">{error || (isLoading ? "मीटर बंद है, अगला गाना लाया जा रहा है…" : "")}</p>
    </aside>
  );
}

export function RadioExperience() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [trackIndex, setTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.72);
  const [error, setError] = useState("");
  const currentTrack = tracks[trackIndex];

  const changeTrack = useCallback((nextIndex: number, autoplay = isPlaying) => {
    const boundedIndex = (nextIndex + tracks.length) % tracks.length;
    setTrackIndex(boundedIndex);
    setCurrentTime(0);
    setDuration(0);
    setError("");
    if (autoplay) setIsLoading(true);
  }, [isPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.load();
    if (isPlaying) {
      audio.play().then(() => setIsLoading(false)).catch(() => {
        setIsPlaying(false);
        setIsLoading(false);
        setError("गाना चल नहीं पाया — एक बार फिर Play दबाएँ।");
      });
    }
    // Track changes are the only intended trigger for reloading media.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackIndex]);

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    setError("");
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }
    setIsLoading(true);
    try {
      await audio.play();
      setIsPlaying(true);
    } catch {
      setError("गाना चल नहीं पाया — नेटवर्क देखकर फिर Play दबाएँ।");
    } finally {
      setIsLoading(false);
    }
  };

  const selectTrack = (track: Track) => {
    const nextIndex = tracks.findIndex((item) => item.id === track.id);
    if (nextIndex === trackIndex) {
      void togglePlayback();
    } else {
      setIsPlaying(true);
      changeTrack(nextIndex, true);
    }
  };

  const updateVolume = (nextVolume: number) => {
    setVolume(nextVolume);
    if (audioRef.current) audioRef.current.volume = nextVolume;
  };

  return (
    <>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <main id="main-content">
        <Hero />
        <TrackGrid activeId={currentTrack.id} onSelect={selectTrack} />
        <footer className="site-footer">
          <p><strong>मीटर डाउन FM</strong> · दिल्ली से, दिल वालों के लिए।</p>
          <p>Demo station · fictional tracks · placeholder audio</p>
        </footer>
      </main>

      <audio
        ref={audioRef}
        src={currentTrack.audioUrl}
        preload="metadata"
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => {
          setDuration(event.currentTarget.duration);
          event.currentTarget.volume = volume;
          setIsLoading(false);
        }}
        onWaiting={() => setIsLoading(true)}
        onPlaying={() => { setIsPlaying(true); setIsLoading(false); }}
        onPause={() => setIsPlaying(false)}
        onEnded={() => changeTrack(trackIndex + 1, true)}
        onError={() => { setIsLoading(false); setIsPlaying(false); setError("यह गाना रास्ते में अटक गया — अगली सवारी चुनें।"); }}
      />

      <NowPlayingDock
        track={currentTrack}
        trackIndex={trackIndex}
        isPlaying={isPlaying}
        isLoading={isLoading}
        error={error}
        currentTime={currentTime}
        duration={duration}
        volume={volume}
        onToggle={() => void togglePlayback()}
        onPrevious={() => changeTrack(trackIndex - 1)}
        onNext={() => changeTrack(trackIndex + 1)}
        onSeek={(value) => { if (audioRef.current) audioRef.current.currentTime = value; setCurrentTime(value); }}
        onVolume={updateVolume}
      />
    </>
  );
}
