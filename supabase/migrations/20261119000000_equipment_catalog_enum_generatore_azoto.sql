-- Aggiunge 'Serbatoi generatore azoto' e 'Generatori azoto' all'enum dei tipi di
-- apparecchiatura (da 10 a 12 valori), per il generatore di azoto della scheda dati DM329.
-- Il codice li usa gia': `EquipmentCatalogType`, `CANONICAL_SPECS`, `EQUIPMENT_CATALOG_TYPES`.
--
-- ATTENZIONE — QUESTO FILE VA ESEGUITO DA SOLO.
-- PostgreSQL non permette di usare un valore di enum nella stessa transazione in cui
-- lo crea. Le migration successive che inseriscono o filtrano righe con questi tipi
-- devono girare in una sessione separata, dopo il commit di questa.
-- Vedi README_MIGRATION_ORDER.md: stessa limitazione gia' incontrata con user_role.

ALTER TYPE equipment_catalog_type ADD VALUE IF NOT EXISTS 'Serbatoi generatore azoto';
ALTER TYPE equipment_catalog_type ADD VALUE IF NOT EXISTS 'Generatori azoto';

-- Verifica (da eseguire a parte):
--   SELECT enumlabel FROM pg_enum
--   WHERE enumtypid = 'equipment_catalog_type'::regtype
--   ORDER BY enumsortorder;
