'use client';

import { useEffect, useState } from 'react';
import { use } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { EnhancedFeedItem } from '@/components/feed/EnhancedFeedItem';
import { RepostItem } from '@/components/feed/RepostItem';
import { useAuthStore } from '@/store/useAuthStore';
import { 
  Music, 
  ArrowLeft, 
  User, 
  Clock, 
  Star, 
  Heart,
  Users,
  Repeat,
  Check,
  UserPlus
} from 'lucide-react';

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
  repostsCount: number;
  isArtist: boolean;
  badge: string;
  artistBio?: string;
  artistGenres?: string[];
  artistVerified: boolean;
  role: string;
  createdAt: string;
  isFollowing?: boolean;
  isFollowedBy?: boolean;
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
  repostsCount?: number;
  author: {
    id: string;
    username: string;
    avatarUrl?: string;
  };
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

interface FollowUser {
  id: string;
  username: string;
  avatarUrl?: string;
  trustScore: number;
  isArtist: boolean;
  isFollowing?: boolean;
}

interface Repost {
  id: string;
  userId: string;
  postId: string;
  caption: string | null;
  createdAt: string;
  reposter: {
    id: string;
    username: string;
    avatarUrl?: string;
    badge: string;
  };
  originalPost: {
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
    likesCount: number;
    commentsCount: number;
    repostsCount: number;
    author: {
      id: string;
      username: string;
      avatarUrl?: string;
      badge: string;
    };
  };
}

type TabType = 'tracks' | 'likes' | 'reposts' | 'followers' | 'following';

