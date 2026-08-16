-- supabase/migrations/20260816000000_drop_search_equipment_fuzzy.sql
--
-- `search_equipment_fuzzy` è rotta da sempre in produzione: la RETURNS TABLE dichiara
-- `last_used TIMESTAMP` mentre il valore che ci finisce dentro è `ec.updated_at`, che è
-- `TIMESTAMPTZ` (colonna 8 della tabella di ritorno), e ogni chiamata solleva
-- 42804 «structure of query does not match function result type». I due soli consumatori
-- — `equipmentCatalogApi.searchFuzzy` e `searchFuzzyMatches` nella edge function —
-- ricevevano quindi sempre l'errore, che veniva assorbito senza risultati.
--
-- Il matching della targhetta ora avviene lato client su `equipment_catalog` caricato per
-- tipo (`src/utils/equipmentMatcher/`), dove è coperto da test. La funzione non ha più
-- consumatori e viene eliminata invece che riparata.

DROP FUNCTION IF EXISTS search_equipment_fuzzy(TEXT, equipment_catalog_type, INTEGER);

-- Verifica: attesa 0 righe.
--   SELECT proname FROM pg_proc WHERE proname = 'search_equipment_fuzzy';
