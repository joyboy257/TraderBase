-- Create trigger function and trigger to automatically verify signals on INSERT
-- Fires AFTER INSERT on signals table when the signal is active and not yet verified
-- Calls verify_signal_position_audit with the new signal's ID via a wrapper

CREATE OR REPLACE FUNCTION public.trigger_verify_signal()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.verify_signal_position_audit(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_signal_insert_verify ON public.signals;
CREATE TRIGGER on_signal_insert_verify
  AFTER INSERT ON public.signals
  FOR EACH ROW
  WHEN (NEW.is_verified = FALSE AND NEW.is_active = TRUE)
  EXECUTE FUNCTION public.trigger_verify_signal();
