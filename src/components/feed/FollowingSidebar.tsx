'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { User } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FollowingUser {
  id: string;
  username: string;
  avatarUrl?: string;
  trustScore: number;
  badge: string;
}

interface FollowingSidebarProps {
  userId?: string;
}

export function FollowingSidebar({ userId }: FollowingSidebarProps) {
  const [following, setFollowing] = useState<FollowingUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFollowing = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setIsLoading(false);
          return;
        }

        const response = await fetch('/api/social/following', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch following');
        }

        const data = await response.json();
        setFollowing(data.following || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load following');
      } finally {
        setIsLoading(false);
      }
    };

    fetchFollowing();
  }, [userId]);

  if (!userId) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-lg">
        <h3 className="font-semibold mb-4">Following</h3>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
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
    );
  }

  if (error) {
    return null;
  }

  return (
    <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-lg">
      <h3 className="font-semibold mb-4">Following ({following.length})</h3>
      <div className="space-y-3 max-h-[500px] overflow-y-auto">
        {following.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <User className="h-8 w-8 mx-auto mb-2" />
            <p className="text-sm">You're not following anyone yet</p>
            <Button variant="ghost" size="sm" className="mt-2">
              Find Artists
            </Button>
          </div>
        ) : (
          following.map((user) => (
            <Link
              key={user.id}
              href={`/profile/${user.id}`}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.username}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <User className="h-5 w-5 text-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{user.username}</p>
                <p className="text-xs text-muted-foreground">{user.badge}</p>
              </div>
              <div className="text-xs text-muted-foreground">
                {user.trustScore}
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
