-- Aggiunge 'Recipienti filtro' all'enum dei tipi di apparecchiatura.
--
-- Il valore manca in `equipment_catalog_type` (9 valori: Serbatoi, Compressori,
-- Disoleatori, Essiccatori, Scambiatori, Filtri, Separatori, Valvole di sicurezza,
-- Altro) ma il codice lo usa gia': `EQUIPMENT_DEFS.recipiente.catalogType` e il tipo
-- `EquipmentCatalogType` lo prevedono. Ogni query che filtra su quel valore fallisce
-- quindi con «invalid input value for enum», e l'autocomplete del catalogo sulle
-- righe «recipiente filtro» e' di fatto inutilizzabile.
--
-- ATTENZIONE — QUESTO FILE VA ESEGUITO DA SOLO.
-- PostgreSQL non permette di usare un valore di enum nella stessa transazione in cui
-- lo crea. Le migration successive che inseriscono o filtrano righe con questo tipo
-- devono girare in una sessione separata, dopo il commit di questa.
-- Vedi README_MIGRATION_ORDER.md: stessa limitazione gia' incontrata con user_role.

ALTER TYPE equipment_catalog_type ADD VALUE IF NOT EXISTS 'Recipienti filtro';

-- Verifica (da eseguire a parte):
--   SELECT enumlabel FROM pg_enum
--   WHERE enumtypid = 'equipment_catalog_type'::regtype
--   ORDER BY enumsortorder;
