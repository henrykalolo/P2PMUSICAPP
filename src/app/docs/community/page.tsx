import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Music, ArrowLeft, Users, MessageSquare, Heart, Share2 } from 'lucide-react';

export const metadata = {
  title: 'Community - P2P Music Platform',
  description: 'Community guidelines and social features of the P2P Music Platform',
};

export default function CommunityPage() {
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
          <h1 className="text-4xl font-bold mb-4">Community Guidelines</h1>
          <p className="text-muted-foreground text-lg mb-8">
            P2P Music Platform is built by and for music lovers. These guidelines help us build 
            a positive, creative community.
          </p>

          {/* Core Values */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="p-6 bg-muted rounded-lg text-center">
              <Users className="h-10 w-10 text-primary mx-auto mb-3" />
              <h3 className="font-semibold mb-2">Respect</h3>
              <p className="text-sm text-muted-foreground">
                Treat all community members with respect and kindness.
              </p>
            </div>
            <div className="p-6 bg-muted rounded-lg text-center">
              <Heart className="h-10 w-10 text-primary mx-auto mb-3" />
              <h3 className="font-semibold mb-2">Creativity</h3>
              <p className="text-sm text-muted-foreground">
                Celebrate original work and give credit where it's due.
              </p>
            </div>
            <div className="p-6 bg-muted rounded-lg text-center">
              <Share2 className="h-10 w-10 text-primary mx-auto mb-3" />
              <h3 className="font-semibold mb-2">Sharing</h3>
              <p className="text-sm text-muted-foreground">
                Share knowledge and help others discover great music.
              </p>
            </div>
          </div>

          {/* Social Features */}
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Social Features</h2>
            
            <div className="border rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-4">Following & Followers</h3>
              <p className="text-muted-foreground mb-4">
                Build your network by following artists and music lovers. Your feed shows 
                tracks from users you follow, sorted by newest first.
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Follow artists to see their uploads in your feed</li>
                <li>Follow curators to discover new music</li>
                <li>Your followers can access your encrypted content</li>
                <li>You can unfollow anyone at any time</li>
              </ul>
            </div>

            <div className="border rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-4">Likes & Appreciation</h3>
              <p className="text-muted-foreground mb-4">
                Show appreciation for tracks you enjoy by liking them. Likes help:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Artists know their work is appreciated</li>
                <li>Tracks gain visibility in trending algorithms</li>
                <li>You earn badges for your engagement</li>
              </ul>
              <p className="text-muted-foreground mt-4">
                <strong>Badge Rewards:</strong> Like tracks to earn badges like "First Supporter", 
                "Swarm Supporter", and "Music Curator".
              </p>
            </div>

            <div className="border rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Comments & Timestamps
              </h3>
              <p className="text-muted-foreground mb-4">
                Engage with tracks by leaving comments. You can:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Leave comments at specific timestamps in the track</li>
                <li>Discuss specific parts of songs with other listeners</li>
                <li>Ask questions or share thoughts about the music</li>
                <li>Give feedback to artists (please be constructive!)</li>
              </ul>
              <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  <strong>Tip:</strong> Use timestamps to reference specific moments in tracks. 
                  Other users can click to jump to that point in the song.
                </p>
              </div>
            </div>

            <div className="border rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-4">Reposts</h3>
              <p className="text-muted-foreground mb-4">
                Share tracks you love with your followers by reposting. You can:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Share any track with your followers</li>
                <li>Add your own caption to explain why you love it</li>
                <li>Help great music get discovered by more people</li>
                <li>Give credit to the original artist</li>
              </ul>
            </div>
          </div>

          {/* Rules */}
          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-4">Community Rules</h2>
            
            <div className="space-y-4">
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border-l-4 border-green-500">
                <h3 className="font-semibold text-green-800 dark:text-green-200">Do</h3>
                <ul className="list-disc list-inside text-green-700 dark:text-green-300 space-y-1 mt-2">
                  <li>Share original music you created or have rights to</li>
                  <li>Give credit to artists when sharing their work</li>
                  <li>Leave constructive and helpful comments</li>
                  <li>Respect other users' preferences and tastes</li>
                  <li>Help new users get started in the community</li>
                  <li>Report content that violates these guidelines</li>
                </ul>
              </div>
              
              <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border-l-4 border-red-500">
                <h3 className="font-semibold text-red-800 dark:text-red-200">Don't</h3>
                <ul className="list-disc list-inside text-red-700 dark:text-red-300 space-y-1 mt-2">
                  <li>Upload music you don't have rights to distribute</li>
                  <li>Harass, threaten, or bully other users</li>
                  <li>Spam or post repetitive/bot-like content</li>
                  <li>Share explicit content or NSFW material</li>
                  <li>Impersonate other artists or users</li>
                  <li>Use automated tools to boost engagement</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Trust Score */}
          <div className="mt-12 p-6 bg-muted rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Trust Score & Reputation</h2>
            <p className="text-muted-foreground mb-4">
              Your trust score reflects your contributions to the P2P network. Higher scores 
              give you priority in the network and unlock badges.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-background rounded-lg border">
                <h3 className="font-semibold mb-2">Score Components</h3>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  <li>Upload ratio (40%) - Share more than you download</li>
                  <li>Connection stability (25%) - Stay connected longer</li>
                  <li>Content integrity (20%) - Pass hash verifications</li>
                  <li>Social connections (15%) - Build mutual follows</li>
                </ul>
              </div>
              <div className="p-4 bg-background rounded-lg border">
                <h3 className="font-semibold mb-2">Trust Tiers</h3>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  <li>0-20: Leecher (new users)</li>
                  <li>21-60: Node (active participants)</li>
                  <li>61-90: Guardian (trusted contributors)</li>
                  <li>91-100: Archivist (network pillars)</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Reporting */}
          <div className="mt-12 p-6 bg-muted rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Reporting Issues</h2>
            <p className="text-muted-foreground mb-4">
              If you see content that violates these guidelines or the DMCA, please report it:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li>Use the "Report" button on any track, comment, or profile</li>
              <li>Contact us through our GitHub repository for serious issues</li>
              <li>Include details about the violation when reporting</li>
            </ul>
            <p className="text-muted-foreground mt-4">
              We review all reports within 48 hours and take appropriate action.
            </p>
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
              <Link href="/docs/security">
                <Button variant="outline">Security Features</Button>
              </Link>
              <Link href="/dmca">
                <Button variant="outline">DMCA Policy</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
