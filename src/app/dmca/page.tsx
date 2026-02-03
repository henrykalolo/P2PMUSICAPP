import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Music, ArrowLeft, Scale, FileText, Mail } from 'lucide-react';

export const metadata = {
  title: 'DMCA Policy - P2P Music Platform',
  description: 'Digital Millennium Copyright Act policy and procedures',
};

export default function DMCAPage() {
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
            <Scale className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold">DMCA Copyright Policy</h1>
          </div>

          <p className="text-muted-foreground mb-6">
            Last updated: February 2026
          </p>

          <div className="prose prose-slate max-w-none">
            <p className="text-muted-foreground mb-6">
              P2P Music Platform respects the intellectual property rights of others and expects 
              users to do the same. This Digital Millennium Copyright Act (DMCA) policy outlines 
              our procedures for handling copyright infringement claims.
            </p>

            <h2 className="text-2xl font-semibold mt-8 mb-4">1. Reporting Copyright Infringement</h2>
            <p className="text-muted-foreground mb-4">
              If you believe that your copyrighted work has been uploaded, stored, or shared on 
              P2P Music Platform without your authorization, please provide our designated 
              Copyright Agent with the following information:
            </p>
            <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-2">
              <li>A physical or electronic signature of the copyright owner or authorized representative</li>
              <li>Identification of the copyrighted work claimed to be infringed</li>
              <li>Identification of the infringing material and its location on our platform</li>
              <li>Your contact information (address, telephone, email)</li>
              <li>A statement that you have a good-faith belief that the use is not authorized</li>
              <li>A statement that the information in the notification is accurate</li>
            </ul>

            <h2 className="text-2xl font-semibold mt-8 mb-4">2. DMCA Notice Requirements</h2>
            <p className="text-muted-foreground mb-4">
              To be effective, your DMCA notice must include all of the following elements:
            </p>
            <div className="bg-muted p-4 rounded-lg mb-4">
              <pre className="text-sm whitespace-pre-wrap">
{`[Your Name or Company]
[Your Address]
[Your Email]

To: P2P Music Platform Copyright Agent

Subject: DMCA Takedown Notice

I am the copyright owner or authorized to act on behalf of the owner of an exclusive right that is allegedly infringed.

Work(s) allegedly infringed:
[Description of copyrighted work]
[URL or location of allegedly infringing content on P2P Music Platform]

I swear, under penalty of perjury, that the information in this notification is accurate and that I am the copyright owner or authorized to act on behalf of the owner of the exclusive right.

[Your Signature]
[Date]`}
              </pre>
            </div>

            <h2 className="text-2xl font-semibold mt-8 mb-4">3. Counter-Notification</h2>
            <p className="text-muted-foreground mb-4">
              If you believe that your content was removed or disabled due to a mistake or 
              misidentification, you may submit a counter-notice. Your counter-notice must include:
            </p>
            <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-2">
              <li>Your physical or electronic signature</li>
              <li>Identification of the content that was removed or disabled</li>
              <li>A statement under penalty of perjury that you have a good-faith belief the content was removed by mistake</li>
              <li>Your name, address, and consent to jurisdiction in your country of residence</li>
            </ul>

            <h2 className="text-2xl font-semibold mt-8 mb-4">4. Repeat Infringers</h2>
            <p className="text-muted-foreground mb-4">
              P2P Music Platform reserves the right to terminate the accounts of users who 
              are found to be repeat infringers. A "repeat infringer" is a user who has been 
              notified of infringing activity more than once or has had content removed more than once.
            </p>

            <h2 className="text-2xl font-semibold mt-8 mb-4">5. Platform Limitations</h2>
            <p className="text-muted-foreground mb-4">
              As a decentralized peer-to-peer platform, P2P Music Platform has some unique 
              characteristics that affect copyright enforcement:
            </p>
            <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-2">
              <li><strong>Encrypted Content:</strong> All music is encrypted with AES-256-GCM. 
                  We cannot access or view the actual content, only metadata.</li>
              <li><strong>Distributed Storage:</strong> Content is stored across multiple peers. 
                  Removal from our platform does not guarantee removal from all peers.</li>
              <li><strong>Magnet Links:</strong> Links contain encrypted references, not content. 
                  We can block specific CIDs but cannot decrypt content.</li>
              <li><strong>Follower-Only Access:</strong> Content is only accessible to approved 
                  followers, limiting potential infringement scope.</li>
            </ul>

            <h2 className="text-2xl font-semibold mt-8 mb-4">6. Contact Information</h2>
            <p className="text-muted-foreground mb-4">
              To submit a DMCA notice or counter-notice, please contact us:
            </p>
            <div className="flex items-center gap-2 text-muted-foreground mb-4">
              <Mail className="h-5 w-5" />
              <span>Email: dmca@p2pmusic.example.com</span>
            </div>
            <p className="text-muted-foreground mb-4">
              Please allow 2-3 business days for us to review and respond to your notice.
            </p>

            <h2 className="text-2xl font-semibold mt-8 mb-4">7. Safe Harbor Provisions</h2>
            <p className="text-muted-foreground mb-4">
              P2P Music Platform operates as a service provider under the DMCA's safe harbor 
              provisions (17 U.S.C. § 512). We respond to valid DMCA notices and maintain 
              policies for repeat infringer termination while preserving legitimate use rights.
            </p>

            <h2 className="text-2xl font-semibold mt-8 mb-4">8. Disclaimer</h2>
            <p className="text-muted-foreground mb-4">
              This policy is for informational purposes only and does not constitute legal advice. 
              If you have questions about copyright law or specific infringement claims, please 
              consult with a qualified attorney.
            </p>
          </div>

          <div className="mt-12 p-6 bg-muted rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Questions?</h2>
            <p className="text-muted-foreground mb-4">
              If you have questions about this DMCA policy or need to submit a notice, 
              please contact our Copyright Agent.
            </p>
            <div className="flex flex-wrap gap-4">
              <a href="mailto:dmca@p2pmusic.example.com">
                <Button>
                  <Mail className="h-4 w-4 mr-2" />
                  Contact Copyright Agent
                </Button>
              </a>
              <Link href="/docs">
                <Button variant="outline">
                  <FileText className="h-4 w-4 mr-2" />
                  View Documentation
                </Button>
              </Link>
              <Link href="/privacy">
                <Button variant="outline">Privacy Policy</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
