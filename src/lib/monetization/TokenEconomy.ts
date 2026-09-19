import { query } from '@/lib/db';
import {
  TokenEconomyConfig,
  TokenDistribution,
  TransactionResult,
  TokenTransaction,
  UserTokenBalance,
  TokenDistributionRecord,
  TokenSource,
  TokenType,
} from '@/types/monetization';
import { generateUUID } from './utils';

const DEFAULT_CONFIG: TokenEconomyConfig = {
  creatorRewardRate: 0.001,
  seederRewardRate: 0.05,
  listenerBonusRate: 0.0001,
  stakingRequirement: 100,
  inflationRate: 0.05,
};

export class TokenEconomy {
  config: TokenEconomyConfig = { ...DEFAULT_CONFIG };

  constructor(config?: Partial<TokenEconomyConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async distributeCreatorRewards(
    trackId: string,
    streamCount: number,
    creatorWallet: string
  ): Promise<TransactionResult> {
    const verifiedStreams = await this.verifyStreams(trackId, streamCount);

    const totalReward = verifiedStreams * this.config.creatorRewardRate;

    const distribution: TokenDistribution = {
      creatorShare: Number((totalReward * 0.7).toFixed(8)),
      platformFee: Number((totalReward * 0.2).toFixed(8)),
      communityPool: Number((totalReward * 0.1).toFixed(8)),
    };

    await this.executeDistribution(distribution, creatorWallet);

    return {
      success: true,
      transactionId: generateUUID(),
      distribution,
      message: `Distributed ${totalReward} tokens for ${verifiedStreams} verified streams`,
    };
  }

  async calculateSeederRewards(peerId: string, bytesServed: number): Promise<number> {
    const qualityMultiplier = await this.getSeederQualityScore(peerId);
    const reward = (bytesServed / 1024 / 1024 / 1024) * this.config.seederRewardRate * qualityMultiplier;
    return Number(reward.toFixed(8));
  }

  async getSeederQualityScore(peerId: string): Promise<number> {
    const result = await query(
      `SELECT availability_score, total_upload_bytes, total_download_bytes
       FROM swarm_participation
       WHERE user_id = $1`,
      [peerId]
    );

    if (result.rows.length === 0) {
      return 1.0;
    }

    const row = result.rows[0];
    const availability = Number(row.availability_score) || 0;
    const uploadRatio = row.total_download_bytes > 0
      ? Number(row.total_upload_bytes) / Number(row.total_download_bytes)
      : 0;

    let score = 1.0;
    score += availability * 0.5;
    score += Math.min(uploadRatio, 3) * 0.25;

    return Number(Math.min(score, 2.0).toFixed(2));
  }

  async executeDistribution(
    distribution: TokenDistribution,
    creatorWallet: string
  ): Promise<void> {
    const transaction = await query(
      `INSERT INTO token_distributions
       (distribution_type, recipient_id, amount, reference_id, metadata, verified)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        'creator_reward',
        creatorWallet,
        distribution.creatorShare,
        null,
        JSON.stringify({ distribution, wallet: creatorWallet }),
        true,
      ]
    );

    await this.recordTokenTransaction(
      creatorWallet,
      distribution.creatorShare,
      'earned' as TokenType,
      'stream' as TokenSource,
      transaction.rows[0].id,
      `Creator reward: ${distribution.creatorShare} tokens`
    );

    await query(
      `INSERT INTO token_distributions
       (distribution_type, recipient_id, amount, reference_id, metadata, verified)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        'platform_fee',
        'platform_treasury',
        distribution.platformFee,
        transaction.rows[0].id,
        JSON.stringify({ source: 'creator_reward' }),
        true,
      ]
    );

    await query(
      `INSERT INTO token_distributions
       (distribution_type, recipient_id, amount, reference_id, metadata, verified)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        'community_pool',
        'community_pool',
        distribution.communityPool,
        transaction.rows[0].id,
        JSON.stringify({ source: 'creator_reward' }),
        true,
      ]
    );
  }

  async verifyStreams(trackId: string, claimedCount: number): Promise<number> {
    const result = await query(
      `SELECT COUNT(*) as verified_count
       FROM token_transactions tt
       JOIN posts p ON tt.reference_id = p.id
       WHERE p.id = $1
       AND tt.type = 'earned'
       AND tt.source = 'stream'
       AND tt.created_at > NOW() - INTERVAL '24 hours'`,
      [trackId]
    );

    const verifiedCount = parseInt(result.rows[0]?.verified_count || '0', 10);

    return verifiedCount > 0 ? Math.max(claimedCount, verifiedCount) : claimedCount;
  }

  async getListenerBonus(userId: string, minutesListened: number): Promise<number> {
    const reward = minutesListened * this.config.listenerBonusRate;
    return Number(reward.toFixed(8));
  }

  async awardListenerBonus(userId: string, minutesListened: number): Promise<void> {
    if (minutesListened < 10) return;

    const reward = await this.getListenerBonus(userId, minutesListened);

    await this.recordTokenTransaction(
      userId,
      reward,
      'earned' as TokenType,
      'listener_bonus' as TokenSource,
      null,
      `Listener bonus for ${minutesListened} minutes of listening`
    );
  }

  async awardSeederReward(peerId: string, bytesServed: number): Promise<number> {
    const reward = await this.calculateSeederRewards(peerId, bytesServed);

    if (reward > 0) {
      await this.recordTokenTransaction(
        peerId,
        reward,
        'earned' as TokenType,
        'seeder' as TokenSource,
        null,
        `Seeder reward for serving ${bytesServed} bytes`
      );
    }

    return reward;
  }

  async recordTokenTransaction(
    userId: string,
    amount: number,
    type: TokenType,
    source: TokenSource,
    referenceId?: string | null,
    description?: string
  ): Promise<TokenTransaction> {
    const result = await query(
      `INSERT INTO token_transactions
       (user_id, amount, type, source, reference_id, description)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, created_at`,
      [userId, amount, type, source, referenceId || null, description || null]
    );

    return {
      id: result.rows[0].id,
      userId,
      amount,
      type,
      source,
      referenceId: referenceId || undefined,
      description: description || undefined,
      createdAt: result.rows[0].created_at,
    };
  }

  async getUserTokenBalance(userId: string): Promise<UserTokenBalance> {
    const result = await query(
      `SELECT
         COALESCE(SUM(CASE WHEN type = 'earned' THEN amount ELSE 0 END), 0) as total_earned,
         COALESCE(SUM(CASE WHEN type = 'spent' THEN amount ELSE 0 END), 0) as total_spent
       FROM token_transactions
       WHERE user_id = $1`,
      [userId]
    );

    const row = result.rows[0] || { total_earned: 0, total_spent: 0 };
    const totalEarned = Number(row.total_earned) || 0;
    const totalSpent = Number(row.total_spent) || 0;

    const stakingResult = await query(
      `SELECT COALESCE(SUM(amount), 0) as staked
       FROM token_transactions
       WHERE user_id = $1 AND source = 'staking'`,
      [userId]
    );

    const staked = Number(stakingResult.rows[0]?.staked) || 0;

    return {
      userId,
      balance: Number((totalEarned - totalSpent).toFixed(8)),
      totalEarned: Number(totalEarned.toFixed(8)),
      totalSpent: Number(totalSpent.toFixed(8)),
      staked,
    };
  }

  async getUserTokenTransactions(userId: string, limit = 50): Promise<TokenTransaction[]> {
    const result = await query(
      `SELECT id, amount, type, source, reference_id, description, created_at
       FROM token_transactions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    return result.rows.map((row: any) => ({
      id: row.id,
      userId,
      amount: Number(row.amount),
      type: row.type as TokenType,
      source: row.source as TokenSource,
      referenceId: row.reference_id || undefined,
      description: row.description || undefined,
      createdAt: row.created_at,
    }));
  }

  async getDistributionRecords(
    recipientId?: string,
    limit = 50
  ): Promise<TokenDistributionRecord[]> {
    let sql = `
      SELECT id, distribution_type, recipient_id, amount, reference_id, metadata, verified, created_at
      FROM token_distributions
    `;
    const params: any[] = [];

    if (recipientId) {
      sql += ` WHERE recipient_id = $1`;
      params.push(recipientId);
    }

    sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await query(sql, params);

    return result.rows.map((row: any) => ({
      id: row.id,
      distributionType: row.distribution_type,
      recipientId: row.recipient_id,
      amount: Number(row.amount),
      referenceId: row.reference_id || undefined,
      metadata: row.metadata || {},
      verified: row.verified,
      createdAt: row.created_at,
    }));
  }

  getConfig(): TokenEconomyConfig {
    return { ...this.config };
  }

  updateConfig(config: Partial<TokenEconomyConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

export default TokenEconomy;
