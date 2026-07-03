-- Migration: Add additional_info column to dm329_technical_data
-- Date: 2026-01-04
-- Description: Aggiunge colonna JSONB per memorizzare informazioni aggiuntive
--              necessarie alla generazione della relazione tecnica (descrizione attività,
--              tipo giri compressori, collegamenti compressori-serbatoi, ecc.)

-- Add additional_info column
ALTER TABLE dm329_technical_data
ADD COLUMN IF NOT EXISTS additional_info JSONB DEFAULT '{}'::jsonb;

-- Add comment to column
COMMENT ON COLUMN dm329_technical_data.additional_info IS
'Informazioni aggiuntive per generazione relazione tecnica. Struttura:
{
  "descrizioneAttivita": "string - Descrizione attività ATECO",
  "compressoriGiri": {
    "C1": "fissi" | "variabili",
    "C2": "fissi" | "variabili"
  },
  "spessimetrica": ["C1", "S2"] - Array codici apparecchiature sottoposte a verifica,
  "collegamentiCompressoriSerbatoi": {
    "C1": ["S1", "S2"],
    "C2": ["S1"]
  },
  "motivoRevisione": "string - Motivo revisione documento (opzionale)"
}';

-- Create index for faster JSONB queries
CREATE INDEX IF NOT EXISTS idx_dm329_additional_info_gin
ON dm329_technical_data USING gin(additional_info);

-- Function to validate additional_info structure
CREATE OR REPLACE FUNCTION validate_dm329_additional_info(info JSONB)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if it's a valid JSON object
  IF jsonb_typeof(info) != 'object' THEN
    RETURN FALSE;
  END IF;

  -- Validate descrizioneAttivita (optional string)
  IF info ? 'descrizioneAttivita' THEN
    IF jsonb_typeof(info->'descrizioneAttivita') != 'string' THEN
      RETURN FALSE;
    END IF;
  END IF;

  -- Validate compressoriGiri (optional object with string values)
  IF info ? 'compressoriGiri' THEN
    IF jsonb_typeof(info->'compressoriGiri') != 'object' THEN
      RETURN FALSE;
    END IF;
  END IF;

  -- Validate spessimetrica (optional array)
  IF info ? 'spessimetrica' THEN
    IF jsonb_typeof(info->'spessimetrica') != 'array' THEN
      RETURN FALSE;
    END IF;
  END IF;

  -- Validate collegamentiCompressoriSerbatoi (optional object)
  IF info ? 'collegamentiCompressoriSerbatoi' THEN
    IF jsonb_typeof(info->'collegamentiCompressoriSerbatoi') != 'object' THEN
      RETURN FALSE;
    END IF;
  END IF;

  -- Validate motivoRevisione (optional string)
  IF info ? 'motivoRevisione' THEN
    IF jsonb_typeof(info->'motivoRevisione') != 'string' THEN
      RETURN FALSE;
    END IF;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add check constraint
ALTER TABLE dm329_technical_data
ADD CONSTRAINT check_additional_info_structure
CHECK (validate_dm329_additional_info(additional_info));

COMMENT ON FUNCTION validate_dm329_additional_info(JSONB) IS
'Valida la struttura del campo additional_info per dm329_technical_data';
