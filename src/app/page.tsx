'use client';

import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  Compass,
  Heart,
  ListMusic,
  Music,
  Play,
  Radio,
  ShieldCheck,
  Sparkles,
  Upload,
  Users,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/useAuthStore';

const highlights = [
  {
    icon: Zap,
    title: 'Instant playback',
    description: 'Native audio with signed links and seamless seeking from the first play.',
  },
  {
    icon: ShieldCheck,
    title: 'Encrypted at rest',
    description: 'Chunked AES-256-GCM protects files without breaking byte-range streaming.',
  },
  {
    icon: Users,
    title: 'Built around people',
    description: 'Follow artists, build a feed, and discover music through the community.',
  },
  {
    icon: Radio,
    title: 'Optional IPFS',
    description: 'Server storage keeps playback reliable while IPFS remains an extra fallback.',
  },
];

const quickLinks = [
  { href: '/feed', label: 'Your feed', description: 'See the latest from artists you follow.', icon: Radio },
  { href: '/discover', label: 'Discover', description: 'Find new music and people to follow.', icon: Compass },
  { href: '/upload', label: 'Upload music', description: 'Share a track with cover art and notes.', icon: Upload, authOnly: true },
  { href: '/playlists', label: 'Playlists', description: 'Jump back into your saved collections.', icon: ListMusic },
  { href: '/liked', label: 'Liked tracks', description: 'Replay everything you have saved.', icon: Heart, authOnly: true },
  { href: '/docs', label: 'Documentation', description: 'Learn how the platform works.', icon: BookOpen },
];

const steps = [
  {
    title: 'Create your space',
    description: 'Sign in, choose a few artists, and make the feed your own.',
  },
  {
    title: 'Share your sound',
    description: 'Upload audio with artwork and a description in a single flow.',
  },
  {
    title: 'Listen everywhere',
    description: 'Use the responsive player on desktop, tablet, or phone.',
  },
];

export default function Home() {
  const { isAuthenticated, user } = useAuthStore();
  const primaryHref = isAuthenticated ? '/feed' : '/register';
  const secondaryHref = isAuthenticated ? '/upload' : '/discover';

  return (
    <main className="bg-background">
      <section className="relative overflow-hidden border-b border-border/60">
        <div className="pointer-events-none absolute -top-40 right-[-12rem] h-[28rem] w-[28rem] rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-[-14rem] left-[-10rem] h-[24rem] w-[24rem] rounded-full bg-accent/10 blur-3xl" />

        <div className="container relative mx-auto px-4 py-16 sm:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
              <Sparkles className="h-4 w-4" />
              Music, made simple and reliable
            </div>

            <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Your music, without the friction
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
              Upload, stream, and share music from one polished space. Your library stays
              ready to play, with social discovery built in.
            </p>

            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href={primaryHref}>
                <Button size="lg" className="w-full sm:w-auto">
                  {isAuthenticated ? 'Open your feed' : 'Get started'}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href={secondaryHref}>
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  <Play className="mr-2 h-4 w-4" />
                  {isAuthenticated ? 'Upload a track' : 'Explore music'}
                </Button>
              </Link>
            </div>

            {isAuthenticated && user && (
              <p className="mt-4 text-sm text-muted-foreground">
                Welcome back, <span className="font-medium text-foreground">{user.username}</span>.
              </p>
            )}
          </div>

          <div className="mx-auto mt-12 grid max-w-3xl gap-3 sm:grid-cols-3">
            {[
              { value: 'Instant', label: 'Server-backed playback' },
              { value: 'Encrypted', label: 'AES-256-GCM at rest' },
              { value: 'Optional', label: 'IPFS fallback' },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-border/60 bg-card/80 px-4 py-5 text-center backdrop-blur"
              >
                <p className="text-lg font-semibold text-primary">{stat.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-14">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Jump back in</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Everything you need is one click away.
            </p>
          </div>
          <Link
            href="/docs/getting-started"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Read the guide
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {quickLinks
            .filter((link) => !link.authOnly || isAuthenticated)
            .map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="group rounded-2xl border border-border/60 bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
                >
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold">{link.label}</h3>
                    <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{link.description}</p>
                </Link>
              );
            })}
        </div>
      </section>

      <section className="border-y border-border/60 bg-muted/20">
        <div className="container mx-auto px-4 py-14">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              A better listening experience
            </h2>
            <p className="mt-2 text-muted-foreground">
              Designed around what actually matters: reliable playback, clear controls,
              and a community that helps you find your next favorite track.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            {highlights.map((highlight) => {
              const Icon = highlight.icon;
              return (
                <div
                  key={highlight.title}
                  className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm"
                >
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold">{highlight.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {highlight.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-14">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Music className="h-5 w-5" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              From upload to playback in three steps
            </h2>
            <p className="mt-3 text-muted-foreground">
              The flow is deliberately simple, whether you are sharing your first song or
              curating a full library.
            </p>
          </div>

          <div className="space-y-4">
            {steps.map((step, index) => (
              <div
                key={step.title}
                className="flex gap-4 rounded-2xl border border-border/60 bg-card p-5"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                  {index + 1}
                </span>
                <div>
                  <h3 className="font-semibold">{step.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 pb-16">
        <div className="relative overflow-hidden rounded-3xl bg-primary px-6 py-12 text-center text-primary-foreground sm:px-12">
          <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
          <h2 className="relative text-2xl font-bold sm:text-3xl">
            Ready to make the feed yours?
          </h2>
          <p className="relative mx-auto mt-2 max-w-xl text-primary-foreground/80">
            Join the community, share a track, and start discovering music today.
          </p>
          <div className="relative mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href={primaryHref}>
              <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                {isAuthenticated ? 'Go to feed' : 'Create free account'}
              </Button>
            </Link>
            <Link href="/docs">
              <Button
                size="lg"
                variant="ghost"
                className="w-full text-primary-foreground hover:bg-white/10 hover:text-primary-foreground sm:w-auto"
              >
                Learn more
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/60">
        <div className="container mx-auto flex flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} P2P Music. Built for reliable, social listening.
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <Link href="/docs" className="hover:text-foreground">Docs</Link>
            <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link href="/dmca" className="hover:text-foreground">DMCA</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
