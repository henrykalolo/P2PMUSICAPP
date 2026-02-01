'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  initWebTorrent, 
  isWebTorrentSupported, 
  streamAudio, 
  seedFile,
  getTorrentInfo,
  removeTorrent,
  type TorrentInfo 
} from '@/lib/p2p/webtorrent';

interface UseWebTorrentReturn {
  isSupported: boolean;
  isReady: boolean;
  isLoading: boolean;
  error: string | null;
  currentTorrent: TorrentInfo | null;
  streamTrack: (magnetURI: string) => Promise<HTMLAudioElement | null>;
  seedTrack: (file: File) => Promise<TorrentInfo | null>;
  stopSeeding: (infoHash: string) => void;
  getInfo: (infoHash: string) => TorrentInfo | null;
}

export function useWebTorrent(): UseWebTorrentReturn {
  const [isSupported, setIsSupported] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTorrent, setCurrentTorrent] = useState<TorrentInfo | null>(null);
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize WebTorrent on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const supported = isWebTorrentSupported();
    setIsSupported(supported);

    if (supported) {
      try {
        initWebTorrent();
        setIsReady(true);
      } catch (err) {
        setError('Failed to initialize WebTorrent');
        console.error('WebTorrent init error:', err);
      }
    }

    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    };
  }, []);

  const streamTrack = useCallback(async (magnetURI: string): Promise<HTMLAudioElement | null> => {
    if (!isReady) {
      setError('WebTorrent not initialized');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { audioElement, torrent } = await streamAudio(magnetURI, {
        onProgress: (progress) => {
          console.log(`[WebTorrent] Download progress: ${progress}%`);
        },
        onPeerConnect: (numPeers) => {
          console.log(`[WebTorrent] Connected to ${numPeers} peers`);
        },
        onError: (err) => {
          console.error('[WebTorrent] Stream error:', err);
          setError(err.message);
        },
        onDone: () => {
          console.log('[WebTorrent] Download complete');
        }
      });

      // Start polling for torrent info updates
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }

      updateIntervalRef.current = setInterval(() => {
        const info = getTorrentInfo(torrent.infoHash);
        if (info) {
          setCurrentTorrent(info);
        }
      }, 2000);

      setIsLoading(false);
      return audioElement;
    } catch (err) {
      setIsLoading(false);
      const errorMessage = err instanceof Error ? err.message : 'Failed to stream track';
      setError(errorMessage);
      console.error('Stream error:', err);
      return null;
    }
  }, [isReady]);

  const seedTrack = useCallback(async (file: File): Promise<TorrentInfo | null> => {
    if (!isReady) {
      setError('WebTorrent not initialized');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const info = await seedFile(file, {
        name: file.name.replace(/\.[^/.]+$/, ''), // Remove extension
        createdBy: 'P2P Music Platform User'
      });

      setCurrentTorrent(info);
      setIsLoading(false);
      return info;
    } catch (err) {
      setIsLoading(false);
      const errorMessage = err instanceof Error ? err.message : 'Failed to seed track';
      setError(errorMessage);
      console.error('Seed error:', err);
      return null;
    }
  }, [isReady]);

  const stopSeeding = useCallback((infoHash: string) => {
    removeTorrent(infoHash, false);
    if (currentTorrent?.infoHash === infoHash) {
      setCurrentTorrent(null);
    }
  }, [currentTorrent]);

  const getInfo = useCallback((infoHash: string): TorrentInfo | null => {
    return getTorrentInfo(infoHash);
  }, []);

  return {
    isSupported,
    isReady,
    isLoading,
    error,
    currentTorrent,
    streamTrack,
    seedTrack,
    stopSeeding,
    getInfo
  };
}

export default useWebTorrent;
