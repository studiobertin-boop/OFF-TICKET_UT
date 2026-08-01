-- L'indirizzo impianto e' finito storicamente in tre posti. requests.indirizzo_impianto
-- diventa la sorgente unica: qui si recuperano le pratiche in cui e' vuoto ma il dato
-- esiste sulla scheda tecnica. Verificato il 2026-08-01: 8 righe interessate, nessun
-- conflitto (dove entrambi sono valorizzati le stringhe coincidono).
UPDATE requests r
SET indirizzo_impianto = COALESCE(
      NULLIF(btrim(t.indirizzo_impianto), ''),
      NULLIF(btrim(t.equipment_data -> 'dati_impianto' ->> 'sede_impianto'), '')
    )
FROM dm329_technical_data t
WHERE t.request_id = r.id
  AND COALESCE(btrim(r.indirizzo_impianto), '') = ''
  AND COALESCE(
        NULLIF(btrim(t.indirizzo_impianto), ''),
        NULLIF(btrim(t.equipment_data -> 'dati_impianto' ->> 'sede_impianto'), '')
      ) IS NOT NULL;
