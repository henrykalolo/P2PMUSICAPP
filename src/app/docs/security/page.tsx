import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Music, ArrowLeft, Shield, Lock, Key, Eye, Users } from 'lucide-react';

export const metadata = {
  title: 'Security - P2P Music Platform',
  description: 'Security and privacy features of the P2P Music Platform',
};

export default function SecurityPage() {
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
          <h1 className="text-4xl font-bold mb-4">Security & Privacy</h1>
          <p className="text-muted-foreground text-lg mb-8">
            P2P Music Platform is built with security and privacy as core principles. Learn about our encryption, 
            access controls, and privacy features.
          </p>

          {/* Encryption Section */}
          <div className="space-y-6">
            <div className="border rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <Lock className="h-8 w-8 text-primary" />
                <h2 className="text-2xl font-semibold">End-to-End Encryption</h2>
              </div>
              
              <p className="text-muted-foreground mb-4">
                All music content is encrypted before it leaves your device using AES-256-GCM encryption. 
                This ensures that only authorized users can decrypt and play the content.
              </p>
              
              <div className="bg-muted rounded-lg p-4 mb-4">
                <h3 className="font-semibold mb-2">How it works:</h3>
                <ol className="list-decimal list-inside text-muted-foreground space-y-2">
                  <li>When you upload a track, it is encrypted on your device</li>
                  <li>The encrypted content is distributed across the P2P network</li>
                  <li>Magnet links contain encrypted content references, not the content itself</li>
                  <li>Only users who follow you have the decryption keys</li>
                  <li>Your followers can decrypt and play the content locally</li>
                </ol>
              </div>
              
              <h3 className="font-semibold mb-2">Encryption Details:</h3>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li><strong>Algorithm:</strong> AES-256-GCM (Galois/Counter Mode)</li>
                <li><strong>Key derivation:</strong> PBKDF2 with high iteration count</li>
                <li><strong>Authentication:</strong> Built-in GCM authentication tags</li>
                <li><strong>IV/Nonce:</strong> Unique for each encryption operation</li>
              </ul>
            </div>

            {/* Access Control */}
            <div className="border rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <Key className="h-8 w-8 text-primary" />
                <h2 className="text-2xl font-semibold">Access Control</h2>
              </div>
              
              <p className="text-muted-foreground mb-4">
                P2P Music Platform implements follower-only access for all content. This means:
              </p>
              
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Only users who follow you can access your music</li>
                <li>Your followers receive decryption keys when you approve their follow request</li>
                <li>Unapproved followers cannot access or play your content</li>
                <li>You can unfollow anyone at any time, immediately revoking their access</li>
              </ul>
              
              <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  <strong>Note:</strong> Even with encryption, your IP address is visible to peers you connect with 
                  for streaming. This is a limitation of peer-to-peer technology.
                </p>
              </div>
            </div>

            {/* P2P Privacy */}
            <div className="border rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <Eye className="h-8 w-8 text-primary" />
                <h2 className="text-2xl font-semibold">P2P Network Privacy</h2>
              </div>
              
              <p className="text-muted-foreground mb-4">
                As a decentralized platform, P2P Music Platform has unique privacy considerations:
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <h3 className="font-semibold text-green-800 dark:text-green-200 mb-2">What We Protect</h3>
                  <ul className="list-disc list-inside text-sm text-green-700 dark:text-green-300 space-y-1">
                    <li>Music content is encrypted at rest and in transit</li>
                    <li>No centralized storage of unencrypted files</li>
                    <li>Decryption keys only shared with followers</li>
                    <li>No logging of who streams what content</li>
                  </ul>
                </div>
                <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <h3 className="font-semibold text-red-800 dark:text-red-200 mb-2">Known Limitations</h3>
                  <ul className="list-disc list-inside text-sm text-red-700 dark:text-red-300 space-y-1">
                    <li>Your IP address is visible to streaming peers</li>
                    <li>Network traffic patterns may be observable</li>
                    <li>ISP can see you're using P2P technology</li>
                    <li>Content metadata (titles) is not encrypted</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Authentication */}
            <div className="border rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <Users className="h-8 w-8 text-primary" />
                <h2 className="text-2xl font-semibold">Authentication</h2>
              </div>
              
              <p className="text-muted-foreground mb-4">
                P2P Music Platform supports multiple authentication methods:
              </p>
              
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <h3 className="font-semibold mb-2">Traditional Authentication</h3>
                  <p className="text-muted-foreground text-sm">
                    Username/email and password with bcrypt hashing. Passwords are never stored in plain text.
                  </p>
                </div>
                
                <div className="p-4 bg-muted rounded-lg">
                  <h3 className="font-semibold mb-2">WebAuthn / Passkeys</h3>
                  <p className="text-muted-foreground text-sm">
                    Modern passwordless authentication using WebAuthn standard. More secure and convenient 
                    than traditional passwords. Supports hardware security keys and device-based passkeys.
                  </p>
                </div>
                
                <div className="p-4 bg-muted rounded-lg">
                  <h3 className="font-semibold mb-2">JWT Tokens</h3>
                  <p className="text-muted-foreground text-sm">
                    All authenticated sessions use JWT (JSON Web Tokens) with configurable expiry. Tokens 
                    are required for all protected API endpoints and automatically validate on each request.
                  </p>
                </div>
              </div>
            </div>

            {/* Data Protection */}
            <div className="border rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <Shield className="h-8 w-8 text-primary" />
                <h2 className="text-2xl font-semibold">Data Protection</h2>
              </div>
              
              <p className="text-muted-foreground mb-4">
                We collect and store only the minimum data necessary to provide the service:
              </p>
              
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Data Type</th>
                    <th className="text-left py-2">Purpose</th>
                    <th className="text-left py-2">Storage</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-2">Username, Email</td>
                    <td className="py-2">Account identification</td>
                    <td className="py-2">PostgreSQL</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2">Password (hashed)</td>
                    <td className="py-2">Authentication</td>
                    <td className="py-2">bcrypt hash</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2">Music Metadata</td>
                    <td className="py-2">Content discovery</td>
                    <td className="py-2">PostgreSQL</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2">Trust Score Data</td>
                    <td className="py-2">Network prioritization</td>
                    <td className="py-2">PostgreSQL</td>
                  </tr>
                  <tr>
                    <td className="py-2">Social Connections</td>
                    <td className="py-2">Follow/following relationships</td>
                    <td className="py-2">PostgreSQL</td>
                  </tr>
                </tbody>
              </table>
              
              <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Your Rights:</strong> You can request access to or deletion of your personal data at any time. 
                  Contact us through our GitHub repository for data portability or deletion requests.
                </p>
              </div>
            </div>
          </div>

          {/* Best Practices */}
          <div className="mt-12 p-6 bg-muted rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Security Best Practices</h2>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li>Use WebAuthn/passkeys for stronger authentication</li>
              <li>Keep your device and browser updated</li>
              <li>Use a VPN if you want to hide your P2P activity from your ISP</li>
              <li>Only follow users you trust - they can see your activity</li>
              <li>Review the privacy settings on your account regularly</li>
              <li>Report any security vulnerabilities through our responsible disclosure program</li>
            </ul>
          </div>

          {/* See Also */}
          <div className="mt-8 p-6 bg-muted rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Related Documentation</h2>
            <div className="flex flex-wrap gap-4">
              <Link href="/docs/getting-started">
                <Button variant="outline">Getting Started</Button>
              </Link>
              <Link href="/docs/technical">
                <Button variant="outline">Technical Overview</Button>
              </Link>
              <Link href="/privacy">
                <Button variant="outline">Privacy Policy</Button>
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
