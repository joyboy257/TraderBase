-- Create sltp_monitors table for tracking stop-loss / take-profit on copied positions
CREATE TABLE IF NOT EXISTS public.sltp_monitors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  position_id UUID REFERENCES public.positions(id) ON DELETE CASCADE,
  copied_trade_id UUID REFERENCES public.copied_trades(id) ON DELETE CASCADE,
  signal_id UUID REFERENCES public.signals(id) ON DELETE CASCADE,
  brokerage_connection_id UUID REFERENCES public.brokerage_connections(id) ON DELETE CASCADE,
  ticker TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('BUY', 'SELL')),
  stop_loss DECIMAL(10,2),
  take_profit DECIMAL(10,2),
  trailing_stop_pct DECIMAL(5,2),
  trailing_activate_pct DECIMAL(5,2) DEFAULT 0,
  trailing_high DECIMAL(10,2),
  trailing_low DECIMAL(10,2),
  entry_price DECIMAL(10,2) NOT NULL,
  sl_order_id TEXT,
  tp_order_id TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'sl_triggered', 'tp_triggered', 'trailing_triggered', 'cancelled')),
  triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sltp_monitors_status ON public.sltp_monitors(status) WHERE status = 'active';
CREATE INDEX idx_sltp_monitors_position_id ON public.sltp_monitors(position_id);
CREATE INDEX idx_sltp_monitors_user_id ON public.sltp_monitors(user_id);
CREATE INDEX idx_sltp_monitors_ticker ON public.sltp_monitors(ticker);

-- Row Level Security
ALTER TABLE public.sltp_monitors ENABLE ROW LEVEL SECURITY;

-- Users can read their own monitors
CREATE POLICY "Users can read own sltp_monitors" ON public.sltp_monitors
  FOR SELECT USING (auth.uid() = user_id);

-- Service role can manage sltp_monitors (used by cron job via service client)
CREATE POLICY "Service role can manage sltp_monitors" ON public.sltp_monitors
  FOR ALL USING (auth.role() = 'service_role');
