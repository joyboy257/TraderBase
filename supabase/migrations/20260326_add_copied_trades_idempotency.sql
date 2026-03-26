-- Add idempotency_key column for copy trading deduplication
-- This ensures that duplicate webhook calls or double server action clicks
-- do not create multiple copied_trade rows for the same (signal_id, user_id)

ALTER TABLE public.copied_trades
ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;

-- Backfill existing rows with composite key
UPDATE public.copied_trades
SET idempotency_key = signal_id || ':' || user_id
WHERE idempotency_key IS NULL;

-- Create unique index for idempotency (allows ON CONFLICT DO NOTHING)
CREATE UNIQUE INDEX IF NOT EXISTS idx_copied_trades_idempotency
ON public.copied_trades(idempotency_key);

-- Alternative approach (if unique constraint already exists via partial index):
-- Use ON CONFLICT (signal_id, user_id) DO NOTHING in application code
-- once a unique constraint/index is added on (signal_id, user_id)
