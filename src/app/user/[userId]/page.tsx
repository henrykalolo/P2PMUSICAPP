'use client';

import { useEffect, useState } from 'react';
import { use } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Music, ArrowLeft, User, Clock, Star, Heart } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';

interface UserProfile {
  id: string;
  username: string;
  email: string;
  avatarUrl?: string;
  trustScore: number;
  followersCount: number;
  followingCount: number;
  tracksCount: number;
  likesCount: number;
  isArtist: boolean;
  badge: string;
  artistBio?: string;
  artistGenres?: string[];
  artistVerified: boolean;
  role: string;
  createdAt: string;
}

interface UserTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  genre: string;
  duration: number;
  coverArtUrl?: string;
  createdAt: string;
  likesCount: number;
  commentsCount: number;
}

interface LikedTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  genre: string;
  duration: number;
  coverArtUrl?: string;
  createdAt: string;
  likesCount: number;
  commentsCount: number;
  author: {
    id: string;
    username: string;
    avatarUrl?: string;
  };
}

export default function UserProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const unwrappedParams = use(params);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [tracks, setTracks] = useState<UserTrack[]>([]);
  const [likedTracks, setLikedTracks] = useState<LikedTrack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('tracks');
  const [isFollowing, setIsFollowing] = useState(false);
  const { user } = useAuthStore();

  useEffect(() => {
    fetchProfileAndData();
  }, []);

  const fetchProfileAndData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Fetch user profile
      const profileResponse = await fetch(`/api/social/profile/${unwrappedParams.userId}`, {
        headers
      });
      
      if (!profileResponse.ok) {
        setIsLoading(false);
        return;
      }

      const profileData = await profileResponse.json();
      setProfile(profileData.user);
      setIsFollowing(profileData.isFollowing);

      // Fetch user's tracks
      const tracksResponse = await fetch('/api/tracks');
      if (tracksResponse.ok) {
        const tracksData = await tracksResponse.json();
        const userTracks = tracksData.tracks.filter((track: any) => track.author?.id === unwrappedParams.userId);
        setTracks(userTracks);
      }

      // Fetch user's liked tracks
      const likedTracksResponse = await fetch(`/api/social/likes?userId=${unwrappedParams.userId}`, {
        headers
      });
      if (likedTracksResponse.ok) {
        const likedData = await likedTracksResponse.json();
        setLikedTracks(likedData.tracks || []);
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFollow = async () => {
    if (!user) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/social/follow', {
        method: isFollowing ? 'DELETE' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ followingId: unwrappedParams.userId }),
      });

      if (response.ok) {
        setIsFollowing(!isFollowing);
        setProfile(prev => prev ? ({
          ...prev,
          followersCount: isFollowing ? prev.followersCount - 1 : prev.followersCount + 1
        }) : null);
      }
    } catch (error) {
      console.error('Follow error:', error);
    }
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 text-center">
          <p className="text-muted-foreground mb-4">User not found</p>
          <Link href="/feed">
            <Button>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Feed
            </Button>
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg">
            <Music className="h-5 w-5" />
            P2P Music
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/feed">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Feed
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Profile Header */}
          <div className="bg-card border border-border/50 rounded-2xl p-8 mb-8 shadow-lg">
            <div className="flex items-start gap-6">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center flex-shrink-0">
                {profile.avatarUrl ? (
                  <img
                    src={profile.avatarUrl}
                    alt={profile.username}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <User className="h-12 w-12 text-primary" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h1 className="text-2xl font-bold">{profile.username}</h1>
                  {profile.artistVerified && (
                    <Star className="h-5 w-5 text-yellow-500" />
                  )}
                </div>
                <p className="text-muted-foreground mb-4">{profile.email}</p>
                <div className="flex items-center gap-6 mb-4">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Tracks</p>
                    <p className="text-lg font-bold">{profile.tracksCount}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Followers</p>
                    <p className="text-lg font-bold">{profile.followersCount}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Following</p>
                    <p className="text-lg font-bold">{profile.followingCount}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                    profile.role === 'superadmin' ? 'bg-red-100 text-red-800' :
                    profile.role === 'admin' ? 'bg-blue-100 text-blue-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {profile.role}
                  </span>
                  <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                    {profile.badge}
                  </span>
                </div>
              </div>
              {user?.id !== unwrappedParams.userId && (
                <div className="flex flex-col gap-2">
                  <Button 
                    variant={isFollowing ? 'outline' : 'default'} 
                    size="sm"
                    onClick={handleFollow}
                  >
                    {isFollowing ? 'Unfollow' : 'Follow'}
                  </Button>
                </div>
              )}
            </div>

            {/* Trust Score */}
            <div className="mt-6 p-6 bg-muted rounded-lg">
              <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
                <Star className="h-5 w-5" />
                Trust Score
              </h2>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${profile.trustScore}%` }}
                    />
                  </div>
                </div>
                <span className="text-lg font-bold">{profile.trustScore}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Trust score increases by seeding content and maintaining good connections.
              </p>
            </div>

            {/* Artist Information */}
            {profile.isArtist && (
              <div className="mt-6">
                <h3 className="font-semibold mb-2">About</h3>
                <p className="text-muted-foreground mb-4">{profile.artistBio || 'No bio available'}</p>
                {profile.artistGenres && profile.artistGenres.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {profile.artistGenres.map((genre, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 text-xs font-semibold bg-accent/50 text-accent-foreground rounded-full"
                      >
                        {genre}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Member Since */}
            <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Member since {new Date(profile.createdAt).toLocaleDateString()}</span>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-4 mb-8 border-b">
            <Button
              variant={activeTab === 'tracks' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('tracks')}
              className="rounded-t-lg rounded-b-none"
            >
              <Music className="h-4 w-4 mr-2" />
              Tracks ({tracks.length})
            </Button>
            <Button
              variant={activeTab === 'likes' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('likes')}
              className="rounded-t-lg rounded-b-none"
            >
              <Heart className="h-4 w-4 mr-2" />
              Likes ({likedTracks.length})
            </Button>
          </div>

          {/* Tab Content */}
          <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-lg">
            {activeTab === 'tracks' && (
              <div>
                <h3 className="font-semibold mb-4">{profile.username}'s Tracks</h3>
                {tracks.length === 0 ? (
                  <div className="text-center py-12">
                    <Music className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h4 className="text-lg font-semibold mb-2">No tracks uploaded yet</h4>
                    <p className="text-muted-foreground">This user hasn't uploaded any tracks yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {tracks.map((track) => (
                      <div key={track.id} className="flex items-center gap-4 p-4 rounded-lg bg-muted/30">
                        {track.coverArtUrl ? (
                          <img
                            src={track.coverArtUrl}
                            alt={track.title}
                            className="w-16 h-16 rounded object-cover"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded bg-secondary flex items-center justify-center">
                            <Music className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1">
                          <h4 className="font-semibold">{track.title}</h4>
                          <p className="text-muted-foreground text-sm">
                            {track.artist} • {track.album} • {track.genre}
                          </p>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {Math.floor(track.duration / 60)}:{(track.duration % 60).toString().padStart(2, '0')}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'likes' && (
              <div>
                <h3 className="font-semibold mb-4">{profile.username}'s Liked Tracks</h3>
                {likedTracks.length === 0 ? (
                  <div className="text-center py-12">
                    <Heart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h4 className="text-lg font-semibold mb-2">No liked tracks yet</h4>
                    <p className="text-muted-foreground">This user hasn't liked any tracks yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {likedTracks.map((track) => (
                      <div key={track.id} className="flex items-center gap-4 p-4 rounded-lg bg-muted/30">
                        {track.coverArtUrl ? (
                          <img
                            src={track.coverArtUrl}
                            alt={track.title}
                            className="w-16 h-16 rounded object-cover"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded bg-secondary flex items-center justify-center">
                            <Music className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1">
                          <h4 className="font-semibold">{track.title}</h4>
                          <p className="text-muted-foreground text-sm">
                            {track.artist} • {track.album} • {track.genre}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            by {track.author.username}
                          </p>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {Math.floor(track.duration / 60)}:{(track.duration % 60).toString().padStart(2, '0')}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
