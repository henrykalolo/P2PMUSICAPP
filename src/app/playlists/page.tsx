'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/useAuthStore';
import {
  Loader2,
  Plus,
  ListMusic,
  MoreHorizontal,
  Play,
  Sparkles,
  Globe,
  Lock,
  X,
} from 'lucide-react';
import { usePlayerStore, type Track as PlayerTrack } from '@/store/usePlayerStore';

interface Playlist {
  id: string;
  name: string;
  description?: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  tracksCount: number;
  tracks?: any[];
}

export default function PlaylistsPage() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [newPlaylistDescription, setNewPlaylistDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isGeneratingMix, setIsGeneratingMix] = useState(false);
  const [mixMessage, setMixMessage] = useState<string | null>(null);
  const { user, isAuthenticated } = useAuthStore();
  const setQueue = usePlayerStore((state) => state.setQueue);

  useEffect(() => {
    fetchPlaylists();
  }, []);

  const fetchPlaylists = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('/api/social/playlists?includeTracks=true', {
        headers
      });

      if (response.ok) {
        const data = await response.json();
        setPlaylists(data.playlists || []);
      }
    } catch (error) {
      console.error('Failed to fetch playlists:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return;

    setIsCreating(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/social/playlists', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newPlaylistName.trim(),
          description: newPlaylistDescription.trim() || null,
          isPublic,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setPlaylists(prev => [data.playlist, ...prev]);
        setShowCreateModal(false);
        setNewPlaylistName('');
        setNewPlaylistDescription('');
      }
    } catch (error) {
      console.error('Failed to create playlist:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeletePlaylist = async (playlistId: string) => {
    if (!confirm('Are you sure you want to delete this playlist?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/social/playlists?id=${playlistId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        setPlaylists(prev => prev.filter(p => p.id !== playlistId));
      }
    } catch (error) {
      console.error('Failed to delete playlist:', error);
    }
  };

  const playPlaylist = (playlist: Playlist) => {
    if (!playlist.tracks || playlist.tracks.length === 0) return;
    localStorage.setItem('currentPlaylist', JSON.stringify(playlist.tracks));
    setQueue(playlist.tracks as PlayerTrack[], 0, {
      autoplay: true,
      contextName: playlist.name,
    });
  };

  const generateMix = async () => {
    if (!isAuthenticated) return;
    setIsGeneratingMix(true);
    setMixMessage(null);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/social/playlists/auto', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ includeFollowing: true, randomize: true, limit: 30 }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Unable to generate your mix');
      }

      const mixTracks: PlayerTrack[] = data.playlist?.tracks || [];
      if (mixTracks.length === 0) {
        setMixMessage('No tracks matched your preferences yet. Try following a few artists first.');
        return;
      }

      // Persist the mix as a normal playlist so it stays available after a reload.
      const saveResponse = await fetch('/api/social/playlists', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: data.playlist.name,
          description: data.playlist.description,
          isPublic: false,
          trackIds: mixTracks.map((track) => track.id),
        }),
      });
      const saved = await saveResponse.json();
      if (saveResponse.ok && saved.playlist) {
        setPlaylists((current) => [
          { ...saved.playlist, tracks: mixTracks, tracksCount: mixTracks.length },
          ...current,
        ]);
      }

      setQueue(mixTracks, 0, { autoplay: true, contextName: data.playlist.name });
      setMixMessage(`Your mix is ready with ${mixTracks.length} tracks and is now playing.`);
    } catch (error) {
      setMixMessage(error instanceof Error ? error.message : 'Unable to generate your mix');
    } finally {
      setIsGeneratingMix(false);
    }
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <ListMusic className="h-8 w-8 text-primary" />
                Playlists
              </h1>
              <p className="text-muted-foreground mt-1">
                Organize your favorite tracks
              </p>
            </div>
            {isAuthenticated && (
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Playlist
              </Button>
            )}
          </div>

          {/* Create Playlist Modal */}
          {showCreateModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-card border rounded-xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Create New Playlist</h3>
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="p-1 hover:bg-secondary rounded-full transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Name</label>
                    <input
                      type="text"
                      value={newPlaylistName}
                      onChange={(e) => setNewPlaylistName(e.target.value)}
                      placeholder="My Playlist"
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                      maxLength={100}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Description (optional)</label>
                    <textarea
                      value={newPlaylistDescription}
                      onChange={(e) => setNewPlaylistDescription(e.target.value)}
                      placeholder="What's this playlist about?"
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary min-h-[80px] resize-none"
                      maxLength={500}
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="isPublic"
                      checked={isPublic}
                      onChange={(e) => setIsPublic(e.target.checked)}
                      className="rounded border-border"
                    />
                    <label htmlFor="isPublic" className="text-sm">
                      Make this playlist public
                    </label>
                  </div>
                </div>

                <div className="flex gap-2 mt-6">
                  <Button
                    variant="outline"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreatePlaylist}
                    disabled={!newPlaylistName.trim() || isCreating}
                    className="flex-1"
                  >
                    {isCreating ? (
                      <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      'Create'
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {mixMessage && (
            <div
              role="status"
              className="mb-4 flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm"
            >
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span className="flex-1">{mixMessage}</span>
              <button
                type="button"
                onClick={() => setMixMessage(null)}
                aria-label="Dismiss message"
                className="rounded p-0.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Playlists Grid */}
          {playlists.length === 0 ? (
            <div className="text-center py-16 bg-card rounded-xl">
              <ListMusic className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No playlists yet</h3>
              <p className="text-muted-foreground mb-6">
                Create your first playlist to organize your favorite music
              </p>
              {isAuthenticated ? (
                <Button onClick={() => setShowCreateModal(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Playlist
                </Button>
              ) : (
                <p className="text-muted-foreground">
                  Sign in to create playlists
                </p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Generate Auto Playlist Card */}
              {isAuthenticated && (
                <button
                  onClick={() => void generateMix()}
                  disabled={isGeneratingMix}
                  className="bg-gradient-to-br from-primary/20 via-accent/20 to-primary/20 border-2 border-dashed border-primary/30 rounded-xl p-6 flex flex-col items-center justify-center gap-3 hover:border-primary/50 transition-colors text-left w-full disabled:opacity-60"
                >
                  {isGeneratingMix ? (
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  ) : (
                    <Sparkles className="h-10 w-10 text-primary" />
                  )}
                  <div>
                    <h3 className="font-semibold">
                      {isGeneratingMix ? 'Building your mix…' : 'Generate Mix'}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Personalized playlist based on your preferences
                    </p>
                  </div>
                </button>
              )}

              {/* User Playlists */}
              {playlists.map((playlist) => (
                <div
                  key={playlist.id}
                  className="bg-card border border-border/50 rounded-xl p-4 hover:shadow-lg transition-shadow group"
                >
                  {/* Playlist Header */}
                  <div className="flex items-start gap-4">
                    <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center flex-shrink-0">
                      <ListMusic className="h-8 w-8 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {playlist.isPublic ? (
                          <Globe className="h-3 w-3 text-muted-foreground" />
                        ) : (
                          <Lock className="h-3 w-3 text-muted-foreground" />
                        )}
                        <h3 className="font-semibold truncate">{playlist.name}</h3>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {playlist.description || `${playlist.tracksCount} tracks`}
                      </p>
                    </div>
                  </div>

                  {/* Track Count */}
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {playlist.tracksCount || 0} tracks
                    </span>

                    <div className="flex items-center gap-1">
                      {/* Play Button */}
                      {playlist.tracks && playlist.tracks.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => playPlaylist(playlist)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                      )}

                      {/* More Options */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Track List Preview */}
                  {playlist.tracks && playlist.tracks.length > 0 && (
                    <div className="mt-4 space-y-1">
                      {playlist.tracks.slice(0, 3).map((track, index) => (
                        <div
                          key={track.id}
                          className="flex items-center gap-2 text-sm p-2 rounded hover:bg-secondary/50 transition-colors"
                        >
                          <span className="text-muted-foreground w-4">{index + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{track.title}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {track.artist}
                            </p>
                          </div>
                        </div>
                      ))}
                      {playlist.tracks.length > 3 && (
                        <p className="text-xs text-muted-foreground text-center py-1">
                          +{playlist.tracks.length - 3} more
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
