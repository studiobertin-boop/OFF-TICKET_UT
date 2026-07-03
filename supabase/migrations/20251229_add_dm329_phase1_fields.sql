-- Migration: Add Phase 1 fields for DM329 Carbone template
-- Date: 2025-12-29
-- Description: Adds simple fields needed for basic template rendering (30 placeholders)

-- =====================================================
-- 1. TABELLA customers - Aggiungi campi indirizzo dettagliati
-- =====================================================

-- Aggiungi numero civico sede legale
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS sede_legale_civico TEXT;

-- Aggiungi descrizione attività
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS descrizione_attivita TEXT;

COMMENT ON COLUMN customers.sede_legale_civico IS 'Numero civico sede legale (es: "15", "23/A")';
COMMENT ON COLUMN customers.descrizione_attivita IS 'Descrizione attività svolta dal cliente (es: "Produzione componenti meccanici")';

-- =====================================================
-- 2. TABELLA dm329_technical_data - Aggiungi flags e metadata
-- =====================================================

-- Flag: sito uguale a sede legale
ALTER TABLE dm329_technical_data
ADD COLUMN IF NOT EXISTS sito_uguale_sede_legale BOOLEAN DEFAULT false;

-- Flag: documento ha revisione
ALTER TABLE dm329_technical_data
ADD COLUMN IF NOT EXISTS ha_revisione BOOLEAN DEFAULT false;

-- Motivo revisione documento
ALTER TABLE dm329_technical_data
ADD COLUMN IF NOT EXISTS motivo_revisione TEXT;

-- Flag: ha verifiche spessimetriche
ALTER TABLE dm329_technical_data
ADD COLUMN IF NOT EXISTS ha_spessimetrica BOOLEAN DEFAULT false;

-- Flag: spessimetrica su compressori
ALTER TABLE dm329_technical_data
ADD COLUMN IF NOT EXISTS ha_spessimetrica_compressori BOOLEAN DEFAULT false;

-- Posizioni compressori sottoposti a spessimetrica (es: "C1, C3")
ALTER TABLE dm329_technical_data
ADD COLUMN IF NOT EXISTS posizioni_compressori_spessimetrati TEXT;

-- Commenti
COMMENT ON COLUMN dm329_technical_data.sito_uguale_sede_legale IS 'Indica se il sito impianto coincide con la sede legale del cliente';
COMMENT ON COLUMN dm329_technical_data.ha_revisione IS 'Indica se il documento è una revisione';
COMMENT ON COLUMN dm329_technical_data.motivo_revisione IS 'Motivo della revisione (es: "modifica configurazione impianto")';
COMMENT ON COLUMN dm329_technical_data.ha_spessimetrica IS 'Indica se sono state effettuate verifiche spessimetriche';
COMMENT ON COLUMN dm329_technical_data.ha_spessimetrica_compressori IS 'Indica se le verifiche spessimetriche riguardano i compressori';
COMMENT ON COLUMN dm329_technical_data.posizioni_compressori_spessimetrati IS 'Elenco posizioni compressori sottoposti a verifica spessimetrica';

-- =====================================================
-- 3. VERIFICA CAMPI ESISTENTI
-- =====================================================

-- Verifica che sito_civico esista già (dovrebbe esistere)
-- Se non esiste, aggiungerlo
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'dm329_technical_data'
        AND column_name = 'sito_civico'
    ) THEN
        ALTER TABLE dm329_technical_data
        ADD COLUMN sito_civico TEXT;

        COMMENT ON COLUMN dm329_technical_data.sito_civico IS 'Numero civico sito impianto';
    END IF;
END $$;

-- =====================================================
-- 4. INDICI (opzionali, per performance)
-- =====================================================

-- Indice su sito_uguale_sede_legale per query filtrate
CREATE INDEX IF NOT EXISTS idx_dm329_sito_uguale_sede
ON dm329_technical_data(sito_uguale_sede_legale)
WHERE sito_uguale_sede_legale = true;

-- Indice su ha_spessimetrica per query filtrate
CREATE INDEX IF NOT EXISTS idx_dm329_ha_spessimetrica
ON dm329_technical_data(ha_spessimetrica)
WHERE ha_spessimetrica = true;

-- =====================================================
-- 5. AGGIORNA RLS (se necessario)
-- =====================================================

-- Le policy RLS esistenti dovrebbero già coprire i nuovi campi
-- Verifica che le policy allow_select, allow_insert, allow_update siano presenti

-- =====================================================
-- FINE MIGRATION
-- =====================================================

-- ISTRUZIONI APPLICAZIONE:
-- 1. Copia questo file
-- 2. Vai su Supabase Dashboard > SQL Editor
-- 3. Incolla il contenuto
-- 4. Esegui la query
-- 5. Verifica che tutti i campi siano stati aggiunti correttamente

-- ROLLBACK (se necessario):
/*
ALTER TABLE customers DROP COLUMN IF EXISTS sede_legale_civico;
ALTER TABLE customers DROP COLUMN IF EXISTS descrizione_attivita;

ALTER TABLE dm329_technical_data DROP COLUMN IF EXISTS sito_uguale_sede_legale;
ALTER TABLE dm329_technical_data DROP COLUMN IF EXISTS ha_revisione;
ALTER TABLE dm329_technical_data DROP COLUMN IF EXISTS motivo_revisione;
ALTER TABLE dm329_technical_data DROP COLUMN IF EXISTS ha_spessimetrica;
ALTER TABLE dm329_technical_data DROP COLUMN IF EXISTS ha_spessimetrica_compressori;
ALTER TABLE dm329_technical_data DROP COLUMN IF EXISTS posizioni_compressori_spessimetrati;

DROP INDEX IF EXISTS idx_dm329_sito_uguale_sede;
DROP INDEX IF EXISTS idx_dm329_ha_spessimetrica;
*/
