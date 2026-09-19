/**
 * Phase 4: Monetization Type Definitions
 * Token economy, subscription tiers, tips, and related types
 */

export type Currency = 'USDC' | 'ETH' | 'MATIC' | 'P2P' | 'USD';

export type TokenType = 'earned' | 'spent' | 'bonus' | 'distribution';
export type TokenSource =
  | 'stream'
  | 'seeder'
  | 'listener_bonus'
  | 'subscription_revenue'
  | 'tip_received'
  | 'tip_given'
  | 'staking'
  | 'referral';

export type SubscriptionStatus = 'active' | 'cancelled' | 'expired' | 'pending';
export type SubscriptionTierName = 'Fan' | 'Super Fan' | 'Collaborator';

export type TipStatus = 'pending' | 'completed' | 'failed' | 'refunded';
export type PayoutMethod = 'stripe' | 'paypal' | 'crypto_wallet' | 'platform_credit';

export type TransactionType =
  | 'subscription_revenue'
  | 'tip_received'
  | 'stream_reward'
  | 'seeder_reward'
  | 'listener_bonus'
  | 'platform_fee';

export interface TokenEconomyConfig {
  creatorRewardRate: number;
  seederRewardRate: number;
  listenerBonusRate: number;
  stakingRequirement: number;
  inflationRate: number;
}

export interface TokenDistribution {
  creatorShare: number;
  platformFee: number;
  communityPool: number;
}

export interface TransactionResult {
  success: boolean;
  transactionId: string;
  distribution: TokenDistribution;
  message?: string;
}

export interface UserTokenBalance {
  userId: string;
  balance: number;
  totalEarned: number;
  totalSpent: number;
  staked: number;
}

export interface TokenTransaction {
  id: string;
  userId: string;
  amount: number;
  type: TokenType;
  source: TokenSource;
  referenceId?: string;
  description?: string;
  createdAt: Date;
}

export interface MonetizationTier {
  name: SubscriptionTierName;
  monthlyPrice: number;
  features: string[];
  creatorShare: number;
  subscriberLimit: number;
}

export interface Subscription {
  id: string;
  artistId: string;
  subscriberId: string;
  tier: SubscriptionTierName;
  monthlyPrice: number;
  creatorShare: number;
  platformFee: number;
  status: SubscriptionStatus;
  startDate: Date;
  renewDate: Date;
  cancelledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubscriptionTransaction {
  type: TransactionType;
  artistId: string;
  subscriberId: string;
  amount: number;
  tier: SubscriptionTierName;
  month: Date;
}

export interface TipConfig {
  minTipAmount: number;
  maxTipAmount: number;
  platformFee: number;
  instantPayout: boolean;
  supportedCurrencies: Currency[];
}

export interface TipRecord {
  fromUserId: string;
  toArtistId: string;
  amount: number;
  currency: Currency;
  message?: string;
}

export interface TipResult {
  success: boolean;
  tipId: string;
  amount: number;
  artistReceived: number;
  platformFee: number;
}

export interface UserBalance {
  userId: string;
  currency: Currency;
  balance: number;
}

export interface PayoutRequest {
  artistId: string;
  amount: number;
  method: PayoutMethod;
  type: 'instant' | 'scheduled';
}

export interface PayoutRecord {
  id: string;
  artistId: string;
  amount: number;
  method: PayoutMethod;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  transactionId?: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface TokenDistributionRecord {
  id: string;
  distributionType: string;
  recipientId: string;
  amount: number;
  referenceId?: string;
  metadata: Record<string, unknown>;
  verified: boolean;
  createdAt: Date;
}
