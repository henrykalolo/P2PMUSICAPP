import { beforeEach, describe, expect, it } from 'vitest';
import { usePlayerStore, type Track } from './usePlayerStore';

const track = (id: string, title = id): Track => ({
  id,
  title,
  artist: 'Artist',
  album: 'Album',
  duration: 120,
  streamUrl: `/api/media/${id}`,
});

const resetStore = () => {
  usePlayerStore.setState({
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
    queue: [],
    currentIndex: -1,
    contextName: null,
  });
};

describe('player queue', () => {
  beforeEach(resetStore);

  it('starts a queue at the requested track and advances on next', () => {
    const tracks = [track('a'), track('b'), track('c')];
    usePlayerStore.getState().setQueue(tracks, 1, { contextName: 'My Mix' });

    let state = usePlayerStore.getState();
    expect(state.currentTrack?.id).toBe('b');
    expect(state.isPlaying).toBe(true);
    expect(state.contextName).toBe('My Mix');

    state.playNext();
    state = usePlayerStore.getState();
    expect(state.currentTrack?.id).toBe('c');
    expect(state.currentIndex).toBe(2);
  });

  it('stops at the end of the queue but rewinds for replay', () => {
    usePlayerStore.getState().setQueue([track('a'), track('b')], 1);
    usePlayerStore.getState().playNext();

    const state = usePlayerStore.getState();
    expect(state.isPlaying).toBe(false);
    expect(state.seekTarget).toBe(0);
    expect(state.currentTrack?.id).toBe('b');
  });

  it('restarts the current track before skipping back', () => {
    usePlayerStore.getState().setQueue([track('a'), track('b')], 1);
    usePlayerStore.getState().setTime(25, 120);
    usePlayerStore.getState().playPrevious();

    let state = usePlayerStore.getState();
    expect(state.currentTrack?.id).toBe('b');
    expect(state.seekTarget).toBe(0);

    usePlayerStore.getState().setTime(1, 120);
    usePlayerStore.getState().playPrevious();
    state = usePlayerStore.getState();
    expect(state.currentTrack?.id).toBe('a');
  });

  it('keeps the queue index valid when removing tracks', () => {
    usePlayerStore.getState().setQueue([track('a'), track('b'), track('c')], 2);
    usePlayerStore.getState().removeFromQueue(0);

    const state = usePlayerStore.getState();
    expect(state.currentIndex).toBe(1);
    expect(state.currentTrack?.id).toBe('c');
  });

  it('does not start playback without a track', () => {
    usePlayerStore.getState().setIsPlaying(true);
    expect(usePlayerStore.getState().isPlaying).toBe(false);

    usePlayerStore.getState().setQueue([track('a')], 0, { autoplay: false });
    expect(usePlayerStore.getState().isPlaying).toBe(false);
    usePlayerStore.getState().togglePlay();
    expect(usePlayerStore.getState().isPlaying).toBe(true);
  });

  it('tracks progress as a percentage for timestamp comments', () => {
    usePlayerStore.getState().setTime(30, 120);
    expect(usePlayerStore.getState().progress).toBe(25);
  });
});
