-- Due correzioni all'allocazione introdotta poco fa da
-- 20260810120000_codice_cliente_primo_slot_libero.sql.

-- ============================================================================
-- 1. LPAD tronca: al codice 1000 assegnava il codice di un altro cliente
-- ============================================================================
--
-- `LPAD(testo, 3, '0')` non si limita a riempire: se il testo è più lungo di 3
-- caratteri lo TRONCA. Verificato in produzione: lpad('1000', 3, '0') = '100'.
-- Il guaio è che '100' supera anche il CHECK identificativo_format, quindi non
-- si sarebbe fermato nulla: al codice 1000 il cliente avrebbe silenziosamente
-- preso '100', che appartiene già a un altro. Il difetto veniva da lontano —
-- entrambi i trigger storici usavano questo LPAD — e non è mai esploso solo
-- perché il massimo assegnato è 675.
--
-- Da qui in avanti la forma canonica del codice si scrive in un punto solo.

CREATE OR REPLACE FUNCTION format_customer_code(p_num integer)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
           WHEN p_num < 1000 THEN LPAD(p_num::text, 3, '0')
           ELSE p_num::text
         END
$$;

COMMENT ON FUNCTION format_customer_code(integer) IS
  'Forma canonica del codice cliente: zero-pad a 3 cifre sotto 1000, naturale da 1000 in su. Gemello SQL di normalizeIdentificativo() lato TypeScript.';

-- ============================================================================
-- 2. STABLE leggeva una fotografia troppo vecchia, scavalcando il lock
-- ============================================================================
--
-- Una funzione STABLE usa la snapshot della query chiamante, non una propria.
-- Chiamata dentro il trigger, quella snapshot è quella dell'INSERT — scattata
-- PRIMA che il trigger prendesse l'advisory lock. Una transazione concorrente
-- che avesse committato nel frattempo sarebbe quindi rimasta invisibile, e si
-- sarebbe scelto un codice già assegnato: esattamente ciò che il lock doveva
-- impedire. VOLATILE forza una snapshot fresca a ogni chiamata, e il lock torna
-- a servire a qualcosa.
--
-- Nessuna conseguenza sull'anteprima lato app: supabase.rpc() usa POST.

CREATE OR REPLACE FUNCTION next_free_customer_code(p_floor integer DEFAULT 585)
RETURNS integer
LANGUAGE sql
VOLATILE                  -- vedi sopra: STABLE userebbe la snapshot del chiamante
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

CREATE OR REPLACE FUNCTION get_next_customer_code()
RETURNS integer
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT next_free_customer_code();
$$;

-- ============================================================================
-- 3. I due percorsi di assegnazione passano dal formattatore unico
-- ============================================================================

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
  -- Va preso PRIMA del calcolo: lo statement successivo prende una snapshot nuova,
  -- e vede quindi il codice appena assegnato da chi ci precedeva.
  PERFORM pg_advisory_xact_lock(hashtext('customer_code'));

  v_num := next_free_customer_code();

  UPDATE customers
  SET identificativo = format_customer_code(v_num)
  WHERE id = NEW.customer_id
    AND (identificativo IS NULL OR identificativo = '');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION generate_customer_identificativo()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo il percorso di creazione dall'app manda 'AUTO'. NULL/'' o un codice esplicito
  -- restano intatti, così gli import massivi dell'anagrafica MAGO non prendono codice.
  IF NEW.identificativo = 'AUTO' THEN
    PERFORM pg_advisory_xact_lock(hashtext('customer_code'));
    NEW.identificativo := format_customer_code(next_free_customer_code());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
