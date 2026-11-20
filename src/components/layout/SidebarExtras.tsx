'use client';

import Link from 'next/link';
import {
  ArrowRight,
  Compass,
  FileText,
  Music,
  ShieldCheck,
  Sparkles,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FollowingSidebar } from '@/components/feed/FollowingSidebar';
import { TrendsSidebar } from '@/components/feed/TrendsSidebar';
import { useAuthStore } from '@/store/useAuthStore';

export function LeftSidebarExtras() {
  const { user, isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) return null;

  if (isAuthenticated && user) {
    return <FollowingSidebar userId={user.id} />;
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
        <Sparkles className="h-5 w-5 text-primary" />
      </div>
      <h3 className="font-semibold">Your music home</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Follow artists, build a feed, and keep everything you love in one place.
      </p>
      <div className="mt-4 grid gap-2">
        <Link href="/register">
          <Button size="sm" className="w-full">
            Create account
          </Button>
        </Link>
        <Link href="/login">
          <Button size="sm" variant="ghost" className="w-full">
            Sign in
          </Button>
        </Link>
      </div>
    </div>
  );
}

export function RightSidebarExtras() {
  const { user, isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) return null;

  if (isAuthenticated && user) {
    return <TrendsSidebar userId={user.id} />;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
          <Compass className="h-5 w-5 text-primary" />
        </div>
        <h3 className="font-semibold">Find something new</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Discover artists and tracks from the community.
        </p>
        <Link href="/discover">
          <Button size="sm" variant="outline" className="mt-4 w-full">
            Explore now
          </Button>
        </Link>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck className="h-4 w-4 text-primary" />
          Platform promises
        </h3>
        <ul className="space-y-3 text-sm text-muted-foreground">
          <li className="flex gap-2">
            <Music className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            Instant, reliable playback from encrypted server storage.
          </li>
          <li className="flex gap-2">
            <Upload className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            Uploads are validated and ready to share right away.
          </li>
          <li className="flex gap-2">
            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            Open documentation and clear platform policies.
          </li>
        </ul>
        <Link
          href="/docs/getting-started"
          className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          Read the guide
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
