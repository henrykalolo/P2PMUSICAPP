'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Volume2, 
  VolumeX,
  Users,
  HardDrive,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { 
  initWebTorrent, 
  isWebTorrentSupported, 
  streamAudio, 
  getTorrentInfo,
  type TorrentInfo 
} from '@/lib/p2p/webtorrent';

interface P2PPlayerProps {
  magnetURI: string;
  title: string;
  artist: string;
  coverArt?: string;
  onEnded?: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
}

export const P2PPlayer: React.FC<P2PPlayerProps> = ({
  magnetURI,
  title,
  artist,
  coverArt,
  onEnded,
  onNext,
  onPrevious
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [torrentInfo, setTorrentInfo] = useState<TorrentInfo | null>(null);
  const [bufferProgress, setBufferProgress] = useState(0);
  const [isSupported, setIsSupported] = useState(true);

  // Initialize WebTorrent and load audio
  useEffect(() => {
    if (!isWebTorrentSupported()) {
      setIsSupported(false);
      setError('P2P streaming is not supported in this browser');
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    const loadAudio = async () => {
      try {
        initWebTorrent();

        const { audioElement, torrent } = await streamAudio(magnetURI, {
          onProgress: (progress) => {
            if (isMounted) setBufferProgress(progress);
          },
          onPeerConnect: () => {
            if (isMounted) {
              const info = getTorrentInfo(torrent.infoHash);
              if (info) setTorrentInfo(info);
            }
          },
          onError: (err) => {
            if (isMounted) setError(err.message);
          },
          onDone: () => {
            if (isMounted) {
              const info = getTorrentInfo(torrent.infoHash);
              if (info) setTorrentInfo(info);
            }
          }
        });

        if (!isMounted) {
          torrent.destroy();
          return;
        }

        audioRef.current = audioElement;

        // Set up audio event listeners
        audioElement.addEventListener('loadedmetadata', () => {
          if (isMounted) setDuration(audioElement.duration);
        });

        audioElement.addEventListener('timeupdate', () => {
          if (isMounted) setCurrentTime(audioElement.currentTime);
        });

        audioElement.addEventListener('ended', () => {
          if (isMounted) {
            setIsPlaying(false);
            onEnded?.();
          }
        });

        audioElement.addEventListener('error', (e) => {
          if (isMounted) {
            console.error('Audio error:', e);
            setError('Failed to play audio');
          }
        });

        // Set initial volume
        audioElement.volume = volume;

        // Auto-play when ready
        try {
          await audioElement.play();
          setIsPlaying(true);
        } catch (playError) {
          // Auto-play blocked, user needs to interact
          console.log('Auto-play blocked:', playError);
        }

        setIsLoading(false);

        // Update torrent info periodically
        const infoInterval = setInterval(() => {
          if (isMounted) {
            const info = getTorrentInfo(torrent.infoHash);
            if (info) setTorrentInfo(info);
          }
        }, 2000);

        return () => clearInterval(infoInterval);
      } catch (err) {
        if (isMounted) {
          console.error('Load error:', err);
          setError(err instanceof Error ? err.message : 'Failed to load audio');
          setIsLoading(false);
        }
      }
    };

    loadAudio();

    return () => {
      isMounted = false;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [magnetURI, onEnded]);

  // Handle play/pause
  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(err => {
        console.error('Play error:', err);
        setError('Failed to play audio');
      });
    }
  }, [isPlaying]);

  // Handle seek
  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !progressRef.current || duration === 0) return;

    const rect = progressRef.current.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const newTime = percent * duration;

    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  }, [duration]);

  // Handle volume change
  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
    setIsMuted(newVolume === 0);
  }, []);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (!audioRef.current) return;

    if (isMuted) {
      audioRef.current.volume = volume || 1;
      setIsMuted(false);
    } else {
      audioRef.current.volume = 0;
      setIsMuted(true);
    }
  }, [isMuted, volume]);

  // Format time display
  const formatTime = (seconds: number): string => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isSupported) {
    return (
      <div className="w-full max-w-md mx-auto p-6 bg-card rounded-lg border">
        <div className="flex items-center gap-3 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <p className="text-sm">P2P streaming is not supported in this browser</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-md mx-auto p-6 bg-card rounded-lg border">
        <div className="flex items-center gap-3 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <p className="text-sm">{error}</p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          className="mt-3"
          onClick={() => window.location.reload()}
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto bg-card rounded-lg border overflow-hidden">
      {/* Cover Art */}
      <div className="relative aspect-square bg-muted">
        {coverArt ? (
          <img 
            src={coverArt} 
            alt={title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <HardDrive className="h-16 w-16 text-muted-foreground" />
          </div>
        )}
        
        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center">
            <Loader2 className="h-8 w-8 text-white animate-spin mb-2" />
            <p className="text-white text-sm">Connecting to peers...</p>
            <p className="text-white/70 text-xs mt-1">{bufferProgress}% buffered</p>
          </div>
        )}
      </div>

      {/* Track Info */}
      <div className="p-4">
        <h3 className="font-semibold text-lg truncate">{title}</h3>
        <p className="text-muted-foreground text-sm truncate">{artist}</p>
      </div>

      {/* Progress Bar */}
      <div className="px-4 pb-2">
        <div 
          ref={progressRef}
          className="h-1 bg-secondary rounded-full cursor-pointer group"
          onClick={handleSeek}
        >
          <div 
            className="h-full bg-primary rounded-full relative"
            style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-primary rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="p-4 pt-2">
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onPrevious}
            disabled={!onPrevious}
          >
            <SkipBack className="h-5 w-5" />
          </Button>

          <Button
            variant="default"
            size="icon"
            className="h-12 w-12"
            onClick={togglePlay}
            disabled={isLoading}
          >
            {isPlaying ? (
              <Pause className="h-6 w-6" />
            ) : (
              <Play className="h-6 w-6 ml-0.5" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={onNext}
            disabled={!onNext}
          >
            <SkipForward className="h-5 w-5" />
          </Button>
        </div>

        {/* Volume Control */}
        <div className="flex items-center gap-2 mt-4">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={toggleMute}
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </Button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className="flex-1 h-1 bg-secondary rounded-lg appearance-none cursor-pointer"
          />
        </div>
      </div>

      {/* P2P Stats */}
      {torrentInfo && (
        <div className="px-4 pb-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted rounded-lg p-2">
            <div className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              <span>{torrentInfo.numPeers} peers</span>
            </div>
            <div>
              {torrentInfo.done ? (
                <span className="text-green-500">● Seeding</span>
              ) : (
                <span>{Math.round(torrentInfo.progress * 100)}% downloaded</span>
              )}
            </div>
            <div>
              ↓ {formatBytes(torrentInfo.downloadSpeed)}/s
            </div>
            <div>
              ↑ {formatBytes(torrentInfo.uploadSpeed)}/s
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default P2PPlayer;

// Helper function to format bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
