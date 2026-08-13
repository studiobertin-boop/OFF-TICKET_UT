-- Il diametro entra nella chiave di variante delle valvole di sicurezza.
--
-- Lo stesso modello di valvola esiste in più diametri d'attacco e, a parità di taratura, è il
-- diametro a dire di quale si tratta — con la portata scaricata che ne dipende. Finché la
-- chiave era la sola Ptar, la seconda variante non si poteva nemmeno censire: l'indice unico
-- la respingeva come riga doppia.
--
-- Prima di allargare la chiave si normalizzano i valori già scritti: il campo era testo libero
-- e a produzione portava «3/8» e «3/8''» sullo stesso attacco. Con due grafie per lo stesso
-- diametro la chiave non distinguerebbe niente, e l'elenco della scheda dati mostrerebbe la
-- stessa variante due volte.

BEGIN;

-- 1. Grafia canonica: frazione seguita dal doppio apice (3/8"), come l'elenco chiuso che ora
--    il contratto dei dati tecnici dichiara. Si tolgono spazi e apici finali di qualsiasi
--    foggia (', '', ″) e se ne rimette uno solo.
UPDATE equipment_catalog
SET specs = jsonb_set(
      specs,
      '{diametro}',
      to_jsonb(regexp_replace(btrim(specs ->> 'diametro'), '[''"″[:space:]]+$', '') || '"')
    ),
    updated_at = now()
WHERE tipo_apparecchiatura = 'Valvole di sicurezza'
  AND specs ->> 'diametro' IS NOT NULL
  AND btrim(specs ->> 'diametro') <> ''
  AND btrim(specs ->> 'diametro') <> regexp_replace(btrim(specs ->> 'diametro'), '[''"″[:space:]]+$', '') || '"';

-- 2. La chiave unica comprende ora il diametro. Resta il COALESCE sulla chiave legacy
--    dell'import (`pressione`) e sul diametro assente, che è il caso delle 70 valvole su 76
--    che non lo dichiarano: senza, l'indice le lascerebbe tutte fuori dal vincolo.
DROP INDEX IF EXISTS equipment_catalog_unique_valvole;
CREATE UNIQUE INDEX equipment_catalog_unique_valvole
  ON equipment_catalog (
    tipo_apparecchiatura, marca, modello,
    (COALESCE(specs ->> 'ptar', specs ->> 'pressione', '')),
    (COALESCE(specs ->> 'diametro', ''))
  )
  WHERE tipo_apparecchiatura = 'Valvole di sicurezza' AND is_active = true;

COMMENT ON INDEX equipment_catalog_unique_valvole IS
  'Valvole: una riga per marca+modello+taratura+diametro. Il diametro distingue le varianti a parità di Ptar (portata scaricata diversa); vuoto per le righe che non lo dichiarano.';

COMMIT;
