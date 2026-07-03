-- Migration: Extend equipment_data JSONB for Phase 2 - Carbone Alternatives
-- Date: 2025-12-31
-- Description: Aggiunge campi per supporto alternative Carbone (disoleatori e scambiatori)

-- =====================================================
-- NOTA IMPORTANTE
-- =====================================================
-- Questo file NON modifica direttamente la struttura della tabella,
-- ma documenta i nuovi campi JSONB necessari per il corretto
-- funzionamento delle alternative Carbone.
--
-- I campi sono opzionali: se non presenti, l'adapter assume valori
-- di default (0) che escludono le apparecchiature dai controlli DM329.
-- =====================================================

-- =====================================================
-- STRUTTURA JSONB EQUIPMENT_DATA - PHASE 2
-- =====================================================

/*
NUOVI CAMPI PER ALTERNATIVE CARBONE:

{
  "compressori": [
    {
      // ===== CAMPI ESISTENTI (Phase 1) =====
      "tipo": "Compressore a vite",
      "marca": "Atlas Copco",
      "modello": "GA 37 VSD",
      "matricola": "12345678",
      "potenza_nominale": 37,
      "tensione": 400,
      "tipo_giri": "variabili",
      "ps_pressione_max": 13,
      "volume_aria_prodotto": 6000,
      "posizione": "C1",
      "anno_produzione": "2020",

      // ===== NUOVI CAMPI PHASE 2 =====
      "volume_disoleatore": 30,              // Volume disoleatore interno in litri
                                             // < 25L → escluso DM329 (alternative '1' o '3')
                                             // >= 25L → soggetto a verifica DM329 (alternative '2' o '5')
                                             // Se omesso: assume 0 (< 25L, escluso)

      "posizione_disoleatore": "D1"          // Posizione identificativa del disoleatore (opzionale)
                                             // Se omesso: genera automaticamente "D1", "D2", ecc.
    }
  ],

  "essiccatori": [
    {
      // ===== CAMPI ESISTENTI (Phase 1) =====
      "tipo": "Essiccatore frigorifero",
      "marca": "Pneumatech",
      "modello": "PD 50 HP",
      "matricola": "11223344",
      "potenza_nominale": 0.75,
      "tensione": 230,
      "posizione": "E1",
      "anno_produzione": "2021",

      // ===== NUOVI CAMPI PHASE 2 =====
      "volume_scambiatore": 28,              // Volume scambiatore di calore in litri
                                             // < 25L → escluso DM329 (alternative '1' o '3')
                                             // >= 25L → soggetto a verifica DM329 (alternative '2' o '5')
                                             // Se omesso: assume 0 (< 25L, escluso)

      "posizione_scambiatore": "SC1"         // Posizione identificativa dello scambiatore (opzionale)
                                             // Se omesso: genera automaticamente "SC1", "SC2", ecc.
    }
  ],

  "serbatoi": [
    {
      // ===== CAMPI ESISTENTI (Phase 1) =====
      // I serbatoi NON hanno nuovi campi in Phase 2
      // La loro classificazione è basata solo su PS×V:
      // - PS×V < 8000 → Dichiarazione (alternative '1' o '3')
      // - PS×V >= 8000 → Verifica (alternative '2' o '5')

      "tipo": "Serbatoio verticale",
      "marca": "Worthington",
      "modello": "RV 500",
      "matricola": "87654321",
      "volume": 500,
      "ps_pressione_max": 11,
      "ps_x_volume": 5500,
      "posizione": "S1",
      "anno_produzione": "2019"
    }
  ]
}

LOGICA ALTERNATIVE (usata da carboneDataAdapter.ts):

COMPRESSORI (compressorAlternative):
  '1' = 1 compressore con volume_disoleatore < 25L (escluso DM329)
  '2' = 1 compressore con volume_disoleatore >= 25L (soggetto a verifica)
  '3' = N compressori tutti con volume_disoleatore < 25L (esclusi)
  '4' = N compressori misti (alcuni < 25L, alcuni >= 25L)
  '5' = N compressori tutti con volume_disoleatore >= 25L (soggetti a verifica)

ESSICCATORI (essiccatoreAlternative):
  '1' = 1 essiccatore con volume_scambiatore < 25L (escluso DM329)
  '2' = 1 essiccatore con volume_scambiatore >= 25L (soggetto a verifica)
  '3' = N essiccatori tutti con volume_scambiatore < 25L (esclusi)
  '4' = N essiccatori misti (alcuni < 25L, alcuni >= 25L)
  '5' = N essiccatori tutti con volume_scambiatore >= 25L (soggetti a verifica)

SERBATOI (serbatoioAlternative):
  '1' = 1 serbatoio con PS×V < 8000 (solo dichiarazione)
  '2' = 1 serbatoio con PS×V >= 8000 (soggetto a verifica)
  '3' = N serbatoi tutti con PS×V < 8000 (solo dichiarazione)
  '4' = N serbatoi misti (alcuni < 8000, alcuni >= 8000)
  '5' = N serbatoi tutti con PS×V >= 8000 (soggetti a verifica)
*/

