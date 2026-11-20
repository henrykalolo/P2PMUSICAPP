import { create } from 'zustand';

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  streamUrl?: string | null;
  ipfsCid?: string;
  coverArtUrl?: string;
  mimeType?: string;
}

export interface PlayQueueOptions {
  /** Start playing immediately after replacing the queue. Defaults to true. */
  autoplay?: boolean;
  /** Human readable source of the queue (playlist, mix, album...). */
  contextName?: string | null;
}

interface PlayerState {
  currentTrack: Track | null;
  isPlaying: boolean;
  /** Playback progress percentage (kept for timestamped comments). */
  progress: number;
  currentTime: number;
  duration: number;
  /** Absolute second requested by a UI control; consumed by the audio engine. */
  seekTarget: number | null;
  isBuffering: boolean;
  error: string | null;
  /** Incremented by retryPlayback() to force the audio engine to reload. */
  playbackRetryToken: number;
  volume: number;
  peerCount: number;
  isSeeding: boolean;
  queue: Track[];
  currentIndex: number;
  contextName: string | null;

  // Actions
  setCurrentTrack: (track: Track | null) => void;
  setIsPlaying: (value: boolean) => void;
  setProgress: (value: number) => void;
  setTime: (currentTime: number, duration?: number) => void;
  setVolume: (value: number) => void;
  setPeerCount: (value: number) => void;
  setIsSeeding: (value: boolean) => void;
  setPlayerError: (value: string | null) => void;
  setBuffering: (value: boolean) => void;
  setDuration: (value: number) => void;
  requestSeek: (seconds: number) => void;
  clearSeekTarget: () => void;
  retryPlayback: () => void;
  addToQueue: (track: Track) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  setQueue: (tracks: Track[], startIndex?: number, options?: PlayQueueOptions) => void;
  playTrack: (track: Track, options?: PlayQueueOptions) => void;
  playNext: () => void;
  playPrevious: () => void;
  togglePlay: () => void;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const resetPosition = {
  currentTime: 0,
  progress: 0,
  duration: 0,
  seekTarget: 0,
  error: null,
};

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentTrack: null,
  isPlaying: false,
  progress: 0,
  currentTime: 0,
  duration: 0,
  seekTarget: null,
  isBuffering: false,
  error: null,
  playbackRetryToken: 0,
  volume: 0.8,
  peerCount: 0,
  isSeeding: false,
  queue: [],
  currentIndex: -1,
  contextName: null,

  setCurrentTrack: (track) => {
    if (!track) {
      set({ currentTrack: null, isPlaying: false, ...resetPosition });
      return;
    }
    const { queue } = get();
    const index = queue.findIndex((item) => item.id === track.id);
    set({
      currentTrack: track,
      currentIndex: index >= 0 ? index : -1,
      ...resetPosition,
    });
  },

  setIsPlaying: (value) => {
    if (value && !get().currentTrack) return;
    set({ isPlaying: value });
  },

  setProgress: (value) => set({ progress: clamp(value, 0, 100) }),

  setTime: (currentTime, duration) => {
    const safeTime = Number.isFinite(currentTime) ? Math.max(0, currentTime) : 0;
    const safeDuration =
      duration === undefined
        ? get().duration
        : Number.isFinite(duration)
          ? Math.max(0, duration)
          : 0;
    set({
      currentTime: safeTime,
      duration: safeDuration,
      progress: safeDuration > 0 ? clamp((safeTime / safeDuration) * 100, 0, 100) : 0,
    });
  },

  setDuration: (value) => set({ duration: Number.isFinite(value) ? Math.max(0, value) : 0 }),
  setVolume: (value) => set({ volume: clamp(value, 0, 1) }),
  setPeerCount: (value) => set({ peerCount: Math.max(0, value) }),
  setIsSeeding: (value) => set({ isSeeding: value }),
  setPlayerError: (value) => set({ error: value, isBuffering: false }),
  setBuffering: (value) => set({ isBuffering: value }),

  requestSeek: (seconds) =>
    set({
      seekTarget: Number.isFinite(seconds) ? Math.max(0, seconds) : 0,
      error: null,
    }),

