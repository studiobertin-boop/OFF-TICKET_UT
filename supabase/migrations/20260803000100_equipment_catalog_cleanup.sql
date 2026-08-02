-- Pulizia del catalogo apparecchiature: funzione orfana e righe dimostrative.
--
-- 1. `search_equipment_fuzzy` esiste in due versioni. La prima (20251112100003)
--    prende (search_text, similarity_threshold, max_results), la seconda
--    (20251113100000) prende (search_term, equipment_type_filter, limit_results):
--    firme diverse, quindi il CREATE OR REPLACE non ha sostituito nulla e sono
--    rimaste entrambe. I due soli punti di chiamata — `equipmentCatalogApi.searchFuzzy`
--    e la edge function analyze-equipment-nameplate — usano i nomi di parametro
--    della seconda. La prima non e' raggiungibile da nessuno.
--
-- 2. Cinque righe senza `tipo_apparecchiatura` sono il seed dimostrativo inserito
--    dalla migration che ha creato la tabella (Ingersoll Rand UP6-15, Atlas Copco
--    GA 30 e FX 12, Kaeser KB 500 e BSD 72). Non sono mai state usate in una pratica,
--    hanno marche non normalizzate rispetto al resto del catalogo («Kaeser» invece di
--    «KAESER KOMPRESSOREN SE») e portano una terza convenzione per i dati tecnici
--    (`potenza_kw`, `portata_m3_min`, `volume_litri`) che nessun'altra riga usa.
--    Senza tipo sono invisibili ai filtri a cascata: esistono ma non sono raggiungibili.

DROP FUNCTION IF EXISTS search_equipment_fuzzy(TEXT, REAL, INT);

COMMENT ON FUNCTION search_equipment_fuzzy(TEXT, equipment_catalog_type, INTEGER) IS
  'Ricerca fuzzy sul catalogo apparecchiature. Unica versione in vigore: la variante '
  'con soglia di similarita'' esplicita e'' stata rimossa perche'' priva di chiamanti.';

-- Il vincolo su usage_count evita di toccare righe che nel frattempo fossero
-- state usate in una pratica. Idempotente: rieseguirla non ha effetti.
DELETE FROM equipment_catalog
WHERE tipo_apparecchiatura IS NULL
  AND usage_count = 0;

NOTIFY pgrst, 'reload schema';

-- Verifica:
--   SELECT count(*) FROM equipment_catalog WHERE tipo_apparecchiatura IS NULL;  -- atteso 0
--   SELECT pg_get_function_identity_arguments(oid) FROM pg_proc
--   WHERE proname = 'search_equipment_fuzzy';                                    -- attesa 1 riga
