'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
  XCircle,
  TrendingUp,
  HardDrive,
  Wifi,
  UserCheck,
  Award,
  Clock,
  FileAudio,
  Flag,
  Server,
  Upload,
  Download,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// Types
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
  activeTorrents: {
    id: string;
    title: string;
    artist: string;
    genre: string;
    peerCount: number;
    seedCount: number;
    leechCount: number;
    authorUsername: string;
    createdAt: string;
  }[];
  needsSeeding: {
    id: string;
    title: string;
    artist: string;
    peerCount: number;
    priority: string;
    authorUsername: string;
  }[];
  topSeeded: {
    id: string;
    title: string;
    artist: string;
    peerCount: number;
    seedCount: number;
    uploadRatio: number;
  }[];
  ipfsOnly: {
    id: string;
    title: string;
    artist: string;
    ipfsCid: string;
    authorUsername: string;
  }[];
  swarmHealth: {
    totalTorrents: number;
    healthyTorrents: number;
    unhealthyTorrents: number;
    healthPercentage: number;
    status: string;
  };
}

interface UserData {
  recentRegistrations: {
    id: string;
    username: string;
    email: string;
    avatarUrl: string;
    badge: string;
    trustScore: number;
    createdAt: string;
    onboardingCompleted?: boolean;
  }[];
  withBadges: {
    id: string;
    username: string;
    badge: string;
    trustScore: number;
    trackCount: number;
  }[];
  topContributors: {
    id: string;
    username: string;
    badge: string;
    trustScore: number;
    uploadRatio: number;
    trackCount: number;
    totalLikesReceived: number;
  }[];
  statistics: {
    totalUsers: number;
    newThisWeek: number;
    newThisMonth: number;
    completedOnboarding: number;
    artists: number;
    canUpload: number;
    badgedUsers: number;
  };
}

interface ContentData {
  recentUploads: {
    id: string;
    title: string;
    artist: string;
    genre: string;
    storageType: string;
    createdAt: string;
    author: {
      id: string;
      username: string;
      avatarUrl: string;
      trustScore: number;
    };
    likeCount: number;
    commentCount: number;
  }[];
  flaggedContent: {
    id: string;
    title: string;
    artist: string;
    author: {
      id: string;
      username: string;
      trustScore: number;
      badge: string;
    };
    likeCount: number;
    flagReason: string;
    severity: string;
  }[];
}

