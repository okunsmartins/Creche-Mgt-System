-- =============================================================================
-- Migration 002: Reference number generation functions
-- =============================================================================
-- All references are generated inside the database inside a transaction
-- to guarantee uniqueness and prevent race conditions.
-- Format: PREFIX-YYYY-NNNNNN (zero-padded 6-digit sequence per year)
-- =============================================================================

-- Sequence tables (one row per year per prefix)
CREATE TABLE IF NOT EXISTS public.reference_sequences (
  prefix      TEXT NOT NULL,
  year        INTEGER NOT NULL,
  next_val    BIGINT NOT NULL DEFAULT 1,
  PRIMARY KEY (prefix, year)
);

-- Lock-safe next value function
CREATE OR REPLACE FUNCTION public.next_reference_val(p_prefix TEXT)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_year INTEGER := EXTRACT(YEAR FROM NOW())::INTEGER;
  v_val  BIGINT;
BEGIN
  INSERT INTO public.reference_sequences (prefix, year, next_val)
  VALUES (p_prefix, v_year, 2)
  ON CONFLICT (prefix, year)
  DO UPDATE SET next_val = reference_sequences.next_val + 1
  RETURNING next_val - 1 INTO v_val;

  RETURN v_val;
END;
$$;

-- Order reference: ORD-YYYY-NNNNNN
CREATE OR REPLACE FUNCTION public.generate_order_reference()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_year INTEGER := EXTRACT(YEAR FROM NOW())::INTEGER;
  v_seq  BIGINT  := public.next_reference_val('ORD');
BEGIN
  RETURN 'ORD-' || v_year || '-' || LPAD(v_seq::TEXT, 6, '0');
END;
$$;

-- Payment reference: PAY-YYYY-NNNNNN
CREATE OR REPLACE FUNCTION public.generate_payment_reference()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_year INTEGER := EXTRACT(YEAR FROM NOW())::INTEGER;
  v_seq  BIGINT  := public.next_reference_val('PAY');
BEGIN
  RETURN 'PAY-' || v_year || '-' || LPAD(v_seq::TEXT, 6, '0');
END;
$$;

-- Order item reference: ITEM-YYYY-NNNNNN
CREATE OR REPLACE FUNCTION public.generate_item_reference()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_year INTEGER := EXTRACT(YEAR FROM NOW())::INTEGER;
  v_seq  BIGINT  := public.next_reference_val('ITEM');
BEGIN
  RETURN 'ITEM-' || v_year || '-' || LPAD(v_seq::TEXT, 6, '0');
END;
$$;

-- Refund reference: REF-YYYY-NNNNNN
CREATE OR REPLACE FUNCTION public.generate_refund_reference()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_year INTEGER := EXTRACT(YEAR FROM NOW())::INTEGER;
  v_seq  BIGINT  := public.next_reference_val('REF');
BEGIN
  RETURN 'REF-' || v_year || '-' || LPAD(v_seq::TEXT, 6, '0');
END;
$$;

-- Pupil payment code: SB-XXXXXXXX (8 random uppercase alphanumeric chars)
-- Collision-safe: caller retries if duplicate is detected (extremely rare).
CREATE OR REPLACE FUNCTION public.generate_pupil_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- omit I, O, 0, 1
  v_code  TEXT := 'SB-';
  v_i     INTEGER;
BEGIN
  FOR v_i IN 1..8 LOOP
    v_code := v_code || substr(v_chars, floor(random() * length(v_chars) + 1)::INTEGER, 1);
  END LOOP;
  RETURN v_code;
END;
$$;
