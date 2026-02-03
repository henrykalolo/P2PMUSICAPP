'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  BarChart3,
  Users,
  Music,
  Heart,
  MessageCircle,
  Activity,
  Shield,
  AlertTriangle,
  CheckCircle,
  Wifi,
  Server,
  HardDrive,
  ArrowLeft,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PlatformStats {
  totalTracks: number;
  totalUsers: number;
  totalLikes: number;
  totalComments: number;
  recentActivity: {
    tracksLast7Days: number;
    usersLast7Days: number;
  };
  genres: { name: string; count: number }[];
  storageDistribution: { type: string; count: number }[];
  uploadsPerDay: { date: string; count: number }[];
}

interface PeerData {
  swarmHealth: {
    totalTorrents: number;
    healthyTorrents: number;
    unhealthyTorrents: number;
    healthPercentage: number;
    status: string;
  };
  activeTorrents: { id: string; title: string; peerCount: number; seedCount: number }[];
  needsSeeding: { id: string; title: string; peerCount: number; priority: string }[];
}

interface UserData {
  statistics: {
    totalUsers: number;
    newThisWeek: number;
    artists: number;
    badgedUsers: number;
  };
  recentRegistrations: { id: string; username: string; trustScore: number; createdAt: string }[];
  topContributors: { id: string; username: string; trustScore: number; trackCount: number }[];
}

interface ContentData {
  recentUploads: { id: string; title: string; author: { username: string }; createdAt: string }[];
  flaggedContent: { id: string; title: string; severity: string }[];
}

type TabId = 'overview' | 'network' | 'users' | 'content';

