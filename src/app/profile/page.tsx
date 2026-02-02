'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Music, ArrowLeft, User, LogOut, Upload } from 'lucide-react';

interface UserProfile {
  id: string;
  username: string;
  email: string;
  avatarUrl?: string;
  trustScore: number;
  followersCount: number;
  followingCount: number;
  tracksCount: number;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // For now, use mock data since we need to implement the API
    setProfile({
      id: '1',
      username: 'Demo User',
      email: 'user@example.com',
      trustScore: 85,
      followersCount: 42,
      followingCount: 23,
      tracksCount: 5,
    });
    setIsLoading(false);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.href = '/';
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </main>
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
            <Link href="/feed">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Feed
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Profile Header */}
          <div className="flex items-center gap-6 mb-8">
            <div className="w-24 h-24 rounded-full bg-secondary flex items-center justify-center">
              {profile?.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt={profile.username}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <User className="h-12 w-12 text-muted-foreground" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold">{profile?.username}</h1>
              <p className="text-muted-foreground">{profile?.email}</p>
              <div className="flex items-center gap-4 mt-2 text-sm">
                <span className="text-muted-foreground">
                  <strong className="text-foreground">{profile?.tracksCount}</strong> tracks
                </span>
                <span className="text-muted-foreground">
                  <strong className="text-foreground">{profile?.followersCount}</strong> followers
                </span>
                <span className="text-muted-foreground">
                  <strong className="text-foreground">{profile?.followingCount}</strong> following
                </span>
              </div>
            </div>
          </div>

          {/* Trust Score */}
          <div className="p-6 bg-muted rounded-lg mb-8">
            <h2 className="text-lg font-semibold mb-2">Trust Score</h2>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${profile?.trustScore}%` }}
                  />
                </div>
              </div>
              <span className="text-lg font-bold">{profile?.trustScore}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Your trust score increases by seeding content and maintaining good connections.
            </p>
          </div>

          {/* Actions */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Actions</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Link href="/upload">
                <Button variant="outline" className="w-full justify-start">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Music
                </Button>
              </Link>
              <Link href="/feed">
                <Button variant="outline" className="w-full justify-start">
                  <Music className="h-4 w-4 mr-2" />
                  View Feed
                </Button>
              </Link>
            </div>
          </div>

          {/* Logout */}
          <div className="mt-8 pt-8 border-t">
            <Button variant="destructive" onClick={handleLogout} className="w-full">
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
