CREATE TABLE public.webhook_events (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source        TEXT NOT NULL,
  event_id      TEXT NOT NULL,
  webhook_type  TEXT NOT NULL,
  webhook_code  TEXT NOT NULL,
  item_id       TEXT,
  raw_payload   JSONB NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts      INT NOT NULL DEFAULT 0,
  max_attempts  INT NOT NULL DEFAULT 3,
  next_retry_at TIMESTAMPTZ,
  last_error    TEXT,
  resolved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(source, event_id)
);

CREATE INDEX idx_webhook_events_status_retry
  ON public.webhook_events(status, next_retry_at)
  WHERE status = 'pending';

CREATE INDEX idx_webhook_events_source_item
  ON public.webhook_events(source, item_id);

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage webhook_events"
  ON public.webhook_events FOR ALL
  USING (auth.role() = 'service_role');
