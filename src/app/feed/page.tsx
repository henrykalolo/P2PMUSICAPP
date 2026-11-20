'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { EnhancedFeedItem } from '@/components/feed/EnhancedFeedItem';
import { RepostItem } from '@/components/feed/RepostItem';
import { Music, Sparkles, Upload, User, Play } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { usePlayerStore, type Track as PlayerTrack } from '@/store/usePlayerStore';

interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  genre: string;
  duration: number;
  ipfsCid?: string;
  streamUrl?: string | null;
  serverStorageId?: string;
  coverArtUrl?: string;
  createdAt: string;
  author: {
    id: string;
    username: string;
    avatarUrl?: string;
    badge: string;
  };
  likesCount: number;
  commentsCount: number;
  repostsCount: number;
}

interface Repost {
  id: string;
  userId: string;
  postId: string;
  caption: string | null;
  createdAt: string;
  reposter: {
    id: string;
    username: string;
    avatarUrl?: string;
    badge: string;
  };
  originalPost: Track;
}

type FeedMode = 'latest' | 'for-you' | 'following';

const FEED_MODES: Array<{ id: FeedMode; label: string; authOnly?: boolean }> = [
  { id: 'for-you', label: 'For You' },
  { id: 'latest', label: 'Latest' },
  { id: 'following', label: 'Following', authOnly: true },
];

