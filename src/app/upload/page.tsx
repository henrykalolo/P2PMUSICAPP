'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Music, ArrowLeft, LogIn, UserPlus } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';

// Dynamically import UploadComponent with SSR disabled
const UploadComponent = dynamic(
  () => import('@/components/upload/UploadComponent').then((mod) => mod.UploadComponent),
  { ssr: false }
);

export default function UploadPage() {
  const { isAuthenticated, isLoading, setUser, setAuthenticated, setLoading, user } = useAuthStore();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    // Check for token on client side
    const token = localStorage.getItem('token');
    if (token) {
      // Verify token and get user info
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
          setAuthChecked(true);
        });
    } else {
      setLoading(false);
      setAuthChecked(true);
    }
  }, [setUser, setAuthenticated, setLoading]);

  const handleUploadComplete = (metadata: {
    title: string;
    artist: string;
    album: string;
    genre: string;
    year: number;
    duration: number;
    storageResult: any;
  }) => {
    console.log('Upload complete:', metadata);
    // Redirect to user's profile page to show their posts
    if (user?.id) {
      window.location.href = `/user/${user.id}`;
    }
  };

  // Show loading state
  if (isLoading || !authChecked) {
    return (
      <main className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto px-4 h-14 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 font-bold text-lg">
              <Music className="h-5 w-5" />
              P2P Music
            </Link>
          </div>
        </header>
        <div className="container mx-auto px-4 py-8 flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </main>
    );
  }

  // Show authentication required message for guests
  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-background">
        {/* Header */}
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto px-4 h-14 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 font-bold text-lg">
              <Music className="h-5 w-5" />
              P2P Music
            </Link>
            <Link href="/feed">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Feed
              </Button>
            </Link>
          </div>
        </header>

        {/* Auth Required Content */}
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-md mx-auto text-center">
            <div className="mb-8">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Music className="h-10 w-10 text-primary" />
              </div>
              <h1 className="text-2xl font-bold mb-2">Authentication Required</h1>
              <p className="text-muted-foreground mb-6">
                You need to create an account or sign in to upload music to the P2P network.
              </p>
            </div>

            <div className="space-y-3">
              <Link href="/register" className="block">
                <Button size="lg" className="w-full">
                  <UserPlus className="h-5 w-5 mr-2" />
                  Create Account
                </Button>
              </Link>
              <p className="text-sm text-muted-foreground">
                Already have an account?{' '}
                <Link href="/login" className="text-primary hover:underline">
                  Sign in
                </Link>
              </p>
            </div>

            <div className="mt-8 p-4 bg-muted rounded-lg text-left">
              <h3 className="font-semibold mb-2">Why do I need an account?</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Track your uploads and manage your music</li>
                <li>• Build a following and connect with listeners</li>
                <li>• Earn trust scores by seeding content</li>
                <li>• Participate in the decentralized music community</li>
              </ul>
            </div>
          </div>
        </div>
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
          <Link href="/feed">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Feed
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto">
          <h1 className="text-2xl font-bold mb-2">Upload Music</h1>
          <p className="text-muted-foreground mb-6">
            Share your music with the P2P network. Files are encrypted and distributed across peers.
          </p>

          <UploadComponent onUploadComplete={handleUploadComplete} />

          <div className="mt-8 p-4 bg-muted rounded-lg">
            <h3 className="font-semibold mb-2">Supported Formats</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• MP3, OGG, WAV, FLAC, M4A</li>
              <li>• Maximum file size: 100MB</li>
              <li>• Files are encrypted before upload</li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
}
