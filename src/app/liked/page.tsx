'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EnhancedFeedItem } from '@/components/feed/EnhancedFeedItem';
import { useAuthStore } from '@/store/useAuthStore';

interface LikedTrack {
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
  userHasLiked?: boolean;
  author: {
    id: string;
    username: string;
    avatarUrl?: string;
  };
}

export default function LikedPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuthStore();
  const [tracks, setTracks] = useState<LikedTrack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLiked = async () => {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }

      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/social/likes?userId=${user.id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!response.ok) throw new Error('Failed to load liked tracks');
        const data = await response.json();
        setTracks(data.tracks || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load liked tracks');
      } finally {
        setIsLoading(false);
      }
    };

    if (!authLoading) fetchLiked();
  }, [authLoading, user?.id]);

  if (!authLoading && !isAuthenticated) {
    return (
      <main className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-xl rounded-2xl border border-border/60 bg-card p-8 text-center">
          <Heart className="mx-auto mb-4 h-10 w-10 text-primary" />
          <h1 className="text-2xl font-bold">Keep your favorites close</h1>
          <p className="mt-2 text-muted-foreground">
            Sign in to see every track you have liked in one place.
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
            <Heart className="h-7 w-7 text-primary" />
            Liked tracks
          </h1>
          <p className="mt-2 text-muted-foreground">
            Everything you have saved, ready to play again.
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
          <div className="rounded-xl border border-border/60 bg-card p-8 text-center">
            <Heart className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="font-medium">No liked tracks yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Tap the heart on a track to save it here.
            </p>
            <Link href="/discover" className="mt-4 inline-block">
              <Button size="sm">Discover music</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {tracks.map((track) => (
              <EnhancedFeedItem
                key={track.id}
                post={{ ...track, userHasLiked: true }}
                currentUserId={user?.id}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
