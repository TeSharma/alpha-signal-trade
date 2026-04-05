-- Dual-Mode AI Trading System: Add new columns for source tracking and Web3 readiness
-- Created: 2026-03-31

-- Add new columns to trading_signals table
ALTER TABLE trading_signals 
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'ai' CHECK (source IN ('ai', 'user')),
ADD COLUMN IF NOT EXISTS ai_decision TEXT CHECK (ai_decision IN ('confirm', 'reject', 'modify')),
ADD COLUMN IF NOT EXISTS wallet_address TEXT,
ADD COLUMN IF NOT EXISTS tx_hash TEXT,
ADD COLUMN IF NOT EXISTS ai_comment TEXT;

-- Add index for source filtering (improve query performance)
CREATE INDEX IF NOT EXISTS idx_trading_signals_source ON trading_signals(source);

-- Add index for ai_decision filtering
CREATE INDEX IF NOT EXISTS idx_trading_signals_ai_decision ON trading_signals(ai_decision);

-- Update existing rows to have default source
UPDATE trading_signals SET source = 'ai' WHERE source IS NULL;

-- Add comment to columns for documentation
COMMENT ON COLUMN trading_signals.source IS 'Signal source: ai (auto-generated) or user (user-created)';
COMMENT ON COLUMN trading_signals.ai_decision IS 'AI verdict for user trades: confirm, reject, or modify';
COMMENT ON COLUMN trading_signals.wallet_address IS 'Web3 wallet address for on-chain execution';
COMMENT ON COLUMN trading_signals.tx_hash IS 'Transaction hash for on-chain execution';
COMMENT ON COLUMN trading_signals.ai_comment IS 'AI-generated comment or explanation for the signal';

-- Create view for AI-generated signals only
CREATE OR REPLACE VIEW ai_signals AS
SELECT * FROM trading_signals 
WHERE source = 'ai' AND status = 'active';

-- Create view for user-created signals with AI confirmation
CREATE OR REPLACE VIEW user_signals AS
SELECT * FROM trading_signals 
WHERE source = 'user' AND status = 'active';

-- Create view for confirmed user trades
CREATE OR REPLACE VIEW confirmed_user_trades AS
SELECT * FROM trading_signals 
WHERE source = 'user' AND ai_decision = 'confirm' AND status = 'active';

-- Create view for rejected user trades
CREATE OR REPLACE VIEW rejected_user_trades AS
SELECT * FROM trading_signals 
WHERE source = 'user' AND ai_decision = 'reject' AND status = 'active';