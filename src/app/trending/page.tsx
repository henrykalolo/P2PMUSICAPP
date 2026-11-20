'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EnhancedFeedItem } from '@/components/feed/EnhancedFeedItem';
import { useAuthStore } from '@/store/useAuthStore';

interface TrendingTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  genre: string;
  duration: number;
  streamUrl?: string | null;
  coverArtUrl?: string;
  storageType?: string;
  serverStorageId?: string;
  ipfsCid?: string;
  createdAt: string;
  likesCount: number;
  commentsCount: number;
  author: {
    id: string;
    username: string;
    avatarUrl?: string;
  };
}

export default function TrendingPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuthStore();
  const [tracks, setTracks] = useState<TrendingTrack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTrending = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch('/api/social/trends', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error('Failed to load trending tracks');
        const data = await response.json();
        setTracks(data.tracks || data.trends?.popularTracks || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load trending tracks');
      } finally {
        setIsLoading(false);
      }
    };

    if (!authLoading) fetchTrending();
  }, [authLoading, user?.id]);

  if (!authLoading && !isAuthenticated) {
    return (
      <main className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-xl rounded-2xl border border-border/60 bg-card p-8 text-center">
          <TrendingUp className="mx-auto mb-4 h-10 w-10 text-primary" />
          <h1 className="text-2xl font-bold">Sign in to see trends</h1>
          <p className="mt-2 text-muted-foreground">
            Trending tracks are personalized for signed-in listeners.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href="/login"><Button variant="outline">Sign in</Button></Link>
            <Link href="/register"><Button>Get started</Button></Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
            <TrendingUp className="h-7 w-7 text-primary" />
            Trending now
          </h1>
          <p className="mt-2 text-muted-foreground">
            The most-loved tracks across the community right now.
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
          </div>
        ) : error ? (
          <div className="rounded-xl border border-border/60 bg-card p-6 text-center">
            <p className="text-muted-foreground">{error}</p>
          </div>
        ) : tracks.length === 0 ? (
          <div className="rounded-xl border border-border/60 bg-card p-8 text-center text-muted-foreground">
            No trending tracks yet. Check back soon.
          </div>
        ) : (
          <div className="space-y-4">
            {tracks.map((track) => (
              <EnhancedFeedItem key={track.id} post={track} currentUserId={user?.id} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
