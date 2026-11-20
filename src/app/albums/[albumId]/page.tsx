'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Disc3 } from 'lucide-react';
import { EnhancedFeedItem } from '@/components/feed/EnhancedFeedItem';

interface AlbumTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  genre: string;
  duration: number;
  streamUrl?: string | null;
  coverArtUrl?: string;
  createdAt: string;
  author: { id: string; username: string; avatarUrl?: string };
  likesCount: number;
  commentsCount: number;
  playsCount?: number;
}

export default function AlbumDetailPage() {
  const { albumId } = useParams<{ albumId: string }>();
  const [album, setAlbum] = useState<any>(null);
  const [tracks, setTracks] = useState<AlbumTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch(`/api/albums/${albumId}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Unable to load album');
        setAlbum(data.album);
        setTracks(data.tracks || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load album');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [albumId]);

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <Link href="/albums" className="text-sm text-muted-foreground hover:text-primary">← All releases</Link>

        {loading ? (
          <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" /></div>
        ) : error ? (
          <div className="rounded-xl border border-border/60 bg-card p-6 text-center text-muted-foreground">{error}</div>
        ) : album ? (
          <>
            <section className="flex gap-4 rounded-2xl border border-border/60 bg-card p-5">
              {album.coverArtUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={album.coverArtUrl} alt="" className="h-24 w-24 rounded-xl object-cover" />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-xl bg-primary/10"><Disc3 className="h-9 w-9 text-primary" /></div>
              )}
              <div className="min-w-0">
                <h1 className="text-2xl font-bold">{album.title}</h1>
                <p className="text-sm text-muted-foreground">{album.artist || `By ${album.owner.username}`}</p>
                {album.releaseDate && <p className="mt-1 text-xs text-muted-foreground">Released {album.releaseDate}</p>}
                {album.description && <p className="mt-2 text-sm">{album.description}</p>}
                <p className="mt-2 text-xs text-muted-foreground">{tracks.length} tracks</p>
              </div>
            </section>

            {tracks.length === 0 ? (
              <div className="rounded-xl border border-border/60 bg-card p-8 text-center text-muted-foreground">
                No tracks in this release yet. Select it when uploading.
              </div>
            ) : (
              <div className="space-y-4">
                {tracks.map((track) => <EnhancedFeedItem key={track.id} post={track} />)}
              </div>
            )}
          </>
        ) : null}
      </div>
    </main>
  );
}
