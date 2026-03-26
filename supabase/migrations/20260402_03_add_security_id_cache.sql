-- Create security_id_cache table for Plaid security_id lookups
-- postInvestmentOrder requires Plaid security_id, not ticker
CREATE TABLE IF NOT EXISTS public.security_id_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brokerage_connection_id UUID REFERENCES public.brokerage_connections(id) ON DELETE CASCADE,
  ticker TEXT NOT NULL,
  security_id TEXT NOT NULL,
  security_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(brokerage_connection_id, ticker)
);

CREATE INDEX idx_security_id_cache_ticker ON public.security_id_cache(ticker);
CREATE INDEX idx_security_id_cache_connection_id ON public.security_id_cache(brokerage_connection_id);

-- Row Level Security
ALTER TABLE public.security_id_cache ENABLE ROW LEVEL SECURITY;

-- Service role can manage security_id_cache (used by webhooks and cron)
CREATE POLICY "Service role can manage security_id_cache" ON public.security_id_cache
  FOR ALL USING (auth.role() = 'service_role');
