'use client';

/**
 * Player controls for a single track.
 *
 * Audio itself lives in the app-wide GlobalAudioPlayer so playlists and mixes
 * keep advancing between pages and never produce overlapping streams.
 */

import React, { useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Loader2, Pause, Play, SkipBack, SkipForward, Volume2 } from 'lucide-react';
import { usePlayerStore, type Track } from '@/store/usePlayerStore';
import { reportPlayEvent } from '@/lib/media/play-telemetry';

interface UnifiedMusicPlayerProps {
  /** Track UUID from the posts table. */
  trackId: string;
  /** Signed playback URL returned by the API. Fallback for the global engine. */
  src?: string | null;
  mimeType?: string;
  title?: string;
  artist?: string;
  album?: string;
  poster?: string;
  /** Known track length (seconds) used before metadata loads. */
  duration?: number;
  /** When provided, pressing play starts a continuous queue at this track. */
  queue?: Track[];
  /** Label shown for the active queue (playlist, mix, album...). */
  queueContext?: string;
  /** Compact variant for feed cards; hides duplicated artwork and metadata. */
  variant?: 'default' | 'minimal';
  /** Kept for backwards compatibility with older feed props; unused. */
  preferredStorage?: unknown;
  /** Kept for backwards compatibility; use trackId instead. */
  serverStorageId?: string;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

interface WaveformProgressProps {
  seed: string;
  progress: number;
  buffered: number;
  currentTime: number;
  duration: number;
  disabled?: boolean;
  onSeek: (percent: number) => void;
}

/** Stable, seed-based waveform that behaves like a WhatsApp voice-note scrubber. */
const WaveformProgress: React.FC<WaveformProgressProps> = ({
  seed,
  progress,
  buffered,
  currentTime,
  duration,
  disabled = false,
  onSeek,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const bars = useMemo(() => {
    let hash = 2166136261;
    for (let index = 0; index < seed.length; index += 1) {
      hash = Math.imul(hash ^ seed.charCodeAt(index), 16777619);
    }

    const count = 36;
    return Array.from({ length: count }, (_, index) => {
      hash = Math.imul(hash ^ (hash >>> 15), 2246822519);
      hash = Math.imul(hash ^ (hash >>> 13), 3266489917);
      const noise = ((hash >>> 0) % 1000) / 1000;
      const envelope = 0.45 + 0.55 * Math.sin((index / (count - 1)) * Math.PI);
      return Math.max(0.2, Math.min(1, envelope * (0.35 + noise * 0.65)));
    });
  }, [seed]);

  const seekFromClientX = (clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    const percent = ((clientX - rect.left) / rect.width) * 100;
    onSeek(Math.max(0, Math.min(100, percent)));
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    draggingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    seekFromClientX(event.clientX);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || disabled) return;
    seekFromClientX(event.clientX);
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const step = event.shiftKey ? 10 : 5;

    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      event.preventDefault();
      onSeek(Math.min(100, progress + step));
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      event.preventDefault();
      onSeek(Math.max(0, progress - step));
    } else if (event.key === 'Home') {
      event.preventDefault();
      onSeek(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      onSeek(100);
    }
  };

  return (
    <div
      ref={containerRef}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress)}
      aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
      aria-disabled={disabled}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onLostPointerCapture={() => {
        draggingRef.current = false;
      }}
      onKeyDown={handleKeyDown}
      className={`relative flex h-7 min-w-0 flex-1 touch-none items-center gap-[2px] rounded-md ${
        disabled ? 'cursor-default opacity-60' : 'cursor-pointer'
      }`}
    >
      {bars.map((height, index) => {
        const barPosition = ((index + 0.5) / bars.length) * 100;
        const isPlayed = barPosition <= progress;
        const isBuffered = barPosition <= buffered;

        return (
          <span
            key={index}
            aria-hidden="true"
            style={{ height: `${Math.round(height * 100)}%` }}
            className={`min-w-[2px] flex-1 rounded-full transition-colors ${
              isPlayed
                ? 'bg-primary'
                : isBuffered
                  ? 'bg-primary/35'
                  : 'bg-muted-foreground/25'
            }`}
          />
        );
      })}

      <span
        aria-hidden="true"
        style={{ left: `${Math.max(2, Math.min(98, progress))}%` }}
        className="pointer-events-none absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-background shadow-sm"
      />
    </div>
  );
};

