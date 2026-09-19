import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
  getClient: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('@/lib/notifications/helper', () => ({
  sendNotification: vi.fn().mockResolvedValue({ success: true }),
}));

const mockQuery = (await import('@/lib/db')).query as any;
const mockTransaction = (await import('@/lib/db')).transaction as any;

import { TokenEconomy } from '@/lib/monetization/TokenEconomy';
import { ArtistMonetization, MONETIZATION_TIERS } from '@/lib/monetization/MonetizationTiers';
import { TipSystem, DEFAULT_TIP_CONFIG } from '@/lib/monetization/TipSystem';
import { generateUUID, addMonths, addYears, getStartOfWeek, getEndOfWeek, generateRandomString } from '@/lib/monetization/utils';

describe('utils', () => {
  it('should generate a valid UUID', () => {
    const id = generateUUID();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('should generate multiple unique UUIDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateUUID()));
    expect(ids.size).toBe(100);
  });

  it('should generate random strings of correct length', () => {
    expect(generateRandomString(16).length).toBe(16);
    expect(generateRandomString(32).length).toBe(32);
  });

  it('should add months correctly', () => {
    const date = new Date('2026-01-15');
    const result = addMonths(date, 3);
    expect(result.getMonth()).toBe(3);
    expect(result.getDate()).toBe(15);
  });

  it('should add years correctly', () => {
    const date = new Date('2026-01-15');
    const result = addYears(date, 1);
    expect(result.getFullYear()).toBe(2027);
  });

  it('should get start of week (Sunday)', () => {
    const start = getStartOfWeek();
    expect(start.getDay()).toBe(0);
    expect(start.getHours()).toBe(0);
  });

  it('should get end of week (Saturday)', () => {
    const end = getEndOfWeek();
    expect(end.getDay()).toBe(6);
    expect(end.getHours()).toBe(23);
  });
});

describe('TokenEconomy', () => {
  let tokenEconomy: TokenEconomy;

  beforeEach(() => {
    vi.clearAllMocks();
    tokenEconomy = new TokenEconomy();
  });

  describe('config', () => {
    it('should have default config values', () => {
      const config = tokenEconomy.getConfig();
      expect(config.creatorRewardRate).toBe(0.001);
      expect(config.seederRewardRate).toBe(0.05);
      expect(config.listenerBonusRate).toBe(0.0001);
      expect(config.stakingRequirement).toBe(100);
      expect(config.inflationRate).toBe(0.05);
    });

    it('should allow custom config', () => {
      const custom = new TokenEconomy({ creatorRewardRate: 0.002 });
      expect(custom.getConfig().creatorRewardRate).toBe(0.002);
      expect(custom.getConfig().seederRewardRate).toBe(0.05);
    });

    it('should update config', () => {
      tokenEconomy.updateConfig({ stakingRequirement: 200 });
      expect(tokenEconomy.getConfig().stakingRequirement).toBe(200);
    });
  });

  describe('getListenerBonus', () => {
    it('should calculate listener bonus correctly', async () => {
      const bonus = await tokenEconomy.getListenerBonus('user1', 60);
      expect(bonus).toBe(0.006); // 60 * 0.0001
    });

    it('should calculate zero bonus for zero minutes', async () => {
      const bonus = await tokenEconomy.getListenerBonus('user1', 0);
      expect(bonus).toBe(0);
    });
  });

  describe('getUserTokenBalance', () => {
    it('should return zero balance for new user', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ total_earned: 0, total_spent: 0 }] });
      mockQuery.mockResolvedValueOnce({ rows: [{ staked: 0 }] });

      const balance = await tokenEconomy.getUserTokenBalance('user1');

      expect(balance.userId).toBe('user1');
      expect(balance.balance).toBe(0);
      expect(balance.totalEarned).toBe(0);
      expect(balance.totalSpent).toBe(0);
      expect(balance.staked).toBe(0);
    });

    it('should calculate balance correctly with earnings and spending', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ total_earned: '100.50', total_spent: '30.25' }]
      });
      mockQuery.mockResolvedValueOnce({ rows: [{ staked: '10.00' }] });

      const balance = await tokenEconomy.getUserTokenBalance('user1');

      expect(balance.totalEarned).toBe(100.5);
      expect(balance.totalSpent).toBe(30.25);
      expect(balance.balance).toBe(70.25);
      expect(balance.staked).toBe(10);
    });

    it('should handle missing balance rows', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const balance = await tokenEconomy.getUserTokenBalance('user1');

      expect(balance.balance).toBe(0);
    });
  });

  describe('verifyStreams', () => {
    it('should return claimed count when no verified streams found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ verified_count: '0' }] });

      const result = await tokenEconomy.verifyStreams('track1', 150);
      expect(result).toBe(150);
    });

    it('should cap at verified count when verified is higher', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ verified_count: '200' }] });

      const result = await tokenEconomy.verifyStreams('track1', 150);
      expect(result).toBe(200);
    });
  });

  describe('calculateSeederRewards', () => {
    it('should calculate seeder rewards with quality multiplier', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          availability_score: '0.9',
          total_upload_bytes: '1000000000',
          total_download_bytes: '2000000000'
        }]
      });

      const reward = await tokenEconomy.calculateSeederRewards('peer1', 1024 * 1024 * 1024);
      expect(reward).toBeGreaterThan(0);
    });

    it('should return default quality score for unknown peer', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const qualityScore = await tokenEconomy.getSeederQualityScore('unknownPeer');
      expect(qualityScore).toBe(1.0);
    });
  });

  describe('recordTokenTransaction', () => {
    it('should record a token transaction', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'tx-1', created_at: new Date() }]
      });

      const tx = await tokenEconomy.recordTokenTransaction(
        'user1', 10.5, 'earned', 'stream', 'track1', 'Stream reward'
      );

      expect(tx.userId).toBe('user1');
      expect(tx.amount).toBe(10.5);
      expect(tx.type).toBe('earned');
      expect(tx.source).toBe('stream');
      expect(tx.referenceId).toBe('track1');
      expect(tx.description).toBe('Stream reward');
    });

    it('should record transaction with null referenceId', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'tx-2', created_at: new Date() }]
      });

      const tx = await tokenEconomy.recordTokenTransaction(
        'user1', 5.0, 'earned', 'listener_bonus', null, 'Bonus'
      );

      expect(tx.referenceId).toBeUndefined();
    });
  });

  describe('getUserTokenTransactions', () => {
    it('should return user transactions', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          { id: 'tx1', amount: '10.0', type: 'earned', source: 'stream', reference_id: 't1', description: 'Reward', created_at: new Date() },
          { id: 'tx2', amount: '5.0', type: 'spent', source: 'staking', reference_id: null, description: null, created_at: new Date() },
        ]
      });

      const transactions = await tokenEconomy.getUserTokenTransactions('user1', 50);

      expect(transactions).toHaveLength(2);
      expect(transactions[0].type).toBe('earned');
      expect(transactions[0].source).toBe('stream');
      expect(transactions[0].referenceId).toBe('t1');
      expect(transactions[1].referenceId).toBeUndefined();
    });
  });

  describe('getDistributionRecords', () => {
    it('should return distribution records for a recipient', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          { id: 'd1', distribution_type: 'creator_reward', recipient_id: 'user1', amount: '50.0', reference_id: null, metadata: { source: 'stream' }, verified: true, created_at: new Date() },
        ]
      });

      const distributions = await tokenEconomy.getDistributionRecords('user1');

      expect(distributions).toHaveLength(1);
      expect(distributions[0].distributionType).toBe('creator_reward');
      expect(distributions[0].verified).toBe(true);
      expect(distributions[0].metadata).toEqual({ source: 'stream' });
    });

    it('should return all distribution records when no recipient specified', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const distributions = await tokenEconomy.getDistributionRecords();
      expect(distributions).toHaveLength(0);
    });
  });
});

