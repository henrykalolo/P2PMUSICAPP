'use client';

import React, { useEffect, useRef, useState } from 'react';
import { streamAudioFromIPFS, createIPFSAudioElement } from '@/lib/ipfs/retrieve';
import { usePlayerStore } from '@/store/usePlayerStore';
import { Button } from '@/components/ui/button';
import { Play, Pause, SkipBack, SkipForward, Volume2, Users, Zap } from 'lucide-react';

interface P2PMusicPlayerProps {
  ipfsCid?: string;
  magnetURI?: string;
}

export const P2PMusicPlayer: React.FC<P2PMusicPlayerProps> = ({ ipfsCid, magnetURI }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const {
    currentTrack,
    isPlaying,
    progress,
    volume,
    peerCount,
    isSeeding,
    setIsPlaying,
    setProgress,
    setVolume,
    setPeerCount,
    setIsSeeding,
  } = usePlayerStore();

  useEffect(() => {
    const initPlayer = async () => {
      try {
        setIsLoading(true);
        setError(null);

        if (ipfsCid) {
          // Use IPFS for audio playback
          const audioElement = await createIPFSAudioElement(ipfsCid);
          audioRef.current = audioElement;
        } else if (magnetURI) {
          // Fallback to WebTorrent if IPFS isn't available
          // TODO: Implement WebTorrent fallback
          setError('WebTorrent fallback not implemented');
          setIsLoading(false);
          return;
        } else {
          setError('No audio source provided');
          setIsLoading(false);
          return;
        }

        // Set up event listeners
        if (audioRef.current) {
          audioRef.current.addEventListener('timeupdate', () => {
            if (audioRef.current?.duration) {
              setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100);
            }
          });

          audioRef.current.addEventListener('play', () => setIsPlaying(true));
          audioRef.current.addEventListener('pause', () => setIsPlaying(false));
          audioRef.current.addEventListener('ended', () => setIsPlaying(false));
          audioRef.current.addEventListener('error', (e) => {
            console.error('Audio element error:', e);
            setError('Failed to play audio');
          });

          // Set initial volume
          audioRef.current.volume = volume;
        }

        setIsLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load track');
        setIsLoading(false);
      }
    };

    if (ipfsCid || magnetURI) {
      initPlayer();
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.remove();
      }
    };
  }, [ipfsCid, magnetURI]);

  const handlePlayPause = () => {
    if (audioRef.current) {
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

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newProgress = parseFloat(e.target.value);
    if (audioRef.current && audioRef.current.duration) {
      audioRef.current.currentTime = (newProgress / 100) * audioRef.current.duration;
      setProgress(newProgress);
    }
  };

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-600">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gradient-to-br from-card to-muted/30 border border-border/50 rounded-2xl shadow-xl backdrop-blur-sm">
      <div className="flex items-center gap-6 mb-6">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => {}}
            disabled={isLoading}
            className="w-12 h-12 rounded-full border-border/50 hover:border-primary/50 hover:bg-primary/10 transition-all duration-300"
          >
            <SkipBack className="h-5 w-5" />
          </Button>
          
          <Button
            size="icon"
            onClick={handlePlayPause}
            disabled={isLoading}
            className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-accent hover:from-primary/90 hover:to-accent/90 shadow-lg hover:shadow-xl transition-all duration-300"
          >
            {isPlaying ? (
              <Pause className="h-6 w-6" />
            ) : (
              <Play className="h-6 w-6" />
            )}
          </Button>
          
          <Button
            variant="outline"
            size="icon"
            onClick={() => {}}
            disabled={isLoading}
            className="w-12 h-12 rounded-full border-border/50 hover:border-primary/50 hover:bg-primary/10 transition-all duration-300"
          >
            <SkipForward className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1">
          <div className="h-3 bg-secondary/50 rounded-full overflow-hidden relative group">
            <div
              className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-300 ease-out relative"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={progress}
              onChange={handleProgressChange}
              disabled={isLoading}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Volume2 className="h-5 w-5 text-muted-foreground" />
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={handleVolumeChange}
            className="w-28 h-2 bg-secondary/50 rounded-lg appearance-none cursor-pointer accent-primary"
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-6">
          <span className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span className="font-medium">{peerCount} peers</span>
          </span>
          {isSeeding && (
            <span className="flex items-center gap-2 text-green-500 animate-pulse">
              <Zap className="h-4 w-4" />
              <span className="font-medium">Seeding</span>
            </span>
          )}
        </div>
        {isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            <span>Loading...</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default P2PMusicPlayer;
