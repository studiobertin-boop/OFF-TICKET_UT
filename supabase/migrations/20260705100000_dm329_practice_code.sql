-- Migration: DM329 practice code (codice pratica)
-- Date: 2026-07-05
-- Description:
--   Structured storage for the DM329 practice code CODICECLIENTE[LETTERASALA]_PROGRESSIVO-ANNO.
--   Adds columns on requests (sala/progressivo/anno/impianto/parent), a partial unique index
--   (one primary practice per client+sala+progressivo; integrazioni sharing a parent are excluded),
--   support RPCs, fixes the technical-data trigger to read the new indirizzo_impianto column, and
--   drops the now-redundant indirizzo_immobile field from the DM329 request-type schemas.

-- ============================================================================
-- STEP 1: New columns on requests
-- ============================================================================

ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS sala_lettera char(1),
  ADD COLUMN IF NOT EXISTS progressivo smallint,
  ADD COLUMN IF NOT EXISTS anno smallint,
  ADD COLUMN IF NOT EXISTS denominazione_sala text,
  ADD COLUMN IF NOT EXISTS indirizzo_impianto text,
  ADD COLUMN IF NOT EXISTS impianto_uguale_sede_legale boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pratica_padre_id uuid REFERENCES requests(id) ON DELETE SET NULL;

ALTER TABLE requests
  ADD CONSTRAINT sala_lettera_format CHECK (sala_lettera IS NULL OR sala_lettera ~ '^[A-Z]$'),
  ADD CONSTRAINT progressivo_range   CHECK (progressivo IS NULL OR (progressivo BETWEEN 0 AND 99)),
  ADD CONSTRAINT anno_range          CHECK (anno IS NULL OR (anno BETWEEN 2000 AND 2100));

COMMENT ON COLUMN requests.sala_lettera IS 'Lettera sala compressori (A,B,C…). Sempre valorizzata sulle pratiche primarie DM329; a video omessa se il cliente ha una sola sala.';
COMMENT ON COLUMN requests.progressivo IS 'Progressivo pratica per sala: 00 = iniziale, 01,02… = aggiornamenti.';
COMMENT ON COLUMN requests.pratica_padre_id IS 'Se valorizzato, la richiesta (Integrazioni) è un documento agganciato alla pratica padre e ne condivide il codice.';

-- ============================================================================
-- STEP 2: Uniqueness (una pratica primaria per cliente+sala+progressivo)
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS ux_requests_codice_pratica
  ON requests (customer_id, sala_lettera, progressivo)
  WHERE pratica_padre_id IS NULL AND sala_lettera IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_requests_pratica_padre ON requests (pratica_padre_id);

-- ============================================================================
-- STEP 3: Support RPCs
-- ============================================================================

-- Pratiche primarie DM329 di un cliente (da cui il frontend deriva sale, prossima lettera,
-- prossimo progressivo e la lista per il selettore della pratica padre delle Integrazioni).
CREATE OR REPLACE FUNCTION get_client_dm329_overview(p_customer uuid)
RETURNS TABLE (
  request_id uuid,
  sala_lettera char(1),
  progressivo smallint,
  anno smallint,
  denominazione_sala text,
  title text,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT r.id, r.sala_lettera, r.progressivo, r.anno, r.denominazione_sala, r.title, r.created_at
  FROM requests r
  JOIN request_types rt ON rt.id = r.request_type_id
  WHERE r.customer_id = p_customer
    AND rt.name IN ('DM329', 'DM329-Integrazioni')
    AND r.pratica_padre_id IS NULL
    AND r.sala_lettera IS NOT NULL
  ORDER BY r.sala_lettera, r.progressivo
$$;

GRANT EXECUTE ON FUNCTION get_client_dm329_overview(uuid) TO authenticated;

-- Prossimo progressivo per (cliente, sala): 00 se la sala non esiste, altrimenti max+1.
CREATE OR REPLACE FUNCTION get_next_progressivo(p_customer uuid, p_lettera char)
RETURNS smallint
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT (COALESCE(MAX(progressivo), -1) + 1)::smallint
  FROM requests
  WHERE customer_id = p_customer
    AND sala_lettera = p_lettera
    AND pratica_padre_id IS NULL
$$;

GRANT EXECUTE ON FUNCTION get_next_progressivo(uuid, char) TO authenticated;

-- ============================================================================
-- STEP 4: Fix trigger — copia l'indirizzo impianto dalla nuova colonna
-- ============================================================================

CREATE OR REPLACE FUNCTION create_technical_data_for_dm329()
RETURNS TRIGGER AS $$
DECLARE
  v_request_type_name TEXT;
BEGIN
  SELECT name INTO v_request_type_name FROM request_types WHERE id = NEW.request_type_id;

  IF v_request_type_name = 'DM329' THEN
    INSERT INTO dm329_technical_data (request_id, created_by, indirizzo_impianto)
    VALUES (NEW.id, NEW.created_by, NEW.indirizzo_impianto);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 5: Rimuovi indirizzo_immobile dagli schemi DM329 (gestito dalla sezione dedicata)
-- ============================================================================

UPDATE request_types
SET fields_schema = '[
  {"name":"cliente","type":"autocomplete","label":"Cliente","required":true,"dataSource":"customers","valueField":"id","displayField":"ragione_sociale"},
  {"name":"off_cac","type":"select","label":"OFF / CAC","options":["off","cac"],"required":false},
  {"name":"no_civa","type":"boolean","label":"No CIVA","required":false},
  {"name":"note","type":"textarea","label":"Note","required":false}
]'::jsonb
WHERE name IN ('DM329', 'DM329-Integrazioni');

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
