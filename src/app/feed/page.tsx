'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { EnhancedFeedItem } from '@/components/feed/EnhancedFeedItem';
import { Music, Upload, User, LogOut, LogIn, UserPlus } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';

interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  genre: string;
  duration: number;
  magnetUri: string;
  coverArtUrl?: string;
  createdAt: string;
  author: {
    id: string;
    username: string;
    avatarUrl?: string;
  };
  likesCount: number;
  commentsCount: number;
}

export default function FeedPage() {
  const [tracks, setTracks] = useState<Track[]>([]);
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
    fetchTracks();
  }, []);

  const fetchTracks = async () => {
    try {
      const response = await fetch('/api/tracks');
      if (!response.ok) {
        throw new Error('Failed to fetch tracks');
      }
      const data = await response.json();
      setTracks(data.tracks || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tracks');
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
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg">
            <Music className="h-5 w-5" />
            P2P Music
          </Link>
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <>
                <Link href="/upload">
                  <Button variant="ghost" size="sm">
                    <Upload className="h-4 w-4 mr-2" />
                    Upload
                  </Button>
                </Link>
                <Link href="/profile">
                  <Button variant="ghost" size="sm">
                    <User className="h-4 w-4 mr-2" />
                    Profile
                  </Button>
                </Link>
                <Button variant="ghost" size="sm" onClick={handleLogout}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </Button>
              </>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" size="sm">
                    <LogIn className="h-4 w-4 mr-2" />
                    Sign In
                  </Button>
                </Link>
                <Link href="/register">
                  <Button size="sm">
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
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Account Details - Only for authenticated users */}
          {isAuthenticated && user && (
            <div className="mb-6 p-4 bg-card border rounded-lg">
              <div className="flex items-center gap-4">
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.username}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-6 w-6 text-primary" />
                  </div>
                )}
                <div className="flex-1">
                  <h2 className="font-semibold text-lg">Welcome, {user.username}!</h2>
                  <p className="text-sm text-muted-foreground">
                    {user.isArtist ? 'Artist' : 'Listener'} • {user.role}
                  </p>
                </div>
                <Link href="/profile">
                  <Button variant="outline" size="sm">
                    View Profile
                  </Button>
                </Link>
              </div>
            </div>
          )}

          <h1 className="text-2xl font-bold mb-6">Your Feed</h1>

          {error ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">{error}</p>
              <Button onClick={fetchTracks}>Retry</Button>
            </div>
          ) : tracks.length === 0 ? (
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
              {tracks.map((track) => (
                <EnhancedFeedItem key={track.id} post={track} />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
