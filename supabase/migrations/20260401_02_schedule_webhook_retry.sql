SELECT cron.schedule(
  'process-webhook-retries',
  '* * * * *',
  $$SELECT public.process_pending_webhook_events()$$
);

CREATE OR REPLACE FUNCTION public.process_pending_webhook_events()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  event_record RECORD;
  backoff_intervals INT[] := ARRAY[1, 10, 60]; -- minutes
BEGIN
  FOR event_record IN
    SELECT id, source, webhook_code, raw_payload, attempts, max_attempts, created_at
    FROM public.webhook_events
    WHERE status = 'pending'
      AND next_retry_at <= NOW()
    ORDER BY next_retry_at ASC
    LIMIT 50
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.webhook_events
    SET status = 'processing'
    WHERE id = event_record.id;

    -- Re-dispatch (MVP: via pg_net or HTTP call to internal endpoint)
    -- On success: UPDATE status='completed', resolved_at=NOW()
    -- On failure:
    --   attempts = attempts + 1
    --   last_error = <error>
    --   If attempts >= max_attempts: status = 'failed'
    --   Else: status = 'pending', next_retry_at = NOW() + backoff_intervals[attempts + 1] * INTERVAL '1 minute'
  END LOOP;
END;
$$;