-- =====================================================
-- VALIDAZIONE JSONB ESTESA
-- =====================================================

-- Aggiorna la funzione di validazione per includere i nuovi campi
CREATE OR REPLACE FUNCTION validate_equipment_data_phase2(data JSONB)
RETURNS BOOLEAN AS $$
DECLARE
  compressore JSONB;
  essiccatore JSONB;
  volume_disoleatore NUMERIC;
  volume_scambiatore NUMERIC;
BEGIN
  -- Valida compressori con nuovi campi
  IF data ? 'compressori' THEN
    FOR compressore IN SELECT * FROM jsonb_array_elements(data->'compressori')
    LOOP
      -- Campi obbligatori base
      IF NOT (compressore ? 'marca' AND compressore ? 'modello') THEN
        RAISE NOTICE 'Compressore mancante marca o modello';
        RETURN FALSE;
      END IF;

      -- Valida volume_disoleatore se presente
      IF compressore ? 'volume_disoleatore' THEN
        volume_disoleatore := (compressore->>'volume_disoleatore')::NUMERIC;

        IF volume_disoleatore < 0 THEN
          RAISE NOTICE 'Volume disoleatore negativo';
          RETURN FALSE;
        END IF;

        -- Avviso se >= 25L ma manca posizione_disoleatore
        IF volume_disoleatore >= 25 AND NOT (compressore ? 'posizione_disoleatore') THEN
          RAISE NOTICE 'Disoleatore >= 25L senza posizione (verrà auto-generata)';
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- Valida essiccatori con nuovi campi
  IF data ? 'essiccatori' THEN
    FOR essiccatore IN SELECT * FROM jsonb_array_elements(data->'essiccatori')
    LOOP
      -- Campi obbligatori base
      IF NOT (essiccatore ? 'marca' AND essiccatore ? 'modello') THEN
        RAISE NOTICE 'Essiccatore mancante marca o modello';
        RETURN FALSE;
      END IF;

      -- Valida volume_scambiatore se presente
      IF essiccatore ? 'volume_scambiatore' THEN
        volume_scambiatore := (essiccatore->>'volume_scambiatore')::NUMERIC;

        IF volume_scambiatore < 0 THEN
          RAISE NOTICE 'Volume scambiatore negativo';
          RETURN FALSE;
        END IF;

        -- Avviso se >= 25L ma manca posizione_scambiatore
        IF volume_scambiatore >= 25 AND NOT (essiccatore ? 'posizione_scambiatore') THEN
          RAISE NOTICE 'Scambiatore >= 25L senza posizione (verrà auto-generata)';
        END IF;
      END IF;
    END LOOP;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION validate_equipment_data_phase2(JSONB) IS
'Valida la struttura JSONB di equipment_data per Phase 2. Controlla campi per alternative Carbone.';

-- =====================================================
-- QUERY DI ESEMPIO PER NUOVI CAMPI
-- =====================================================

-- Esempio 1: Trova compressori con disoleatore grande (>= 25L)
/*
SELECT
  id,
  request_id,
  jsonb_array_elements(equipment_data->'compressori')->>'marca' as marca,
  jsonb_array_elements(equipment_data->'compressori')->>'modello' as modello,
  (jsonb_array_elements(equipment_data->'compressori')->>'volume_disoleatore')::NUMERIC as volume_disoleatore,
  CASE
    WHEN (jsonb_array_elements(equipment_data->'compressori')->>'volume_disoleatore')::NUMERIC >= 25
    THEN 'Soggetto a verifica DM329'
    ELSE 'Escluso DM329'
  END as classificazione
FROM dm329_technical_data
WHERE equipment_data ? 'compressori'
  AND jsonb_array_elements(equipment_data->'compressori') ? 'volume_disoleatore'
ORDER BY volume_disoleatore DESC;
*/

-- Esempio 2: Conta essiccatori per classificazione scambiatore
/*
SELECT
  CASE
    WHEN (jsonb_array_elements(equipment_data->'essiccatori')->>'volume_scambiatore')::NUMERIC >= 25
    THEN 'Verifica'
    ELSE 'Escluso'
  END as classificazione,
  COUNT(*) as numero
FROM dm329_technical_data
WHERE equipment_data ? 'essiccatori'
  AND jsonb_array_elements(equipment_data->'essiccatori') ? 'volume_scambiatore'
GROUP BY classificazione;
*/