// Progress Bar Component
function ProgressBar({ 
  value, 
  max = 100, 
  color = 'bg-blue-500',
  size = 'md'
}: { 
  value: number; 
  max?: number; 
  color?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  const heightClass = size === 'sm' ? 'h-1.5' : size === 'lg' ? 'h-3' : 'h-2';
  
  return (
    <div className={`w-full ${heightClass} bg-gray-700 rounded-full overflow-hidden`}>
      <div 
        className={`${heightClass} ${color} rounded-full transition-all duration-300`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

// Stat Card Component
function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  trend, 
  trendUp,
  color = 'blue'
}: { 
  title: string; 
  value: string | number; 
  icon: React.ElementType;
  trend?: string;
  trendUp?: boolean;
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red';
}) {
  const colorClasses = {
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    green: 'bg-green-500/10 text-green-400 border-green-500/20',
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    orange: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    red: 'bg-red-500/10 text-red-400 border-red-500/20',
  };

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 hover:bg-gray-800/70 transition-colors">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-400 text-sm font-medium">{title}</p>
          <p className="text-2xl font-bold text-white mt-2">{value}</p>
          {trend && (
            <p className={`text-sm mt-1 ${trendUp ? 'text-green-400' : 'text-red-400'}`}>
              {trendUp ? '↑' : '↓'} {trend}
            </p>
          )}
        </div>
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}

// Section Header Component
function SectionHeader({ 
  title, 
  icon: Icon, 
  action
}: { 
  title: string; 
  icon: React.ElementType;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <Icon className="w-5 h-5 text-gray-400" />
        <h2 className="text-lg font-semibold text-white">{title}</h2>
      </div>
      {action}
    </div>
  );
}

// Badge Component
function Badge({ 
  children, 
  variant = 'default' 
}: { 
  children: React.ReactNode; 
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
}) {
  const variants = {
    default: 'bg-gray-700 text-gray-300',
    success: 'bg-green-500/20 text-green-400',
    warning: 'bg-yellow-500/20 text-yellow-400',
    error: 'bg-red-500/20 text-red-400',
    info: 'bg-blue-500/20 text-blue-400',
  };

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${variants[variant]}`}>
      {children}
    </span>
  );
}

export default function AdminDashboard() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'peers' | 'users' | 'content'>('overview');
  
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
      // Check if user is superadmin
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

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData.stats);
      }

      if (peersRes.ok) {
        const peersData = await peersRes.json();
        setPeers(peersData.peers);
      }

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(usersData.users);
        setContent(usersData.content);
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!isAuthorized || isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-400">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span>Loading admin dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Shield className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Admin Dashboard</h1>
                <p className="text-xs text-gray-400">P2P Music Platform</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Badge variant="success">Superadmin</Badge>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => router.push('/')}
              >
                Exit Admin
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-gray-800/50 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex gap-1 -mb-px">
            {[
              { id: 'overview', label: 'Overview', icon: BarChart3 },
              { id: 'peers', label: 'Peer Monitoring', icon: Wifi },
              { id: 'users', label: 'User Management', icon: Users },
              { id: 'content', label: 'Content Moderation', icon: Shield },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-purple-500 text-purple-400'
                    : 'border-transparent text-gray-400 hover:text-gray-300'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Overview Tab */}
        {activeTab === 'overview' && stats && (
          <div className="space-y-8">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard
                title="Total Tracks"
                value={formatNumber(stats.totalTracks)}
                icon={Music}
                trend={`${stats.recentActivity.tracksLast7Days} this week`}
                trendUp={stats.recentActivity.tracksLast7Days > 0}
                color="purple"
              />
              <StatCard
                title="Total Users"
                value={formatNumber(stats.totalUsers)}
                icon={Users}
                trend={`${stats.recentActivity.usersLast7Days} this week`}
                trendUp={stats.recentActivity.usersLast7Days > 0}
                color="blue"
              />
              <StatCard
                title="Total Likes"
                value={formatNumber(stats.totalLikes)}
                icon={Heart}
                color="red"
              />
              <StatCard
                title="Total Comments"
                value={formatNumber(stats.totalComments)}
                icon={MessageCircle}
                color="green"
              />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Genre Distribution */}
              <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                <SectionHeader title="Most Active Genres" icon={Music} />
                <div className="space-y-3">
                  {stats.genres.slice(0, 8).map((genre, index) => {
                    const maxCount = stats.genres[0]?.count || 1;
                    const colors = ['bg-purple-500', 'bg-blue-500', 'bg-green-500', 'bg-orange-500', 'bg-pink-500', 'bg-cyan-500', 'bg-yellow-500', 'bg-red-500'];
                    return (
                      <div key={genre.name} className="flex items-center gap-3">
                        <span className="text-gray-400 text-sm w-24 truncate">{genre.name}</span>
                        <div className="flex-1">
                          <ProgressBar 
                            value={genre.count} 
                            max={maxCount} 
                            color={colors[index % colors.length]}
                          />
                        </div>
                        <span className="text-gray-300 text-sm w-12 text-right">{genre.count}</span>
                      </div>
                    );
                  })}
                  {stats.genres.length === 0 && (
                    <p className="text-gray-500 text-center py-4">No genre data available</p>
                  )}
                </div>
              </div>

              {/* Storage Distribution */}
              <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                <SectionHeader title="Storage Distribution" icon={HardDrive} />
                <div className="space-y-4">
                  {stats.storageDistribution.map((storage) => {
                    const total = stats.storageDistribution.reduce((sum, s) => sum + s.count, 0);
                    const percentage = total > 0 ? Math.round((storage.count / total) * 100) : 0;
                    const colorMap: Record<string, string> = {
                      ipfs: 'bg-blue-500',
                      torrent: 'bg-green-500',
                      hybrid: 'bg-purple-500',
                    };
                    return (
                      <div key={storage.type} className="flex items-center gap-3">
                        <span className="text-gray-400 text-sm w-20 capitalize">{storage.type}</span>
                        <div className="flex-1">
                          <ProgressBar 
                            value={storage.count} 
                            max={total} 
                            color={colorMap[storage.type] || 'bg-gray-500'}
                            size="lg"
                          />
                        </div>
                        <span className="text-gray-300 text-sm">{percentage}%</span>
                        <span className="text-gray-500 text-xs">({storage.count})</span>
                      </div>
                    );
                  })}
                </div>

                {/* Upload Activity */}
                <div className="mt-6 pt-6 border-t border-gray-700">
                  <h3 className="text-sm font-medium text-gray-300 mb-3">Upload Activity (Last 30 Days)</h3>
                  <div className="flex items-end gap-1 h-24">
                    {stats.uploadsPerDay.slice(0, 30).reverse().map((day, index) => {
                      const maxCount = Math.max(...stats.uploadsPerDay.map(d => d.count), 1);
                      const height = maxCount > 0 ? (day.count / maxCount) * 100 : 0;
                      return (
                        <div
                          key={index}
                          className="flex-1 bg-purple-500/30 hover:bg-purple-500/50 rounded-t transition-colors relative group"
                          style={{ height: `${Math.max(height, 5)}%` }}
                        >
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-gray-700 text-xs text-white rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-10">
                            {day.date}: {day.count} uploads
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Peers Tab */}
        {activeTab === 'peers' && peers && (
          <div className="space-y-8">
            {/* Swarm Health */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <StatCard
                title="Total Torrents"
                value={peers.swarmHealth.totalTorrents}
                icon={Server}
                color="blue"
              />
              <StatCard
                title="Healthy Swarms"
                value={peers.swarmHealth.healthyTorrents}
                icon={CheckCircle}
                color="green"
              />
              <StatCard
                title="Needs Seeding"
                value={peers.swarmHealth.unhealthyTorrents}
                icon={AlertTriangle}
                color="orange"
              />
              <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-gray-400 text-sm font-medium">Swarm Health</p>
                    <p className="text-2xl font-bold text-white mt-2">{peers.swarmHealth.healthPercentage}%</p>
                  </div>
                  <div className={`p-3 rounded-lg ${
                    peers.swarmHealth.status === 'healthy' ? 'bg-green-500/10 text-green-400' :
                    peers.swarmHealth.status === 'degraded' ? 'bg-yellow-500/10 text-yellow-400' :
                    'bg-red-500/10 text-red-400'
                  }`}>
                    <Activity className="w-6 h-6" />
                  </div>
                </div>
                <ProgressBar 
                  value={peers.swarmHealth.healthPercentage} 
                  max={100}
                  color={
                    peers.swarmHealth.status === 'healthy' ? 'bg-green-500' :
                    peers.swarmHealth.status === 'degraded' ? 'bg-yellow-500' :
                    'bg-red-500'
                  }
                  size="sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Needs Seeding */}
              <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                <SectionHeader 
                  title="Needs Seeding" 
                  icon={Upload}
                  action={<Badge variant="warning">{peers.needsSeeding.length} tracks</Badge>}
                />
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {peers.needsSeeding.map((track) => (
                    <div key={track.id} className="flex items-center gap-3 p-3 bg-gray-700/30 rounded-lg">
                      <div className="p-2 bg-orange-500/10 rounded-lg">
                        <AlertTriangle className="w-4 h-4 text-orange-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium truncate">{track.title}</p>
                        <p className="text-gray-400 text-sm">{track.artist} • {track.authorUsername}</p>
                      </div>
                      <Badge variant={track.priority === 'high' ? 'error' : 'warning'}>
                        {track.priority}
                      </Badge>
                    </div>
                  ))}
                  {peers.needsSeeding.length === 0 && (
                    <p className="text-gray-500 text-center py-4">All swarms are healthy!</p>
                  )}
                </div>
              </div>

              {/* Top Seeded */}
              <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                <SectionHeader 
                  title="Top Seeded Tracks" 
                  icon={TrendingUp}
                  action={<Badge variant="success">Healthy</Badge>}
                />
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {peers.topSeeded.map((track) => (
                    <div key={track.id} className="flex items-center gap-3 p-3 bg-gray-700/30 rounded-lg">
                      <div className="p-2 bg-green-500/10 rounded-lg">
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium truncate">{track.title}</p>
                        <p className="text-gray-400 text-sm">{track.artist}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-green-400 text-sm font-medium">{track.seedCount} seeds</p>
                        <p className="text-gray-500 text-xs">Ratio: {track.uploadRatio.toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                  {peers.topSeeded.length === 0 && (
                    <p className="text-gray-500 text-center py-4">No highly seeded tracks yet</p>
                  )}
                </div>
              </div>
            </div>

            {/* Active Torrents Table */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden">
              <div className="p-6 border-b border-gray-700">
                <SectionHeader title="Active Torrents" icon={Wifi} />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-700/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Track</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Artist</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Genre</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Peers</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Seeds</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Leechers</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {peers.activeTorrents.slice(0, 10).map((track) => (
                      <tr key={track.id} className="hover:bg-gray-700/30">
                        <td className="px-4 py-3 text-white font-medium">{track.title}</td>
                        <td className="px-4 py-3 text-gray-400">{track.artist}</td>
                        <td className="px-4 py-3">
                          <Badge variant="default">{track.genre}</Badge>
                        </td>
                        <td className="px-4 py-3 text-center text-white">{track.peerCount}</td>
                        <td className="px-4 py-3 text-center text-green-400">{track.seedCount}</td>
                        <td className="px-4 py-3 text-center text-orange-400">{track.leechCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && users && (
          <div className="space-y-8">
            {/* User Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <StatCard
                title="Total Users"
                value={formatNumber(users.statistics.totalUsers)}
                icon={Users}
                color="blue"
              />
              <StatCard
                title="New This Week"
                value={users.statistics.newThisWeek}
                icon={TrendingUp}
                color="green"
              />
              <StatCard
                title="Artists"
                value={users.statistics.artists}
                icon={Music}
                color="purple"
              />
              <StatCard
                title="Badged Users"
                value={users.statistics.badgedUsers}
                icon={Award}
                color="orange"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Recent Registrations */}
              <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                <SectionHeader title="Recent Registrations" icon={Clock} />
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {users.recentRegistrations.map((user) => (
                    <div key={user.id} className="flex items-center gap-3 p-3 bg-gray-700/30 rounded-lg">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-medium">
                        {user.username.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium truncate">{user.username}</p>
                        <p className="text-gray-400 text-xs">{formatDate(user.createdAt)}</p>
                      </div>
                      <Badge variant={user.onboardingCompleted ? 'success' : 'default'}>
                        {user.onboardingCompleted ? 'Onboarded' : 'New'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              {/* Users with Badges */}
              <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                <SectionHeader title="Users with Badges" icon={Award} />
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {users.withBadges.map((user) => (
                    <div key={user.id} className="flex items-center gap-3 p-3 bg-gray-700/30 rounded-lg">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center text-white font-medium">
                        {user.username.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium truncate">{user.username}</p>
                        <p className="text-yellow-400 text-xs">{user.badge}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-white text-sm">{user.trustScore}</p>
                        <p className="text-gray-500 text-xs">score</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Contributors */}
              <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                <SectionHeader title="Top Contributors" icon={UserCheck} />
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {users.topContributors.map((user) => (
                    <div key={user.id} className="flex items-center gap-3 p-3 bg-gray-700/30 rounded-lg">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center text-white font-medium">
                        {user.username.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium truncate">{user.username}</p>
                        <p className="text-gray-400 text-xs">{user.trackCount} tracks • {user.totalLikesReceived} likes</p>
                      </div>
                      <div className="text-right">
                        <p className="text-green-400 text-sm">{user.uploadRatio.toFixed(2)}</p>
                        <p className="text-gray-500 text-xs">ratio</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Content Tab */}
        {activeTab === 'content' && content && (
          <div className="space-y-8">
            {/* Content Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <StatCard
                title="Recent Uploads"
                value={content.recentUploads.length}
                icon={FileAudio}
                color="blue"
              />
              <StatCard
                title="Flagged Content"
                value={content.flaggedContent.length}
                icon={Flag}
                color={content.flaggedContent.length > 0 ? 'red' : 'green'}
              />
              <StatCard
                title="Total Engagement"
                value={content.recentUploads.reduce((sum, u) => sum + u.likeCount + u.commentCount, 0)}
                icon={Heart}
                color="purple"
              />
              <StatCard
                title="Storage Types"
                value={new Set(content.recentUploads.map(u => u.storageType)).size}
                icon={HardDrive}
                color="orange"
              />
            </div>

            {/* Flagged Content Alert */}
            {content.flaggedContent.length > 0 && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <AlertTriangle className="w-6 h-6 text-red-400" />
                  <h2 className="text-lg font-semibold text-red-400">Flagged Content Requiring Review</h2>
                </div>
                <div className="space-y-3">
                  {content.flaggedContent.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 p-4 bg-gray-800/50 rounded-lg">
                      <div className="p-2 bg-red-500/20 rounded-lg">
                        <Flag className="w-4 h-4 text-red-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium">{item.title}</p>
                        <p className="text-gray-400 text-sm">
                          by {item.author.username} • {item.flagReason}
                        </p>
                      </div>
                      <Badge variant={item.severity === 'high' ? 'error' : 'warning'}>
                        {item.severity}
                      </Badge>
                      <Button variant="outline" size="sm">
                        Review
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Uploads Table */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden">
              <div className="p-6 border-b border-gray-700">
                <SectionHeader title="Recent Uploads" icon={Clock} />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-700/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Track</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Artist</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Uploader</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Type</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Likes</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Comments</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {content.recentUploads.map((upload) => (
                      <tr key={upload.id} className="hover:bg-gray-700/30">
                        <td className="px-4 py-3 text-white font-medium">{upload.title}</td>
                        <td className="px-4 py-3 text-gray-400">{upload.artist}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-300">{upload.author.username}</span>
                            <span className="text-gray-500 text-xs">({upload.author.trustScore})</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant={upload.storageType === 'ipfs' ? 'info' : upload.storageType === 'hybrid' ? 'success' : 'default'}>
                            {upload.storageType}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-center text-white">{upload.likeCount}</td>
                        <td className="px-4 py-3 text-center text-white">{upload.commentCount}</td>
                        <td className="px-4 py-3 text-right">
                          <Button variant="ghost" size="sm">
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
