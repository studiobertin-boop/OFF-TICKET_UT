-- Spessimetrica per apparecchiatura.
--
-- Fino al 28-09-2026 le apparecchiature sottoposte a verifica di integrità (prova spessimetrica)
-- si dichiaravano alla generazione della relazione, come elenco di codici in
-- `additional_info.spessimetrica`. Ora il dato è un flag `spessimetrica: true` sulla singola
-- apparecchiatura in `equipment_data` (serbatoi, disoleatori, scambiatori, recipienti_filtro), e
-- relazione e riepilogo CIVA lo ereditano da lì.
--
-- Qui si riporta l'elenco sulle apparecchiature e lo si toglie da `additional_info`: lasciarlo
-- farebbe credere che conti ancora. Da applicare insieme al deploy del frontend che legge il flag:
-- il frontend precedente legge l'elenco.
--
-- Il trigger `trigger_update_request_status_on_completion` reagisce solo al cambio di
-- `is_completed`, che qui non si tocca.

UPDATE public.dm329_technical_data AS t
SET
  equipment_data = COALESCE(
    (
      SELECT jsonb_object_agg(
        j.k,
        CASE
          WHEN j.k IN ('serbatoi', 'disoleatori', 'scambiatori', 'recipienti_filtro')
            AND jsonb_typeof(j.v) = 'array'
          THEN (
            SELECT COALESCE(
              jsonb_agg(
                CASE
                  WHEN e.el->>'codice' IN (
                    SELECT jsonb_array_elements_text(t.additional_info->'spessimetrica')
                  )
                  THEN e.el || '{"spessimetrica": true}'::jsonb
                  ELSE e.el
                END
                ORDER BY e.ord
              ),
              '[]'::jsonb
            )
            FROM jsonb_array_elements(j.v) WITH ORDINALITY AS e(el, ord)
          )
          ELSE j.v
        END
      )
      FROM jsonb_each(t.equipment_data) AS j(k, v)
    ),
    t.equipment_data
  ),
  additional_info = t.additional_info - 'spessimetrica'
WHERE t.additional_info ? 'spessimetrica'
  AND jsonb_typeof(t.additional_info->'spessimetrica') = 'array';
