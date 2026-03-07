CREATE OR REPLACE FUNCTION validate_signal_performance_result()
RETURNS trigger LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.result NOT IN ('open', 'win', 'loss', 'expired') THEN
    RAISE EXCEPTION 'Invalid result value: %', NEW.result;
  END IF;
  RETURN NEW;
END;
$$;