describe('MonetizationTiers', () => {
  let monetization: ArtistMonetization;

  beforeEach(() => {
    vi.clearAllMocks();
    monetization = new ArtistMonetization();
  });

  describe('MONETIZATION_TIERS', () => {
    it('should have three tiers defined', () => {
      expect(MONETIZATION_TIERS).toHaveLength(3);
    });

    it('should have correct tier names', () => {
      expect(MONETIZATION_TIERS.map((t) => t.name)).toEqual(['Fan', 'Super Fan', 'Collaborator']);
    });

    it('should have correct pricing', () => {
      expect(MONETIZATION_TIERS[0].monthlyPrice).toBe(4.99);
      expect(MONETIZATION_TIERS[1].monthlyPrice).toBe(9.99);
      expect(MONETIZATION_TIERS[2].monthlyPrice).toBe(24.99);
    });

    it('should have correct creator shares', () => {
      expect(MONETIZATION_TIERS[0].creatorShare).toBe(0.70);
      expect(MONETIZATION_TIERS[1].creatorShare).toBe(0.80);
      expect(MONETIZATION_TIERS[2].creatorShare).toBe(0.90);
    });

    it('should have features for each tier', () => {
      MONETIZATION_TIERS.forEach((tier) => {
        expect(tier.features).toBeDefined();
        expect(tier.features.length).toBeGreaterThan(0);
      });
    });

    it('should have Fan tier with offline downloads', () => {
      const fanTier = MONETIZATION_TIERS[0];
      expect(fanTier.features).toContain('Offline downloads');
    });
  });

  describe('getTiers', () => {
    it('should return all tiers', () => {
      const tiers = monetization.getTiers();
      expect(tiers).toBe(MONETIZATION_TIERS);
    });
  });

  describe('getTier', () => {
    it('should return the correct tier', () => {
      const tier = monetization.getTier('Fan');
      expect(tier?.monthlyPrice).toBe(4.99);
    });

    it('should return undefined for invalid tier', () => {
      const tier = monetization.getTier('Invalid' as any);
      expect(tier).toBeUndefined();
    });
  });

  describe('createSubscription', () => {
    it('should throw for invalid tier', async () => {
      await expect(
        monetization.createSubscription('artist1', 'Invalid' as any, 'sub1')
      ).rejects.toThrow('Invalid tier');
    });

    it('should throw if subscribing to self', async () => {
      mockTransaction.mockImplementation(async (cb: any) => {
        return cb({
          query: vi.fn().mockResolvedValue({ rows: [{ id: 'sub1' }] }),
        });
      });

      await expect(
        monetization.createSubscription('user1', 'Fan', 'user1')
      ).rejects.toThrow('subscription');
    });
  });
});

