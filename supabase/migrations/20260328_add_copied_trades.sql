-- Create copied_trades table for recording copy trade executions
CREATE TABLE IF NOT EXISTS public.copied_trades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  signal_id UUID REFERENCES public.signals(id) ON DELETE CASCADE,
  brokerage_connection_id UUID REFERENCES public.brokerage_connections(id) ON DELETE CASCADE,
  ticker TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('BUY', 'SELL')),
  quantity DECIMAL(12, 4) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  executed_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'executed', 'failed')),
  error_message TEXT,
  idempotency_key TEXT UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_copied_trades_user_id ON public.copied_trades(user_id);
CREATE INDEX IF NOT EXISTS idx_copied_trades_signal_id ON public.copied_trades(signal_id);
CREATE INDEX IF NOT EXISTS idx_copied_trades_idempotency ON public.copied_trades(idempotency_key);
