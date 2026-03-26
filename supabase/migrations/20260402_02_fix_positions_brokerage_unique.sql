-- Fix positions unique constraint to include brokerage_connection_id
-- The current constraint UNIQUE(user_id, ticker) conflicts with upserts that use
-- onConflict: "user_id,brokerage_connection_id,ticker"

-- Data cleanup: keep newest row per (user_id, ticker, brokerage_connection_id)
DELETE FROM public.positions a
  USING public.positions b
  WHERE a.user_id = b.user_id
    AND a.ticker = b.ticker
    AND a.brokerage_connection_id = b.brokerage_connection_id
    AND a.id < b.id;

-- Drop incorrect constraint
ALTER TABLE public.positions DROP CONSTRAINT IF EXISTS positions_user_id_ticker_key;

-- Add correct constraint
ALTER TABLE public.positions ADD CONSTRAINT positions_user_id_ticker_brokerage_connection_id_key
  UNIQUE (user_id, ticker, brokerage_connection_id);
