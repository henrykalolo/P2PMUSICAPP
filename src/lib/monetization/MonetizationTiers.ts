import { query, transaction } from '@/lib/db';
import {
  MonetizationTier,
  Subscription,
  SubscriptionStatus,
  SubscriptionTierName,
  SubscriptionTransaction,
} from '@/types/monetization';
import { generateUUID, addMonths } from './utils';
import TokenEconomy from './TokenEconomy';

export const MONETIZATION_TIERS: MonetizationTier[] = [
  {
    name: 'Fan',
    monthlyPrice: 4.99,
    features: [
      'Ad-free listening',
      'High-quality audio (320kbps)',
      'Offline downloads',
      'Exclusive content access',
    ],
    creatorShare: 0.70,
    subscriberLimit: Infinity,
  },
  {
    name: 'Super Fan',
    monthlyPrice: 9.99,
    features: [
      'All Fan features',
      'Early access to new releases',
      'Exclusive behind-the-scenes content',
      'Direct messaging with artist',
      'Virtual meetups monthly',
    ],
    creatorShare: 0.80,
    subscriberLimit: 1000,
  },
  {
    name: 'Collaborator',
    monthlyPrice: 24.99,
    features: [
      'All Super Fan features',
      'Collaborate on tracks',
      'Revenue sharing options',
      'Private workspace access',
      'Analytics dashboard',
    ],
    creatorShare: 0.90,
    subscriberLimit: 100,
  },
];

export class ArtistMonetization {
  private tokenEconomy: TokenEconomy;

  constructor(tokenEconomy?: TokenEconomy) {
    this.tokenEconomy = tokenEconomy || new TokenEconomy();
  }

  getTiers(): MonetizationTier[] {
    return MONETIZATION_TIERS;
  }

  getTier(name: SubscriptionTierName): MonetizationTier | undefined {
    return MONETIZATION_TIERS.find((t) => t.name === name);
  }

  async createSubscription(
    artistId: string,
    tier: SubscriptionTierName,
    subscriberId: string
  ): Promise<Subscription> {
    const tierConfig = this.getTier(tier);
    if (!tierConfig) {
      throw new Error(`Invalid tier: ${tier}`);
    }

    const now = new Date();

    return await transaction(async (client) => {
      const existing = await client.query(
        `SELECT id FROM subscriptions
         WHERE artist_id = $1 AND subscriber_id = $2 AND status = 'active'`,
        [artistId, subscriberId]
      );

      if (existing.rows.length > 0) {
        throw new Error('Active subscription already exists for this artist-subscriber pair');
      }

      const creatorAmount = Number((tierConfig.monthlyPrice * tierConfig.creatorShare).toFixed(2));
      const platformFee = Number((tierConfig.monthlyPrice * (1 - tierConfig.creatorShare)).toFixed(2));

      const result = await client.query(
        `INSERT INTO subscriptions
         (id, artist_id, subscriber_id, tier, monthly_price, creator_share, platform_fee,
          status, start_date, renew_date, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING *`,
        [
          generateUUID(),
          artistId,
          subscriberId,
          tier,
          tierConfig.monthlyPrice,
          creatorAmount,
          platformFee,
          'active' as SubscriptionStatus,
          now,
          addMonths(now, 1),
          now,
          now,
        ]
      );

      const subscription = result.rows[0];

      await this.processPayment(subscription);
      await this.grantSubscriberAccess(artistId, subscriberId, tierConfig);

      return {
        id: subscription.id,
        artistId: subscription.artist_id,
        subscriberId: subscription.subscriber_id,
        tier: subscription.tier as SubscriptionTierName,
        monthlyPrice: Number(subscription.monthly_price),
        creatorShare: Number(subscription.creator_share),
        platformFee: Number(subscription.platform_fee),
        status: subscription.status as SubscriptionStatus,
        startDate: subscription.start_date,
        renewDate: subscription.renew_date,
        createdAt: subscription.created_at,
        updatedAt: subscription.updated_at,
      };
    });
  }

