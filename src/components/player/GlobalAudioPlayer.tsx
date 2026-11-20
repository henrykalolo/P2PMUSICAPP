'use client';

/**
 * Single audio engine for the whole application.
 *
 * Every player UI controls this store-backed element instead of owning an
 * <audio> tag. That keeps exactly one stream active at a time and lets
 * playlists/mixes continue automatically when a track ends.
 */

import { useEffect, useRef, useState } from 'react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { reportPlayEvent } from '@/lib/media/play-telemetry';

interface MediaSource {
  trackId: string;
  url: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function resolveMediaUrl(trackId: string): Promise<string> {
  const response = await fetch(`/api/media/token?trackId=${encodeURIComponent(trackId)}`);
  if (!response.ok) throw new Error('Playback authorization failed');
  const data = (await response.json()) as { url?: unknown };
  if (typeof data.url !== 'string' || !data.url.startsWith('/api/media/')) {
    throw new Error('Invalid playback URL');
  }
  return data.url;
}

export function GlobalAudioPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const retriedRef = useRef(false);
  const playReportedRef = useRef(false);
  const [mediaSource, setMediaSource] = useState<MediaSource | null>(null);

  const currentTrack = usePlayerStore((state) => state.currentTrack);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const volume = usePlayerStore((state) => state.volume);
  const seekTarget = usePlayerStore((state) => state.seekTarget);
  const retryToken = usePlayerStore((state) => state.playbackRetryToken);
  const setTime = usePlayerStore((state) => state.setTime);
  const setDuration = usePlayerStore((state) => state.setDuration);
  const setIsPlaying = usePlayerStore((state) => state.setIsPlaying);
  const setBuffering = usePlayerStore((state) => state.setBuffering);
  const setPlayerError = usePlayerStore((state) => state.setPlayerError);
  const clearSeekTarget = usePlayerStore((state) => state.clearSeekTarget);
  const playNext = usePlayerStore((state) => state.playNext);

  const trackId = currentTrack?.id || null;
  const streamUrl = currentTrack?.streamUrl || null;
  const canPlay = Boolean(trackId && mediaSource?.trackId === trackId);

  // Resolve a playable URL whenever the active track (or its token) changes.
  useEffect(() => {
    retriedRef.current = false;
    playReportedRef.current = false;
    setMediaSource(null);

    if (!trackId) {
      setBuffering(false);
      return;
    }

    const controller = new AbortController();
    setBuffering(true);
    setPlayerError(null);

    const load = async () => {
      try {
        let url: string;
        if (streamUrl && streamUrl.startsWith('/api/media/')) {
          url = streamUrl;
        } else if (streamUrl && /^https?:\/\//.test(streamUrl)) {
          url = streamUrl;
        } else if (UUID_RE.test(trackId)) {
          url = await resolveMediaUrl(trackId);
        } else {
          throw new Error('This track has no playable media source.');
        }
        if (!controller.signal.aborted) setMediaSource({ trackId, url });
      } catch (error) {
        if (controller.signal.aborted) return;
        setPlayerError(error instanceof Error ? error.message : 'Unable to load track');
        setBuffering(false);
        setIsPlaying(false);
      }
    };

    void load();
    return () => controller.abort();
  }, [trackId, streamUrl, retryToken, setBuffering, setPlayerError, setIsPlaying]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  // Single source of truth for play/pause across every player instance.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !canPlay) return;
    if (isPlaying) {
      void audio.play().catch(() => {
        setPlayerError('Playback was blocked. Press play again to continue.');
        setIsPlaying(false);
      });
    } else {
      audio.pause();
    }
  }, [canPlay, isPlaying, mediaSource, setPlayerError, setIsPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || seekTarget === null || !canPlay) return;
    const target = Math.min(Math.max(0, seekTarget), Number.isFinite(audio.duration) ? audio.duration : seekTarget);
    audio.currentTime = target;
    setTime(target, audio.duration || 0);
    clearSeekTarget();
  }, [seekTarget, canPlay, clearSeekTarget, setTime]);

  // Refresh a signed URL once when a long-lived feed URL expires.
  const handleAudioError = () => {
    if (!trackId) return;
    if (retriedRef.current || !UUID_RE.test(trackId)) {
      setPlayerError('This track could not be played. It may have been removed.');
      setBuffering(false);
      setIsPlaying(false);
      return;
    }
    retriedRef.current = true;
    setBuffering(true);
    void resolveMediaUrl(trackId)
      .then((url) => setMediaSource({ trackId, url }))
      .catch(() => {
        setPlayerError('Unable to load this track.');
        setBuffering(false);
        setIsPlaying(false);
      });
  };

  return (
    <audio
      ref={audioRef}
      src={mediaSource?.url || undefined}
      preload="metadata"
      onLoadedMetadata={(event) => {
        setTime(event.currentTarget.currentTime, event.currentTarget.duration || 0);
        setBuffering(false);
      }}
      onCanPlay={() => {
        setDuration(audioRef.current?.duration || 0);
        setBuffering(false);
      }}
      onPlaying={() => setBuffering(false)}
      onWaiting={() => setBuffering(true)}
      onTimeUpdate={(event) => {
        setTime(event.currentTarget.currentTime, event.currentTarget.duration || 0);
      }}
      onProgress={(event) => {
        const audio = event.currentTarget;
        if (audio.duration && Number.isFinite(audio.duration)) {
          setTime(audio.currentTime, audio.duration);
        }
      }}
      onPlay={(event) => {
        setIsPlaying(true);
        if (!playReportedRef.current && trackId) {
          playReportedRef.current = true;
          reportPlayEvent(
            'play',
            trackId,
            event.currentTarget.currentTime,
            event.currentTarget.duration || 0,
            mediaSource?.url
          );
        }
      }}
      onEnded={(event) => {
        if (trackId) {
          reportPlayEvent(
            'complete',
            trackId,
            event.currentTarget.duration || 0,
            event.currentTarget.duration || 0,
            mediaSource?.url
          );
        }
        playReportedRef.current = false;
        setIsPlaying(false);
        playNext();
      }}
      onError={handleAudioError}
      className="hidden"
      aria-hidden="true"
    />
  );
}

export default GlobalAudioPlayer;
