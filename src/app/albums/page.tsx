'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Disc3, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/store/useAuthStore';

interface Album {
  id: string;
  title: string;
  artist: string | null;
  description: string | null;
  genre: string | null;
  releaseDate: string | null;
  coverArtUrl: string | null;
  tracksCount: number;
}

export default function AlbumsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', artist: '', genre: '', releaseDate: '', coverArtUrl: '' });

  const loadAlbums = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const response = await fetch('/api/albums', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Unable to load albums');
      const data = await response.json();
      setAlbums(data.albums || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load albums');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading || !isAuthenticated) {
      setLoading(false);
      return;
    }
    void loadAlbums();
  }, [authLoading, isAuthenticated]);

  const createAlbum = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.title.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/albums', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to create album');
      setAlbums((current) => [{ ...data.album, tracksCount: 0 }, ...current]);
      setForm({ title: '', artist: '', genre: '', releaseDate: '', coverArtUrl: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create album');
    } finally {
      setCreating(false);
    }
  };

  const deleteAlbum = async (albumId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/albums/${albumId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) setAlbums((current) => current.filter((album) => album.id !== albumId));
    } catch {
      setError('Unable to delete album');
    }
  };

  if (!authLoading && !isAuthenticated) {
    return (
      <main className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-xl rounded-2xl border border-border/60 bg-card p-8 text-center">
          <Disc3 className="mx-auto mb-4 h-10 w-10 text-primary" />
          <h1 className="text-2xl font-bold">Sign in to manage releases</h1>
          <p className="mt-2 text-muted-foreground">Albums group your uploads into a single release.</p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href="/login"><Button variant="outline">Sign in</Button></Link>
            <Link href="/register"><Button>Get started</Button></Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
            <Disc3 className="h-7 w-7 text-primary" />
            Releases
          </h1>
          <p className="mt-2 text-muted-foreground">
            Create an album, then choose it when you upload a track.
          </p>
        </div>

        <form onSubmit={createAlbum} className="grid gap-3 rounded-xl border border-border/60 bg-card p-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <h2 className="flex items-center gap-2 font-semibold"><Plus className="h-4 w-4 text-primary" /> New release</h2>
          </div>
          <Input placeholder="Album title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={200} required />
          <Input placeholder="Artist" value={form.artist} onChange={(e) => setForm({ ...form, artist: e.target.value })} />
          <Input placeholder="Genre" value={form.genre} onChange={(e) => setForm({ ...form, genre: e.target.value })} />
          <Input type="date" value={form.releaseDate} onChange={(e) => setForm({ ...form, releaseDate: e.target.value })} />
          <Input placeholder="Cover image URL (optional)" value={form.coverArtUrl} onChange={(e) => setForm({ ...form, coverArtUrl: e.target.value })} className="sm:col-span-2" />
          <div className="sm:col-span-2">
            <Button type="submit" disabled={creating || !form.title.trim()}>
              {creating ? 'Creating…' : 'Create release'}
            </Button>
          </div>
        </form>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {loading ? (
          <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" /></div>
        ) : albums.length === 0 ? (
          <div className="rounded-xl border border-border/60 bg-card p-8 text-center text-muted-foreground">
            No releases yet. Create one above.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {albums.map((album) => (
              <div key={album.id} className="flex gap-3 rounded-xl border border-border/60 bg-card p-4">
                {album.coverArtUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={album.coverArtUrl} alt="" className="h-16 w-16 rounded object-cover" />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded bg-primary/10"><Disc3 className="h-6 w-6 text-primary" /></div>
                )}
                <div className="min-w-0 flex-1">
                  <Link href={`/albums/${album.id}`} className="block truncate font-medium hover:text-primary">{album.title}</Link>
                  <p className="truncate text-xs text-muted-foreground">{album.artist || 'Unknown artist'}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{album.tracksCount} tracks</p>
                </div>
                <button type="button" onClick={() => void deleteAlbum(album.id)} aria-label={`Delete ${album.title}`} className="self-start rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
