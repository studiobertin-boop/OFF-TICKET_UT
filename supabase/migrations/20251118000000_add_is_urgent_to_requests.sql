-- Migration: Add is_urgent field to requests table
-- Description: Aggiunge campo per segnalare richieste urgenti (gestibile da admin e userdm329)

-- Aggiungi colonna is_urgent
ALTER TABLE requests
ADD COLUMN IF NOT EXISTS is_urgent BOOLEAN DEFAULT false NOT NULL;

-- Crea indice per migliorare le performance delle query filtrate per urgenza
CREATE INDEX IF NOT EXISTS idx_requests_is_urgent ON requests(is_urgent) WHERE is_urgent = true;

-- Commento
COMMENT ON COLUMN requests.is_urgent IS 'Indica se la richiesta è marcata come urgente (gestibile da admin e userdm329)';
