-- Doppioni di KAESER SK 26 a catalogo.
--
-- Il modello ha quattro righe attive per due sole macchine: 8 bar con 2550 l/min e 11 bar
-- con 2200 l/min, ciascuna presente due volte. In ogni coppia una riga porta la pressione
-- di lavoro e l'altra no, residuo di due import successivi; portata e pressione massima
-- coincidono, quindi descrivono la stessa macchina.
--
-- Finche' il raggruppamento delle varianti avveniva per pressione massima le due righe
-- collassavano e il doppione non si vedeva. Ora che avviene per la chiave dell'indice unico
-- — COALESCE(pressione_esercizio, pressione_max) — le loro chiavi differiscono (10 contro 11,
-- e 7,5 contro 8) e il menu della scheda dati mostrerebbe due voci identiche, con l'avviso
-- del pulsante «+» che annuncia due varianti dove la macchina e' una.
--
-- Si disattiva la riga incompleta di ogni coppia, non quella completa: e' l'unica delle due
-- che il catalogo sappia distinguere dalle sorelle.
--
-- Non e' una cancellazione: `is_active` torna a true e la riga riappare. L'indice unico e'
-- parziale su is_active, quindi disattivarle non puo' collidere con nulla.
--
-- Ricognizione del 2026-08-03: due righe, entrambe di KAESER SK 26. Nessun altro modello del
-- catalogo presenta la stessa forma.

BEGIN;

UPDATE equipment_catalog AS incompleta
SET is_active = false,
    updated_at = now()
WHERE incompleta.tipo_apparecchiatura = 'Compressori'
  AND incompleta.is_active
  AND NOT (incompleta.specs ? 'pressione_esercizio')
  AND EXISTS (
    SELECT 1
    FROM equipment_catalog AS completa
    WHERE completa.id <> incompleta.id
      AND completa.tipo_apparecchiatura = incompleta.tipo_apparecchiatura
      AND completa.marca = incompleta.marca
      AND completa.modello = incompleta.modello
      AND completa.is_active
      AND completa.specs ? 'pressione_esercizio'
      -- Stessa macchina: stessa pressione dichiarata e stessa portata.
      AND (completa.specs ->> 'pressione_max')::numeric
          = (incompleta.specs ->> 'pressione_max')::numeric
      AND (completa.specs ->> 'fad')::numeric
          = (incompleta.specs ->> 'fad')::numeric
  );

COMMIT;
