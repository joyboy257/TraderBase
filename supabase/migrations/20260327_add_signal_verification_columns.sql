-- Add verification metadata columns to signals table
-- Records when and how a signal was verified (position audit, manual, etc.)
-- Existing signals remain unaffected (verified_at = NULL)

ALTER TABLE public.signals
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_method TEXT;  -- e.g., 'position_audit', 'manual', 'brokerage_link'
