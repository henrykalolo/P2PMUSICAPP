import { query } from '@/lib/db';
import {
  TipConfig,
  TipResult,
  TipRecord,
  UserBalance,
  PayoutRequest,
  PayoutRecord,
  Currency,
  PayoutMethod,
} from '@/types/monetization';
import { generateUUID } from './utils';
import TokenEconomy from './TokenEconomy';
import { sendNotification } from '@/lib/notifications/helper';

export const DEFAULT_TIP_CONFIG: TipConfig = {
  minTipAmount: 0.5,
  maxTipAmount: 500,
  platformFee: 0.05,
  instantPayout: true,
  supportedCurrencies: ['USDC', 'ETH', 'MATIC', 'P2P'],
};

export class TipSystem {
  config: TipConfig = { ...DEFAULT_TIP_CONFIG };
  private tokenEconomy: TokenEconomy;

  constructor(tokenEconomy?: TokenEconomy, config?: Partial<TipConfig>) {
    this.tokenEconomy = tokenEconomy || new TokenEconomy();
    this.config = { ...DEFAULT_TIP_CONFIG, ...config };
  }

  async processTip(
    fromUserId: string,
    toArtistId: string,
    amount: number,
    currency: string,
    message?: string
  ): Promise<TipResult> {
    if (amount < this.config.minTipAmount || amount > this.config.maxTipAmount) {
      throw new Error(
        `Tip amount must be between ${this.config.minTipAmount} and ${this.config.maxTipAmount}`
      );
    }

    if (!this.config.supportedCurrencies.includes(currency as Currency)) {
      throw new Error(`Unsupported currency: ${currency}`);
    }

    if (fromUserId === toArtistId) {
      throw new Error('Cannot tip yourself');
    }

    const balance = await this.getUserBalance(fromUserId, currency as Currency);
    if (balance.balance < amount) {
      throw new Error('Insufficient balance');
    }

    const platformFee = Number((amount * this.config.platformFee).toFixed(2));
    const artistReceived = Number((amount - platformFee).toFixed(2));

    await this.debitUser(fromUserId, amount, currency as Currency);
    await this.creditArtist(toArtistId, artistReceived, currency as Currency);

    const tipId = generateUUID();
    await this.recordTip({
      fromUserId,
      toArtistId,
      amount,
      currency: currency as Currency,
      message,
    }, tipId, platformFee, artistReceived);

    await this.tokenEconomy.recordTokenTransaction(
      toArtistId,
      artistReceived,
      'earned',
      'tip_received',
      tipId,
      `Tip of ${amount} ${currency} from ${fromUserId}`
    );

    const fromUserResult = await query(
      'SELECT username FROM users WHERE id = $1',
      [fromUserId]
    );
    const fromUsername = fromUserResult.rows[0]?.username || 'Someone';

    const displayName = `${currency} ${artistReceived.toFixed(2)}`;
    await sendNotification(
      toArtistId,
      'tip',
      'Tip Received',
      `${fromUsername} tipped you ${displayName}${message ? ` — "${message}"` : ''}`,
      { fromUserId, amount, currency, tipId }
    );

    return {
      success: true,
      tipId,
      amount,
      artistReceived,
      platformFee,
    };
  }

  async getUserBalance(userId: string, currency: Currency): Promise<UserBalance> {
    const result = await query(
      `SELECT balance FROM user_balances
       WHERE user_id = $1 AND currency = $2`,
      [userId, currency]
    );

    const balance = result.rows[0]?.balance || 0;

    return {
      userId,
      currency,
      balance: Number(balance),
    };
  }

  async getMultipleUserBalances(userId: string): Promise<UserBalance[]> {
    const result = await query(
      `SELECT currency, balance FROM user_balances WHERE user_id = $1`,
      [userId]
    );

    return result.rows.map((row: any) => ({
      userId,
      currency: row.currency as Currency,
      balance: Number(row.balance),
    }));
  }

  async debitUser(userId: string, amount: number, currency: Currency): Promise<void> {
    await this.recordBalanceTransaction(userId, -amount, currency, 'debit', 'tip_sent');
  }

  async creditArtist(artistId: string, amount: number, currency: Currency): Promise<void> {
    await this.recordBalanceTransaction(artistId, amount, currency, 'credit', 'tip_received');
  }

  async recordBalanceTransaction(
    userId: string,
    amount: number,
    currency: Currency,
    direction: 'credit' | 'debit',
    source: string
  ): Promise<void> {
    await query(
      `INSERT INTO user_balances
       (user_id, currency, balance, total_earned, total_spent, updated_at)
       VALUES ($1, $2, 0, 0, 0, NOW())
       ON CONFLICT (user_id, currency) DO UPDATE SET
         balance = CASE
           WHEN $4 = 'credit' THEN user_balances.balance + $2
           ELSE user_balances.balance - $2
         END,
         total_earned = CASE
           WHEN $4 = 'credit' THEN user_balances.total_earned + $2
           ELSE user_balances.total_earned
         END,
         total_spent = CASE
           WHEN $4 = 'debit' THEN user_balances.total_spent + $2
           ELSE user_balances.total_spent
         END,
         updated_at = NOW()`,
      [userId, currency, amount, direction]
    );

    await query(
      `INSERT INTO balance_transactions
       (user_id, amount, currency, direction, source, reference_id, created_at)
       SELECT $1, $2, $3, $4, $5, $6, NOW()
       WHERE EXISTS (SELECT 1 FROM users WHERE id = $1)`,
      [userId, amount, currency, direction, source, generateUUID()]
    );
  }

