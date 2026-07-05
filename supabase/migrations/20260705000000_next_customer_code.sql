-- Migration: next available client code helper
-- Date: 2026-07-05
-- Description:
--   RPC that returns the next client code that auto-generation would assign
--   (the customer_identificativo_seq peek). Used by the UI to show the next
--   available number in the "Identificativo" field helper and in the
--   duplicate-code error message.

CREATE OR REPLACE FUNCTION get_next_customer_code()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  -- Next value the sequence would produce (without consuming it) — i.e. exactly
  -- what the BEFORE INSERT trigger assigns when identificativo is left empty.
  SELECT (last_value + CASE WHEN is_called THEN 1 ELSE 0 END)::integer
  FROM customer_identificativo_seq
$$;

GRANT EXECUTE ON FUNCTION get_next_customer_code() TO authenticated;

COMMENT ON FUNCTION get_next_customer_code() IS
  'Returns the next numeric client code auto-generation will assign (peek of customer_identificativo_seq).';
