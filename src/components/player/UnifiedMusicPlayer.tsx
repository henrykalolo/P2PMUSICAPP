'use client';

import React, { useEffect, useRef, useState } from 'react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { Button } from '@/components/ui/button';
import { Play, Pause, SkipBack, SkipForward, Volume2, Loader2, Wifi } from 'lucide-react';
import { UnifiedStorage, StorageSystem, StorageResult } from '@/lib/storage/unifiedStorage';

interface UnifiedMusicPlayerProps {
  /** Track identifier - can be IPFS CID, torrent infoHash, or local storage key */
  trackId: string;
  /** MIME type of the audio file */
  mimeType?: string;
  /** Track title */
  title?: string;
  /** Track artist */
  artist?: string;
  /** Preferred storage system (optional) */
  preferredStorage?: StorageSystem;
}

export const UnifiedMusicPlayer: React.FC<UnifiedMusicPlayerProps> = ({
  trackId,
  mimeType = 'audio/mpeg',
  title = 'Unknown Track',
  artist = 'Unknown Artist',
  preferredStorage,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadProgress, setLoadProgress] = useState(0);
  const [usedStorage, setUsedStorage] = useState<StorageSystem | null>(null);
  
  const {
    isPlaying,
    progress,
    volume,
    setIsPlaying,
    setProgress,
    setVolume,
  } = usePlayerStore();

  // Load audio from unified storage
  useEffect(() => {
    const loadAudio = async () => {
      setIsLoading(true);
      setError(null);
      setLoadProgress(0);

      try {
        // Perform health check on storage systems
        const healthCheck = await UnifiedStorage.healthCheck();
        console.log('Storage system health:', healthCheck);
        
        // Try to load from storage with fallback
        const storageOptions = {
          preferredSystem: preferredStorage,
          timeout: 30000, // 30 seconds
          cache: true,
          onProgress: (progress: number) => setLoadProgress(progress),
        };

        console.log(`Attempting to load track ${trackId} with options:`, storageOptions);
        
        // First check if content is available in any storage system
        const availability = await UnifiedStorage.isContentAvailable(trackId);
        if (!availability.available) {
          throw new Error('Track not available in any storage system');
        }

        console.log('Track available in systems:', availability.systems);

        // Load the audio element with fallback mechanism
        const audio = await UnifiedStorage.streamAudio(
          trackId,
          mimeType,
          storageOptions
        );
        
        // Determine which system was used
        // In a real implementation, we could track this more precisely
        if (trackId.startsWith('Qm')) {
          setUsedStorage(StorageSystem.IPFS);
        } else if (trackId.startsWith('magnet:')) {
          setUsedStorage(StorageSystem.WEB_TORRENT);
        } else if (trackId.startsWith('file-')) {
          setUsedStorage(StorageSystem.INDEXED_DB);
        }

        audio.preload = 'metadata';
        audio.volume = volume;

        // Set up event listeners
        audio.addEventListener('loadedmetadata', () => {
          setIsLoading(false);
          setLoadProgress(100);
        });

        audio.addEventListener('timeupdate', () => {
          if (audio.duration) {
            setProgress((audio.currentTime / audio.duration) * 100);
          }
        });

        audio.addEventListener('play', () => setIsPlaying(true));
        audio.addEventListener('pause', () => setIsPlaying(false));
        audio.addEventListener('ended', () => setIsPlaying(false));

        audio.addEventListener('error', (e) => {
          console.error('Audio error:', e);
          setError('Failed to load audio');
          setIsLoading(false);
        });

        audioRef.current = audio;
        setIsLoading(false);

      } catch (err) {
        console.error('Player initialization error:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize player');
        setIsLoading(false);
      }
    };

    loadAudio();

    // Cleanup
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [trackId, mimeType, volume, setIsPlaying, setProgress, preferredStorage]);

  const handlePlayPause = () => {
    if (audioRef.current && !isLoading) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch((err) => {
          console.error('Play error:', err);
          setError('Failed to play audio');
        });
      }
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const seekPercent = parseFloat(e.target.value);
    if (audioRef.current && audioRef.current.duration) {
      const seekTime = (seekPercent / 100) * audioRef.current.duration;
      audioRef.current.currentTime = seekTime;
      setProgress(seekPercent);
    }
  };

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-600">Error: {error}</p>
        <p className="text-sm text-red-500 mt-1">
          Track ID: {trackId.slice(0, 20)}...
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-card border rounded-lg shadow-sm">
      {/* Track Info */}
      <div className="mb-4">
        <h3 className="font-semibold text-lg truncate">{title}</h3>
        <p className="text-sm text-muted-foreground">{artist}</p>
        <p className="text-xs text-muted-foreground mt-1 font-mono">
          {usedStorage ? `${usedStorage.toUpperCase()}:` : ''} {trackId.slice(0, 16)}...{trackId.slice(-8)}
        </p>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => {}}
            disabled={isLoading}
          >
            <SkipBack className="h-4 w-4" />
          </Button>
          
          <Button
            size="icon"
            onClick={handlePlayPause}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isPlaying ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>
          
          <Button
            variant="outline"
            size="icon"
            onClick={() => {}}
            disabled={isLoading}
          >
            <SkipForward className="h-4 w-4" />
          </Button>
        </div>

        {/* Progress Bar */}
        <div className="flex-1">
          <input
            type="range"
            min="0"
            max="100"
            step="0.1"
            value={progress}
            onChange={handleSeek}
            disabled={isLoading}
            className="w-full h-2 bg-secondary rounded-full appearance-none cursor-pointer accent-primary"
            style={{
              background: `linear-gradient(to right, hsl(var(--primary)) ${progress}%, hsl(var(--secondary)) ${progress}%)`,
            }}
          />
        </div>

        {/* Volume Control */}
        <div className="flex items-center gap-2">
          <Volume2 className="h-4 w-4" />
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={handleVolumeChange}
            className="w-20 h-2 bg-secondary rounded-full appearance-none cursor-pointer accent-primary"
            style={{
              background: `linear-gradient(to right, hsl(var(--primary)) ${volume * 100}%, hsl(var(--secondary)) ${volume * 100}%)`,
            }}
          />
        </div>
      </div>

      {/* Status */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <Wifi className="h-4 w-4" />
            {usedStorage || 'Loading...'}
          </span>
          {isLoading && (
            <span className="flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              {`Loading... ${Math.round(loadProgress)}%`}
            </span>
          )}
        </div>
        {isPlaying && <span className="text-green-500">● Playing</span>}
      </div>
    </div>
  );
};

export default UnifiedMusicPlayer;
