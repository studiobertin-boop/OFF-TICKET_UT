-- Migration: Extend equipment_data JSONB structure for Phase 1
-- Date: 2025-12-29
-- Description: Documenta la struttura JSONB estesa per equipment_data

-- =====================================================
-- NOTA IMPORTANTE
-- =====================================================
-- Questo file NON modifica direttamente la struttura della tabella,
-- ma documenta la struttura JSONB che deve essere usata quando si
-- inseriscono/aggiornano dati in dm329_technical_data.equipment_data
--
-- I campi JSONB sono flessibili e non richiedono ALTER TABLE,
-- ma è importante documentare la struttura attesa.
-- =====================================================

-- =====================================================
-- STRUTTURA JSONB EQUIPMENT_DATA - PHASE 1
-- =====================================================

/*
STRUTTURA COMPLETA equipment_data (JSONB):

{
  "compressori": [
    {
      // ===== CAMPI ESISTENTI =====
      "tipo": "Compressore a vite",
      "marca": "Atlas Copco",
      "modello": "GA 37",
      "matricola": "12345678",
      "potenza_nominale": 37,
      "tensione": 400,
      "tipo_giri": "fissi",
      "ps_pressione_max": 13,
      "volume_aria_prodotto": 100,

      // ===== NUOVI CAMPI PHASE 1 =====
      "posizione": "C1",                    // Posizione nell'impianto (es: "C1", "C2")
      "anno_produzione": "2020"             // Anno di produzione
    }
  ],

  "serbatoi": [
    {
      // ===== CAMPI ESISTENTI =====
      "tipo": "Serbatoio verticale",
      "marca": "Worthington",
      "modello": "RV 500",
      "matricola": "87654321",
      "volume": 500,
      "ps_pressione_max": 11,
      "ps_x_volume": 5500,

      // ===== NUOVI CAMPI PHASE 1 =====
      "posizione": "S1",                    // Posizione nell'impianto (es: "S1", "S2")
      "anno_produzione": "2019"             // Anno di produzione
    }
  ],

  "essiccatori": [
    {
      // ===== CAMPI ESISTENTI =====
      "tipo": "Essiccatore frigorifero",
      "marca": "Pneumatech",
      "modello": "PD 50",
      "matricola": "11223344",
      "potenza_nominale": 0.5,
      "tensione": 230,

      // ===== NUOVI CAMPI PHASE 1 =====
      "posizione": "E1",                    // Posizione nell'impianto (es: "E1", "E2")
      "anno_produzione": "2021"             // Anno di produzione
    }
  ],

  "filtri": [
    {
      // ===== CAMPI ESISTENTI =====
      "tipo": "Filtro coalescente",
      "marca": "Parker",
      "modello": "FC-100",
      "matricola": "55667788",

      // ===== NUOVI CAMPI PHASE 1 =====
      "posizione": "F1",                    // Posizione nell'impianto (es: "F1", "F2")
      "anno_produzione": "2020"             // Anno di produzione
    }
  ],

  "separatori": [
    {
      // ===== CAMPI ESISTENTI =====
      "tipo": "Separatore acqua-olio",
      "marca": "OMI",
      "modello": "OSC 10",
      "matricola": "99887766",

      // ===== NUOVI CAMPI PHASE 1 =====
      "posizione": "SEP1",                  // Posizione nell'impianto
      "anno_produzione": "2020"             // Anno di produzione
    }
  ]
}
*/

-- =====================================================
-- VALIDAZIONE JSONB (opzionale)
-- =====================================================

-- Funzione helper per validare la presenza dei campi minimi
-- (può essere usata in trigger o constraint check)

CREATE OR REPLACE FUNCTION validate_equipment_data_phase1(data JSONB)
RETURNS BOOLEAN AS $$
DECLARE
  compressore JSONB;
  serbatoio JSONB;
  essiccatore JSONB;
BEGIN
  -- Valida compressori
  IF data ? 'compressori' THEN
    FOR compressore IN SELECT * FROM jsonb_array_elements(data->'compressori')
    LOOP
      -- Campi obbligatori esistenti
      IF NOT (compressore ? 'marca' AND compressore ? 'modello') THEN
        RAISE NOTICE 'Compressore mancante marca o modello';
        RETURN FALSE;
      END IF;

      -- Nuovi campi raccomandati (non obbligatori)
      IF NOT (compressore ? 'posizione') THEN
        RAISE NOTICE 'Compressore senza posizione (raccomandato)';
      END IF;
    END LOOP;
  END IF;

  -- Valida serbatoi
  IF data ? 'serbatoi' THEN
    FOR serbatoio IN SELECT * FROM jsonb_array_elements(data->'serbatoi')
    LOOP
      IF NOT (serbatoio ? 'marca' AND serbatoio ? 'volume') THEN
        RAISE NOTICE 'Serbatoio mancante marca o volume';
        RETURN FALSE;
      END IF;
    END LOOP;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION validate_equipment_data_phase1(JSONB) IS
'Valida la struttura JSONB di equipment_data per Phase 1. Controlla campi obbligatori e raccomandati.';

-- =====================================================
-- QUERY DI ESEMPIO PER ESTRARRE NUOVI CAMPI
-- =====================================================

-- Esempio 1: Estrai posizioni di tutti i compressori
/*
SELECT
  id,
  request_id,
  jsonb_array_elements(equipment_data->'compressori')->>'posizione' as posizione_compressore,
  jsonb_array_elements(equipment_data->'compressori')->>'marca' as marca_compressore
FROM dm329_technical_data
WHERE equipment_data ? 'compressori';
*/

-- Esempio 2: Conta apparecchiature per anno di produzione
/*
SELECT
  jsonb_array_elements(equipment_data->'compressori')->>'anno_produzione' as anno,
  COUNT(*) as num_compressori
FROM dm329_technical_data
WHERE equipment_data ? 'compressori'
GROUP BY anno
ORDER BY anno DESC;
*/

-- Esempio 3: Trova apparecchiature senza posizione assegnata
/*
SELECT
  id,
  request_id,
  'compressore' as tipo,
  jsonb_array_elements(equipment_data->'compressori')->>'marca' as marca
FROM dm329_technical_data
WHERE equipment_data ? 'compressori'
  AND NOT (jsonb_array_elements(equipment_data->'compressori') ? 'posizione');
*/

-- =====================================================
-- ISTRUZIONI PER L'USO
-- =====================================================

/*
COME AGGIORNARE equipment_data CON NUOVI CAMPI:

1. Via SQL UPDATE:

UPDATE dm329_technical_data
SET equipment_data = jsonb_set(
  equipment_data,
  '{compressori,0,posizione}',
  '"C1"'
)
WHERE id = 'uuid-qui';

2. Via application code (TypeScript):
Vedere src/utils/templateDataBuilder.ts
Il parsing JSONB è già implementato con fallback per campi mancanti.

3. Via form input:
Aggiungere campi "Posizione" e "Anno produzione" nei form di inserimento
apparecchiature (verrà fatto in task separato).
*/

-- =====================================================
-- FINE DOCUMENTAZIONE
-- =====================================================
