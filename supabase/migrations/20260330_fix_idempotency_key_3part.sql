-- Backfill ALL existing rows with correct 3-part key
UPDATE public.copied_trades
SET idempotency_key = signal_id || ':' || user_id || ':' || brokerage_connection_id
WHERE idempotency_key IS NULL
   OR idempotency_key NOT LIKE '%:%:%';

-- Drop old 2-part unique index
DROP INDEX IF EXISTS idx_copied_trades_idempotency;

-- New unique index on 3-part key
CREATE UNIQUE INDEX idx_copied_trades_idempotency_3part
ON public.copied_trades(idempotency_key)
WHERE idempotency_key IS NOT NULL;

-- 3-part composite unique constraint as belt-and-suspenders
ALTER TABLE public.copied_trades
ADD CONSTRAINT copied_trades_3part_unique
UNIQUE (signal_id, user_id, brokerage_connection_id);

-- Enable RLS on copied_trades
ALTER TABLE public.copied_trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own copied_trades"
ON public.copied_trades FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage copied_trades"
ON public.copied_trades FOR ALL
USING (auth.role() = 'service_role');