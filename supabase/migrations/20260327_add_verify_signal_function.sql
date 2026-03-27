-- Create verify_signal_position_audit function
-- Cross-references a signal's ticker/action against the trader's recent Plaid positions
-- within a 24-hour window to determine if the signal is verified.
-- Returns TRUE if verified, FALSE otherwise. Idempotent — safe to re-run.

CREATE OR REPLACE FUNCTION public.verify_signal_position_audit(signal_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  sig public.signals%ROWTYPE;
  pos_record public.positions%ROWTYPE;
BEGIN
  -- Fetch the signal
  SELECT * INTO sig FROM public.signals WHERE id = signal_id;

  -- If signal not found, return FALSE
  IF sig.id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- If trader has no active brokerage connection, cannot verify
  -- Check if user has any active brokerage connection
  IF NOT EXISTS (
    SELECT 1 FROM public.brokerage_connections
    WHERE user_id = sig.user_id AND is_active = TRUE
  ) THEN
    RETURN FALSE;
  END IF;

  -- Check: does leader have a position matching sig.ticker AND sig.action
  -- within 24 hours of sig.created_at?
  -- For BUY signals: any position with quantity > 0
  -- For SELL signals: any position with quantity > 0 (implies long position held)
  IF sig.action = 'BUY' THEN
    SELECT * INTO pos_record
    FROM public.positions
    WHERE user_id = sig.user_id
      AND ticker = sig.ticker
      AND quantity > 0
      AND updated_at >= sig.created_at - INTERVAL '24 hours'
    LIMIT 1;
  ELSE
    -- SELL signal: verify trader had a long position
    SELECT * INTO pos_record
    FROM public.positions
    WHERE user_id = sig.user_id
      AND ticker = sig.ticker
      AND quantity > 0
      AND updated_at >= sig.created_at - INTERVAL '24 hours'
    LIMIT 1;
  END IF;

  IF pos_record.id IS NOT NULL THEN
    UPDATE public.signals
    SET is_verified = TRUE,
        verified_at = NOW(),
        verified_method = 'position_audit'
    WHERE id = signal_id;
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
