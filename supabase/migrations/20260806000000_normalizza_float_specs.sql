-- Code di arrotondamento nei dati tecnici del catalogo.
--
-- Sei righe attive portano valori come 4059.9999999999995 al posto di 4060, residuo di
-- conversioni m3/h -> l/min fatte in virgola mobile all'import. Il numero finisce tale e
-- quale nella scheda dati e nella tabella caratteristiche della relazione.
--
-- Ricognizione del 2026-08-03 sul catalogo attivo:
--   KAESER ASK 40            fad 4059.9999999999995 -> 4060
--   KAESER ASK 40 T          fad 4059.9999999999995 -> 4060
--   WORTHINGTON Rollair 1000 B   fad  996.0000000000001 ->  996
--   WORTHINGTON Rollair 2000 A   fad 2027.9999999999998 -> 2028
--   WORTHINGTON RLR 2500 BE7     fad 2583.3333333333335 -> 2583.33
--   WORTHINGTON Rollair RLR 750 B fad 691.6666666666666 ->  691.67
--
-- Le ultime due sono divisioni per 60 genuinamente periodiche e restano con i decimali:
-- l'arrotondamento e' a 2 cifre, non all'intero.
--
-- Solo i valori numerici JSON: i testuali non si toccano, perche' fra loro ci sono gli
-- intervalli di temperatura («-10 ÷ +200») che un arrotondamento distruggerebbe.
--
-- Il confronto e' numerico e non testuale: `'8' <> '8.00'` e' vero come stringhe, e una
-- condizione testuale riscriverebbe ogni valore intero del catalogo. `trim_scale` toglie
-- gli zeri di coda introdotti da `round`, cosi' 4060.00 torna 4060 e non 4060.00.
--
-- La guardia di tipo (jsonb_typeof = 'number') e il cast a numeric NON vanno concatenati con
-- AND: Postgres non garantisce l'ordine di valutazione degli operandi di AND (e' il pattern da
-- manuale "x > 0 AND y/x > 1.5"). Se il planner valutasse il cast prima della guardia, un
-- valore testuale del catalogo (es. l'intervallo di temperatura "-10 ÷ +200") farebbe fallire
-- l'intera UPDATE con "invalid input syntax for type numeric". Per questo la guardia e il cast
-- sono annidati in CASE, sia nella SET sia nella EXISTS: un CASE valuta i rami in ordine e non
-- passa al successivo se non serve, a differenza di AND.

BEGIN;

UPDATE equipment_catalog c
SET specs = (
      SELECT jsonb_object_agg(
               e.key,
               CASE WHEN jsonb_typeof(e.value) = 'number' THEN
                 CASE WHEN e.value::text::numeric <> round(e.value::text::numeric, 2)
                      THEN to_jsonb(trim_scale(round(e.value::text::numeric, 2)))
                      ELSE e.value
                 END
               ELSE e.value
               END
             )
      FROM jsonb_each(c.specs) AS e
    ),
    updated_at = now()
WHERE c.is_active
  AND c.specs IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM jsonb_each(c.specs) AS e
    WHERE CASE WHEN jsonb_typeof(e.value) = 'number'
               THEN e.value::text::numeric <> round(e.value::text::numeric, 2)
               ELSE false
          END
  );

COMMIT;
