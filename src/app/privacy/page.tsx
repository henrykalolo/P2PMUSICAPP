import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Music, ArrowLeft, Shield } from 'lucide-react';

export const metadata = {
  title: 'Privacy Policy - P2P Music Platform',
  description: 'Privacy policy for the P2P Music Platform',
};

export default function PrivacyPage() {
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
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <Shield className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold">Privacy Policy</h1>
          </div>

          <div className="prose prose-slate max-w-none">
            <p className="text-muted-foreground mb-6">
              Last updated: February 2026
            </p>

            <h2 className="text-2xl font-semibold mt-8 mb-4">1. Information We Collect</h2>
            <p className="text-muted-foreground mb-4">
              We collect minimal information to provide the P2P Music Platform service:
            </p>
            <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-2">
              <li>Account information (username, email)</li>
              <li>Music metadata (titles, artists, albums)</li>
              <li>Optional IPFS content identifiers (CIDs) for secondary copies</li>
              <li>Trust scores and social activity data</li>
            </ul>

            <h2 className="text-2xl font-semibold mt-8 mb-4">2. How We Use Your Information</h2>
            <p className="text-muted-foreground mb-4">
              Your information is used solely for:
            </p>
            <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-2">
              <li>Providing music upload and streaming</li>
              <li>Maintaining your account and preferences</li>
              <li>Facilitating content discovery between users</li>
              <li>Trust scoring and storage management</li>
            </ul>

            <h2 className="text-2xl font-semibold mt-8 mb-4">3. Data Security</h2>
            <p className="text-muted-foreground mb-4">
              We take security seriously:
            </p>
            <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-2">
              <li>Audio is encrypted at rest with AES-256-GCM in 1 MiB chunks</li>
              <li>Authentication uses strong JWT secrets and bcrypt password hashes</li>
              <li>Playback uses short-lived, track-scoped signed URLs</li>
              <li>Storage paths are validated as UUIDs to prevent traversal</li>
            </ul>

            <h2 className="text-2xl font-semibold mt-8 mb-4">4. Storage and Playback Privacy</h2>
            <p className="text-muted-foreground mb-4">
              Playback is normally served by the application server:
            </p>
            <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-2">
              <li>Server-stored audio is encrypted at rest and served via authorized URLs</li>
              <li>Private media is not cached publicly</li>
              <li>IPFS is optional and only used for tracks without a server copy</li>
              <li>Using an external IPFS gateway shares your IP address with that gateway</li>
            </ul>

            <h2 className="text-2xl font-semibold mt-8 mb-4">5. Your Rights</h2>
            <p className="text-muted-foreground mb-4">
              You have the right to:
            </p>
            <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-2">
              <li>Access your personal data</li>
              <li>Delete your account and associated data</li>
              <li>Export your content metadata</li>
              <li>Control who can follow you and see your uploads</li>
            </ul>

            <h2 className="text-2xl font-semibold mt-8 mb-4">6. Contact Us</h2>
            <p className="text-muted-foreground mb-4">
              For privacy-related questions or concerns, please contact us through our GitHub repository.
            </p>
          </div>

          <div className="mt-12 p-6 bg-muted rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Questions?</h2>
            <p className="text-muted-foreground mb-4">
              If you have any questions about this privacy policy, please reach out.
            </p>
            <Link href="/">
              <Button>Back to Home</Button>
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
