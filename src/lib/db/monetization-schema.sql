-- ============================================
-- Phase 4: Monetization Database Schema
-- ============================================

-- Token transactions (ledger for token economy)
CREATE TABLE IF NOT EXISTS token_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(20,8) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('earned', 'spent', 'bonus', 'distribution')),
  source VARCHAR(100) NOT NULL,
  reference_id UUID,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for token transactions
CREATE INDEX IF NOT EXISTS idx_token_transactions_user ON token_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_token_transactions_type ON token_transactions(type);
CREATE INDEX IF NOT EXISTS idx_token_transactions_source ON token_transactions(source);
CREATE INDEX IF NOT EXISTS idx_token_transactions_created ON token_transactions(created_at DESC);

-- User token balances (aggregated view for quick lookups)
CREATE TABLE IF NOT EXISTS user_balances (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  currency VARCHAR(20) NOT NULL,
  balance DECIMAL(20,8) DEFAULT 0,
  total_earned DECIMAL(20,8) DEFAULT 0,
  total_spent DECIMAL(20,8) DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, currency)
);

CREATE INDEX IF NOT EXISTS idx_user_balances_currency ON user_balances(currency);

-- Balance transactions (for fiat/crypto currency tracking)
CREATE TABLE IF NOT EXISTS balance_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(20) NOT NULL,
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('credit', 'debit')),
  source VARCHAR(100) NOT NULL,
  reference_id UUID,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_balance_transactions_user ON balance_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_balance_transactions_currency ON balance_transactions(currency);

-- Subscriptions (artist monetization tiers)
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscriber_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tier VARCHAR(50) NOT NULL,
  monthly_price DECIMAL(10,2) NOT NULL,
  creator_share DECIMAL(10,2) NOT NULL,
  platform_fee DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('active', 'cancelled', 'expired', 'pending')),
  start_date TIMESTAMP NOT NULL,
  renew_date TIMESTAMP NOT NULL,
  cancelled_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_artist ON subscriptions(artist_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_subscriber ON subscriptions(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_renew ON subscriptions(renew_date);

-- Subscriber features (what features a subscriber has access to)
CREATE TABLE IF NOT EXISTS subscriber_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  artist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tier_name VARCHAR(50) NOT NULL,
  features JSONB DEFAULT '[]',
  granted_at TIMESTAMP NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriber_features_user ON subscriber_features(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriber_features_artist ON subscriber_features(artist_id);

-- Tips (direct artist support)
CREATE TABLE IF NOT EXISTS tips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_artist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(20) NOT NULL,
  platform_fee DECIMAL(10,2) NOT NULL,
  artist_received DECIMAL(10,2) NOT NULL,
  message TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  payout_id UUID,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tips_from_user ON tips(from_user_id);
CREATE INDEX IF NOT EXISTS idx_tips_to_artist ON tips(to_artist_id);
CREATE INDEX IF NOT EXISTS idx_tips_created ON tips(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tips_currency ON tips(currency);

-- Payouts (artist revenue withdrawals)
CREATE TABLE IF NOT EXISTS payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  method VARCHAR(50) NOT NULL CHECK (method IN ('stripe', 'paypal', 'crypto_wallet', 'platform_credit')),
  type VARCHAR(20) NOT NULL CHECK (type IN ('instant', 'scheduled')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  transaction_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payouts_artist ON payouts(artist_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON payouts(status);

-- Transactions (general ledger for all monetization activities)
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL,
  artist_id UUID REFERENCES users(id) ON DELETE CASCADE,
  subscriber_id UUID REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  tier VARCHAR(50),
  reference_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_artist ON transactions(artist_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(created_at DESC);

-- Token distributions (batch reward distributions)
CREATE TABLE IF NOT EXISTS token_distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  distribution_type VARCHAR(50) NOT NULL,
  recipient_id VARCHAR(255) NOT NULL,
  amount DECIMAL(20,8) NOT NULL,
  reference_id UUID,
  metadata JSONB DEFAULT '{}',
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_token_distributions_recipient ON token_distributions(recipient_id);
CREATE INDEX IF NOT EXISTS idx_token_distributions_type ON token_distributions(distribution_type);
CREATE INDEX IF NOT EXISTS idx_token_distributions_created ON token_distributions(created_at DESC);

-- Artist settings (for payout preferences)
CREATE TABLE IF NOT EXISTS artist_settings (
  artist_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  payout_method VARCHAR(50) DEFAULT 'stripe' CHECK (payout_method IN ('stripe', 'paypal', 'crypto_wallet', 'platform_credit')),
  payout_schedule VARCHAR(20) DEFAULT 'instant' CHECK (payout_schedule IN ('instant', 'daily', 'weekly', 'monthly')),
  crypto_wallet TEXT,
  stripe_account_id TEXT,
  paypal_email TEXT,
  monetization_enabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Grant permissions for monetization tables
GRANT SELECT, INSERT, UPDATE, DELETE ON token_transactions TO PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_balances TO PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON balance_transactions TO PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON subscriptions TO PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON subscriber_features TO PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON tips TO PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON payouts TO PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON transactions TO PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON token_distributions TO PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON artist_settings TO PUBLIC;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA PUBLIC TO PUBLIC;
