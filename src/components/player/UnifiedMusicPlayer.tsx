'use client';

/**
 * Server-authoritative audio player.
 *
 * Playback always uses an authorized, range-capable /api/media URL so seeking
 * and instant readiness work for every uploaded track. P2P/IPFS remains an
 * optional redirect handled by the API, never a client-side dependency.
 */

import React, { useEffect, useRef, useState } from 'react';
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

  const { isPlaying, volume, setIsPlaying, setVolume } = usePlayerStore();

  // Resolve a short-lived playback URL when one was not supplied by the API.
  useEffect(() => {
    retriedRef.current = false;
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
    audio.currentTime = Math.min(Math.max(0, audio.currentTime + delta), audio.duration);
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
      onPlay={() => setIsPlaying(true)}
      onPause={() => setIsPlaying(false)}
      onEnded={() => setIsPlaying(false)}
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

            <div className="min-w-0 flex-1">
              <div className="relative h-1 w-full overflow-hidden rounded bg-secondary">
                <div
                  className="absolute inset-y-0 left-0 bg-muted-foreground/40"
                  style={{ width: `${Math.min(100, buffered)}%` }}
                />
                <div
                  className="absolute inset-y-0 left-0 bg-primary"
                  style={{
                    width: `${duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0}%`,
                  }}
                />
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={0.1}
                value={duration > 0 ? (currentTime / duration) * 100 : 0}
                onChange={(event) => handleSeek(Number(event.target.value))}
                disabled={!ready}
                aria-label="Seek"
                className="mt-0.5 h-3 w-full cursor-pointer disabled:cursor-not-allowed"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
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
          <div className="relative h-1.5 w-full overflow-hidden rounded bg-secondary">
            <div
              className="absolute inset-y-0 left-0 bg-muted-foreground/40"
              style={{ width: `${Math.min(100, buffered)}%` }}
            />
            <div
              className="absolute inset-y-0 left-0 bg-primary"
              style={{
                width: `${duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0}%`,
              }}
            />
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={0.1}
            value={duration > 0 ? (currentTime / duration) * 100 : 0}
            onChange={(event) => handleSeek(Number(event.target.value))}
            disabled={!ready}
            aria-label="Seek"
            className="mt-1 h-4 w-full cursor-pointer disabled:cursor-not-allowed"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
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