export default function FeedPage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [reposts, setReposts] = useState<Repost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<FeedMode>('for-you');
  const [mix, setMix] = useState<{
    name: string;
    description: string;
    tracks: Track[];
  } | null>(null);
  const { user, isAuthenticated, setUser, setAuthenticated, setLoading } = useAuthStore();
  const setQueue = usePlayerStore((state) => state.setQueue);
  const setIsPlaying = usePlayerStore((state) => state.setIsPlaying);
  const currentTrack = usePlayerStore((state) => state.currentTrack);

  useEffect(() => {
    // Check authentication status
    const token = localStorage.getItem('token');
    if (token) {
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.user) {
            setUser(data.user);
            setAuthenticated(true);
          } else {
            localStorage.removeItem('token');
            setAuthenticated(false);
          }
        })
        .catch(() => {
          localStorage.removeItem('token');
          setAuthenticated(false);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [setUser, setAuthenticated, setLoading]);

  // A personalized mix generated on Discover is handed over through localStorage.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('playlist') !== 'auto') return;
    try {
      const raw = window.localStorage.getItem('autoPlaylist');
      if (!raw) return;
      const stored = JSON.parse(raw) as {
        name?: string;
        description?: string;
        tracks?: Track[];
      };
      const mixTracks = (stored.tracks || []).filter((track) => track?.id && track?.title);
      if (mixTracks.length === 0) return;
      const nextMix = {
        name: stored.name || 'Discover Mix',
        description: stored.description || 'A personalized mix based on your preferences',
        tracks: mixTracks,
      };
      setMix(nextMix);
      setQueue(mixTracks as PlayerTrack[], 0, {
        autoplay: false,
        contextName: nextMix.name,
      });
    } catch {
      // A malformed/stale mix should never break the feed.
    }
  }, [setQueue]);

  const fetchFeedData = async (feedMode: FeedMode = mode) => {
    setIsLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const [tracksResponse, repostsResponse] = await Promise.all([
        fetch(`/api/tracks?mode=${feedMode}&limit=50`, { headers }),
        feedMode === 'following'
          ? Promise.resolve(null)
          : fetch('/api/social/reposts', { headers })
      ]);

      // Handle reposts separately - 401 is expected for unauthenticated users
      let repostsData = { reposts: [] };
      if (repostsResponse) {
        if (repostsResponse.ok) {
          repostsData = await repostsResponse.json();
        } else if (repostsResponse.status !== 401) {
          throw new Error('Failed to fetch reposts');
        }
      }

      if (!tracksResponse.ok) {
        const data = await tracksResponse.json().catch(() => null);
        throw new Error(data?.error || 'Failed to fetch tracks');
      }

      const tracksData = await tracksResponse.json();

      setTracks(tracksData.tracks || []);
      setReposts(repostsData.reposts || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load feed');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchFeedData(mode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setAuthenticated(false);
    window.location.href = '/';
  };

  // Combine tracks and reposts for feed display. For You keeps the server's
  // ranking; Latest/Following remain chronological.
  const timestamp = (value: string) => {
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const orderedTracks = mode === 'for-you'
    ? tracks
    : [...tracks].sort((a, b) => timestamp(b.createdAt) - timestamp(a.createdAt));

  const feedItems: Array<{
    type: 'track' | 'repost';
    data: Track | Repost;
    createdAt: string;
  }> = orderedTracks.map((track) => ({
    type: 'track',
    data: track,
    createdAt: track.createdAt,
  }));

  const orderedReposts = [...reposts].sort(
    (a, b) => timestamp(b.createdAt) - timestamp(a.createdAt)
  );

  if (mode === 'for-you') {
    // Interleave reposts by date without reordering the ranked tracks.
    orderedReposts.forEach((repost) => {
      const entry = {
        type: 'repost' as const,
        data: repost,
        createdAt: repost.createdAt,
      };
      const insertAt = feedItems.findIndex(
        (item) => item.type === 'track' && timestamp(item.createdAt) <= timestamp(repost.createdAt)
      );
      if (insertAt === -1) feedItems.push(entry);
      else feedItems.splice(insertAt, 0, entry);
    });
  } else {
    orderedReposts.forEach((repost) => {
      feedItems.push({
        type: 'repost',
        data: repost,
        createdAt: repost.createdAt,
      });
    });
    feedItems.sort((a, b) => timestamp(b.createdAt) - timestamp(a.createdAt));
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background">

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-3xl space-y-8">
            {/* Account Details - Only for authenticated users */}
            {isAuthenticated && user && (
              <div className="mb-8 p-6 bg-card border border-border/50 rounded-2xl shadow-lg">
                <div className="flex items-center gap-6">
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.username}
                      className="w-16 h-16 rounded-full object-cover border-2 border-primary/50"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center border-2 border-primary/50">
                      <User className="h-8 w-8 text-primary" />
                    </div>
                  )}
                  <div className="flex-1">
                    <h2 className="font-bold text-xl">Welcome, {user.username}!</h2>
                    <p className="text-sm text-muted-foreground">
                      {user.isArtist ? 'Artist' : 'Listener'} • {user.role}
                    </p>
                  </div>
                  <Link href="/profile">
                    <Button variant="outline" size="sm" className="border-primary/50 hover:bg-primary/10 transition-all duration-200">
                      View Profile
                    </Button>
                  </Link>
                </div>
              </div>
            )}

            <div className="mb-8">
              <h1 className="text-3xl font-bold">Your Feed</h1>
              <div className="mt-4 flex gap-2 border-b border-border/60">
                {FEED_MODES.filter((item) => !item.authOnly || isAuthenticated).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setMode(item.id)}
                    className={`border-b-2 px-1 pb-2 text-sm font-medium transition-colors ${
                      mode === item.id
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {mix && mix.tracks.length > 0 && (
              <section className="space-y-4 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-accent/5 to-primary/10 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="flex items-center gap-2 text-xl font-bold">
                      <Sparkles className="h-5 w-5 text-primary" />
                      {mix.name}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {mix.description} · {mix.tracks.length} tracks
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      const isCurrentMix =
                        currentTrack &&
                        mix.tracks.some((track) => track.id === currentTrack.id);
                      if (isCurrentMix) {
                        setIsPlaying(true);
                      } else {
                        setQueue(mix.tracks as PlayerTrack[], 0, {
                          autoplay: true,
                          contextName: mix.name,
                        });
                      }
                    }}
                  >
                    <Play className="mr-2 h-4 w-4" />
                    Play Mix
                  </Button>
                </div>
                <div className="space-y-3">
                  {mix.tracks.slice(0, 10).map((track) => (
                    <EnhancedFeedItem
                      key={`mix-${track.id}`}
                      post={track}
                      queue={mix.tracks as PlayerTrack[]}
                      queueContext={mix.name}
                    />
                  ))}
                </div>
              </section>
            )}

            {error ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">{error}</p>
                <Button onClick={() => void fetchFeedData(mode)}>Retry</Button>
              </div>
            ) : feedItems.length === 0 ? (
              <div className="text-center py-12 border rounded-lg">
                <Music className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h2 className="text-lg font-semibold mb-2">No tracks yet</h2>
                <p className="text-muted-foreground mb-4">
                  Start following artists or upload your own music
                </p>
                <Link href="/upload">
                  <Button>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Music
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {feedItems.map((item, index) => (
                  <div key={`${item.type}-${item.data.id}-${index}`}>
                    {item.type === 'track' ? (
                      <EnhancedFeedItem
                        key={item.data.id}
                        post={item.data as Track}
                        queue={tracks as PlayerTrack[]}
                        queueContext="Your Feed"
                      />
                    ) : (
                      <RepostItem key={item.data.id} repost={item.data as Repost} />
                    )}
                  </div>
                ))}
              </div>
            )}
        </div>
      </div>
    </main>
  );
}