export default function UserProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const unwrappedParams = use(params);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [tracks, setTracks] = useState<UserTrack[]>([]);
  const [likedTracks, setLikedTracks] = useState<LikedTrack[]>([]);
  const [reposts, setReposts] = useState<Repost[]>([]);
  const [followers, setFollowers] = useState<FollowUser[]>([]);
  const [following, setFollowing] = useState<FollowUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('tracks');
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowedBy, setIsFollowedBy] = useState(false);
  const [isProcessingFollow, setIsProcessingFollow] = useState(false);
  const { user } = useAuthStore();

  useEffect(() => {
    fetchProfileAndData();
  }, [unwrappedParams.userId]);

  const fetchProfileAndData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Fetch user profile with follow status
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
      setIsFollowedBy(profileData.isFollowedBy || false);

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

      // Fetch user's reposts
      const repostsResponse = await fetch(`/api/social/reposts?userId=${unwrappedParams.userId}`, {
        headers
      });
      if (repostsResponse.ok) {
        const repostsData = await repostsResponse.json();
        setReposts(repostsData.reposts || []);
      }

      // Fetch followers
      const followersResponse = await fetch(`/api/social/followers/${unwrappedParams.userId}`, {
        headers
      });
      if (followersResponse.ok) {
        const followersData = await followersResponse.json();
        setFollowers(followersData.users || []);
      }

      // Fetch following
      const followingResponse = await fetch(`/api/social/following/${unwrappedParams.userId}`, {
        headers
      });
      if (followingResponse.ok) {
        const followingData = await followingResponse.json();
        setFollowing(followingData.users || []);
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFollow = async () => {
    if (!user || isProcessingFollow) return;

    setIsProcessingFollow(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/social/follow', {
        method: isFollowing ? 'DELETE' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId: unwrappedParams.userId }),
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
    } finally {
      setIsProcessingFollow(false);
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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

  const tabs: { id: TabType; label: string; icon: any; count: number }[] = [
    { id: 'tracks', label: 'Tracks', icon: Music, count: tracks.length },
    { id: 'likes', label: 'Likes', icon: Heart, count: likedTracks.length },
    { id: 'reposts', label: 'Reposts', icon: Repeat, count: reposts.length },
    { id: 'followers', label: 'Followers', icon: Users, count: profile.followersCount },
    { id: 'following', label: 'Following', icon: UserPlus, count: profile.followingCount },
  ];

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/feed">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Back</span>
              </Button>
            </Link>
            <Link href="/" className="flex items-center gap-2 font-bold text-lg">
              <Music className="h-5 w-5" />
              <span className="hidden xs:inline">P2P Music</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Profile Header */}
          <div className="bg-card border border-border/50 rounded-2xl p-6 mb-6 shadow-lg">
            <div className="flex flex-col sm:flex-row items-start gap-6">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center flex-shrink-0 mx-auto sm:mx-0">
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
              
              <div className="flex-1 w-full">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-4">
                  <div className="text-center sm:text-left">
                    <div className="flex items-center gap-2 justify-center sm:justify-start">
                      <h1 className="text-2xl font-bold">{profile.username}</h1>
                      {profile.artistVerified && (
                        <Star className="h-5 w-5 text-yellow-500" />
                      )}
                    </div>
                    <p className="text-muted-foreground">{profile.email}</p>
                  </div>

                  {/* Follow Button */}
                  {user?.id !== unwrappedParams.userId && (
                    <div className="flex flex-col gap-2 sm:ml-auto">
                      <Button 
                        variant={isFollowing ? 'outline' : 'default'} 
                        size="sm"
                        onClick={handleFollow}
                        disabled={isProcessingFollow}
                        className={isFollowing ? '' : 'bg-primary hover:bg-primary/90'}
                      >
                        {isProcessingFollow ? (
                          <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : isFollowing ? (
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
                      
                      {/* Mutual follow indicator */}
                      {isFollowedBy && isFollowing && (
                        <p className="text-xs text-muted-foreground text-center">
                          Follows you back
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Stats */}
                <div className="flex justify-center sm:justify-start gap-6 mb-4">
                  <button onClick={() => setActiveTab('tracks')} className="text-center hover:text-primary transition-colors">
                    <p className="text-lg font-bold">{profile.tracksCount}</p>
                    <p className="text-xs text-muted-foreground">Tracks</p>
                  </button>
                  <button onClick={() => setActiveTab('followers')} className="text-center hover:text-primary transition-colors">
                    <p className="text-lg font-bold">{profile.followersCount}</p>
                    <p className="text-xs text-muted-foreground">Followers</p>
                  </button>
                  <button onClick={() => setActiveTab('following')} className="text-center hover:text-primary transition-colors">
                    <p className="text-lg font-bold">{profile.followingCount}</p>
                    <p className="text-xs text-muted-foreground">Following</p>
                  </button>
                </div>

                {/* Badges */}
                <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
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
                  {profile.isArtist && (
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                      Artist
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Trust Score */}
            <div className="mt-6 p-4 bg-muted rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold flex items-center gap-2">
                  <Star className="h-4 w-4" />
                  Trust Score
                </h3>
                <span className="font-bold">{profile.trustScore}</span>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${profile.trustScore}%` }}
                />
              </div>
            </div>

            {/* Artist Information */}
            {profile.isArtist && profile.artistBio && (
              <div className="mt-4">
                <h4 className="font-semibold mb-2">About</h4>
                <p className="text-muted-foreground text-sm">{profile.artistBio}</p>
                {profile.artistGenres && profile.artistGenres.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
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
            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Member since {new Date(profile.createdAt).toLocaleDateString()}</span>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <Button
                  key={tab.id}
                  variant={activeTab === tab.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveTab(tab.id)}
                  className="flex items-center gap-2 whitespace-nowrap"
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                  <span className="text-xs opacity-70">({tab.count})</span>
                </Button>
              );
            })}
          </div>

          {/* Tab Content */}
          <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-lg">
            {activeTab === 'tracks' && (
              <div>
                <h3 className="font-semibold mb-4">{profile.username}'s Tracks</h3>
                {tracks.length === 0 ? (
                  <EmptyState icon={Music} title="No tracks uploaded" message="This user hasn't uploaded any tracks yet" />
                ) : (
                  <div className="space-y-4">
                    {tracks.map((track) => (
                      <EnhancedFeedItem key={track.id} post={track} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'likes' && (
              <div>
                <h3 className="font-semibold mb-4">{profile.username}'s Liked Tracks</h3>
                {likedTracks.length === 0 ? (
                  <EmptyState icon={Heart} title="No liked tracks" message="This user hasn't liked any tracks yet" />
                ) : (
                  <div className="space-y-4">
                    {likedTracks.map((track) => (
                      <EnhancedFeedItem key={track.id} post={track} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'reposts' && (
              <div>
                <h3 className="font-semibold mb-4">{profile.username}'s Reposts</h3>
                {reposts.length === 0 ? (
                  <EmptyState icon={Repeat} title="No reposts" message="This user hasn't reposted any tracks yet" />
                ) : (
                  <div className="space-y-4">
                    {reposts.map((repost) => (
                      <RepostItem key={repost.id} repost={repost} currentUserId={user?.id} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'followers' && (
              <div>
                <h3 className="font-semibold mb-4">{profile.username}'s Followers</h3>
                {followers.length === 0 ? (
                  <EmptyState icon={Users} title="No followers" message="This user doesn't have any followers yet" />
                ) : (
                  <div className="space-y-3">
                    {followers.map((follower) => (
                      <FollowerItem 
                        key={follower.id} 
                        user={follower} 
                        currentUserId={user?.id}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'following' && (
              <div>
                <h3 className="font-semibold mb-4">{profile.username} is Following</h3>
                {following.length === 0 ? (
                  <EmptyState icon={UserPlus} title="Not following anyone" message="This user hasn't followed anyone yet" />
                ) : (
                  <div className="space-y-3">
                    {following.map((followedUser) => (
                      <FollowerItem 
                        key={followedUser.id} 
                        user={followedUser} 
                        currentUserId={user?.id}
                      />
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

// Empty State Component
function EmptyState({ icon: Icon, title, message }: { icon: any; title: string; message: string }) {
  return (
    <div className="text-center py-12">
      <Icon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
      <h4 className="text-lg font-semibold mb-2">{title}</h4>
      <p className="text-muted-foreground">{message}</p>
    </div>
  );
}

// Follower/Following Item Component
function FollowerItem({ user, currentUserId }: { user: FollowUser; currentUserId?: string }) {
  const [isFollowing, setIsFollowing] = useState(user.isFollowing || false);
  const [isLoading, setIsLoading] = useState(false);

  const handleFollow = async () => {
    if (!currentUserId || isLoading) return;

    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/social/follow', {
        method: isFollowing ? 'DELETE' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId: user.id }),
      });

      if (response.ok) {
        setIsFollowing(!isFollowing);
      }
    } catch (error) {
      console.error('Follow error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
      {user.avatarUrl ? (
        <img
          src={user.avatarUrl}
          alt={user.username}
          className="w-12 h-12 rounded-full object-cover"
        />
      ) : (
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
          <User className="h-6 w-6 text-primary" />
        </div>
      )}
      
      <div className="flex-1 min-w-0">
        <Link 
          href={`/user/${user.id}`}
          className="font-semibold hover:text-primary transition-colors"
        >
          {user.username}
        </Link>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {user.isArtist && (
            <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs">
              Artist
            </span>
          )}
          <span>Trust: {user.trustScore}</span>
        </div>
      </div>

      {currentUserId !== user.id && (
        <Button
          variant={isFollowing ? 'outline' : 'default'}
          size="sm"
          onClick={handleFollow}
          disabled={isLoading}
          className={isFollowing ? '' : 'bg-primary hover:bg-primary/90'}
        >
          {isFollowing ? (
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
  );
}
