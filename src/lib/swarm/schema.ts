/**
 * User Swarm Participation Schema
 * 
 * This module defines the database schema and operations for user swarm participation.
 * Swarms are groups of peers that collaborate to seed and distribute content.
 */

import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth/jwt';

// Swarm types
export enum SwarmRole {
  SEEDER = 'seeder',
  LEECHER = 'leecher',
  ARCHIVER = 'archiver',
  REPAIRER = 'repairer',
}

export enum SwarmStatus {
  ACTIVE = 'active',
  IDLE = 'idle',
  OFFLINE = 'offline',
}

export interface Swarm {
  id: string;
  contentId: string;
  contentType: 'track' | 'album' | 'playlist';
  name: string;
  createdAt: Date;
  updatedAt: Date;
  memberCount: number;
  totalSize: number;
  status: SwarmStatus;
}

export interface SwarmMember {
  id: string;
  swarmId: string;
  userId: string;
  role: SwarmRole;
  joinedAt: Date;
  lastActiveAt: Date;
  bytesUploaded: number;
  bytesDownloaded: number;
  reputationScore: number;
  isOnline: boolean;
}

export interface SwarmParticipation {
  id: string;
  userId: string;
  swarmId: string;
  role: SwarmRole;
  joinedAt: Date;
  lastPingAt: Date;
  totalUploadBytes: number;
  totalDownloadBytes: number;
  availabilityScore: number;
}

// Database schema creation
export async function createSwarmTables(): Promise<void> {
  const createSwarmTable = `
    CREATE TABLE IF NOT EXISTS swarms (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      content_id VARCHAR(255) NOT NULL,
      content_type VARCHAR(50) NOT NULL,
      name VARCHAR(255) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      member_count INTEGER DEFAULT 1,
      total_size BIGINT DEFAULT 0,
      status VARCHAR(20) DEFAULT 'active',
      UNIQUE(content_id)
    );
  `;

  const createSwarmMembersTable = `
    CREATE TABLE IF NOT EXISTS swarm_members (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      swarm_id UUID NOT NULL REFERENCES swarms(id) ON DELETE CASCADE,
      user_id VARCHAR(255) NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'leecher',
      joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      bytes_uploaded BIGINT DEFAULT 0,
      bytes_downloaded BIGINT DEFAULT 0,
      reputation_score INTEGER DEFAULT 0,
      is_online BOOLEAN DEFAULT FALSE,
      UNIQUE(swarm_id, user_id)
    );
  `;

  const createSwarmParticipationTable = `
    CREATE TABLE IF NOT EXISTS swarm_participation (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR(255) NOT NULL,
      swarm_id UUID NOT NULL REFERENCES swarms(id) ON DELETE CASCADE,
      role VARCHAR(20) NOT NULL DEFAULT 'leecher',
      joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      last_ping_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      total_upload_bytes BIGINT DEFAULT 0,
      total_download_bytes BIGINT DEFAULT 0,
      availability_score INTEGER DEFAULT 0
    );
  `;

  const createIndexes = `
    CREATE INDEX IF NOT EXISTS idx_swarms_content ON swarms(content_id);
    CREATE INDEX IF NOT EXISTS idx_swarm_members_swarm ON swarm_members(swarm_id);
    CREATE INDEX IF NOT EXISTS idx_swarm_members_user ON swarm_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_swarm_participation_user ON swarm_participation(user_id);
  `;

  try {
    await query(createSwarmTable);
    await query(createSwarmMembersTable);
    await query(createSwarmParticipationTable);
    await query(createIndexes);
    console.log('Swarm tables created successfully');
  } catch (error) {
    console.error('Failed to create swarm tables:', error);
    throw error;
  }
}

// Swarm operations
export async function createSwarm(
  contentId: string,
  contentType: 'track' | 'album' | 'playlist',
  name: string,
  initialSize: number
): Promise<Swarm> {
  const result = await query(
    `INSERT INTO swarms (content_id, content_type, name, total_size)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (content_id) DO UPDATE SET updated_at = NOW()
     RETURNING *`,
    [contentId, contentType, name, initialSize]
  );
  return result.rows[0];
}

export async function joinSwarm(
  userId: string,
  swarmId: string,
  role: SwarmRole = SwarmRole.LEECHER
): Promise<SwarmMember> {
  const result = await query(
    `INSERT INTO swarm_members (swarm_id, user_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (swarm_id, user_id) DO UPDATE SET last_active_at = NOW()
     RETURNING *`,
    [swarmId, userId, role]
  );

  // Update swarm member count
  await query(
    `UPDATE swarms SET member_count = (
       SELECT COUNT(*) FROM swarm_members WHERE swarm_id = $1
     ) WHERE id = $1`,
    [swarmId]
  );

  return result.rows[0];
}