export const UnifiedMusicPlayer: React.FC<UnifiedMusicPlayerProps> = ({
  trackId,
  src,
  title = 'Unknown Track',
  artist = 'Unknown Artist',
  album = '',
  poster,
  duration: knownDuration = 0,
  queue,
  queueContext,
  variant = 'default',
}) => {
  const currentTrack = usePlayerStore((state) => state.currentTrack);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const currentTime = usePlayerStore((state) => state.currentTime);
  const storeDuration = usePlayerStore((state) => state.duration);
  const progress = usePlayerStore((state) => state.progress);
  const volume = usePlayerStore((state) => state.volume);
  const isBuffering = usePlayerStore((state) => state.isBuffering);
  const error = usePlayerStore((state) => state.error);
  const contextName = usePlayerStore((state) => state.contextName);
  const setIsPlaying = usePlayerStore((state) => state.setIsPlaying);
  const setVolume = usePlayerStore((state) => state.setVolume);
  const setQueue = usePlayerStore((state) => state.setQueue);
  const playTrack = usePlayerStore((state) => state.playTrack);
  const requestSeek = usePlayerStore((state) => state.requestSeek);
  const retryPlayback = usePlayerStore((state) => state.retryPlayback);
  const playPrevious = usePlayerStore((state) => state.playPrevious);
  const playNext = usePlayerStore((state) => state.playNext);

  const isActive = currentTrack?.id === trackId;
  const playing = isActive && isPlaying;
  const trackDuration = isActive && storeDuration > 0 ? storeDuration : knownDuration;
  const displayTime = isActive ? currentTime : 0;
  const displayProgress = isActive ? progress : 0;
  const showError = isActive && Boolean(error);
  const showBuffering = isActive && isBuffering && !error;

  const track: Track = useMemo(
    () => ({
      id: trackId,
      title,
      artist,
      album,
      duration: knownDuration || 0,
      streamUrl: src || undefined,
      coverArtUrl: poster,
    }),
    [trackId, title, artist, album, knownDuration, src, poster]
  );

  const handlePlayPause = () => {
    if (playing) {
      setIsPlaying(false);
      return;
    }
    if (isActive) {
      setIsPlaying(true);
      return;
    }
    if (queue && queue.length > 0) {
      const merged = queue.map((item) =>
        item.id === trackId ? { ...item, ...track, streamUrl: item.streamUrl || track.streamUrl } : item
      );
      const index = Math.max(
        0,
        merged.findIndex((item) => item.id === trackId)
      );
      setQueue(merged, index, { autoplay: true, contextName: queueContext });
      return;
    }
    playTrack(track, { contextName: queueContext });
  };

  const handleSeek = (value: number) => {
    if (!isActive || !trackDuration) return;
    requestSeek((value / 100) * trackDuration);
  };

  const handleSkip = (delta: number) => {
    if (!isActive || !trackDuration) return;
    const from = currentTime;
    const to = Math.min(Math.max(0, from + delta), trackDuration);
    if (delta > 0) {
      reportPlayEvent('skip', trackId, from, trackDuration, currentTrack?.streamUrl);
    }
    requestSeek(to);
  };

  const handlePrevious = () => {
    if (!isActive) {
      handlePlayPause();
      return;
    }
    if (currentTime > 3) {
      requestSeek(0);
      return;
    }
    playPrevious();
  };

  const handleNext = () => {
    if (!isActive) {
      handlePlayPause();
      return;
    }
    reportPlayEvent('skip', trackId, currentTime, trackDuration, currentTrack?.streamUrl);
    playNext();
  };

  const waveform = (
    <WaveformProgress
      seed={trackId}
      progress={displayProgress}
      buffered={displayProgress}
      currentTime={displayTime}
      duration={trackDuration}
      disabled={!trackDuration}
      onSeek={handleSeek}
    />
  );

  const timeLabel = (
    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
      {formatTime(displayTime)} / {formatTime(trackDuration)}
    </span>
  );

  const queueLabel =
    isActive && contextName ? (
      <span className="truncate text-[10px] uppercase tracking-wide text-primary">{contextName}</span>
    ) : null;

  if (variant === 'minimal') {
    return (
      <div className="w-full" aria-label={`Player for ${title}`}>
        {showError ? (
          <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{error}</span>
            <button
              type="button"
              onClick={retryPlayback}
              className="ml-auto shrink-0 font-medium underline"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Button
              type="button"
              size="icon"
              variant="secondary"
              onClick={handlePlayPause}
              aria-label={playing ? 'Pause' : 'Play'}
              className="h-8 w-8 shrink-0 rounded-full"
            >
              {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            </Button>

            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-muted/30 px-2 py-1.5">
              {waveform}
              <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                {formatTime(displayTime)} / {formatTime(trackDuration)}
              </span>
            </div>

            {showBuffering && (
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
            )}
          </div>
        )}
        {queueLabel && <div className="mt-1 pl-11">{queueLabel}</div>}
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-3" aria-label={`Player for ${title}`}>
      {poster && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={poster} alt={`${title} cover`} className="mb-3 h-32 w-32 rounded object-cover" />
      )}

      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{title}</p>
          <p className="truncate text-xs text-muted-foreground">{artist}</p>
          {queueLabel}
        </div>
        {showBuffering && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      {showError ? (
        <div className="flex items-start gap-2 rounded bg-destructive/10 p-2 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={retryPlayback} className="font-medium underline">
            Retry
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-xl bg-muted/30 px-3 py-2">
          {waveform}
          {timeLabel}
        </div>
      )}

      <div className="mt-2 flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handlePrevious}
          aria-label="Previous track"
        >
          <SkipBack className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          onClick={handlePlayPause}
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleNext}
          aria-label="Next track"
        >
          <SkipForward className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => handleSkip(-10)}
          aria-label="Back 10 seconds"
        >
          <span className="text-[10px] font-semibold">-10</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => handleSkip(10)}
          aria-label="Forward 10 seconds"
        >
          <span className="text-[10px] font-semibold">+10</span>
        </Button>
        <Volume2 className="ml-2 h-4 w-4 text-muted-foreground" />
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(event) => setVolume(Number(event.target.value))}
          aria-label="Volume"
          className="h-4 w-20 cursor-pointer"
        />
      </div>
    </div>
  );
};

export default UnifiedMusicPlayer;
