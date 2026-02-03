import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Music, ArrowLeft, UserPlus, Radio, Users, Play } from 'lucide-react';

export const metadata = {
  title: 'Getting Started - P2P Music Platform',
  description: 'Learn how to get started with the P2P Music Platform',
};

export default function GettingStartedPage() {
  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg">
            <Music className="h-5 w-5" />
            P2P Music
          </Link>
          <Link href="/docs">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Docs
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold mb-4">Getting Started</h1>
          <p className="text-muted-foreground text-lg mb-8">
            Welcome to P2P Music Platform! This guide will help you get up and running with our decentralized music streaming platform.
          </p>

          <div className="space-y-8">
            {/* Step 1 */}
            <div className="border rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">
                  1
                </div>
                <h2 className="text-2xl font-semibold">Create Your Account</h2>
              </div>
              
              <p className="text-muted-foreground mb-4">
                Sign up for a free account to start uploading and streaming music. We offer two authentication methods:
              </p>
              
              <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-4">
                <li><strong>Traditional Registration:</strong> Username, email, and password</li>
                <li><strong>WebAuthn/Passkeys:</strong> Secure passwordless authentication</li>
              </ul>
              
              <p className="text-muted-foreground mb-4">
                The first 11 users who register become "Founder Users" with special privileges and immediate upload access.
              </p>
              
              <Link href="/register">
                <Button>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Create Account
                </Button>
              </Link>
            </div>

            {/* Step 2 */}
            <div className="border rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">
                  2
                </div>
                <h2 className="text-2xl font-semibold">Complete Onboarding</h2>
              </div>
              
              <p className="text-muted-foreground mb-4">
                New users need to complete onboarding before uploading music. This helps personalize your experience:
              </p>
              
              <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-4">
                <li><strong>Select Music Preferences:</strong> Choose at least 5 genres/artists you like</li>
                <li><strong>Follow Artists:</strong> Follow at least 10 users to build your feed</li>
              </ul>
              
              <p className="text-muted-foreground">
                Once completed, you'll be able to upload music and build your following.
              </p>
            </div>

            {/* Step 3 */}
            <div className="border rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">
                  3
                </div>
                <h2 className="text-2xl font-semibold">Upload Your Music</h2>
              </div>
              
              <p className="text-muted-foreground mb-4">
                Share your music with the decentralized network. We support:
              </p>
              
              <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-4">
                <li>MP3, OGG, WAV, FLAC, M4A formats</li>
                <li>Maximum file size: 100MB</li>
                <li>Automatic metadata extraction</li>
                <li>End-to-end encryption before upload</li>
              </ul>
              
              <p className="text-muted-foreground mb-4">
                Your music is encrypted with AES-256-GCM and distributed across the peer-to-peer network using IPFS and WebTorrent.
              </p>
              
              <Link href="/upload">
                <Button>
                  <Radio className="h-4 w-4 mr-2" />
                  Upload Music
                </Button>
              </Link>
            </div>

            {/* Step 4 */}
            <div className="border rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">
                  4
                </div>
                <h2 className="text-2xl font-semibold">Build Your Network</h2>
              </div>
              
              <p className="text-muted-foreground mb-4">
                Connect with other music lovers to discover new tracks:
              </p>
              
              <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-4">
                <li><strong>Follow Artists:</strong> See their uploads in your feed</li>
                <li><strong>Like & Repost:</strong> Show appreciation and share with your followers</li>
                <li><strong>Comment:</strong> Engage with the community at specific timestamps</li>
              </ul>
              
              <p className="text-muted-foreground">
                Your feed shows tracks from users you follow, sorted by newest first.
              </p>
            </div>

            {/* Step 5 */}
            <div className="border rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">
                  5
                </div>
                <h2 className="text-2xl font-semibold">Stream & Seed</h2>
              </div>
              
              <p className="text-muted-foreground mb-4">
                Listen to music while helping the network:
              </p>
              
              <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-4">
                <li><strong>Stream:</strong> Listen directly from peers using WebRTC</li>
                <li><strong>Seed:</strong> Share content with other users after downloading</li>
                <li><strong>Earn Trust:</strong> Higher seed ratios improve your trust score</li>
              </ul>
              
              <p className="text-muted-foreground">
                Your trust score affects your priority in the network. Seed more to earn higher scores!
              </p>
            </div>
          </div>

          {/* Quick Tips */}
          <div className="mt-12 p-6 bg-muted rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Quick Tips</h2>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li>Keep the tab open while streaming to help seed to other users</li>
              <li>Use headphones with timestamps in comments for precise feedback</li>
              <li>First 11 users are "Founders" with special badges and early access</li>
              <li>Your trust score starts at 0 and improves with seeding activity</li>
              <li>All music is encrypted - only your followers can access your uploads</li>
            </ul>
          </div>

          {/* Next Steps */}
          <div className="mt-8 p-6 bg-muted rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Next Steps</h2>
            <div className="flex flex-wrap gap-4">
              <Link href="/docs/technical">
                <Button variant="outline">Technical Overview</Button>
              </Link>
              <Link href="/docs/security">
                <Button variant="outline">Security Features</Button>
              </Link>
              <Link href="/docs/community">
                <Button variant="outline">Community Guidelines</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
