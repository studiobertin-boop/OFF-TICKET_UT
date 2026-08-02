-- La chiave di variante dei compressori passa alla pressione di esercizio.
--
-- ATTENZIONE ALL'ORDINE: va applicata PRIMA della normalizzazione dei nomi
-- (20260804000000). Dopo quella, `ASD 37 SFC (@10bar)` e `ASD 37 SFC (@13bar)`
-- diventano entrambi `ASD 37 SFC` e condividono la stessa pressione massima (15 bar,
-- il valore di targa della macchina): sull'indice attuale collidono. Cio' che li
-- distingue e' la pressione di esercizio, quella a cui il costruttore dichiara la
-- portata — 10 e 13 bar. Verificato: dieci coppie collidono sull'indice attuale,
-- nessuna su quello nuovo.
--
-- Il COALESCE rende sicura la sequenza. Finche' nessuna riga ha
-- `pressione_esercizio` la chiave resta la pressione massima e l'indice si comporta
-- come prima; man mano che la normalizzazione la valorizza, subentra quella.

DROP INDEX IF EXISTS equipment_catalog_unique_compressori;

CREATE UNIQUE INDEX equipment_catalog_unique_compressori
  ON equipment_catalog (
    tipo_apparecchiatura,
    marca,
    modello,
    (COALESCE(specs ->> 'pressione_esercizio', specs ->> 'pressione_max'))
  )
  WHERE tipo_apparecchiatura = 'Compressori' AND is_active = true;

COMMENT ON INDEX equipment_catalog_unique_compressori IS
  'Varianti dello stesso compressore, distinte dalla pressione di esercizio (quella a '
  'cui e'' dichiarata la portata) con ricaduta sulla pressione massima per le righe '
  'non ancora normalizzate.';

-- Verifica:
--   SELECT indexdef FROM pg_indexes WHERE indexname = 'equipment_catalog_unique_compressori';
--
-- Preflight della migration successiva — attesa: nessuna riga.
--   SELECT tipo_apparecchiatura, marca, modello,
--          COALESCE(specs ->> 'pressione_esercizio', specs ->> 'pressione_max') AS p, count(*)
--   FROM equipment_catalog
--   WHERE tipo_apparecchiatura = 'Compressori' AND is_active
--   GROUP BY 1, 2, 3, 4 HAVING count(*) > 1;
