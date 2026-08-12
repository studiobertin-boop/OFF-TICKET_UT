-- "Filtri" guadagna PS e TS: da indice univoco su (tipo, marca, modello) a uno che ammette
-- più varianti di pressione dello stesso modello, come già per Serbatoi, Disoleatori,
-- Essiccatori, Scambiatori e Recipienti filtro (20260805000000_equipment_catalog_variante_ps.sql).
--
-- Preflight eseguito il 2026-08-12 su tutte le righe attive di tipo 'Filtri': nessuna
-- collisione (l'indice attuale già impedirebbe due righe identiche su marca+modello).
--   SELECT marca, modello, count(*)
--   FROM equipment_catalog
--   WHERE tipo_apparecchiatura = 'Filtri' AND is_active
--   GROUP BY 1, 2 HAVING count(*) > 1;
-- Risultato: nessuna riga.

BEGIN;

DROP INDEX IF EXISTS equipment_catalog_unique_ps;
CREATE UNIQUE INDEX equipment_catalog_unique_ps
  ON equipment_catalog (
    tipo_apparecchiatura, marca, modello,
    (COALESCE(specs ->> 'ps', specs ->> 'pressione', ''))
  )
  WHERE tipo_apparecchiatura IN
        ('Serbatoi', 'Disoleatori', 'Essiccatori', 'Scambiatori', 'Recipienti filtro', 'Filtri')
    AND is_active = true;

DROP INDEX IF EXISTS equipment_catalog_unique_senza_pressione;
CREATE UNIQUE INDEX equipment_catalog_unique_senza_pressione
  ON equipment_catalog (tipo_apparecchiatura, marca, modello)
  WHERE tipo_apparecchiatura IN ('Separatori', 'Altro')
    AND is_active = true;

COMMIT;
