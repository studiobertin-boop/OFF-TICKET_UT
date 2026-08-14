-- Migration: motivo della revisione sul codice pratica
-- Date: 2026-08-14
-- Description:
--   Il motivo della revisione, finora raccolto nel form "Dati per la relazione tecnica"
--   e salvato in dm329_technical_data.additional_info (JSONB, nessun cambio richiesto),
--   trasloca sulla pagina di modifica del codice pratica: è un'informazione della pratica,
--   non della scheda tecnica, e la relazione la legge da qui.

ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS motivo_revisione text;

COMMENT ON COLUMN requests.motivo_revisione IS 'Motivo della revisione per §1 della relazione DM329. Alla prima emissione (progressivo 0) si precompila con "Prima emissione", editabile; dalla prima revisione in poi parte vuoto.';

-- ROLLBACK (se necessario):
-- ALTER TABLE requests DROP COLUMN IF EXISTS motivo_revisione;
