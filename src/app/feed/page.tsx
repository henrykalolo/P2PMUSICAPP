'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { EnhancedFeedItem } from '@/components/feed/EnhancedFeedItem';
import { RepostItem } from '@/components/feed/RepostItem';
import { FollowingSidebar } from '@/components/feed/FollowingSidebar';
import { TrendsSidebar } from '@/components/feed/TrendsSidebar';
import { Music, Upload, User, LogOut, LogIn, UserPlus } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';

interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  genre: string;
  duration: number;
  magnetUri?: string;
  ipfsCid?: string;
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

export default function FeedPage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [reposts, setReposts] = useState<Repost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, isAuthenticated, setUser, setAuthenticated, setLoading } = useAuthStore();

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

  useEffect(() => {
    fetchFeedData();
  }, []);

  const fetchFeedData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const [tracksResponse, repostsResponse] = await Promise.all([
        fetch('/api/tracks'),
        fetch('/api/social/reposts', { headers })
      ]);

      // Handle reposts separately - 401 is expected for unauthenticated users
      let repostsData = { reposts: [] };
      if (repostsResponse.ok) {
        repostsData = await repostsResponse.json();
      } else if (repostsResponse.status !== 401) {
        throw new Error('Failed to fetch reposts');
      }

      if (!tracksResponse.ok) {
        throw new Error('Failed to fetch tracks');
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

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setAuthenticated(false);
    window.location.href = '/';
  };

  // Combine tracks and reposts for feed display
  const feedItems: Array<{
    type: 'track' | 'repost';
    data: Track | Repost;
    createdAt: string;
  }> = [];
  
  // Add tracks with type indicator
  tracks.forEach(track => {
    feedItems.push({
      type: 'track',
      data: track,
      createdAt: track.createdAt
    });
  });
  
  // Add reposts with type indicator
  reposts.forEach(repost => {
    feedItems.push({
      type: 'repost',
      data: repost,
      createdAt: repost.createdAt
    });
  });
  
  // Sort feed items by date (newest first)
  feedItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/95 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl">
            <Music className="h-6 w-6 text-primary" />
            P2P Music
          </Link>
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <>
                <Link href="/upload">
                  <Button variant="ghost" size="sm" className="hover:bg-primary/10 transition-all duration-200">
                    <Upload className="h-4 w-4 mr-2" />
                    Upload
                  </Button>
                </Link>
                <Link href="/profile">
                  <Button variant="ghost" size="sm" className="hover:bg-primary/10 transition-all duration-200">
                    <User className="h-4 w-4 mr-2" />
                    Profile
                  </Button>
                </Link>
                <Button variant="ghost" size="sm" onClick={handleLogout} className="hover:bg-destructive/10 hover:text-destructive transition-all duration-200">
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </Button>
              </>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" size="sm" className="hover:bg-primary/10 transition-all duration-200">
                    <LogIn className="h-4 w-4 mr-2" />
                    Sign In
                  </Button>
                </Link>
                <Link href="/register">
                  <Button size="sm" className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 transition-all duration-200">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Sign Up
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Sidebar - Following */}
          <div className="lg:col-span-3">
            <FollowingSidebar userId={user?.id} />
          </div>

          {/* Feed Content */}
          <div className="lg:col-span-6">
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

            <h1 className="text-3xl font-bold mb-8">Your Feed</h1>

            {error ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">{error}</p>
                <Button onClick={fetchFeedData}>Retry</Button>
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
                      <EnhancedFeedItem key={item.data.id} post={item.data as Track} />
                    ) : (
                      <RepostItem key={item.data.id} repost={item.data as Repost} />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Sidebar - Trends */}
          <div className="lg:col-span-3">
            <TrendsSidebar userId={user?.id} />
          </div>
        </div>
      </div>
    </main>
  );
}
