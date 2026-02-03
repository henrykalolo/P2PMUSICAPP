import { create } from 'zustand';

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  magnetUri?: string;
  ipfsCid?: string;
  coverArtUrl?: string;
}

interface PlayerState {
  currentTrack: Track | null;
  isPlaying: boolean;
  progress: number;
  volume: number;
  peerCount: number;
  isSeeding: boolean;
  queue: Track[];
  currentIndex: number;
  
  // Actions
  setCurrentTrack: (track: Track | null) => void;
  setIsPlaying: (value: boolean) => void;
  setProgress: (value: number) => void;
  setVolume: (value: number) => void;
  setPeerCount: (value: number) => void;
  setIsSeeding: (value: boolean) => void;
  addToQueue: (track: Track) => void;
  removeFromQueue: (index: number) => void;
  playNext: () => void;
  playPrevious: () => void;
  togglePlay: () => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentTrack: null,
  isPlaying: false,
  progress: 0,
  volume: 0.8,
  peerCount: 0,
  isSeeding: false,
  queue: [],
  currentIndex: -1,

  setCurrentTrack: (track) => set({ currentTrack: track }),
  setIsPlaying: (value) => set({ isPlaying: value }),
  setProgress: (value) => set({ progress: value }),
  setVolume: (value) => set({ volume: value }),
  setPeerCount: (value) => set({ peerCount: value }),
  setIsSeeding: (value) => set({ isSeeding: value }),
  
  addToQueue: (track) => {
    const { queue } = get();
    set({ queue: [...queue, track] });
  },
  
  removeFromQueue: (index) => {
    const { queue } = get();
    const newQueue = [...queue];
    newQueue.splice(index, 1);
    set({ queue: newQueue });
  },
  
  playNext: () => {
    const { queue, currentIndex } = get();
    const nextIndex = currentIndex + 1;
    if (nextIndex < queue.length) {
      set({
        currentTrack: queue[nextIndex],
        currentIndex: nextIndex,
        isPlaying: true,
      });
    }
  },
  
  playPrevious: () => {
    const { queue, currentIndex } = get();
    const prevIndex = currentIndex - 1;
    if (prevIndex >= 0) {
      set({
        currentTrack: queue[prevIndex],
        currentIndex: prevIndex,
        isPlaying: true,
      });
    }
  },
  
  togglePlay: () => {
    const { isPlaying } = get();
    set({ isPlaying: !isPlaying });
  },
}));