export async function leaveSwarm(
  userId: string,
  swarmId: string
): Promise<void> {
  await query(
    `DELETE FROM swarm_members WHERE swarm_id = $1 AND user_id = $2`,
    [swarmId, userId]
  );

  // Update swarm member count
  await query(
    `UPDATE swarms SET member_count = (
       SELECT COUNT(*) FROM swarm_members WHERE swarm_id = $1
     ) WHERE id = $1`,
    [swarmId]
  );
}

export async function updateSwarmMemberStats(
  userId: string,
  swarmId: string,
  uploadedBytes: number,
  downloadedBytes: number
): Promise<void> {
  await query(
    `UPDATE swarm_members
     SET bytes_uploaded = bytes_uploaded + $1,
         bytes_downloaded = bytes_downloaded + $2,
         last_active_at = NOW(),
         reputation_score = LEAST(100, (
           CASE 
             WHEN bytes_downloaded > 0 
             THEN (bytes_uploaded::FLOAT / bytes_downloaded) * 50 
             ELSE 50 
           END +
           (EXTRACT(EPOCH FROM (NOW() - joined_at)) / 86400) * 2
         ))
     WHERE swarm_id = $3 AND user_id = $4`,
    [uploadedBytes, downloadedBytes, swarmId, userId]
  );
}

export async function getUserSwarms(userId: string): Promise<SwarmMember[]> {
  const result = await query(
    `SELECT sm.*, s.content_id, s.content_type, s.name as swarm_name, s.total_size, s.status
     FROM swarm_members sm
     JOIN swarms s ON sm.swarm_id = s.id
     WHERE sm.user_id = $1
     ORDER BY sm.last_active_at DESC`,
    [userId]
  );
  return result.rows;
}

export async function getSwarmMembers(
  swarmId: string
): Promise<SwarmMember[]> {
  const result = await query(
    `SELECT sm.*, u.username, u.avatar_url, u.trust_score
     FROM swarm_members sm
     JOIN users u ON sm.user_id = u.id
     WHERE sm.swarm_id = $1
     ORDER BY sm.reputation_score DESC`,
    [swarmId]
  );
  return result.rows;
}

export async function getNearbyPeers(
  userId: string,
  limit: number = 10
): Promise<SwarmMember[]> {
  // Get peers with similar trust scores who are online
  const result = await query(
    `SELECT sm.*, u.username, u.avatar_url, u.trust_score,
            s.content_id, s.content_type, s.name as swarm_name
     FROM swarm_members sm
     JOIN users u ON sm.user_id = u.id
     JOIN swarms s ON sm.swarm_id = s.id
     WHERE sm.user_id != $1
       AND sm.is_online = true
       AND u.trust_score BETWEEN 
         (SELECT trust_score FROM users WHERE id = $1) - 20 
         AND 
         (SELECT trust_score FROM users WHERE id = $1) + 20
     ORDER BY ABS(u.trust_score - (SELECT trust_score FROM users WHERE id = $1))
     LIMIT $2`,
    [userId, limit]
  );
  return result.rows;
}

export async function pingSwarmPresence(
  userId: string,
  swarmIds: string[]
): Promise<void> {
  await query(
    `UPDATE swarm_members
     SET last_active_at = NOW(), is_online = true
     WHERE user_id = $1 AND swarm_id = ANY($2::uuid[])`,
    [userId, swarmIds]
  );

  // Mark offline peers (not pinged in last 5 minutes)
  await query(
    `UPDATE swarm_members
     SET is_online = false
     WHERE user_id = $1 AND last_active_at < NOW() - INTERVAL '5 minutes'`,
    [userId]
  );
}

export async function getSwarmStats(
  swarmId: string
): Promise<{
  totalUpload: number;
  totalDownload: number;
  averageReputation: number;
  onlineMembers: number;
}> {
  const result = await query(
    `SELECT 
       COALESCE(SUM(bytes_uploaded), 0) as total_upload,
       COALESCE(SUM(bytes_downloaded), 0) as total_download,
       COALESCE(AVG(reputation_score), 0) as avg_reputation,
       COUNT(CASE WHEN is_online THEN 1 END) as online_members
     FROM swarm_members
     WHERE swarm_id = $1`,
    [swarmId]
  );
  return result.rows[0];
}
