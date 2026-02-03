'use client';

import { useState, useCallback, useEffect } from 'react';

export enum SwarmRole {
  SEEDER = 'seeder',
  LEECHER = 'leecher',
  ARCHIVER = 'archiver',
  REPAIRER = 'repairer',
}

export interface SwarmMember {
  id: string;
  userId: string;
  username: string;
  avatarUrl?: string;
  trustScore: number;
  role: SwarmRole;
  reputationScore: number;
  isOnline: boolean;
  bytesUploaded: number;
  bytesDownloaded: number;
  joinedAt: string;
  lastActiveAt: string;
}

export interface Swarm {
  id: string;
  swarmId: string;
  contentId: string;
  contentType: string;
  name: string;
  role: SwarmRole;
  reputationScore: number;
  bytesUploaded: number;
  bytesDownloaded: number;
  isOnline: boolean;
  lastActiveAt: string;
}

export interface SwarmStats {
  totalUpload: number;
  totalDownload: number;
  averageReputation: number;
  onlineMembers: number;
}

interface UseSwarmReturn {
  swarms: Swarm[];
  isLoading: boolean;
  error: string | null;
  createSwarm: (contentId: string, contentType: string, name: string) => Promise<Swarm | null>;
  joinSwarm: (swarmId: string) => Promise<boolean>;
  leaveSwarm: (swarmId: string) => Promise<boolean>;
  updateStats: (swarmId: string, uploadedBytes: number, downloadedBytes: number) => Promise<void>;
  getNearbyPeers: (limit?: number) => Promise<SwarmMember[]>;
  pingPresence: (swarmIds: string[]) => Promise<void>;
  refetch: () => Promise<void>;
}

export function useSwarm(): UseSwarmReturn {
  const [swarms, setSwarms] = useState<Swarm[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSwarms = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('/api/swarm', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch swarms');
      }

      const data = await response.json();
      setSwarms(data.swarms || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createSwarm = useCallback(
    async (contentId: string, contentType: string, name: string): Promise<Swarm | null> => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          throw new Error('Not authenticated');
        }

        const response = await fetch('/api/swarm', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            action: 'create',
            contentId,
            contentType,
            name,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create swarm');
        }

        const data = await response.json();
        await fetchSwarms();
        return data.swarm;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        return null;
      }
    },
    [fetchSwarms]
  );

  const joinSwarm = useCallback(
    async (swarmId: string): Promise<boolean> => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          throw new Error('Not authenticated');
        }

        const response = await fetch('/api/swarm', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            action: 'join',
            swarmId,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to join swarm');
        }

        await fetchSwarms();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        return false;
      }
    },
    [fetchSwarms]
  );

  const leaveSwarm = useCallback(
    async (swarmId: string): Promise<boolean> => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          throw new Error('Not authenticated');
        }

        const response = await fetch(`/api/swarm?swarmId=${swarmId}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to leave swarm');
        }

        await fetchSwarms();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        return false;
      }
    },
    [fetchSwarms]
  );

  const updateStats = useCallback(
    async (swarmId: string, uploadedBytes: number, downloadedBytes: number) => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          throw new Error('Not authenticated');
        }

        await fetch('/api/swarm', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            action: 'update',
            swarmId,
            uploadedBytes,
            downloadedBytes,
          }),
        });
      } catch (err) {
        console.error('Failed to update swarm stats:', err);
      }
    },
    []
  );

  const getNearbyPeers = useCallback(
    async (limit: number = 10): Promise<SwarmMember[]> => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          throw new Error('Not authenticated');
        }

        const response = await fetch(`/api/swarm?action=nearby&limit=${limit}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch nearby peers');
        }

        const data = await response.json();
        return data.peers || [];
      } catch (err) {
        console.error('Failed to fetch nearby peers:', err);
        return [];
      }
    },
    []
  );

  const pingPresence = useCallback(async (swarmIds: string[]) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        return;
      }

      await fetch('/api/swarm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'ping',
          swarmIds,
        }),
      });
    } catch (err) {
      console.error('Failed to ping swarm presence:', err);
    }
  }, []);

  // Ping presence periodically
  useEffect(() => {
    if (swarms.length === 0) return;

    const swarmIds = swarms.map((s) => s.swarmId);
    pingPresence(swarmIds);

    const interval = setInterval(() => {
      pingPresence(swarmIds);
    }, 60000); // Every minute

    return () => clearInterval(interval);
  }, [swarms, pingPresence]);

  useEffect(() => {
    fetchSwarms();
  }, [fetchSwarms]);

  return {
    swarms,
    isLoading,
    error,
    createSwarm,
    joinSwarm,
    leaveSwarm,
    updateStats,
    getNearbyPeers,
    pingPresence,
    refetch: fetchSwarms,
  };
}

export default useSwarm;
