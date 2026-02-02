import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Music, ArrowLeft, Book, Code, Shield, Users } from 'lucide-react';

export const metadata = {
  title: 'Documentation - P2P Music Platform',
  description: 'Documentation for the P2P Music Platform',
};

export default function DocsPage() {
  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg">
            <Music className="h-5 w-5" />
            P2P Music
          </Link>
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold mb-4">Documentation</h1>
          <p className="text-muted-foreground text-lg mb-8">
            Learn how to use the P2P Music Platform and understand the technology behind it.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            <Link href="/docs/getting-started">
              <div className="p-6 border rounded-lg hover:shadow-lg transition-shadow cursor-pointer">
                <Book className="h-8 w-8 text-primary mb-4" />
                <h2 className="text-xl font-semibold mb-2">Getting Started</h2>
                <p className="text-muted-foreground">
                  Learn the basics of using the P2P Music Platform
                </p>
              </div>
            </Link>

            <Link href="/docs/technical">
              <div className="p-6 border rounded-lg hover:shadow-lg transition-shadow cursor-pointer">
                <Code className="h-8 w-8 text-primary mb-4" />
                <h2 className="text-xl font-semibold mb-2">Technical Overview</h2>
                <p className="text-muted-foreground">
                  Understand the P2P and IPFS technology stack
                </p>
              </div>
            </Link>

            <Link href="/docs/security">
              <div className="p-6 border rounded-lg hover:shadow-lg transition-shadow cursor-pointer">
                <Shield className="h-8 w-8 text-primary mb-4" />
                <h2 className="text-xl font-semibold mb-2">Security</h2>
                <p className="text-muted-foreground">
                  Learn about encryption and privacy features
                </p>
              </div>
            </Link>

            <Link href="/docs/community">
              <div className="p-6 border rounded-lg hover:shadow-lg transition-shadow cursor-pointer">
                <Users className="h-8 w-8 text-primary mb-4" />
                <h2 className="text-xl font-semibold mb-2">Community</h2>
                <p className="text-muted-foreground">
                  Connect with other users and contributors
                </p>
              </div>
            </Link>
          </div>

          <div className="prose prose-slate max-w-none">
            <h2 className="text-2xl font-bold mb-4">Quick Start Guide</h2>
            
            <h3 className="text-xl font-semibold mt-6 mb-3">1. Create an Account</h3>
            <p className="text-muted-foreground mb-4">
              Sign up for a free account to start uploading and streaming music. 
              Your account is secured with modern authentication methods.
            </p>

            <h3 className="text-xl font-semibold mt-6 mb-3">2. Upload Music</h3>
            <p className="text-muted-foreground mb-4">
              Upload your audio files (MP3, OGG, WAV, FLAC, M4A). Files are automatically 
              encrypted and distributed across the P2P network using IPFS and WebTorrent.
            </p>

            <h3 className="text-xl font-semibold mt-6 mb-3">3. Build Your Network</h3>
            <p className="text-muted-foreground mb-4">
              Follow other artists and users to discover new music. Your feed will show 
              uploads from people you follow.
            </p>

            <h3 className="text-xl font-semibold mt-6 mb-3">4. Stream & Seed</h3>
            <p className="text-muted-foreground mb-4">
              Listen to music while simultaneously seeding to other peers. The more you 
              seed, the higher your trust score in the network.
            </p>
          </div>

          <div className="mt-12 p-6 bg-muted rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Need Help?</h2>
            <p className="text-muted-foreground mb-4">
              Check out our GitHub repository or join the community discussions.
            </p>
            <div className="flex gap-4">
              <a 
                href="https://github.com" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <Button variant="outline">GitHub</Button>
              </a>
              <Link href="/">
                <Button>Back to Home</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
