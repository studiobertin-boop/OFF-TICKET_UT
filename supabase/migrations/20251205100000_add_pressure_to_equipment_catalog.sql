-- Migration: Add pressure-based unique constraints to equipment_catalog
-- Description: Per compressori e valvole di sicurezza, la pressione fa parte della chiave univoca

-- Rimuovi constraint esistente
ALTER TABLE equipment_catalog DROP CONSTRAINT IF EXISTS equipment_catalog_unique_combo;

-- Rimuovi eventuali indici esistenti con gli stessi nomi
DROP INDEX IF EXISTS equipment_catalog_unique_no_pressure;
DROP INDEX IF EXISTS equipment_catalog_unique_compressori;
DROP INDEX IF EXISTS equipment_catalog_unique_valvole;

-- Constraint per apparecchiature SENZA pressione come chiave
-- (Serbatoi, Essiccatori, Disoleatori, Scambiatori, Filtri, Separatori, Recipienti filtro, Altro)
CREATE UNIQUE INDEX equipment_catalog_unique_no_pressure
ON equipment_catalog (tipo_apparecchiatura, marca, modello)
WHERE tipo_apparecchiatura NOT IN ('Compressori', 'Valvole di sicurezza')
  AND tipo_apparecchiatura IS NOT NULL;

-- Constraint per COMPRESSORI (include pressione_max negli specs)
-- Ogni combinazione tipo-marca-modello-pressione è univoca
CREATE UNIQUE INDEX equipment_catalog_unique_compressori
ON equipment_catalog (tipo_apparecchiatura, marca, modello, (specs->>'pressione_max'))
WHERE tipo_apparecchiatura = 'Compressori';

-- Constraint per VALVOLE DI SICUREZZA (include ptar negli specs)
-- Ogni combinazione tipo-marca-modello-ptar è univoca
CREATE UNIQUE INDEX equipment_catalog_unique_valvole
ON equipment_catalog (tipo_apparecchiatura, marca, modello, (specs->>'ptar'))
WHERE tipo_apparecchiatura = 'Valvole di sicurezza';

-- Aggiungi commenti
COMMENT ON INDEX equipment_catalog_unique_no_pressure IS
  'Univocità tipo-marca-modello per apparecchiature senza varianti di pressione';
COMMENT ON INDEX equipment_catalog_unique_compressori IS
  'Univocità tipo-marca-modello-pressione per compressori (stesso modello può avere FAD diversi a pressioni diverse)';
COMMENT ON INDEX equipment_catalog_unique_valvole IS
  'Univocità tipo-marca-modello-ptar per valvole (stesso modello può avere specs diverse a Ptar diverse)';
