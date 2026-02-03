import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Music, ArrowLeft, Code, Globe, Shield, Zap } from 'lucide-react';

export const metadata = {
  title: 'Technical Overview - P2P Music Platform',
  description: 'Technical documentation for the P2P Music Platform',
};

export default function TechnicalPage() {
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
          <h1 className="text-4xl font-bold mb-4">Technical Overview</h1>
          <p className="text-muted-foreground text-lg mb-8">
            Learn about the decentralized technologies that power P2P Music Platform.
          </p>

          {/* Architecture Diagram Placeholder */}
          <div className="bg-muted rounded-lg p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Globe className="h-5 w-5" />
              System Architecture
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-background rounded-lg border">
                <h3 className="font-semibold mb-2">Frontend</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Next.js 14 (React framework)</li>
                  <li>• TypeScript for type safety</li>
                  <li>• Tailwind CSS for styling</li>
                  <li>• Service Workers for offline support</li>
                </ul>
              </div>
              <div className="p-4 bg-background rounded-lg border">
                <h3 className="font-semibold mb-2">Backend</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Next.js API Routes</li>
                  <li>• PostgreSQL database</li>
                  <li>• JWT authentication</li>
                  <li>• WebAuthn support</li>
                </ul>
              </div>
              <div className="p-4 bg-background rounded-lg border">
                <h3 className="font-semibold mb-2">P2P Network</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• WebRTC for peer connections</li>
                  <li>• WebTorrent for torrent-based sharing</li>
                  <li>• IPFS for content addressing</li>
                  <li>• Helia as IPFS implementation</li>
                </ul>
              </div>
              <div className="p-4 bg-background rounded-lg border">
                <h3 className="font-semibold mb-2">Security</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• AES-256-GCM encryption</li>
                  <li>• End-to-end encrypted content</li>
                  <li>• JWT tokens with expiry</li>
                  <li>• Secure WebAuthn authentication</li>
                </ul>
              </div>
            </div>
          </div>

          {/* P2P Streaming Section */}
          <div className="space-y-6">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Zap className="h-6 w-6" />
              P2P Streaming Technology
            </h2>
            
            <div className="prose prose-slate max-w-none">
              <h3 className="text-xl font-semibold">WebRTC & WebTorrent</h3>
              <p className="text-muted-foreground">
                P2P Music Platform uses WebRTC (Web Real-Time Communication) to establish direct 
                peer-to-peer connections between users. This enables:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Low-latency audio streaming directly from peer to peer</li>
                <li>No central server required for data transfer</li>
                <li>Automatic peer discovery and connection</li>
                <li>NAT traversal using ICE/STUN/TURN servers</li>
              </ul>
              
              <h3 className="text-xl font-semibold mt-6">IPFS Integration</h3>
              <p className="text-muted-foreground">
                The InterPlanetary File System (IPFS) provides content addressing and distributed storage:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Content-based addressing using CIDs (Content Identifiers)</li>
                <li>Deduplication of identical content across the network</li>
                <li>Built-in encryption for all content</li>
                <li>Hybrid storage: IPFS + WebTorrent for redundancy</li>
              </ul>
              
              <h3 className="text-xl font-semibold mt-6">Trust Score System</h3>
              <p className="text-muted-foreground">
                Our reputation system prioritizes high-quality peers in the network:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li><strong>Upload Ratio (40%):</strong> Bytes uploaded / downloaded</li>
                <li><strong>Connection Stability (25%):</strong> Average session duration</li>
                <li><strong>Content Integrity (20%):</strong> Hash verification success rate</li>
                <li><strong>Social Verification (15%):</strong> Mutual connections count</li>
              </ul>
            </div>
          </div>

          {/* API Section */}
          <div className="mt-12">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Code className="h-6 w-6" />
              API Reference
            </h2>
            
            <div className="bg-muted rounded-lg p-6 mt-4">
              <h3 className="font-semibold mb-4">Authentication</h3>
              <p className="text-muted-foreground mb-4">
                All protected endpoints require a JWT token in the Authorization header:
              </p>
              <pre className="bg-background p-4 rounded-lg overflow-x-auto">
{`Authorization: Bearer <your-jwt-token>`}
              </pre>
              
              <h3 className="font-semibold mt-6 mb-4">Available Endpoints</h3>
              <div className="space-y-2 text-sm">
                <div className="grid grid-cols-3 gap-2 font-mono">
                  <span className="text-green-600">POST</span>
                  <span>/api/auth/register</span>
                  <span className="text-muted-foreground">Create new account</span>
                </div>
                <div className="grid grid-cols-3 gap-2 font-mono">
                  <span className="text-green-600">POST</span>
                  <span>/api/auth/login</span>
                  <span className="text-muted-foreground">Authenticate user</span>
                </div>
                <div className="grid grid-cols-3 gap-2 font-mono">
                  <span className="text-blue-600">GET</span>
                  <span>/api/auth/me</span>
                  <span className="text-muted-foreground">Get current user</span>
                </div>
                <div className="grid grid-cols-3 gap-2 font-mono">
                  <span className="text-blue-600">GET</span>
                  <span>/api/tracks</span>
                  <span className="text-muted-foreground">List tracks</span>
                </div>
                <div className="grid grid-cols-3 gap-2 font-mono">
                  <span className="text-green-600">POST</span>
                  <span>/api/tracks</span>
                  <span className="text-muted-foreground">Upload track</span>
                </div>
                <div className="grid grid-cols-3 gap-2 font-mono">
                  <span className="text-green-600">POST</span>
                  <span>/api/social/follow</span>
                  <span className="text-muted-foreground">Follow user</span>
                </div>
                <div className="grid grid-cols-3 gap-2 font-mono">
                  <span className="text-green-600">POST</span>
                  <span>/api/social/like</span>
                  <span className="text-muted-foreground">Like track</span>
                </div>
                <div className="grid grid-cols-3 gap-2 font-mono">
                  <span className="text-blue-600">GET</span>
                  <span>/api/trust-score</span>
                  <span className="text-muted-foreground">Get trust score</span>
                </div>
              </div>
            </div>
          </div>

          {/* Security Section */}
          <div className="mt-12">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="h-6 w-6" />
              Security Architecture
            </h2>
            
            <div className="bg-muted rounded-lg p-6 mt-4">
              <h3 className="font-semibold mb-4">Encryption</h3>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li><strong>AES-256-GCM:</strong> Symmetric encryption for all audio content</li>
                <li><strong>WebRTC DTLS:</strong> Encrypted peer-to-peer connections</li>
                <li><strong>HTTPS/TLS:</strong> All API communications are encrypted</li>
              </ul>
              
              <h3 className="font-semibold mt-6 mb-4">Access Control</h3>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li><strong>Follower-only access:</strong> Only your followers can access your encrypted content</li>
                <li><strong>Magnet links:</strong> Contain encrypted references, not raw content</li>
                <li><strong>Token-based auth:</strong> JWT tokens with configurable expiry</li>
              </ul>
            </div>
          </div>

          {/* Database Schema */}
          <div className="mt-12 p-6 bg-muted rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Database Schema</h2>
            <p className="text-muted-foreground mb-4">
              Key tables in the PostgreSQL database:
            </p>
            <div className="space-y-4 font-mono text-sm">
              <div className="bg-background p-3 rounded">
                <span className="text-blue-600">users</span> - User accounts and profiles
              </div>
              <div className="bg-background p-3 rounded">
                <span className="text-blue-600">posts</span> - Music tracks and metadata
              </div>
              <div className="bg-background p-3 rounded">
                <span className="text-blue-600">follows</span> - Follow relationships
              </div>
              <div className="bg-background p-3 rounded">
                <span className="text-blue-600">likes</span> - Track likes
              </div>
              <div className="bg-background p-3 rounded">
                <span className="text-blue-600">comments</span> - Timestamped comments
              </div>
              <div className="bg-background p-3 rounded">
                <span className="text-blue-600">reposts</span> - Track reposts
              </div>
              <div className="bg-background p-3 rounded">
                <span className="text-blue-600">user_stats</span> - Trust score statistics
              </div>
              <div className="bg-background p-3 rounded">
                <span className="text-blue-600">music_preferences</span> - User preferences
              </div>
            </div>
          </div>

          {/* See Also */}
          <div className="mt-8 p-6 bg-muted rounded-lg">
            <h2 className="text-xl font-semibold mb-4">See Also</h2>
            <div className="flex flex-wrap gap-4">
              <Link href="/docs/getting-started">
                <Button variant="outline">Getting Started</Button>
              </Link>
              <Link href="/docs/security">
                <Button variant="outline">Security Details</Button>
              </Link>
              <Link href="https://github.com" target="_blank" rel="noopener noreferrer">
                <Button variant="outline">GitHub Repository</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
