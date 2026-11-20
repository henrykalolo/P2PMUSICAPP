import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Music, ArrowLeft, Code, Globe, Shield, Zap } from 'lucide-react';

export const metadata = {
  title: 'Technical Overview - P2P Music Platform',
  description: 'Technical documentation for the implemented P2P Music Platform architecture',
};

export default function TechnicalPage() {
  return (
    <main className="min-h-screen bg-background">

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold mb-4">Technical Overview</h1>
          <p className="text-muted-foreground text-lg mb-8">
            The app is server-authoritative with optional IPFS acceleration. Playback never depends on peers,
            trackers, or TURN servers.
          </p>

          <div className="bg-muted rounded-lg p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Globe className="h-5 w-5" />
              System Architecture
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-background rounded-lg border">
                <h3 className="font-semibold mb-2">Frontend</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Next.js 15 App Router, React 19, TypeScript</li>
                  <li>• Tailwind CSS 4 and Lucide icons</li>
                  <li>• Zustand for auth and player state</li>
                  <li>• Native HTML5 audio for range-based seeking</li>
                </ul>
              </div>
              <div className="p-4 bg-background rounded-lg border">
                <h3 className="font-semibold mb-2">Backend</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Next.js API routes, Node.js runtime</li>
                  <li>• PostgreSQL is the source of truth</li>
                  <li>• JWT auth via jose; bcrypt for passwords</li>
                  <li>• WebAuthn credential tables and flows</li>
                </ul>
              </div>
              <div className="p-4 bg-background rounded-lg border">
                <h3 className="font-semibold mb-2">Media</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Local/object storage under STORAGE_DIR</li>
                  <li>• AES-256-GCM per 1 MiB chunk at rest</li>
                  <li>• Short-lived signed URLs for audio requests</li>
                  <li>• HTTP 206 Range responses for seeking</li>
                </ul>
              </div>
              <div className="p-4 bg-background rounded-lg border">
                <h3 className="font-semibold mb-2">Optional IPFS</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Helia for content-addressed secondary copies</li>
                  <li>• Used only when no server copy exists</li>
                  <li>• Never required for upload or playback</li>
                  <li>• WebTorrent was removed: it was never wired in</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Zap className="h-6 w-6" />
              Upload and Playback
            </h2>
            <div className="prose prose-slate max-w-none">
              <h3 className="text-xl font-semibold">Upload</h3>
              <p className="text-muted-foreground">
                <code>POST /api/tracks</code> authenticates the user, checks onboarding and upload quotas,
                then encrypts and stores the audio before writing its metadata to PostgreSQL. The response
                includes a signed <code>streamUrl</code>.
              </p>
              <h3 className="text-xl font-semibold mt-6">Playback</h3>
              <p className="text-muted-foreground">
                The player requests a one-hour, track-scoped token from <code>/api/media/token</code> and
                streams from <code>/api/media/:trackId</code>. The route verifies the token, prefers the
                server copy, and falls back to an IPFS gateway only for tracks without server bytes.
              </p>
              <h3 className="text-xl font-semibold mt-6">Trust Score</h3>
              <p className="text-muted-foreground">
                Trust scores are stored social/reputation scaffolding used by discovery and admin views.
                They do not control media availability.
              </p>
            </div>
          </div>

          <div className="mt-12">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Code className="h-6 w-6" />
              API Reference
            </h2>
            <div className="bg-muted rounded-lg p-6 mt-4">
              <h3 className="font-semibold mb-4">Authentication</h3>
              <p className="text-muted-foreground mb-4">
                Protected endpoints use <code>Authorization: Bearer &lt;jwt&gt;</code>. Native audio requests use
                a short-lived signed query token because <code>&lt;audio&gt;</code> cannot set headers.
              </p>
              <pre className="bg-background p-4 rounded-lg overflow-x-auto">
                {`Authorization: Bearer <your-jwt-token>\n/api/media/:trackId?token=<expires.signature>`}
              </pre>

              <h3 className="font-semibold mt-6 mb-4">Common endpoints</h3>
              <div className="space-y-2 text-sm">
                {[
                  ['POST', '/api/auth/register', 'Create account'],
                  ['POST', '/api/auth/login', 'Sign in'],
                  ['GET', '/api/auth/me', 'Current user'],
                  ['GET', '/api/tracks', 'List tracks'],
                  ['POST', '/api/tracks', 'Upload track'],
                  ['GET', '/api/media/token', 'Issue playback token'],
                  ['GET', '/api/media/:trackId', 'Range-capable audio stream'],
                  ['POST', '/api/social/follow', 'Follow user'],
                  ['POST', '/api/social/like', 'Like post'],
                  ['GET', '/api/trust-score', 'Current trust score'],
                ].map(([method, path, description]) => (
                  <div key={path} className="grid grid-cols-3 gap-2 font-mono">
                    <span className={method === 'POST' ? 'text-green-600' : 'text-blue-600'}>{method}</span>
                    <span>{path}</span>
                    <span className="text-muted-foreground">{description}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-12">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="h-6 w-6" />
              Security Model
            </h2>
            <div className="bg-muted rounded-lg p-6 mt-4">
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>
                  <strong>Encryption at rest:</strong> server-stored audio is encrypted with AES-256-GCM in
                  independently decryptable 1 MiB chunks so seeking works.
                </li>
                <li>
                  <strong>Key handling:</strong> <code>ENCRYPTION_MASTER_KEY</code> and <code>JWT_SECRET</code> are
                  required environment values. The app fails fast if they are missing or weak.
                </li>
                <li>
                  <strong>Media authorization:</strong> signed URLs are HMAC-SHA256, track-scoped, time-limited,
                  and compared with <code>timingSafeEqual</code>.
                </li>
                <li>
                  <strong>Path safety:</strong> storage identifiers are validated as UUIDs before being used as
                  filesystem paths; media responses set <code>X-Content-Type-Options: nosniff</code>.
                </li>
                <li>
                  <strong>Not end-to-end:</strong> the server can decrypt stored audio. This protects disks and
                  backups, not content from the platform operator.
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-12 p-6 bg-muted rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Configuration</h2>
            <p className="text-muted-foreground mb-4">
              Required: <code>DATABASE_URL</code>, <code>JWT_SECRET</code> (32+ characters), and{' '}
              <code>ENCRYPTION_MASTER_KEY</code> (64 hex characters). Optional: <code>STORAGE_DIR</code> and
              WebAuthn origin settings. See <code>.env.example</code>.
            </p>
            <p className="text-sm text-muted-foreground">
              Keep a secure backup of <code>ENCRYPTION_MASTER_KEY</code>; losing it makes stored audio
              unrecoverable.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