  async recordTip(
    record: TipRecord,
    tipId: string,
    platformFee: number,
    artistReceived: number
  ): Promise<void> {
    await query(
      `INSERT INTO tips
       (id, from_user_id, to_artist_id, amount, currency, platform_fee, artist_received,
        message, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
      [
        tipId,
        record.fromUserId,
        record.toArtistId,
        record.amount,
        record.currency,
        platformFee,
        artistReceived,
        record.message || null,
        'completed',
      ]
    );
  }

  async getTipsReceived(artistId: string, limit = 50): Promise<any[]> {
    const result = await query(
      `SELECT t.id, t.amount, t.currency, t.platform_fee, t.artist_received, t.message, t.created_at,
              u.id as from_user_id, u.username as from_username, u.avatar_url as from_avatar_url
       FROM tips t
       JOIN users u ON t.from_user_id = u.id
       WHERE t.to_artist_id = $1
       ORDER BY t.created_at DESC
       LIMIT $2`,
      [artistId, limit]
    );

    return result.rows;
  }

  async getTipsSent(userId: string, limit = 50): Promise<any[]> {
    const result = await query(
      `SELECT t.id, t.amount, t.currency, t.platform_fee, t.artist_received, t.message, t.created_at,
              u.id as to_user_id, u.username as to_username, u.avatar_url as to_avatar_url
       FROM tips t
       JOIN users u ON t.to_artist_id = u.id
       WHERE t.from_user_id = $1
       ORDER BY t.created_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    return result.rows;
  }

  async enableInstantPayout(artistId: string): Promise<void> {
    const pendingBalance = await this.getPendingPayouts(artistId);

    if (pendingBalance.total > 0) {
      await this.initiatePayout({
        artistId,
        amount: pendingBalance.total,
        method: await this.getArtistPreferredPayoutMethod(artistId),
        type: 'instant',
      });
    }
  }

  async getPendingPayouts(artistId: string): Promise<{ total: number; byCurrency: Record<string, number> }> {
    const result = await query(
      `SELECT currency, SUM(artist_received) as total
       FROM tips
       WHERE to_artist_id = $1 AND status = 'completed'
       AND (payout_id IS NULL OR payout_id IS NOT NULL)
       GROUP BY currency`,
      [artistId]
    );

    const byCurrency: Record<string, number> = {};
    let total = 0;

    for (const row of result.rows) {
      byCurrency[row.currency] = Number(row.total);
      total += Number(row.total);
    }

    return { total, byCurrency };
  }

  async getArtistPreferredPayoutMethod(artistId: string): Promise<PayoutMethod> {
    const result = await query(
      `SELECT payout_method FROM artist_settings WHERE artist_id = $1`,
      [artistId]
    );

    if (result.rows.length > 0 && result.rows[0].payout_method) {
      return result.rows[0].payout_method as PayoutMethod;
    }

    return 'stripe';
  }

  async initiatePayout(request: PayoutRequest): Promise<PayoutRecord> {
    const payoutId = generateUUID();

    await query(
      `INSERT INTO payouts
       (id, artist_id, amount, method, type, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [payoutId, request.artistId, request.amount, request.method, request.type, 'processing']
    );

    await sendNotification(
      request.artistId,
      'system',
      'Payout Initiated',
      `${request.amount} ${request.method} payout is being processed`,
      { payoutId, amount: request.amount, method: request.method }
    );

    return {
      id: payoutId,
      artistId: request.artistId,
      amount: request.amount,
      method: request.method,
      status: 'processing',
      createdAt: new Date(),
    };
  }

  async getTippingStats(artistId: string): Promise<any> {
    const result = await query(
      `SELECT
         COUNT(*) as total_tips,
         COALESCE(SUM(artist_received), 0) as total_received,
         COALESCE(SUM(platform_fee), 0) as total_fees,
         COUNT(DISTINCT from_user_id) as unique_tippers
       FROM tips
       WHERE to_artist_id = $1 AND status = 'completed'`,
      [artistId]
    );

    const row = result.rows[0];
    return {
      totalTips: row ? (parseInt(row.total_tips) || 0) : 0,
      totalReceived: row ? (Number(row.total_received) || 0) : 0,
      totalFees: row ? (Number(row.total_fees) || 0) : 0,
      uniqueTippers: row ? (parseInt(row.unique_tippers) || 0) : 0,
    };
  }

  getConfig(): TipConfig {
    return { ...this.config };
  }

  updateConfig(config: Partial<TipConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

export default TipSystem;
