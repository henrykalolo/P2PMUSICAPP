'use client';

/**
 * Server-authoritative audio player.
 *
 * Playback always uses an authorized, range-capable /api/media URL so seeking
 * and instant readiness work for every uploaded track. P2P/IPFS remains an
 * optional redirect handled by the API, never a client-side dependency.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Loader2, Pause, Play, SkipBack, SkipForward, Volume2 } from 'lucide-react';
import { usePlayerStore } from '@/store/usePlayerStore';

interface UnifiedMusicPlayerProps {
  /** Track UUID from the posts table. */
  trackId: string;
  /** Signed playback URL returned by /api/tracks. Optional. */
  src?: string | null;
  mimeType?: string;
  title?: string;
  artist?: string;
  poster?: string;
  /** Compact variant for feed cards; hides duplicated artwork and metadata. */
  variant?: 'default' | 'minimal';
  /** Kept for backwards compatibility with older feed props; unused. */
  preferredStorage?: unknown;
  /** Kept for backwards compatibility; use trackId instead. */
  serverStorageId?: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function createEventId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
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
  poster,
  variant = 'default',
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(src || null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>(
    src ? 'loading' : 'idle'
  );
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const retriedRef = useRef(false);
  const playReportedRef = useRef(false);

  const { isPlaying, volume, setIsPlaying, setVolume } = usePlayerStore();

  const reportEvent = useCallback(
    (eventType: 'play' | 'complete' | 'skip', progress: number, total: number) => {
      const token = localStorage.getItem('token');
      if (!token || !UUID_RE.test(trackId)) return;
      void fetch(`/api/tracks/${encodeURIComponent(trackId)}/play`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          eventType,
          eventId: createEventId(),
          progressSeconds: Math.max(0, Math.floor(progress || 0)),
          durationSeconds: Math.max(0, Math.floor(total || 0)),
        }),
      }).catch(() => {
        // Telemetry must never interrupt playback.
      });
    },
    [trackId]
  );

  // Resolve a short-lived playback URL when one was not supplied by the API.
  useEffect(() => {
    retriedRef.current = false;
    playReportedRef.current = false;
    if (src) {
      setMediaUrl(src);
      setStatus('loading');
      setError(null);
      return;
    }
    if (!UUID_RE.test(trackId)) {
      setError('This track has no playable media source.');
      setStatus('error');
      return;
    }

    const controller = new AbortController();
    setStatus('loading');
    setError(null);

    fetch(`/api/media/token?trackId=${encodeURIComponent(trackId)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Playback authorization failed');
        return response.json() as Promise<{ url: string }>;
      })
      .then((data) => {
        if (typeof data.url !== 'string' || !data.url.startsWith('/api/media/')) {
          throw new Error('Invalid playback URL');
        }
        setMediaUrl(data.url);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Unable to load track');
        setStatus('error');
      });

    return () => controller.abort();
  }, [src, trackId]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume, mediaUrl]);

  const handlePlayPause = async () => {
    const audio = audioRef.current;
    if (!audio || status === 'error') return;
    if (audio.paused) {
      try {
        await audio.play();
      } catch {
        setError('Playback was blocked. Try again after interacting with the page.');
      }
    } else {
      audio.pause();
    }
  };

  const handleSkip = (delta: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration)) return;
    const from = audio.currentTime;
    audio.currentTime = Math.min(Math.max(0, from + delta), audio.duration);
    if (delta > 0) reportEvent('skip', from, audio.duration);
  };

  const handleSeek = (value: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration)) return;
    audio.currentTime = (value / 100) * audio.duration;
    setCurrentTime(audio.currentTime);
  };

  const handleVolume = (value: number) => {
    setVolume(value);
    if (audioRef.current) audioRef.current.volume = value;
  };

  const handleProgress = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
    setCurrentTime(audio.currentTime);
    if (audio.buffered.length > 0) {
      setBuffered((audio.buffered.end(audio.buffered.length - 1) / audio.duration) * 100);
    }
  };

  // A feed URL can outlive its one-hour token. Refresh once on playback failure.
  const refreshPlaybackUrl = async () => {
    if (retriedRef.current || !UUID_RE.test(trackId)) {
      setError('This track could not be played. It may have been removed.');
      setStatus('error');
      setIsPlaying(false);
      return;
    }
    retriedRef.current = true;
    setStatus('loading');
    setError(null);
    try {
      const response = await fetch(`/api/media/token?trackId=${encodeURIComponent(trackId)}`);
      if (!response.ok) throw new Error('Playback authorization failed');
      const data = (await response.json()) as { url?: unknown };
      if (typeof data.url !== 'string' || !data.url.startsWith('/api/media/')) {
        throw new Error('Invalid playback URL');
      }
      setMediaUrl(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load track');
      setStatus('error');
      setIsPlaying(false);
    }
  };

  const ready = status === 'ready';
  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  const audioElement = mediaUrl ? (
    <audio
      ref={audioRef}
      src={mediaUrl}
      preload="metadata"
      onLoadedMetadata={(event) => {
        setDuration(event.currentTarget.duration || 0);
        setStatus('ready');
      }}
      onCanPlay={() => setStatus('ready')}
      onTimeUpdate={handleProgress}
      onProgress={handleProgress}
      onPlay={(event) => {
        setIsPlaying(true);
        if (!playReportedRef.current) {
          playReportedRef.current = true;
          reportEvent('play', event.currentTarget.currentTime, event.currentTarget.duration || 0);
        }
      }}
      onPause={() => setIsPlaying(false)}
      onEnded={(event) => {
        setIsPlaying(false);
        reportEvent('complete', event.currentTarget.duration || 0, event.currentTarget.duration || 0);
        playReportedRef.current = false;
      }}
      onError={() => {
        void refreshPlaybackUrl();
      }}
      className="hidden"
    />
  ) : null;

  if (variant === 'minimal') {
    return (
      <div className="w-full" aria-label={`Player for ${title}`}>
        {error ? (
          <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{error}</span>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Button
              type="button"
              size="icon"
              variant="secondary"
              onClick={() => void handlePlayPause()}
              disabled={!ready || !mediaUrl}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              className="h-8 w-8 shrink-0 rounded-full"
            >
              {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            </Button>

            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-muted/30 px-2 py-1.5">
              <WaveformProgress
                seed={trackId}
                progress={progress}
                buffered={Math.min(100, buffered)}
                currentTime={currentTime}
                duration={duration}
                disabled={!ready}
                onSeek={handleSeek}
              />
              <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            {status === 'loading' && (
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
            )}
          </div>
        )}
        {audioElement}
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
        </div>
        {status === 'loading' && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      {error ? (
        <div className="flex items-start gap-2 rounded bg-destructive/10 p-2 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 rounded-xl bg-muted/30 px-3 py-2">
            <WaveformProgress
              seed={trackId}
              progress={progress}
              buffered={Math.min(100, buffered)}
              currentTime={currentTime}
              duration={duration}
              disabled={!ready}
              onSeek={handleSeek}
            />
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>
        </>
      )}

      <div className="mt-2 flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => handleSkip(-10)}
          disabled={!ready}
          aria-label="Back 10 seconds"
        >
          <SkipBack className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          onClick={() => void handlePlayPause()}
          disabled={!ready || !mediaUrl}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => handleSkip(10)}
          disabled={!ready}
          aria-label="Forward 10 seconds"
        >
          <SkipForward className="h-4 w-4" />
        </Button>
        <Volume2 className="ml-2 h-4 w-4 text-muted-foreground" />
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(event) => handleVolume(Number(event.target.value))}
          aria-label="Volume"
          className="h-4 w-20 cursor-pointer"
        />
      </div>

      {audioElement}
    </div>
  );
};

export default UnifiedMusicPlayer;
