import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Eye, Key, Lock, Music, Shield, Users } from 'lucide-react';

export const metadata = {
  title: 'Security - P2P Music Platform',
  description: 'Security model of the server-authoritative music platform',
};

export default function SecurityPage() {
  return (
    <main className="min-h-screen bg-background">

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Security Model</h1>
          </div>
          <p className="text-muted-foreground text-lg mb-8">
            The server authorizes access and stores media encrypted at rest. This is not end-to-end
            encryption: the server can decrypt stored audio when it serves a playback request.
          </p>

          <div className="space-y-6">
            <div className="border rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <Lock className="h-8 w-8 text-primary" />
                <h2 className="text-2xl font-semibold">Encryption at Rest</h2>
              </div>
              <p className="text-muted-foreground mb-4">
                Uploaded audio is encrypted in 1 MiB chunks with AES-256-GCM before it is written to disk.
                Each chunk has a unique derived nonce and its own authentication tag, so tampering is
                detected and byte-range seeking still works.
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li><strong>Algorithm:</strong> AES-256-GCM</li>
                <li><strong>Key:</strong> <code>ENCRYPTION_MASTER_KEY</code>, required at startup</li>
                <li><strong>IV:</strong> random per-file base IV with a chunk index extension</li>
                <li><strong>Integrity:</strong> GCM authentication tags on every chunk</li>
                <li><strong>Recovery:</strong> losing the master key makes stored audio unrecoverable</li>
              </ul>
            </div>

            <div className="border rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <Key className="h-8 w-8 text-primary" />
                <h2 className="text-2xl font-semibold">Media Authorization</h2>
              </div>
              <p className="text-muted-foreground mb-4">
                Browsers cannot send Authorization headers with <code>&lt;audio&gt;</code> requests, so the
                API issues short-lived, track-scoped signed URLs.
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>API clients use JWT bearer tokens</li>
                <li>Playback URLs use HMAC-SHA256 signatures with a one-hour expiry</li>
                <li>Tokens are compared with <code>timingSafeEqual</code></li>
                <li>Media responses are private and set <code>X-Content-Type-Options: nosniff</code></li>
                <li>Storage identifiers are validated as UUIDs before filesystem access</li>
              </ul>
            </div>

            <div className="border rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <Users className="h-8 w-8 text-primary" />
                <h2 className="text-2xl font-semibold">Accounts</h2>
              </div>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Passwords are hashed with bcrypt</li>
                <li>JWT signing requires a strong <code>JWT_SECRET</code>; there is no fallback secret</li>
                <li>WebAuthn credential tables and flows are supported</li>
                <li>Uploads require onboarding completion and per-user quotas</li>
              </ul>
            </div>

            <div className="border rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <Eye className="h-8 w-8 text-primary" />
                <h2 className="text-2xl font-semibold">Privacy Boundaries</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <h3 className="font-semibold text-green-800 dark:text-green-200 mb-2">Protected</h3>
                  <ul className="list-disc list-inside text-sm text-green-700 dark:text-green-300 space-y-1">
                    <li>Audio bytes on disk are encrypted</li>
                    <li>Private media is not publicly cached</li>
                    <li>Avatars use a read-only public route</li>
                  </ul>
                </div>
                <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <h3 className="font-semibold text-red-800 dark:text-red-200 mb-2">Limitations</h3>
                  <ul className="list-disc list-inside text-sm text-red-700 dark:text-red-300 space-y-1">
                    <li>The server can decrypt audio it serves</li>
                    <li>Track titles and social metadata are not encrypted</li>
                    <li>IPFS gateway retrieval leaves the platform control</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
