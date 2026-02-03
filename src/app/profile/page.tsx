'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Music, ArrowLeft, User, LogOut, Upload, Edit, Settings, Activity, Clock, Star, Pen, Sliders, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { useTrustScore } from '@/hooks/useTrustScore';
import { SwarmPanel } from '@/components/swarm/SwarmPanel';

interface UserProfile {
  id: string;
  username: string;
  email: string;
  avatarUrl?: string;
  trustScore: number;
  followersCount: number;
  followingCount: number;
  tracksCount: number;
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

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [tracks, setTracks] = useState<UserTrack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('tracks');
  const [following, setFollowing] = useState<any[]>([]);
  const [followers, setFollowers] = useState<any[]>([]);
  const [isFollowingLoading, setIsFollowingLoading] = useState(false);
  const [isFollowersLoading, setIsFollowersLoading] = useState(false);
  const { user, setUser, setAuthenticated } = useAuthStore();
  const router = useRouter();
  const { data: trustScoreData, isLoading: isTrustScoreLoading, refetch: refetchTrustScore } = useTrustScore();
  const [showTrustDetails, setShowTrustDetails] = useState(false);

  useEffect(() => {
    fetchProfileAndTracks();
  }, []);

  const fetchProfileAndTracks = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setIsLoading(false);
        return;
      }

      // Fetch user profile
      const profileResponse = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!profileResponse.ok) {
        localStorage.removeItem('token');
        setAuthenticated(false);
        setUser(null);
        setIsLoading(false);
        return;
      }

      const profileData = await profileResponse.json();
      setProfile(profileData.user);

      // Fetch user's tracks
      const tracksResponse = await fetch('/api/tracks');
      if (tracksResponse.ok) {
        const tracksData = await tracksResponse.json();
        const userTracks = tracksData.tracks.filter((track: any) => track.author?.id === profileData.user.id);
        setTracks(userTracks);
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setAuthenticated(false);
    router.push('/');
  };

  // Helper function to format bytes
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const fetchFollowing = async () => {
    setIsFollowingLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/social/following', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setFollowing(data.users || []);
      }
    } catch (error) {
      console.error('Failed to fetch following:', error);
    } finally {
      setIsFollowingLoading(false);
    }
  };

  const fetchFollowers = async () => {
    setIsFollowersLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/social/followers', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setFollowers(data.users || []);
      }
    } catch (error) {
      console.error('Failed to fetch followers:', error);
    } finally {
      setIsFollowersLoading(false);
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
          <p className="text-muted-foreground mb-4">You need to be logged in to view your profile</p>
          <Link href="/login">
            <Button>Sign In</Button>
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
          <div className="bg-card border border-border/50 rounded-2xl p-8 mb-8 shadow-lg relative overflow-hidden">
            {/* Decorative gradient background */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-primary/5 to-accent/5 rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none" />
            
            <div className="flex flex-col md:flex-row items-start gap-6 relative z-10">
              {/* Avatar with status indicator */}
              <div className="relative">
                <div className="w-28 h-28 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center flex-shrink-0 ring-4 ring-background shadow-lg">
                  {profile.avatarUrl ? (
                    <img
                      src={profile.avatarUrl}
                      alt={profile.username}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <User className="h-14 w-14 text-primary" />
                  )}
                </div>
                {/* Online/Status indicator */}
                <div className="absolute bottom-2 right-2 w-5 h-5 bg-green-500 rounded-full border-4 border-background" title="Online" />
              </div>
              
              {/* Profile Info */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-col md:flex-row md:items-center gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <h1 className="text-3xl font-bold truncate">{profile.username}</h1>
                    {profile.artistVerified && (
                      <Star className="h-6 w-6 text-yellow-500" fill="currentColor" />
                    )}
                  </div>
                  {/* Role & Badge */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${
                      profile.role === 'superadmin' ? 'bg-red-50 text-red-700 border-red-200' :
                      profile.role === 'admin' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                      'bg-green-50 text-green-700 border-green-200'
                    }`}>
                      {profile.role}
                    </span>
                    <span className="px-3 py-1 text-xs font-semibold rounded-full bg-gradient-to-r from-violet-100 to-purple-100 text-violet-700 border border-violet-200">
                      {profile.badge}
                    </span>
                  </div>
                </div>
                
                <p className="text-muted-foreground mb-4 truncate">{profile.email}</p>
                
                {/* Stats Row */}
                <div className="flex items-center gap-8 mb-4">
                  <div className="text-center group cursor-pointer">
                    <p className="text-2xl font-bold group-hover:text-primary transition-colors">{profile.tracksCount}</p>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Tracks</p>
                  </div>
                  <div className="w-px h-10 bg-border" />
                  <div className="text-center group cursor-pointer">
                    <p className="text-2xl font-bold group-hover:text-primary transition-colors">{profile.followersCount}</p>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Followers</p>
                  </div>
                  <div className="w-px h-10 bg-border" />
                  <div className="text-center group cursor-pointer">
                    <p className="text-2xl font-bold group-hover:text-primary transition-colors">{profile.followingCount}</p>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Following</p>
                  </div>
                </div>
                
                {/* Member since */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>Member since {new Date(profile.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
              
              {/* Action Buttons - Redesigned */}
              <div className="flex flex-row md:flex-col gap-3 w-full md:w-auto">
                <Link href="/profile/settings" className="flex-1 md:flex-none">
                  <Button 
                    variant="default" 
                    size="lg" 
                    className="w-full md:w-48 h-12 rounded-xl bg-gradient-to-r from-primary to-violet-600 hover:from-primary/90 hover:to-violet-600/90 shadow-md hover:shadow-lg transition-all duration-300"
                  >
                    <Pen className="h-5 w-5 mr-2" />
                    <span className="font-semibold">Edit Profile</span>
                  </Button>
                </Link>
                <Link href="/profile/settings" className="flex-1 md:flex-none">
                  <Button 
                    variant="outline" 
                    size="lg" 
                    className="w-full md:w-48 h-12 rounded-xl border-2 hover:bg-accent/50 transition-all duration-300"
                  >
                    <Sliders className="h-5 w-5 mr-2" />
                    <span className="font-semibold">Settings</span>
                  </Button>
                </Link>
              </div>
            </div>

            {/* Trust Score - Redesigned */}
            <div className="mt-8 p-5 bg-gradient-to-r from-muted/50 to-muted rounded-xl border">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Activity className="h-5 w-5 text-primary" />
                  </div>
                  Trust Score
                </h2>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold bg-gradient-to-r from-primary to-violet-600 bg-clip-text text-transparent">
                      {trustScoreData?.trustScore || profile.trustScore || 0}
                    </span>
                    <span className="text-muted-foreground">/ 100</span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setShowTrustDetails(!showTrustDetails)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {showTrustDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="relative">
                <div className="h-3 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary via-violet-500 to-accent rounded-full transition-all duration-500 shadow-sm"
                    style={{ width: `${trustScoreData?.trustScore || profile.trustScore || 0}%` }}
                  />
                </div>
                {/* Trust score markers */}
                <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                  <span>Newcomer</span>
                  <span>Regular</span>
                  <span>Trusted</span>
                  <span>Verified</span>
                </div>
              </div>
              
              {/* Trust Score Details - Expandable */}
              {showTrustDetails && (
                <div className="mt-4 pt-4 border-t space-y-3 animate-in slide-in-from-top-2 duration-200">
                  {isTrustScoreLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                    </div>
                  ) : trustScoreData?.breakdown ? (
                    <>
                      {/* Upload Ratio */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Upload Ratio</span>
                          <span className="font-medium">{trustScoreData.breakdown.uploadRatio.value}</span>
                        </div>
                        <div className="h-2 bg-secondary rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-500 rounded-full transition-all duration-500"
                            style={{ width: `${trustScoreData.breakdown.uploadRatio.score}%` }}
                          />
                        </div>
                      </div>
                      
                      {/* Connection Stability */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Session Duration</span>
                          <span className="font-medium">{trustScoreData.breakdown.connectionStability.value}</span>
                        </div>
                        <div className="h-2 bg-secondary rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-green-500 rounded-full transition-all duration-500"
                            style={{ width: `${trustScoreData.breakdown.connectionStability.score}%` }}
                          />
                        </div>
                      </div>
                      
                      {/* Content Integrity */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Hash Verification</span>
                          <span className="font-medium">{trustScoreData.breakdown.contentIntegrity.value}</span>
                        </div>
                        <div className="h-2 bg-secondary rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-violet-500 rounded-full transition-all duration-500"
                            style={{ width: `${trustScoreData.breakdown.contentIntegrity.score}%` }}
                          />
                        </div>
                      </div>
                      
                      {/* Social Verification */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Mutual Connections</span>
                          <span className="font-medium">{trustScoreData.breakdown.socialVerification.value}</span>
                        </div>
                        <div className="h-2 bg-secondary rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-orange-500 rounded-full transition-all duration-500"
                            style={{ width: `${trustScoreData.breakdown.socialVerification.score}%` }}
                          />
                        </div>
                      </div>
                      
                      {/* Stats */}
                      <div className="flex gap-4 pt-2 text-xs text-muted-foreground">
                        <span>↑ {formatBytes(trustScoreData.stats.totalUploaded)}</span>
                        <span>↓ {formatBytes(trustScoreData.stats.totalDownloaded)}</span>
                        <span>✓ {trustScoreData.stats.successfulVerifications}/{trustScoreData.stats.totalVerifications} verifications</span>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground text-sm">
                      <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Trust score details will appear as you interact with the network</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Artist Information */}
            {profile.isArtist && (
              <div className="mt-6 p-5 bg-gradient-to-r from-accent/10 to-primary/10 rounded-xl border">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 rounded-lg bg-accent/20">
                    <User className="h-5 w-5 text-accent" />
                  </div>
                  <h3 className="font-semibold">Artist Profile</h3>
                </div>
                <p className="text-muted-foreground mb-4 leading-relaxed">{profile.artistBio || 'No bio available'}</p>
                {profile.artistGenres && profile.artistGenres.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {profile.artistGenres.map((genre, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 text-sm font-medium bg-background/80 backdrop-blur-sm border rounded-full text-foreground shadow-sm"
                      >
                        {genre}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Quick Actions */}
            <div className="mt-6 flex items-center gap-3 text-sm text-muted-foreground">
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
              My Tracks ({tracks.length})
            </Button>
            <Button
              variant={activeTab === 'following' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => {
                setActiveTab('following');
                if (following.length === 0) fetchFollowing();
              }}
              className="rounded-t-lg rounded-b-none"
            >
              <User className="h-4 w-4 mr-2" />
              Following ({profile.followingCount})
            </Button>
            <Button
              variant={activeTab === 'followers' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => {
                setActiveTab('followers');
                if (followers.length === 0) fetchFollowers();
              }}
              className="rounded-t-lg rounded-b-none"
            >
              <User className="h-4 w-4 mr-2" />
              Followers ({profile.followersCount})
            </Button>
          </div>

          {/* Tab Content */}
          <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-lg">
            {activeTab === 'tracks' && (
              <div>
                <h3 className="font-semibold mb-4">Your Tracks</h3>
                {tracks.length === 0 ? (
                  <div className="text-center py-12">
                    <Music className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h4 className="text-lg font-semibold mb-2">No tracks uploaded yet</h4>
                    <p className="text-muted-foreground mb-4">Start sharing your music with the world</p>
                    <Link href="/upload">
                      <Button>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Music
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {tracks.map((track) => (
                      <div
                        key={track.id}
                        className="flex items-center gap-4 p-4 rounded-lg hover:bg-accent/50 transition-colors"
                      >
                        <div className="w-16 h-16 rounded bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                          {track.coverArtUrl ? (
                            <img
                              src={track.coverArtUrl}
                              alt={track.title}
                              className="w-full h-full rounded object-cover"
                            />
                          ) : (
                            <Music className="h-8 w-8 text-primary" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium truncate">{track.title}</h4>
                          <p className="text-sm text-muted-foreground truncate">{track.artist}</p>
                          <p className="text-xs text-muted-foreground">{track.album} • {track.genre}</p>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Star className="h-4 w-4" />
                            <span>{track.likesCount}</span>
                          </div>
                          <div className="text-xs mt-1">{track.commentsCount} comments</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'following' && (
              <div>
                <h3 className="font-semibold mb-4">Following ({following.length})</h3>
                {isFollowingLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  </div>
                ) : following.length === 0 ? (
                  <div className="text-center py-12">
                    <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h4 className="text-lg font-semibold mb-2">Not following anyone yet</h4>
                    <p className="text-muted-foreground mb-4">Start following artists to see them here</p>
                    <Link href="/feed">
                      <Button>Discover Music</Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {following.map((followedUser) => (
                      <Link
                        key={followedUser.id}
                        href={`/user/${followedUser.id}`}
                        className="flex items-center gap-4 p-4 rounded-lg hover:bg-accent/50 transition-colors"
                      >
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                          {followedUser.avatarUrl ? (
                            <img
                              src={followedUser.avatarUrl}
                              alt={followedUser.username}
                              className="w-full h-full rounded-full object-cover"
                            />
                          ) : (
                            <User className="h-6 w-6 text-primary" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium truncate">{followedUser.username}</h4>
                          <p className="text-sm text-muted-foreground truncate">
                            {followedUser.isArtist ? 'Artist' : 'User'}
                          </p>
                        </div>
                        <Button variant="ghost" size="sm">
                          View
                        </Button>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'followers' && (
              <div>
                <h3 className="font-semibold mb-4">Followers ({followers.length})</h3>
                {isFollowersLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  </div>
                ) : followers.length === 0 ? (
                  <div className="text-center py-12">
                    <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h4 className="text-lg font-semibold mb-2">No followers yet</h4>
                    <p className="text-muted-foreground mb-4">Share your music to get followers</p>
                    <Link href="/upload">
                      <Button>Upload Music</Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {followers.map((follower) => (
                      <Link
                        key={follower.id}
                        href={`/user/${follower.id}`}
                        className="flex items-center gap-4 p-4 rounded-lg hover:bg-accent/50 transition-colors"
                      >
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                          {follower.avatarUrl ? (
                            <img
                              src={follower.avatarUrl}
                              alt={follower.username}
                              className="w-full h-full rounded-full object-cover"
                            />
                          ) : (
                            <User className="h-6 w-6 text-primary" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium truncate">{follower.username}</h4>
                          <p className="text-sm text-muted-foreground truncate">
                            {follower.isArtist ? 'Artist' : 'User'}
                          </p>
                        </div>
                        <Button variant="ghost" size="sm">
                          View
                        </Button>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link href="/upload">
              <Button variant="outline" className="w-full justify-start">
                <Upload className="h-4 w-4 mr-2" />
                Upload Music
              </Button>
            </Link>
            <Link href="/feed">
              <Button variant="outline" className="w-full justify-start">
                <Music className="h-4 w-4 mr-2" />
                View Feed
              </Button>
            </Link>
          </div>

          {/* Swarm Panel */}
          <div className="mt-8 pt-8 border-t">
            <SwarmPanel compact={true} />
          </div>

          {/* Logout */}
          <div className="mt-8 pt-8 border-t">
            <Button variant="destructive" onClick={handleLogout} className="w-full">
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
