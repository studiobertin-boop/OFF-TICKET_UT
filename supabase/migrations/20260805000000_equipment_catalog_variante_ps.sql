-- Varianti di pressione per tutti i tipi che hanno una PS.
--
-- Finora solo compressori e valvole potevano avere più righe per lo stesso modello, distinte
-- dalla pressione; per serbatoi, disoleatori, essiccatori, scambiatori e recipienti filtro
-- l'unicità era su (tipo, marca, modello) e una seconda PS era impossibile. La scheda dati ora
-- propone la PS scegliendola fra quelle a catalogo, con la capacità associata: perché una nuova
-- PS sia registrabile, la pressione deve entrare nella chiave anche per questi tipi.
--
-- Preflight eseguito il 2026-08-02 su 452 righe attive dei cinque tipi: nessuna collisione.
--   SELECT tipo_apparecchiatura, marca, modello,
--          COALESCE(specs->>'ps', specs->>'pressione', '') AS k, count(*)
--   FROM equipment_catalog
--   WHERE tipo_apparecchiatura IN
--         ('Serbatoi','Disoleatori','Essiccatori','Scambiatori','Recipienti filtro')
--     AND is_active
--   GROUP BY 1,2,3,4 HAVING count(*) > 1;

BEGIN;

DROP INDEX IF EXISTS equipment_catalog_unique_no_pressure;

-- Tipi con PS: la variante e' (tipo, marca, modello, ps).
--
-- Il COALESCE non e' opzionale: gran parte delle righe d'import porta ancora la chiave generica
-- `pressione` (stringa) invece di `ps`. Il ripiego a stringa vuota evita che le righe prive di
-- pressione chiavino su NULL, che in Postgres non collide mai e disattiverebbe il vincolo in
-- silenzio proprio sulle righe incomplete.
CREATE UNIQUE INDEX equipment_catalog_unique_ps
  ON equipment_catalog (
    tipo_apparecchiatura, marca, modello,
    (COALESCE(specs ->> 'ps', specs ->> 'pressione', ''))
  )
  WHERE tipo_apparecchiatura IN
        ('Serbatoi', 'Disoleatori', 'Essiccatori', 'Scambiatori', 'Recipienti filtro')
    AND is_active = true;

-- Tipi senza dati di pressione: resta l'unicità su nome.
CREATE UNIQUE INDEX equipment_catalog_unique_senza_pressione
  ON equipment_catalog (tipo_apparecchiatura, marca, modello)
  WHERE tipo_apparecchiatura IN ('Filtri', 'Separatori', 'Altro')
    AND is_active = true;

-- Allinea le valvole agli altri due indici: predicato su is_active (finora assente, quindi una
-- riga disattivata bloccava la ricreazione di una omonima) e ricaduta sulla chiave legacy.
DROP INDEX IF EXISTS equipment_catalog_unique_valvole;
CREATE UNIQUE INDEX equipment_catalog_unique_valvole
  ON equipment_catalog (
    tipo_apparecchiatura, marca, modello,
    (COALESCE(specs ->> 'ptar', specs ->> 'pressione', ''))
  )
  WHERE tipo_apparecchiatura = 'Valvole di sicurezza' AND is_active = true;

COMMIT;
