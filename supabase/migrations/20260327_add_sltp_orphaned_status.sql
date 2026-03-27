-- Add 'orphaned' as a valid status value for sltp_monitors
-- This allows monitors that have lost their position link to be distinctly flagged
-- rather than being silently skipped (which happened with the INNER JOIN bug)

ALTER TABLE public.sltp_monitors
  DROP CONSTRAINT IF EXISTS sltp_monitors_status_check,
  ADD CONSTRAINT sltp_monitors_status_check
    CHECK (status IN ('active', 'sl_triggered', 'tp_triggered', 'trailing_triggered', 'cancelled', 'orphaned'));
