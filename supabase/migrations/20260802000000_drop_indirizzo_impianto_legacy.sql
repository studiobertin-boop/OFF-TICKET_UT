-- Rimozione delle collocazioni legacy dell'indirizzo impianto.
--
-- Dopo la migration 20260801000000, `requests.indirizzo_impianto` e' la sorgente unica:
-- i dati che vivevano su `dm329_technical_data` sono stati travasati li' (8 righe, zero
-- conflitti) e nessun codice li scrive piu'.
--
-- ATTENZIONE ALL'ORDINE: eseguire SOLO dopo che il codice che smette di scrivere queste
-- colonne e' in produzione. Fino ad allora `technicalDataApi.create()` inserisce
-- `indirizzo_impianto` a ogni creazione automatica di scheda dati, e il DROP farebbe
-- fallire quell'insert.
--
-- Colonne rimosse:
--   indirizzo_impianto            - travasata su requests, 15 righe valorizzate
--   indirizzo_impianto_formatted  - dati strutturati Google Places, mai letta da nessuno

ALTER TABLE dm329_technical_data
  DROP COLUMN IF EXISTS indirizzo_impianto,
  DROP COLUMN IF EXISTS indirizzo_impianto_formatted;