describe('TipSystem', () => {
  let tipSystem: TipSystem;

  beforeEach(() => {
    vi.clearAllMocks();
    tipSystem = new TipSystem();
  });

  describe('config', () => {
    it('should have default tip config', () => {
      expect(tipSystem.config.minTipAmount).toBe(0.5);
      expect(tipSystem.config.maxTipAmount).toBe(500);
      expect(tipSystem.config.platformFee).toBe(0.05);
      expect(tipSystem.config.instantPayout).toBe(true);
    });

    it('should support default currencies', () => {
      expect(DEFAULT_TIP_CONFIG.supportedCurrencies).toEqual(['USDC', 'ETH', 'MATIC', 'P2P']);
    });
  });

  describe('processTip - validation', () => {
    it('should reject tip below minimum', async () => {
      await expect(
        tipSystem.processTip('user1', 'user2', 0.1, 'USDC')
      ).rejects.toThrow('Tip amount must be between');
    });

    it('should reject tip above maximum', async () => {
      await expect(
        tipSystem.processTip('user1', 'user2', 600, 'USDC')
      ).rejects.toThrow('Tip amount must be between');
    });

    it('should reject unsupported currency', async () => {
      await expect(
        tipSystem.processTip('user1', 'user2', 10, 'XYZ')
      ).rejects.toThrow('Unsupported currency');
    });

    it('should reject tipping yourself', async () => {
      await expect(
        tipSystem.processTip('user1', 'user1', 10, 'USDC')
      ).rejects.toThrow('Cannot tip yourself');
    });
  });

  describe('processTip - successful flow', () => {
    it('should process tip with correct fee and artist amount', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ balance: '50.00' }] }) // getUserBalance
        .mockResolvedValueOnce({ rows: [] }) // debitUser: upsert balance
        .mockResolvedValueOnce({ rows: [] }) // debitUser: insert tx
        .mockResolvedValueOnce({ rows: [] }) // creditArtist: upsert balance
        .mockResolvedValueOnce({ rows: [] }) // creditArtist: insert tx
        .mockResolvedValueOnce({ rows: [{ id: 'tip-1' }] }) // recordTip
        .mockResolvedValueOnce({ rows: [{ id: 'tx-1', created_at: new Date() }] }) // recordTokenTransaction
        .mockResolvedValueOnce({ rows: [{ username: 'fromUser' }] }); // user lookup

      const result = await tipSystem.processTip('fromUser', 'toArtist', 10, 'USDC', 'Great track!');

      expect(result.success).toBe(true);
      expect(result.tipId).toBeDefined();
      expect(result.amount).toBe(10);
      expect(result.artistReceived).toBe(9.5);
      expect(result.platformFee).toBe(0.5);
    });
  });

  describe('getUserBalance', () => {
    it('should return balance for existing balance', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ balance: '25.50' }]
      });

      const balance = await tipSystem.getUserBalance('user1', 'USDC');

      expect(balance.userId).toBe('user1');
      expect(balance.currency).toBe('USDC');
      expect(balance.balance).toBe(25.5);
    });

    it('should return zero balance for new user', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const balance = await tipSystem.getUserBalance('user1', 'ETH');

      expect(balance.balance).toBe(0);
    });
  });

  describe('getTippingStats', () => {
    it('should return correct tip statistics', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          total_tips: '5',
          total_received: '47.50',
          total_fees: '2.50',
          unique_tippers: '3'
        }]
      });

      const stats = await tipSystem.getTippingStats('artist1');

      expect(stats.totalTips).toBe(5);
      expect(stats.totalReceived).toBe(47.5);
      expect(stats.totalFees).toBe(2.5);
      expect(stats.uniqueTippers).toBe(3);
    });

    it('should handle null values in stats', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const stats = await tipSystem.getTippingStats('artist1');

      expect(stats.totalTips).toBe(0);
      expect(stats.totalReceived).toBe(0);
      expect(stats.totalFees).toBe(0);
      expect(stats.uniqueTippers).toBe(0);
    });
  });

  describe('getArtistPreferredPayoutMethod', () => {
    it('should return saved payout method', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ payout_method: 'paypal' }]
      });

      const method = await tipSystem.getArtistPreferredPayoutMethod('artist1');

      expect(method).toBe('paypal');
    });

    it('should default to stripe when not set', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const method = await tipSystem.getArtistPreferredPayoutMethod('artist1');

      expect(method).toBe('stripe');
    });
  });

  describe('getConfig', () => {
    it('should return a copy of config', () => {
      const config = tipSystem.getConfig();
      expect(config).toEqual(DEFAULT_TIP_CONFIG);
    });

    it('should not mutate original config when returned copy is modified', () => {
      const config = tipSystem.getConfig();
      config.minTipAmount = 999;
      expect(tipSystem.config.minTipAmount).toBe(0.5);
    });
  });
});
