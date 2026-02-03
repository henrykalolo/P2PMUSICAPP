'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Music, User, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TrendingArtist {
  id: string;
  username: string;
  avatarUrl?: string;
  trustScore: number;
  badge: string;
  followersCount: number;
}

interface PopularTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  genre: string;
  coverArtUrl?: string;
  likesCount: number;
  author: {
    username: string;
    avatarUrl?: string;
  };
}

interface RecentComment {
  id: string;
  content: string;
  createdAt: string;
  author: {
    username: string;
    avatarUrl?: string;
  };
  post: {
    id: string;
    title: string;
  };
}

interface TrendsSidebarProps {
  userId?: string;
}

export function TrendsSidebar({ userId }: TrendsSidebarProps) {
  const [trends, setTrends] = useState<{
    trendingArtists: TrendingArtist[];
    popularTracks: PopularTrack[];
    recentComments: RecentComment[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTrends = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setIsLoading(false);
          return;
        }

        const response = await fetch('/api/social/trends', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch trends');
        }

        const data = await response.json();
        setTrends(data.trends);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load trends');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTrends();
  }, [userId]);

  if (!userId) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-lg space-y-6">
        <div>
          <h3 className="font-semibold mb-4">Trending Artists</h3>
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="w-10 h-10 rounded-full bg-muted"></div>
                <div className="flex-1">
                  <div className="h-4 bg-muted rounded w-24 mb-1"></div>
                  <div className="h-3 bg-muted rounded w-16"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3 className="font-semibold mb-4">Popular Tracks</h3>
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="w-10 h-10 rounded bg-muted"></div>
                <div className="flex-1">
                  <div className="h-4 bg-muted rounded w-24 mb-1"></div>
                  <div className="h-3 bg-muted rounded w-16"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !trends) {
    return null;
  }

  return (
    <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-lg space-y-6">
      {/* Trending Artists */}
      <div>
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <User className="h-4 w-4" />
          Trending Artists
        </h3>
        <div className="space-y-3">
          {trends.trendingArtists.map((artist) => (
            <Link
              key={artist.id}
              href={`/profile/${artist.id}`}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                {artist.avatarUrl ? (
                  <img
                    src={artist.avatarUrl}
                    alt={artist.username}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <User className="h-5 w-5 text-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{artist.username}</p>
                <p className="text-xs text-muted-foreground">
                  {artist.followersCount} followers
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Popular Tracks */}
      <div>
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Music className="h-4 w-4" />
          Popular Tracks
        </h3>
        <div className="space-y-3">
          {trends.popularTracks.map((track) => (
            <Link
              key={track.id}
              href={`/track/${track.id}`}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors"
            >
              <div className="w-10 h-10 rounded bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                {track.coverArtUrl ? (
                  <img
                    src={track.coverArtUrl}
                    alt={track.title}
                    className="w-full h-full rounded object-cover"
                  />
                ) : (
                  <Music className="h-5 w-5 text-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{track.title}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {track.artist} • {track.likesCount} likes
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Comments */}
      {trends.recentComments.length > 0 && (
        <div>
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            Recent Activity
          </h3>
          <div className="space-y-3 max-h-[200px] overflow-y-auto">
            {trends.recentComments.map((comment) => (
              <Link
                key={comment.id}
                href={`/track/${comment.post.id}`}
                className="p-2 rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-xs">{comment.author.username}</span>
                  <span className="text-xs text-muted-foreground">on</span>
                  <span className="text-xs text-muted-foreground truncate">{comment.post.title}</span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{comment.content}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
