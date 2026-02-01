'use client';

import { useState, useEffect, useCallback } from 'react';

interface TrustScoreBreakdown {
  uploadRatio: {
    score: number;
    weight: number;
    value: string;
    description: string;
  };
  connectionStability: {
    score: number;
    weight: number;
    value: string;
    description: string;
  };
  contentIntegrity: {
    score: number;
    weight: number;
    value: string;
    description: string;
  };
  socialVerification: {
    score: number;
    weight: number;
    value: number;
    description: string;
  };
}

interface TrustScoreStats {
  totalUploaded: number;
  totalDownloaded: number;
  successfulVerifications: number;
  totalVerifications: number;
}

interface TrustScoreData {
  userId: string;
  trustScore: number;
  badge: string;
  breakdown: TrustScoreBreakdown;
  stats: TrustScoreStats;
}

interface UseTrustScoreReturn {
  data: TrustScoreData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  updateStats: (stats: {
    uploadedBytes?: number;
    downloadedBytes?: number;
    sessionDuration?: number;
    verificationResult?: boolean;
    peerConnections?: boolean;
  }) => Promise<void>;
}

export function useTrustScore(userId?: string): UseTrustScoreReturn {
  const [data, setData] = useState<TrustScoreData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrustScore = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Not authenticated');
      }

      const url = userId 
        ? `/api/trust-score?userId=${userId}` 
        : '/api/trust-score';

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch trust score');
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  const updateStats = useCallback(async (stats: {
    uploadedBytes?: number;
    downloadedBytes?: number;
    sessionDuration?: number;
    verificationResult?: boolean;
    peerConnections?: boolean;
  }) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('/api/trust-score', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(stats)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update stats');
      }

      // Refetch to get updated score
      await fetchTrustScore();
    } catch (err) {
      console.error('Failed to update stats:', err);
      throw err;
    }
  }, [fetchTrustScore]);

  useEffect(() => {
    fetchTrustScore();
  }, [fetchTrustScore]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchTrustScore,
    updateStats
  };
}

export default useTrustScore;