-- Esempio 3: Trova apparecchiature senza campi Phase 2
/*
SELECT
  id,
  request_id,
  'Compressori senza volume_disoleatore' as tipo,
  COUNT(*) as numero
FROM dm329_technical_data
WHERE equipment_data ? 'compressori'
  AND NOT (jsonb_array_elements(equipment_data->'compressori') ? 'volume_disoleatore')
GROUP BY id, request_id

UNION ALL

SELECT
  id,
  request_id,
  'Essiccatori senza volume_scambiatore' as tipo,
  COUNT(*) as numero
FROM dm329_technical_data
WHERE equipment_data ? 'essiccatori'
  AND NOT (jsonb_array_elements(equipment_data->'essiccatori') ? 'volume_scambiatore')
GROUP BY id, request_id;
*/

-- =====================================================
-- ISTRUZIONI PER L'USO
-- =====================================================

/*
COME AGGIORNARE DATI ESISTENTI CON NUOVI CAMPI:

1. Aggiungere volume_disoleatore a un compressore:

UPDATE dm329_technical_data
SET equipment_data = jsonb_set(
  equipment_data,
  '{compressori,0,volume_disoleatore}',
  '30'  -- Valore numerico come stringa JSON
)
WHERE id = 'uuid-qui';

2. Aggiungere volume_scambiatore a un essiccatore:

UPDATE dm329_technical_data
SET equipment_data = jsonb_set(
  equipment_data,
  '{essiccatori,0,volume_scambiatore}',
  '28'
)
WHERE id = 'uuid-qui';

3. Aggiungere posizione_disoleatore:

UPDATE dm329_technical_data
SET equipment_data = jsonb_set(
  equipment_data,
  '{compressori,0,posizione_disoleatore}',
  '"D1"'  -- Stringa racchiusa in doppi apici
)
WHERE id = 'uuid-qui';

4. Aggiornare multipli campi in una volta:

UPDATE dm329_technical_data
SET equipment_data = equipment_data
  || jsonb_build_object(
    'compressori',
    jsonb_build_array(
      (equipment_data->'compressori'->0)
        || '{"volume_disoleatore": 30, "posizione_disoleatore": "D1"}'::jsonb
    )
  )
WHERE id = 'uuid-qui';

5. Via application code (TypeScript):
L'adapter carboneDataAdapter.ts già supporta questi campi con fallback:
- volume_disoleatore || 0
- volume_scambiatore || 0
Se i campi non esistono, assume 0 (< 25L, escluso DM329).

6. Via form UI:
Aggiungere campi input nei form di inserimento apparecchiature:
- Compressori: campo "Volume disoleatore (L)" (opzionale, numeric)
- Essiccatori: campo "Volume scambiatore (L)" (opzionale, numeric)
*/

-- =====================================================
-- SCRIPT UTILITY PER POPOLARE VALORI DEFAULT
-- =====================================================

/*
-- Se vuoi popolare volumi di default per test:

-- Compressori: imposta volume_disoleatore = 15L (< 25L, esclusi)
UPDATE dm329_technical_data
SET equipment_data = jsonb_set(
  equipment_data,
  '{compressori}',
  (
    SELECT jsonb_agg(
      elem || '{"volume_disoleatore": 15}'::jsonb
    )
    FROM jsonb_array_elements(equipment_data->'compressori') elem
  )
)
WHERE equipment_data ? 'compressori'
  AND NOT (equipment_data->'compressori'->0 ? 'volume_disoleatore');

-- Essiccatori: imposta volume_scambiatore = 10L (< 25L, esclusi)
UPDATE dm329_technical_data
SET equipment_data = jsonb_set(
  equipment_data,
  '{essiccatori}',
  (
    SELECT jsonb_agg(
      elem || '{"volume_scambiatore": 10}'::jsonb
    )
    FROM jsonb_array_elements(equipment_data->'essiccatori') elem
  )
)
WHERE equipment_data ? 'essiccatori'
  AND NOT (equipment_data->'essiccatori'->0 ? 'volume_scambiatore');
*/

-- =====================================================
-- RIFERIMENTI
-- =====================================================
/*
- Adapter: src/utils/carboneDataAdapter.ts
- Types: src/types/carbone.ts
- Test: scripts/test-carbone-alternatives.ts
- Doc: docs/CARBONE_ALTERNATIVES_FIX.md
*/

-- =====================================================
-- FINE MIGRATION
-- =====================================================
