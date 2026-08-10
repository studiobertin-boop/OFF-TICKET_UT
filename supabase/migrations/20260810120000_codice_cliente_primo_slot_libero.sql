-- Il codice cliente non nasce più da una sequenza.
--
-- `customer_identificativo_seq` non è transazionale: `nextval()` non torna mai indietro,
-- nemmeno se la transazione viene annullata. Ogni creazione di pratica DM329 fallita dopo
-- il trigger di assegnazione bruciava quindi un numero per sempre. In produzione se ne
-- contano dieci consecutivi — 664..673 — persi fra il 2 e il 10 agosto 2026, quando il
-- trigger della scheda tecnica scriveva una colonna eliminata e faceva abortire ogni
-- inserimento (vedi 20260810000000_fix_trigger_indirizzo_impianto_dropped_column.sql).
--
-- Al suo posto il codice si calcola al momento dell'assegnazione: il primo numero libero
-- da 585 in su. È una pura lettura, quindi una transazione annullata non consuma nulla e
-- il tentativo successivo ricalcola lo stesso numero. I dieci codici bruciati rientrano
-- così in circolo da soli, uno per pratica, senza bisogno di alcun backfill.
--
-- PAVIMENTO 585: i numeri 001..584 rispecchiano il master Excel dell'ufficio e restano
-- congelati. I 39 buchi in quella fascia non si riusano: su carta possono già appartenere
-- a clienti mai importati qui. Spostare il pavimento è una parola sola, qui sotto.

CREATE OR REPLACE FUNCTION next_free_customer_code(p_floor integer DEFAULT 585)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER          -- deve vedere TUTTI i codici occupati, RLS esclusa
SET search_path = public
AS $$
  -- Il limite superiore è MAX+1 (o il pavimento stesso, se sopra non c'è ancora nulla):
  -- garantisce che la serie contenga sempre almeno un numero libero, quindi MIN() non
  -- torna mai NULL e non serve un COALESCE di scorta.
  SELECT MIN(g)::integer
  FROM generate_series(
         p_floor,
         GREATEST(
           (SELECT COALESCE(MAX(codice_cliente_num), 0) FROM customers),
           p_floor - 1
         ) + 1
       ) g
  WHERE NOT EXISTS (
    SELECT 1 FROM customers c WHERE c.codice_cliente_num = g
  );
$$;

GRANT EXECUTE ON FUNCTION next_free_customer_code(integer) TO authenticated;

COMMENT ON FUNCTION next_free_customer_code(integer) IS
  'Primo codice cliente libero dal pavimento in su. Sola lettura: non riserva nulla.';

-- L'anteprima mostra ora esattamente ciò che verrà assegnato: prima sbirciava la sequenza
-- mentre l'assegnazione reale faceva GREATEST(nextval, MAX+1), e le due potevano divergere.
CREATE OR REPLACE FUNCTION get_next_customer_code()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT next_free_customer_code();
$$;

-- Percorso A — pratica DM329 creata per un cliente senza codice.
CREATE OR REPLACE FUNCTION auto_assign_customer_code_for_dm329()
RETURNS TRIGGER AS $$
DECLARE
  v_type     text;
  v_has_code boolean;
  v_num      integer;
BEGIN
  IF NEW.customer_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_type FROM request_types WHERE id = NEW.request_type_id;
  IF v_type NOT IN ('DM329', 'DM329-Integrazioni') THEN
    RETURN NEW;
  END IF;

  SELECT (identificativo IS NOT NULL AND identificativo <> '')
  INTO v_has_code
  FROM customers
  WHERE id = NEW.customer_id;

  -- cliente assente o già codificato -> il codice esistente non si tocca mai
  IF v_has_code IS DISTINCT FROM false THEN
    RETURN NEW;
  END IF;

  -- Due assegnazioni in volo insieme sceglierebbero lo stesso numero e la seconda
  -- sbatterebbe sull'indice unico. Il lock le mette in fila e si libera da sé a fine
  -- transazione, senza bisogno di rilasciarlo a mano nemmeno in caso di errore.
  -- Va preso PRIMA del calcolo: in READ COMMITTED lo statement successivo prende una
  -- snapshot nuova, e vede quindi il codice appena assegnato da chi ci precedeva.
  PERFORM pg_advisory_xact_lock(hashtext('customer_code'));

  v_num := next_free_customer_code();

  UPDATE customers
  SET identificativo = LPAD(v_num::text, 3, '0')
  WHERE id = NEW.customer_id
    AND (identificativo IS NULL OR identificativo = '');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Percorso B — cliente creato a mano dall'app (sentinella 'AUTO').
CREATE OR REPLACE FUNCTION generate_customer_identificativo()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo il percorso di creazione dall'app manda 'AUTO'. NULL/'' o un codice esplicito
  -- restano intatti, così gli import massivi dell'anagrafica MAGO non prendono codice.
  IF NEW.identificativo = 'AUTO' THEN
    PERFORM pg_advisory_xact_lock(hashtext('customer_code'));
    NEW.identificativo := LPAD(next_free_customer_code()::text, 3, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- La sequenza resta a database ma non la usa più nessuno: si tiene per non rompere
-- eventuali dump o script esterni, e perché il suo valore non è più fonte di verità.
COMMENT ON SEQUENCE customer_identificativo_seq IS
  'DORMIENTE dal 2026-08-10: i codici si assegnano con next_free_customer_code().';
