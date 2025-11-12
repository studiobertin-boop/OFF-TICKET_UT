-- Migration: Create dm329_technical_data table
-- Description: Tabella per dati tecnici delle pratiche DM329 (scheda dati sala compressori e apparecchiature)

CREATE TABLE IF NOT EXISTS dm329_technical_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID UNIQUE NOT NULL REFERENCES requests(id) ON DELETE CASCADE,

  -- Dati generali impianto
  indirizzo_impianto TEXT,
  indirizzo_impianto_formatted JSONB, -- Dati strutturati dall'autocomplete (address components)

  -- Stato compilazione scheda
  is_completed BOOLEAN DEFAULT false NOT NULL,
  completed_by UUID REFERENCES users(id),
  completed_at TIMESTAMPTZ,

  -- Dati apparecchiature (struttura flessibile JSONB)
  -- Sarà popolato nei passi successivi con i campi specifici forniti dall'utente
  equipment_data JSONB DEFAULT '{}'::jsonb NOT NULL,

  -- Dati OCR e normalizzazione
  ocr_processing_status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
  ocr_results JSONB DEFAULT '[]'::jsonb, -- Array di risultati OCR dalle foto targhette
  ocr_processed_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_by UUID REFERENCES users(id),

  -- Constraints
  CONSTRAINT dm329_technical_data_ocr_status_check
    CHECK (ocr_processing_status IN ('pending', 'processing', 'completed', 'failed'))
);

-- Indexes
CREATE INDEX idx_dm329_technical_data_request_id ON dm329_technical_data(request_id);
CREATE INDEX idx_dm329_technical_data_completed ON dm329_technical_data(is_completed);
CREATE INDEX idx_dm329_technical_data_ocr_status ON dm329_technical_data(ocr_processing_status);

-- Index GIN per ricerche su JSONB
CREATE INDEX idx_dm329_technical_data_equipment_data ON dm329_technical_data USING gin(equipment_data);
CREATE INDEX idx_dm329_technical_data_ocr_results ON dm329_technical_data USING gin(ocr_results);

-- Trigger per aggiornare updated_at
CREATE OR REPLACE FUNCTION update_dm329_technical_data_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_dm329_technical_data_updated_at
  BEFORE UPDATE ON dm329_technical_data
  FOR EACH ROW
  EXECUTE FUNCTION update_dm329_technical_data_updated_at();

-- Trigger per aggiornare lo stato della richiesta quando la scheda viene completata
CREATE OR REPLACE FUNCTION update_request_status_on_technical_data_completion()
RETURNS TRIGGER AS $$
BEGIN
  -- Se la scheda viene marcata come completata, aggiorna lo stato della richiesta
  IF NEW.is_completed = true AND (OLD.is_completed IS NULL OR OLD.is_completed = false) THEN
    -- Aggiorna lo stato solo se è una richiesta DM329 e lo stato attuale è 1-INCARICO_RICEVUTO
    UPDATE requests
    SET
      status = '2-SCHEDA_DATI_PRONTA',
      updated_at = now()
    WHERE id = NEW.request_id
    AND status = '1-INCARICO_RICEVUTO'
    AND EXISTS (
      SELECT 1 FROM request_types rt
      WHERE rt.id = requests.request_type_id
      AND rt.name = 'DM329'
    );

    -- Registra nel history
    INSERT INTO request_history (request_id, status_from, status_to, changed_by, notes)
    SELECT
      NEW.request_id,
      '1-INCARICO_RICEVUTO',
      '2-SCHEDA_DATI_PRONTA',
      NEW.completed_by,
      'Scheda dati tecnici completata automaticamente'
    WHERE EXISTS (
      SELECT 1 FROM requests
      WHERE id = NEW.request_id
      AND status = '2-SCHEDA_DATI_PRONTA'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_request_status_on_completion
  AFTER UPDATE ON dm329_technical_data
  FOR EACH ROW
  EXECUTE FUNCTION update_request_status_on_technical_data_completion();

-- RLS Policies
ALTER TABLE dm329_technical_data ENABLE ROW LEVEL SECURITY;

-- Policy: Admin e userdm329 possono vedere tutte le schede dati
CREATE POLICY "Admin and userdm329 can view all technical data"
  ON dm329_technical_data
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'userdm329')
    )
  );

-- Policy: Admin e userdm329 possono creare schede dati
CREATE POLICY "Admin and userdm329 can create technical data"
  ON dm329_technical_data
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'userdm329')
    )
  );

-- Policy: Admin e userdm329 possono modificare schede dati
CREATE POLICY "Admin and userdm329 can update technical data"
  ON dm329_technical_data
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'userdm329')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'userdm329')
    )
  );

-- Policy: Solo admin può eliminare schede dati
CREATE POLICY "Only admin can delete technical data"
  ON dm329_technical_data
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Funzione per creare automaticamente una scheda dati quando viene creata una richiesta DM329
CREATE OR REPLACE FUNCTION create_technical_data_for_dm329()
RETURNS TRIGGER AS $$
DECLARE
  v_request_type_name TEXT;
BEGIN
  -- Verifica se la richiesta è di tipo DM329
  SELECT name INTO v_request_type_name
  FROM request_types
  WHERE id = NEW.request_type_id;

  IF v_request_type_name = 'DM329' THEN
    -- Crea la scheda dati tecnici
    INSERT INTO dm329_technical_data (
      request_id,
      created_by,
      indirizzo_impianto
    ) VALUES (
      NEW.id,
      NEW.created_by,
      NEW.custom_fields->>'indirizzo_impianto' -- Copia l'indirizzo dal form iniziale
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_technical_data_for_dm329
  AFTER INSERT ON requests
  FOR EACH ROW
  EXECUTE FUNCTION create_technical_data_for_dm329();

-- Commenti
COMMENT ON TABLE dm329_technical_data IS 'Scheda dati tecnici per pratiche DM329: dati sala compressori e apparecchiature';
COMMENT ON COLUMN dm329_technical_data.request_id IS 'Riferimento alla richiesta DM329 (relazione 1:1)';
COMMENT ON COLUMN dm329_technical_data.indirizzo_impianto IS 'Indirizzo impianto (testo libero o da autocomplete)';
COMMENT ON COLUMN dm329_technical_data.indirizzo_impianto_formatted IS 'Dati strutturati indirizzo da Google Places API';
COMMENT ON COLUMN dm329_technical_data.is_completed IS 'Indica se la scheda è stata completata e verificata';
COMMENT ON COLUMN dm329_technical_data.equipment_data IS 'Dati apparecchiature in formato JSONB flessibile';
COMMENT ON COLUMN dm329_technical_data.ocr_processing_status IS 'Stato elaborazione OCR: pending, processing, completed, failed';
COMMENT ON COLUMN dm329_technical_data.ocr_results IS 'Array risultati OCR da foto targhette (raw + normalizzati)';
