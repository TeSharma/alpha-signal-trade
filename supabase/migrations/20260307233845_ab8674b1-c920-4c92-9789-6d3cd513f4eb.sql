CREATE TABLE signal_performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id uuid REFERENCES trading_signals(id) ON DELETE CASCADE NOT NULL,
  pair text NOT NULL,
  direction text NOT NULL,
  entry_price numeric,
  stop_loss numeric,
  take_profit numeric,
  result text DEFAULT 'open',
  pnl_percent numeric DEFAULT 0,
  time_to_target interval,
  model_version text,
  strategy text,
  created_at timestamptz DEFAULT now(),
  closed_at timestamptz,
  UNIQUE(signal_id)
);

-- Validation trigger instead of CHECK constraint
CREATE OR REPLACE FUNCTION validate_signal_performance_result()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.result NOT IN ('open', 'win', 'loss', 'expired') THEN
    RAISE EXCEPTION 'Invalid result value: %', NEW.result;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_signal_performance_result
  BEFORE INSERT OR UPDATE ON signal_performance
  FOR EACH ROW EXECUTE FUNCTION validate_signal_performance_result();

ALTER TABLE signal_performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view signal performance"
  ON signal_performance FOR SELECT USING (true);

CREATE POLICY "Service role can insert performance"
  ON signal_performance FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role can update performance"
  ON signal_performance FOR UPDATE USING (true);