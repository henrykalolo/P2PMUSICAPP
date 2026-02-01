'use client';

import React, { useEffect, useRef, useState } from 'react';
import { P2PAudioPlayer } from '@/lib/p2p/player';
import { usePlayerStore } from '@/store/usePlayerStore';
import { Button } from '@/components/ui/button';
import { Play, Pause, SkipBack, SkipForward, Volume2, Users } from 'lucide-react';

interface P2PMusicPlayerProps {
  magnetURI: string;
}

export const P2PMusicPlayer: React.FC<P2PMusicPlayerProps> = ({ magnetURI }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playerRef = useRef<P2PAudioPlayer | null>(null);
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
    if (!P2PAudioPlayer.isSupported()) {
      setError('P2P is not supported in this browser');
      setIsLoading(false);
      return;
    }

    playerRef.current = new P2PAudioPlayer();

    const initPlayer = async () => {
      try {
        setIsLoading(true);
        const { element, torrent } = await playerRef.current!.stream(magnetURI);
        
        audioRef.current = element;
        
        // Set up event listeners
        element.addEventListener('timeupdate', () => {
          if (element.duration) {
            setProgress((element.currentTime / element.duration) * 100);
          }
        });

        element.addEventListener('play', () => setIsPlaying(true));
        element.addEventListener('pause', () => setIsPlaying(false));
        element.addEventListener('ended', () => setIsPlaying(false));

        // Update torrent info
        torrent.on('wire', () => {
          setPeerCount(torrent.numPeers);
        });

        torrent.on('done', () => {
          setIsSeeding(true);
        });

        setIsSeeding(torrent.done);
        setPeerCount(torrent.numPeers);
        setIsLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load track');
        setIsLoading(false);
      }
    };

    initPlayer();

    return () => {
      playerRef.current?.destroy();
    };
  }, [magnetURI]);

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
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

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-600">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-card border rounded-lg shadow-sm">
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
            {isPlaying ? (
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

        <div className="flex-1">
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Volume2 className="h-4 w-4" />
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={handleVolumeChange}
            className="w-24"
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            {peerCount} peers
          </span>
          {isSeeding && (
            <span className="text-green-500 flex items-center gap-1">
              ⚡ Seeding
            </span>
          )}
        </div>
        {isLoading && <span>Loading...</span>}
      </div>
    </div>
  );
};

export default P2PMusicPlayer;
