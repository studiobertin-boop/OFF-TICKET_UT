-- ================================================
-- MIGRATION: Equipment to Manufacturers Migration
-- ================================================
-- Migra i dati esistenti da equipment_catalog.marca
-- alla nuova tabella manufacturers normalizzata
-- ================================================

-- ================================================
-- STEP 1: Add manufacturer_id column to equipment_catalog
-- ================================================

ALTER TABLE equipment_catalog
ADD COLUMN manufacturer_id UUID REFERENCES manufacturers(id);

-- Index per performance nelle JOIN
CREATE INDEX equipment_catalog_manufacturer_id_idx ON equipment_catalog (manufacturer_id);

-- ================================================
-- STEP 2: Insert distinct marche into manufacturers
-- ================================================

-- Inserisci tutti i costruttori unici dalla colonna marca
-- STRATEGIA: Marcare temporaneamente tutti come ESTERI con paese "Da verificare"
-- per evitare violazione dei constraint CHECK che richiedono campi italiani
-- L'utente potrà poi completare i dati via UI e settare is_estero correttamente
INSERT INTO manufacturers (nome, is_estero, paese, is_active, usage_count)
SELECT DISTINCT
  marca AS nome,
  true AS is_estero,  -- Temporaneo: tutti esteri per evitare constraint violation
  'Da verificare' AS paese,  -- Placeholder paese
  true AS is_active,
  COUNT(*) AS usage_count  -- Conta quante volte appare
FROM equipment_catalog
WHERE marca IS NOT NULL AND trim(marca) != ''
GROUP BY marca
ON CONFLICT (nome) DO NOTHING;  -- Evita duplicati se script viene eseguito più volte

-- ================================================
-- STEP 3: Populate manufacturer_id in equipment_catalog
-- ================================================

-- Aggiorna equipment_catalog collegando ogni equipment
-- al manufacturer corrispondente tramite il nome marca
UPDATE equipment_catalog ec
SET manufacturer_id = m.id
FROM manufacturers m
WHERE ec.marca = m.nome
  AND ec.manufacturer_id IS NULL;  -- Solo record non ancora collegati

-- ================================================
-- STEP 4: Verification Query (commented)
-- ================================================

-- Verifica che tutti gli equipment siano stati collegati
-- UNCOMMENTA per eseguire manualmente dopo la migrazione:

-- SELECT COUNT(*) AS equipment_without_manufacturer
-- FROM equipment_catalog
-- WHERE manufacturer_id IS NULL;

-- Risultato atteso: 0

-- ================================================
-- STEP 5: Data Quality Checks (commented)
-- ================================================

-- Verifica quanti costruttori sono stati creati
-- SELECT COUNT(*) AS total_manufacturers FROM manufacturers;

-- Verifica costruttori più usati
-- SELECT nome, usage_count
-- FROM manufacturers
-- ORDER BY usage_count DESC
-- LIMIT 10;

-- Verifica costruttori con dati mancanti
-- SELECT
--   nome,
--   is_estero,
--   check_manufacturer_completeness(id) AS completeness
-- FROM manufacturers
-- ORDER BY usage_count DESC;

-- ================================================
-- IMPORTANT NOTES
-- ================================================

-- ⚠️ ATTENZIONE:
-- 1. La colonna marca NON viene eliminata in questa migration
--    per mantenere backward compatibility temporanea
-- 2. La colonna manufacturer_id rimane NULLABLE per ora
-- 3. Dopo verifica manuale, eseguire:
--    - ALTER TABLE equipment_catalog ALTER COLUMN manufacturer_id SET NOT NULL;
--    - ALTER TABLE equipment_catalog DROP COLUMN marca; (opzionale)

-- ================================================
-- POST-MIGRATION TASKS
-- ================================================

-- ⚠️ IMPORTANTE - STRATEGIA DI COMPLETAMENTO DATI:
-- Tutti i costruttori sono stati creati con is_estero=true e paese="Da verificare"
-- per evitare violazione dei constraint CHECK durante la migrazione.
--
-- PROSSIMI STEP:
-- 1. Usare l'interfaccia admin per ogni costruttore:
--    - Se ITALIANO: settare is_estero=false e completare P.IVA, telefono, indirizzo
--    - Se ESTERO: settare paese corretto (es: "Germania", "Francia")
-- 2. Verificare completezza con check_manufacturer_completeness()
-- 3. Quando tutti i manufacturer_id sono popolati e verificati:
--    ALTER TABLE equipment_catalog ALTER COLUMN manufacturer_id SET NOT NULL;

-- ================================================
-- COMMENTS
-- ================================================

COMMENT ON COLUMN equipment_catalog.manufacturer_id IS 'FK alla tabella manufacturers - sostituisce il campo marca TEXT';
