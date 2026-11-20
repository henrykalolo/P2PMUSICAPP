'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BarChart3, Heart, Play, Repeat2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/useAuthStore';

interface AnalyticsSummary {
  tracks: number;
  plays: number;
  shares: number;
  likes: number;
  reposts: number;
  comments: number;
  followers: number;
  following: number;
  completionRate: number;
  skipRate: number;
}

interface AnalyticsData {
  summary: AnalyticsSummary;
  playsLast14Days: Array<{ date: string; plays: number }>;
  topTracks: Array<{
    id: string;
    title: string;
    coverArtUrl: string | null;
    plays: number;
    likes: number;
    comments: number;
    completionRate: number;
    skipRate: number;
  }>;
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Play;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-4 w-4 text-primary" />
        {label}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function AnalyticsPage() {
  const { isAuthenticated, isLoading } = useAuthStore();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    const fetchAnalytics = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/analytics/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error('Unable to load analytics');
        const data = await response.json();
        setAnalytics(data.analytics);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load analytics');
      } finally {
        setLoading(false);
      }
    };

    void fetchAnalytics();
  }, [isAuthenticated, isLoading]);

  if (!isLoading && !isAuthenticated) {
    return (
      <main className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-xl rounded-2xl border border-border/60 bg-card p-8 text-center">
          <BarChart3 className="mx-auto mb-4 h-10 w-10 text-primary" />
          <h1 className="text-2xl font-bold">Sign in to see your analytics</h1>
          <p className="mt-2 text-muted-foreground">
            Play counts, completion rates and listener growth are available to creators.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href="/login"><Button variant="outline">Sign in</Button></Link>
            <Link href="/register"><Button>Get started</Button></Link>
          </div>
        </div>
      </main>
    );
  }

  const maxPlays = Math.max(1, ...(analytics?.playsLast14Days.map((day) => day.plays) ?? []));

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
            <BarChart3 className="h-7 w-7 text-primary" />
            Your analytics
          </h1>
          <p className="mt-2 text-muted-foreground">
            A live view of plays, engagement and listener growth from your tracks.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
          </div>
        ) : error ? (
          <div className="rounded-xl border border-border/60 bg-card p-6 text-center text-muted-foreground">
            {error}
          </div>
        ) : analytics ? (
          <>
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard icon={Play} label="Total plays" value={analytics.summary.plays.toLocaleString()} />
              <StatCard icon={Heart} label="Likes" value={analytics.summary.likes.toLocaleString()} />
              <StatCard icon={Repeat2} label="Reposts" value={analytics.summary.reposts.toLocaleString()} />
              <StatCard icon={Users} label="Followers" value={analytics.summary.followers.toLocaleString()} />
            </section>

            <section className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-border/60 bg-card p-5">
                <h2 className="font-semibold">Listening quality</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Based on completed and skipped plays.
                </p>
                <div className="mt-5 space-y-5">
                  <div>
                    <div className="mb-2 flex justify-between text-sm">
                      <span>Completion rate</span>
                      <span className="font-medium tabular-nums">{analytics.summary.completionRate}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${analytics.summary.completionRate}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 flex justify-between text-sm">
                      <span>Skip rate</span>
                      <span className="font-medium tabular-nums">{analytics.summary.skipRate}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-amber-500" style={{ width: `${analytics.summary.skipRate}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border/60 bg-card p-5">
                <h2 className="font-semibold">Plays · last 14 days</h2>
                <div className="mt-5 flex h-28 items-end gap-1.5">
                  {analytics.playsLast14Days.map((day) => (
                    <div
                      key={day.date}
                      className="flex-1 rounded-t bg-primary/70"
                      style={{ height: `${Math.max(3, (day.plays / maxPlays) * 100)}%` }}
                      title={`${day.date}: ${day.plays} plays`}
                    />
                  ))}
                </div>
                <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
                  <span>{analytics.playsLast14Days[0]?.date}</span>
                  <span>{analytics.playsLast14Days[analytics.playsLast14Days.length - 1]?.date}</span>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-border/60 bg-card p-5">
              <h2 className="font-semibold">Top tracks</h2>
              {analytics.topTracks.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">Upload and play a track to see stats here.</p>
              ) : (
                <div className="mt-4 divide-y divide-border/60">
                  {analytics.topTracks.map((track) => (
                    <div key={track.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                      {track.coverArtUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={track.coverArtUrl} alt="" className="h-10 w-10 rounded object-cover" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded bg-primary/10">
                          <Play className="h-4 w-4 text-primary" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <Link href={`/post/${track.id}`} className="truncate text-sm font-medium hover:text-primary">
                          {track.title}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {track.plays} plays · {track.likes} likes · {track.completionRate}% completed
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