  clearSeekTarget: () => set({ seekTarget: null }),
  retryPlayback: () =>
    set((state) => ({
      playbackRetryToken: state.playbackRetryToken + 1,
      error: null,
      isBuffering: true,
    })),

  addToQueue: (track) => {
    const { queue, currentTrack } = get();
    set({
      queue: [...queue, track],
      currentTrack: currentTrack || track,
      currentIndex: currentTrack ? get().currentIndex : 0,
    });
  },

  removeFromQueue: (index) => {
    const { queue, currentIndex } = get();
    if (index < 0 || index >= queue.length) return;
    const nextQueue = queue.filter((_, position) => position !== index);
    if (nextQueue.length === 0) {
      set({
        queue: [],
        currentTrack: null,
        currentIndex: -1,
        isPlaying: false,
        contextName: null,
        ...resetPosition,
      });
      return;
    }
    if (index < currentIndex) {
      set({ queue: nextQueue, currentIndex: currentIndex - 1 });
      return;
    }
    if (index > currentIndex) {
      set({ queue: nextQueue });
      return;
    }
    const nextIndex = Math.min(index, nextQueue.length - 1);
    set({
      queue: nextQueue,
      currentIndex: nextIndex,
      currentTrack: nextQueue[nextIndex],
      ...resetPosition,
    });
  },

  clearQueue: () =>
    set({
      queue: [],
      currentIndex: -1,
      contextName: null,
    }),

  setQueue: (tracks, startIndex = 0, options = {}) => {
    const queue = (tracks || []).filter(Boolean);
    if (queue.length === 0) {
      set({
        queue: [],
        currentTrack: null,
        currentIndex: -1,
        isPlaying: false,
        contextName: null,
        ...resetPosition,
      });
      return;
    }
    const index = clamp(Math.floor(startIndex) || 0, 0, queue.length - 1);
    set({
      queue,
      currentIndex: index,
      currentTrack: queue[index],
      isPlaying: options.autoplay !== false,
      contextName: options.contextName ?? null,
      isBuffering: options.autoplay !== false,
      ...resetPosition,
    });
  },

  playTrack: (track, options = {}) => {
    if (!track) return;
    const { queue } = get();
    const index = queue.findIndex((item) => item.id === track.id);
    if (index >= 0) {
      set({
        currentIndex: index,
        currentTrack: queue[index],
        isPlaying: true,
        isBuffering: true,
        contextName: options.contextName ?? get().contextName,
        ...resetPosition,
      });
      return;
    }
    get().setQueue([track], 0, { ...options, autoplay: true });
  },

  playNext: () => {
    const { queue, currentIndex } = get();
    if (queue.length === 0) return;
    const nextIndex = currentIndex + 1;
    if (nextIndex < queue.length) {
      set({
        currentIndex: nextIndex,
        currentTrack: queue[nextIndex],
        isPlaying: true,
        isBuffering: true,
        ...resetPosition,
      });
      return;
    }
    // End of queue: stop, but rewind so pressing play restarts the last track.
    set({
      isPlaying: false,
      isBuffering: false,
      currentTime: 0,
      progress: 0,
      seekTarget: 0,
    });
  },

  playPrevious: () => {
    const { queue, currentIndex, currentTime } = get();
    if (queue.length === 0) return;
    // Standard player behaviour: restart the track before skipping back.
    if (currentTime > 3) {
      set({ currentTime: 0, progress: 0, seekTarget: 0 });
      return;
    }
    const prevIndex = Math.max(0, currentIndex - 1);
    set({
      currentIndex: prevIndex,
      currentTrack: queue[prevIndex],
      isPlaying: true,
      isBuffering: true,
      ...resetPosition,
    });
  },

  togglePlay: () => {
    const { isPlaying, currentTrack, queue, currentIndex } = get();
    if (!currentTrack && queue.length > 0) {
      set({
        currentTrack: queue[Math.max(0, currentIndex)],
        isPlaying: true,
        isBuffering: true,
        ...resetPosition,
      });
      return;
    }
    if (!currentTrack) return;
    set({ isPlaying: !isPlaying, isBuffering: !isPlaying ? true : false });
  },
}));
