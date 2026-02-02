'use client';

import { useEffect, useState } from 'react';
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Music, Users, Shield, Zap, Radio, HardDrive, LogIn, UserPlus, TrendingUp, Clock } from "lucide-react";
import { useAuthStore } from '@/store/useAuthStore';

interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  genre: string;
  duration: number;
  cover_art_url?: string;
  created_at: string;
  author_username: string;
  author_avatar?: string;
}

export default function Home() {
  const { isAuthenticated, isLoading, setUser, setAuthenticated, setLoading } = useAuthStore();
  const [latestTracks, setLatestTracks] = useState<Track[]>([]);
  const [isLoadingTracks, setIsLoadingTracks] = useState(true);

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

    // Fetch latest tracks for preview
    fetch('/api/tracks?limit=6')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.tracks) {
          setLatestTracks(data.tracks);
        }
      })
      .catch(console.error)
      .finally(() => setIsLoadingTracks(false));
  }, [setUser, setAuthenticated, setLoading]);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <main className="min-h-screen">
      {/* Navigation Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg">
            <Music className="h-5 w-5" />
            P2P Music
          </Link>
          <div className="flex items-center gap-2">
            {!isLoading && !isAuthenticated && (
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
            {!isLoading && isAuthenticated && (
              <Link href="/feed">
                <Button variant="ghost" size="sm">
                  Go to Feed
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative px-4 sm:px-6 lg:px-8 py-12 sm:py-20 lg:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-secondary/20" />

        <div className="relative z-10 max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8">
            <Zap className="h-4 w-4" />
            <span>Phase 2 Beta Now Available</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-7xl font-bold mb-6 tracking-tight">
            P2P Music Platform
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto px-4">
            A decentralized, peer-to-peer music streaming platform.
            No central servers. Just you, your music, and the community.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center px-4">
            <Link href="/feed">
              <Button size="lg" className="w-full sm:w-auto">
                <Music className="mr-2 h-5 w-5" />
                Start Listening
              </Button>
            </Link>
            <Link href="/upload">
              <Button variant="outline" size="lg" className="w-full sm:w-auto">
                <Radio className="mr-2 h-5 w-5" />
                Upload Music
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-4 sm:px-6 lg:px-8 py-16 sm:py-24 bg-muted/50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-12">
            Built for the Decentralized Future
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {/* Feature 1 */}
            <div className="bg-card rounded-xl p-6 border hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                <Radio className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">P2P Streaming</h3>
              <p className="text-muted-foreground text-sm">
                Stream music directly from peers using WebTorrent and WebRTC technology. 
                No central server required.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-card rounded-xl p-6 border hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">End-to-End Encryption</h3>
              <p className="text-muted-foreground text-sm">
                Your music is encrypted with AES-256-GCM before sharing. 
                Only authorized peers can decrypt and play.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-card rounded-xl p-6 border hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Social Discovery</h3>
              <p className="text-muted-foreground text-sm">
                Discover music through your social connections. 
                Follow artists and curators to build your feed.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-card rounded-xl p-6 border hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                <HardDrive className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Offline Support</h3>
              <p className="text-muted-foreground text-sm">
                Cache your favorite tracks for offline listening. 
                Service workers keep the music playing even without internet.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="bg-card rounded-xl p-6 border hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Trust Score System</h3>
              <p className="text-muted-foreground text-sm">
                Earn reputation by seeding content and maintaining good connections. 
                Higher scores get priority in the network.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="bg-card rounded-xl p-6 border hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                <Music className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Universal Artist Status</h3>
              <p className="text-muted-foreground text-sm">
                Every user is an artist. Upload your music, build a following, 
                and share your creativity with the world.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Latest Tracks Preview Section */}
      <section className="px-4 sm:px-6 lg:px-8 py-16 sm:py-24 bg-muted/50">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold">Latest Uploads</h2>
              <p className="text-muted-foreground mt-1">
                Discover the newest music from our community
              </p>
            </div>
            <Link href="/feed">
              <Button variant="outline">
                <TrendingUp className="h-4 w-4 mr-2" />
                View All
              </Button>
            </Link>
          </div>

          {isLoadingTracks ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : latestTracks.length === 0 ? (
            <div className="text-center py-12 border rounded-lg bg-card">
              <Music className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold text-lg mb-2">No tracks yet</h3>
              <p className="text-muted-foreground mb-4">
                Be the first to upload music to the platform!
              </p>
              <Link href="/upload">
                <Button>
                  <Radio className="h-4 w-4 mr-2" />
                  Upload Music
                </Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {latestTracks.map((track) => (
                <Link 
                  key={track.id} 
                  href="/feed"
                  className="group bg-card border rounded-lg p-4 hover:shadow-lg transition-all hover:border-primary/50"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-16 h-16 bg-primary/10 rounded-lg flex items-center justify-center overflow-hidden">
                      {track.cover_art_url ? (
                        <img 
                          src={track.cover_art_url} 
                          alt={track.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Music className="h-8 w-8 text-primary/50" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate group-hover:text-primary transition-colors">
                        {track.title}
                      </h3>
                      <p className="text-sm text-muted-foreground truncate">
                        {track.artist}
                      </p>
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <span className="truncate">@{track.author_username}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDuration(track.duration)}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* How It Works Section */}
      <section className="px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-12">
            How It Works
          </h2>
          
          <div className="space-y-8">
            {/* Step 1 */}
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-start">
              <div className="flex-shrink-0 w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">
                1
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-2">Upload Your Music</h3>
                <p className="text-muted-foreground">
                  Drag and drop your audio files. We automatically extract metadata 
                  and create a torrent for P2P distribution. Your music is encrypted 
                  before leaving your device.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-start">
              <div className="flex-shrink-0 w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">
                2
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-2">Share with Followers</h3>
                <p className="text-muted-foreground">
                  Your followers receive the encrypted magnet link. Only they can 
                  access and stream your music through the mutual-follower network.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-start">
              <div className="flex-shrink-0 w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">
                3
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-2">Stream & Seed</h3>
                <p className="text-muted-foreground">
                  Listen to music while simultaneously seeding to other peers. 
                  The more you seed, the higher your trust score and network priority.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-4 sm:px-6 lg:px-8 py-16 sm:py-24 bg-primary text-primary-foreground">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">
            Ready to Join the Revolution?
          </h2>
          <p className="text-primary-foreground/80 mb-8 text-lg">
            Be part of the decentralized music movement. Upload, stream, and share
            without boundaries.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register">
              <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                Create Account
              </Button>
            </Link>
            <Link href="/docs">
              <Button
                size="lg"
                variant="outline"
                className="w-full sm:w-auto border-primary-foreground/20 hover:bg-primary-foreground/10"
              >
                Read Documentation
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-4 sm:px-6 lg:px-8 py-8 border-t">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            © 2026 P2P Music Platform. Open source and decentralized.
          </p>
          <div className="flex gap-6">
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              GitHub
            </a>
            <Link href="/docs">
              <span className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                Documentation
              </span>
            </Link>
            <Link href="/privacy">
              <span className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                Privacy
              </span>
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
