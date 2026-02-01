import { Button } from "@/components/ui/button";
import { Music, Users, Shield, Zap, Radio, HardDrive } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen">
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
            <Button size="lg" className="w-full sm:w-auto">
              <Music className="mr-2 h-5 w-5" />
              Start Listening
            </Button>
            <Button variant="outline" size="lg" className="w-full sm:w-auto">
              <Radio className="mr-2 h-5 w-5" />
              Upload Music
            </Button>
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
            <Button size="lg" variant="secondary" className="w-full sm:w-auto">
              Create Account
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="w-full sm:w-auto border-primary-foreground/20 hover:bg-primary-foreground/10"
            >
              Read Documentation
            </Button>
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
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              GitHub
            </a>
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Documentation
            </a>
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Privacy
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
