'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Users, Network, Share2, UserPlus, UserMinus, 
  Activity, Clock, Upload, Download, ChevronDown, ChevronUp, RefreshCw 
} from 'lucide-react';
import { useSwarm, SwarmMember } from '@/hooks/useSwarm';

interface SwarmPanelProps {
  contentId?: string;
  contentName?: string;
  contentType?: 'track' | 'album' | 'playlist';
  compact?: boolean;
}

export function SwarmPanel({ 
  contentId, 
  contentName, 
  contentType = 'track',
  compact = false 
}: SwarmPanelProps) {
  const { 
    swarms, 
    isLoading, 
    error, 
    createSwarm, 
    joinSwarm, 
    leaveSwarm,
    getNearbyPeers,
    refetch 
  } = useSwarm();
  
  const [nearbyPeers, setNearbyPeers] = useState<SwarmMember[]>([]);
  const [showNearby, setShowNearby] = useState(false);
  const [showSwarms, setShowSwarms] = useState(!compact);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (showNearby) {
      getNearbyPeers(5).then(setNearbyPeers);
    }
  }, [showNearby, getNearbyPeers]);

  const handleCreateSwarm = async () => {
    if (!contentId || !contentName) return;
    
    setIsCreating(true);
    await createSwarm(contentId, contentType, contentName);
    setIsCreating(false);
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getRoleColor = (role: string): string => {
    switch (role) {
      case 'seeder': return 'text-green-600 bg-green-100';
      case 'archiver': return 'text-blue-600 bg-blue-100';
      case 'repairer': return 'text-purple-600 bg-purple-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'seeder': return <Upload className="h-3 w-3" />;
      case 'archiver': return <Share2 className="h-3 w-3" />;
      case 'repairer': return <Activity className="h-3 w-3" />;
      default: return <Users className="h-3 w-3" />;
    }
  };

  if (isLoading && swarms.length === 0) {
    return (
      <div className="animate-pulse bg-muted rounded-lg h-24" />
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-600 text-sm">{error}</p>
        <Button variant="outline" size="sm" onClick={refetch} className="mt-2">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Network className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Swarm Participation</h3>
        </div>
        <div className="flex items-center gap-2">
          {compact && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setShowSwarms(!showSwarms)}
            >
              {showSwarms ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          )}
        </div>
      </div>

      {/* Content Swarm Creation */}
      {contentId && !swarms.some(s => s.contentId === contentId) && (
        <div className="p-4 bg-gradient-to-r from-primary/5 to-accent/5 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Start a swarm for this content</p>
              <p className="text-xs text-muted-foreground">
                Become a seeder and earn reputation
              </p>
            </div>
            <Button 
              size="sm"
              onClick={handleCreateSwarm}
              disabled={isCreating}
              className="bg-primary hover:bg-primary/90"
            >
              {isCreating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Start Swarm
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* User's Swarms */}
      {showSwarms && swarms.length > 0 && (
        <div className="space-y-3">
          <div className="text-sm font-medium text-muted-foreground">
            Your Active Swarms ({swarms.length})
          </div>
          
          {swarms.map((swarm) => (
            <div 
              key={swarm.swarmId}
              className="p-4 bg-card border rounded-lg hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full capitalize ${getRoleColor(swarm.role)}`}>
                    {getRoleIcon(swarm.role)}
                    <span className="ml-1">{swarm.role}</span>
                  </span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full ${
                    swarm.isOnline ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${swarm.isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
                    {swarm.isOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => leaveSwarm(swarm.swarmId)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <UserMinus className="h-4 w-4" />
                </Button>
              </div>

              <p className="font-medium truncate">{swarm.name}</p>
              
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Upload className="h-3 w-3" />
                  ↑ {formatBytes(swarm.bytesUploaded)}
                </span>
                <span className="flex items-center gap-1">
                  <Download className="h-3 w-3" />
                  ↓ {formatBytes(swarm.bytesDownloaded)}
                </span>
                <span className="flex items-center gap-1">
                  <Activity className="h-3 w-3" />
                  Rep: {swarm.reputationScore}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Nearby Peers */}
      <div>
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => setShowNearby(!showNearby)}
          className="w-full justify-between"
        >
          <span className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Nearby Peers
          </span>
          {showNearby ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>

        {showNearby && (
          <div className="mt-2 space-y-2">
            {nearbyPeers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No nearby peers found
              </p>
            ) : (
              nearbyPeers.map((peer) => (
                <div 
                  key={peer.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50"
                >
                  <div className="relative">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                      {peer.avatarUrl ? (
                        <img 
                          src={peer.avatarUrl} 
                          alt={peer.username}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        <Users className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    {peer.isOnline && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{peer.username}</p>
                    <p className="text-xs text-muted-foreground">
                      Trust: {peer.trustScore} • {peer.role}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm">
                    <UserPlus className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Swarm Statistics */}
      {swarms.length > 0 && (
        <div className="grid grid-cols-2 gap-3 pt-3 border-t">
          <div className="text-center">
            <p className="text-2xl font-bold text-primary">
              {swarms.reduce((acc, s) => acc + s.bytesUploaded, 0) > 0 
                ? formatBytes(swarms.reduce((acc, s) => acc + s.bytesUploaded, 0))
                : '0 B'}
            </p>
            <p className="text-xs text-muted-foreground">Total Uploaded</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-primary">
              {swarms.reduce((acc, s) => acc + s.reputationScore, 0) / swarms.length || 0}
            </p>
            <p className="text-xs text-muted-foreground">Avg Reputation</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default SwarmPanel;