export default function AdminDashboard() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [peers, setPeers] = useState<PeerData | null>(null);
  const [users, setUsers] = useState<UserData | null>(null);
  const [content, setContent] = useState<ContentData | null>(null);

  useEffect(() => {
    checkAuthAndLoadData();
  }, []);

  const checkAuthAndLoadData = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const meResponse = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!meResponse.ok) {
        router.push('/login');
        return;
      }

      const meData = await meResponse.json();
      if (meData.user?.role !== 'superadmin') {
        router.push('/');
        return;
      }

      setIsAuthorized(true);
      await loadAllData(token);
    } catch (error) {
      console.error('Auth check failed:', error);
      router.push('/login');
    }
  };

  const loadAllData = async (token: string) => {
    setIsLoading(true);
    try {
      const [statsRes, peersRes, usersRes] = await Promise.all([
        fetch('/api/admin/stats', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/peers', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (statsRes.ok) setStats((await statsRes.json()).stats);
      if (peersRes.ok) setPeers((await peersRes.json()).peers);
      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers(data.users);
        setContent(data.content);
      }
    } catch (error) {
      console.error('Failed to load admin data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-500';
      case 'degraded': return 'text-yellow-500';
      default: return 'text-red-500';
    }
  };

  if (!isAuthorized || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span>Loading admin dashboard...</span>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'overview' as TabId, label: 'Overview', icon: BarChart3 },
    { id: 'network' as TabId, label: 'Network', icon: Wifi },
    { id: 'users' as TabId, label: 'Users', icon: Users },
    { id: 'content' as TabId, label: 'Content', icon: Shield },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <span className="font-semibold">Admin</span>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => loadAllData(localStorage.getItem('token') || '')}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b bg-muted/30">
        <div className="container mx-auto px-4">
          <nav className="flex gap-1 -mb-px overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Overview Tab */}
        {activeTab === 'overview' && stats && (
          <div className="space-y-8">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-card border rounded-xl p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Music className="h-4 w-4" />
                  <span className="text-xs">Tracks</span>
                </div>
                <p className="text-2xl font-bold">{formatNumber(stats.totalTracks)}</p>
                <p className="text-xs text-green-500">+{stats.recentActivity.tracksLast7Days} this week</p>
              </div>
              <div className="bg-card border rounded-xl p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Users className="h-4 w-4" />
                  <span className="text-xs">Users</span>
                </div>
                <p className="text-2xl font-bold">{formatNumber(stats.totalUsers)}</p>
                <p className="text-xs text-green-500">+{stats.recentActivity.usersLast7Days} this week</p>
              </div>
              <div className="bg-card border rounded-xl p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Heart className="h-4 w-4" />
                  <span className="text-xs">Likes</span>
                </div>
                <p className="text-2xl font-bold">{formatNumber(stats.totalLikes)}</p>
              </div>
              <div className="bg-card border rounded-xl p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <MessageCircle className="h-4 w-4" />
                  <span className="text-xs">Comments</span>
                </div>
                <p className="text-2xl font-bold">{formatNumber(stats.totalComments)}</p>
              </div>
            </div>

            {/* Charts Row */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Genres */}
              <div className="bg-card border rounded-xl p-6">
                <h3 className="font-semibold mb-4">Top Genres</h3>
                <div className="space-y-3">
                  {stats.genres.slice(0, 6).map((genre, i) => {
                    const max = stats.genres[0]?.count || 1;
                    const colors = ['bg-primary', 'bg-blue-500', 'bg-green-500', 'bg-orange-500', 'bg-purple-500', 'bg-pink-500'];
                    return (
                      <div key={genre.name} className="flex items-center gap-3">
                        <span className="text-sm w-24 truncate">{genre.name}</span>
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full ${colors[i % colors.length]} rounded-full`} style={{ width: `${(genre.count / max) * 100}%` }} />
                        </div>
                        <span className="text-sm text-muted-foreground w-8 text-right">{genre.count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Storage */}
              <div className="bg-card border rounded-xl p-6">
                <h3 className="font-semibold mb-4">Storage Distribution</h3>
                <div className="space-y-4">
                  {stats.storageDistribution.map((s) => {
                    const total = stats.storageDistribution.reduce((sum, x) => sum + x.count, 0);
                    const pct = total > 0 ? Math.round((s.count / total) * 100) : 0;
                    return (
                      <div key={s.type} className="flex items-center gap-3">
                        <HardDrive className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm capitalize w-16">{s.type}</span>
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full bg-primary rounded-full`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-sm font-medium">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Network Tab */}
        {activeTab === 'network' && peers && (
          <div className="space-y-8">
            {/* Swarm Health */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-card border rounded-xl p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Server className="h-4 w-4" />
                  <span className="text-xs">Total Torrents</span>
                </div>
                <p className="text-2xl font-bold">{peers.swarmHealth.totalTorrents}</p>
              </div>
              <div className="bg-card border rounded-xl p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-xs">Healthy</span>
                </div>
                <p className="text-2xl font-bold">{peers.swarmHealth.healthyTorrents}</p>
              </div>
              <div className="bg-card border rounded-xl p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  <span className="text-xs">Needs Seeding</span>
                </div>
                <p className="text-2xl font-bold">{peers.swarmHealth.unhealthyTorrents}</p>
              </div>
              <div className="bg-card border rounded-xl p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Activity className={`h-4 w-4 ${getHealthColor(peers.swarmHealth.status)}`} />
                  <span className="text-xs">Health</span>
                </div>
                <p className="text-2xl font-bold">{peers.swarmHealth.healthPercentage}%</p>
              </div>
            </div>

            {/* Active Swarms */}
            <div className="bg-card border rounded-xl p-6">
              <h3 className="font-semibold mb-4">Most Active Swarms</h3>
              <div className="space-y-3">
                {peers.activeTorrents.slice(0, 5).map((torrent) => (
                  <div key={torrent.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div>
                      <p className="font-medium truncate max-w-md">{torrent.title}</p>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" /> {torrent.peerCount}
                        </span>
                        <span className="flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" /> {torrent.seedCount} seeds
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && users && (
          <div className="space-y-8">
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-card border rounded-xl p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Users className="h-4 w-4" />
                  <span className="text-xs">Total Users</span>
                </div>
                <p className="text-2xl font-bold">{formatNumber(users.statistics.totalUsers)}</p>
              </div>
              <div className="bg-card border rounded-xl p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  <span className="text-xs">New This Week</span>
                </div>
                <p className="text-2xl font-bold">+{users.statistics.newThisWeek}</p>
              </div>
              <div className="bg-card border rounded-xl p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Music className="h-4 w-4" />
                  <span className="text-xs">Artists</span>
                </div>
                <p className="text-2xl font-bold">{formatNumber(users.statistics.artists)}</p>
              </div>
              <div className="bg-card border rounded-xl p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Shield className="h-4 w-4 text-purple-500" />
                  <span className="text-xs">Badged Users</span>
                </div>
                <p className="text-2xl font-bold">{formatNumber(users.statistics.badgedUsers)}</p>
              </div>
            </div>

            {/* Top Contributors */}
            <div className="bg-card border rounded-xl p-6">
              <h3 className="font-semibold mb-4">Top Contributors</h3>
              <div className="space-y-3">
                {users.topContributors.slice(0, 5).map((user, i) => (
                  <div key={user.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 flex items-center justify-center text-sm font-medium text-muted-foreground">
                        #{i + 1}
                      </span>
                      <div>
                        <p className="font-medium">{user.username}</p>
                        <p className="text-sm text-muted-foreground">{user.trackCount} tracks</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">Trust: {user.trustScore}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Content Tab */}
        {activeTab === 'content' && content && (
          <div className="space-y-8">
            {/* Flagged Content */}
            <div className="bg-card border rounded-xl p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                Flagged Content ({content.flaggedContent.length})
              </h3>
              {content.flaggedContent.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No flagged content</p>
              ) : (
                <div className="space-y-3">
                  {content.flaggedContent.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div>
                        <p className="font-medium">{item.title}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          item.severity === 'high' ? 'bg-red-100 text-red-700' :
                          item.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {item.severity}
                        </span>
                      </div>
                      <Button variant="outline" size="sm">Review</Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Uploads */}
            <div className="bg-card border rounded-xl p-6">
              <h3 className="font-semibold mb-4">Recent Uploads</h3>
              <div className="space-y-3">
                {content.recentUploads.slice(0, 5).map((upload) => (
                  <div key={upload.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div>
                      <p className="font-medium">{upload.title}</p>
                      <p className="text-sm text-muted-foreground">by {upload.author.username}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
