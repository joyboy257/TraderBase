-- Create trigger to automatically verify signals on INSERT
-- Fires AFTER INSERT on signals table when the signal is active and not yet verified
-- Calls verify_signal_position_audit with the new signal's ID

CREATE OR REPLACE TRIGGER on_signal_insert_verify
  AFTER INSERT ON public.signals
  FOR EACH ROW
  WHEN (NEW.is_verified = FALSE AND NEW.is_active = TRUE)
  EXECUTE FUNCTION public.verify_signal_position_audit(NEW.id);