  async processPayment(subscription: Partial<Subscription>): Promise<void> {
    const tx: SubscriptionTransaction = {
      type: 'subscription_revenue',
      artistId: subscription.artistId!,
      subscriberId: subscription.subscriberId!,
      amount: subscription.creatorShare!,
      tier: subscription.tier!,
      month: new Date(),
    };

    await this.tokenEconomy.recordTokenTransaction(
      subscription.artistId!,
      subscription.creatorShare!,
      'earned',
      'subscription_revenue',
      subscription.id,
      `Subscription revenue from ${subscription.tier} tier`
    );

    await query(
      `INSERT INTO transactions
       (id, type, artist_id, subscriber_id, amount, tier, reference_id, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        generateUUID(),
        tx.type,
        tx.artistId,
        tx.subscriberId,
        tx.amount,
        tx.tier,
        subscription.id,
        JSON.stringify({ monthlyPrice: subscription.monthlyPrice }),
        new Date(),
      ]
    );
  }

  async grantSubscriberAccess(
    artistId: string,
    subscriberId: string,
    tier: MonetizationTier
  ): Promise<void> {
    await query(
      `INSERT INTO subscriber_features
       (user_id, artist_id, tier_name, features, granted_at, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, artist_id) DO UPDATE SET
         tier_name = EXCLUDED.tier_name,
         features = EXCLUDED.features,
         granted_at = EXCLUDED.granted_at,
         expires_at = EXCLUDED.expires_at`,
      [
        subscriberId,
        artistId,
        tier.name,
        JSON.stringify(tier.features),
        new Date(),
        addMonths(new Date(), 1),
      ]
    );
  }

  async getActiveSubscriptions(artistId: string, month: Date): Promise<Subscription[]> {
    const result = await query(
      `SELECT *
       FROM subscriptions
       WHERE artist_id = $1
         AND status = 'active'
         AND start_date <= $2
         AND (cancelled_at IS NULL OR cancelled_at > $2)`,
      [artistId, month]
    );

    return result.rows.map((row: any) => this.mapSubscription(row));
  }

  async getSubscriberSubscriptions(subscriberId: string): Promise<Subscription[]> {
    const result = await query(
      `SELECT *
       FROM subscriptions
       WHERE subscriber_id = $1
         AND status IN ('active', 'pending')
       ORDER BY created_at DESC`,
      [subscriberId]
    );

    return result.rows.map((row: any) => this.mapSubscription(row));
  }

  async distributeSubscriberRevenue(artistId: string, month: Date): Promise<void> {
    const subscriptions = await this.getActiveSubscriptions(artistId, month);

    for (const sub of subscriptions) {
      const tier = this.getTier(sub.tier);
      if (!tier) continue;

      const creatorAmount = Number((sub.monthlyPrice * tier.creatorShare).toFixed(2));

      await this.transferToCreator(artistId, creatorAmount, sub.id);
      await this.recordTransaction({
        type: 'subscription_revenue',
        artistId,
        subscriberId: sub.subscriberId,
        amount: creatorAmount,
        tier: sub.tier,
        month,
      });
    }
  }

  async transferToCreator(artistId: string, amount: number, subscriptionId: string): Promise<void> {
    await query(
      `INSERT INTO transactions
       (id, type, artist_id, amount, reference_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [generateUUID(), 'creator_payout', artistId, amount, subscriptionId, new Date()]
    );
  }

  async recordTransaction(tx: SubscriptionTransaction): Promise<void> {
    await query(
      `INSERT INTO transactions
       (id, type, artist_id, subscriber_id, amount, tier, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        generateUUID(),
        tx.type,
        tx.artistId,
        tx.subscriberId,
        tx.amount,
        tx.tier,
        new Date(),
      ]
    );
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    await query(
      `UPDATE subscriptions
       SET status = 'cancelled',
           cancelled_at = NOW(),
           updated_at = NOW()
       WHERE id = $1 AND status = 'active'`,
      [subscriptionId]
    );
  }

  async getArtistRevenue(artistId: string, limit = 10): Promise<any[]> {
    const result = await query(
      `SELECT type, amount, tier, created_at
       FROM transactions
       WHERE artist_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [artistId, limit]
    );

    return result.rows;
  }

  private mapSubscription(row: any): Subscription {
    return {
      id: row.id,
      artistId: row.artist_id,
      subscriberId: row.subscriber_id,
      tier: row.tier as SubscriptionTierName,
      monthlyPrice: Number(row.monthly_price),
      creatorShare: Number(row.creator_share),
      platformFee: Number(row.platform_fee),
      status: row.status as SubscriptionStatus,
      startDate: row.start_date,
      renewDate: row.renew_date,
      cancelledAt: row.cancelled_at || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export default ArtistMonetization;
