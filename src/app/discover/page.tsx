'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { EnhancedFeedItem } from '@/components/feed/EnhancedFeedItem';
import { useAuthStore } from '@/store/useAuthStore';
import { 
  Music, 
  Search, 
  Users, 
  TrendingUp,
  Plus,
  Check,
  UserPlus,
  Sparkles,
  RefreshCw
} from 'lucide-react';

interface User {
  id: string;
  username: string;
  avatarUrl?: string;
  bio?: string;
  isArtist: boolean;
  followersCount: number;
  tracksCount: number;
  isFollowing?: boolean;
  isFollowedBy?: boolean;
}

interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  genre: string;
  duration: number;
  magnetUri?: string;
  ipfsCid?: string;
  coverArtUrl?: string;
  createdAt: string;
  author: {
    id: string;
    username: string;
    avatarUrl?: string;
  };
  likesCount: number;
  commentsCount: number;
}

export default function DiscoverPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'users' | 'tracks'>('users');
  const { user, isAuthenticated } = useAuthStore();

  useEffect(() => {
    fetchDiscoverData();
  }, []);

  const fetchDiscoverData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Fetch suggested users
      const usersResponse = await fetch('/api/onboarding/suggested-users', {
        headers
      });
      
      if (usersResponse.ok) {
        const usersData = await usersResponse.json();
        setUsers(usersData.suggestions || []);
      }

      // Fetch trending tracks
      const tracksResponse = await fetch('/api/social/trends', {
        headers
      });

      if (tracksResponse.ok) {
        const tracksData = await tracksResponse.json();
        setTracks(tracksData.tracks || []);
      }
    } catch (error) {
      console.error('Failed to fetch discover data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFollow = async (userId: string) => {
    if (!isAuthenticated) {
      alert('Please sign in to follow users');
      return;
    }

    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex === -1) return;

    const isFollowing = users[userIndex].isFollowing;
    const token = localStorage.getItem('token');

    try {
      const response = await fetch('/api/social/follow', {
        method: isFollowing ? 'DELETE' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId }),
      });

      if (response.ok) {
        setUsers(prev => prev.map(u => {
          if (u.id === userId) {
            return {
              ...u,
              isFollowing: !isFollowing,
              followersCount: isFollowing ? u.followersCount - 1 : u.followersCount + 1,
            };
          }
          return u;
        }));
      }
    } catch (error) {
      console.error('Follow error:', error);
    }
  };

  const generateAutoPlaylist = async () => {
    if (!isAuthenticated) {
      alert('Please sign in to generate personalized playlists');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/social/playlists/auto', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          includeFollowing: true,
          randomize: true,
          limit: 30,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // Store the auto-generated playlist in localStorage for the player
        localStorage.setItem('autoPlaylist', JSON.stringify(data.playlist));
        window.location.href = '/feed?playlist=auto';
      }
    } catch (error) {
      console.error('Auto playlist error:', error);
    }
  };

  const filteredUsers = users.filter(u => 
    u.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredTracks = tracks.filter(t => 
    t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.artist.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
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
              <Button variant="ghost" size="sm">Feed</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Hero Section */}
          <div className="bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 rounded-2xl p-8 mb-8">
            <h1 className="text-3xl font-bold mb-4 flex items-center gap-3">
              <Sparkles className="h-8 w-8 text-primary" />
              Discover
            </h1>
            <p className="text-muted-foreground mb-6">
              Find new music and connect with artists based on your preferences
            </p>
            
            {/* Auto Playlist Button */}
            <Button 
              onClick={generateAutoPlaylist}
              className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Generate Personalized Mix
            </Button>
          </div>

          {/* Search */}
          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              type="text"
              placeholder={`Search ${activeTab === 'users' ? 'users' : 'tracks'}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-xl border border-border bg-card focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Tabs */}
          <div className="flex gap-4 mb-6">
            <Button
              variant={activeTab === 'users' ? 'default' : 'outline'}
              onClick={() => setActiveTab('users')}
              className="flex items-center gap-2"
            >
              <Users className="h-4 w-4" />
              Users ({filteredUsers.length})
            </Button>
            <Button
              variant={activeTab === 'tracks' ? 'default' : 'outline'}
              onClick={() => setActiveTab('tracks')}
              className="flex items-center gap-2"
            >
              <Music className="h-4 w-4" />
              Tracks ({filteredTracks.length})
            </Button>
          </div>

          {/* Content */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              {filteredUsers.length === 0 ? (
                <div className="text-center py-12 bg-card rounded-xl">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No users found</h3>
                  <p className="text-muted-foreground mb-4">
                    Try adjusting your search or check back later
                  </p>
                  <Button onClick={fetchDiscoverData} variant="outline">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              ) : (
                filteredUsers.map((userData) => (
                  <div 
                    key={userData.id}
                    className="bg-card border border-border/50 rounded-xl p-4 flex items-center gap-4 hover:shadow-md transition-shadow"
                  >
                    {/* Avatar */}
                    {userData.avatarUrl ? (
                      <img
                        src={userData.avatarUrl}
                        alt={userData.username}
                        className="w-14 h-14 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                        <Users className="h-7 w-7 text-primary" />
                      </div>
                    )}

                    {/* User Info */}
                    <div className="flex-1">
                      <Link 
                        href={`/user/${userData.id}`}
                        className="font-semibold text-lg hover:text-primary transition-colors"
                      >
                        {userData.username}
                      </Link>
                      {userData.bio && (
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {userData.bio}
                        </p>
                      )}
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        <span>{userData.tracksCount} tracks</span>
                        <span>{userData.followersCount} followers</span>
                        {userData.isArtist && (
                          <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs">
                            Artist
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Follow Button */}
                    {user?.id !== userData.id && (
                      <Button
                        variant={userData.isFollowing ? 'outline' : 'default'}
                        size="sm"
                        onClick={() => handleFollow(userData.id)}
                        className={userData.isFollowing ? '' : 'bg-primary hover:bg-primary/90'}
                      >
                        {userData.isFollowing ? (
                          <>
                            <Check className="h-4 w-4 mr-1" />
                            Following
                          </>
                        ) : (
                          <>
                            <UserPlus className="h-4 w-4 mr-1" />
                            Follow
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'tracks' && (
            <div className="space-y-4">
              {filteredTracks.length === 0 ? (
                <div className="text-center py-12 bg-card rounded-xl">
                  <Music className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No tracks found</h3>
                  <p className="text-muted-foreground">
                    Try adjusting your search
                  </p>
                </div>
              ) : (
                filteredTracks.map((track) => (
                  <EnhancedFeedItem key={track.id} post={track} />
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
