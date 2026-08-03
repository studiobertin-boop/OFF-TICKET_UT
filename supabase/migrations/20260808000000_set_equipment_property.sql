-- Modifica massiva delle proprieta' costruttive dei compressori.
--
-- Serve a valorizzare `giri` e `tipo_compressore` su gruppi di righe scelti a mano dal
-- tecnico. Quando il catalogo fu importato, `giri` venne compilato solo dove c'era prova
-- positiva — il suffisso commerciale delle macchine a velocita' variabile — e oggi sono 486
-- le righe di compressore attive con `giri` vuoto (485 delle quali hanno vuoto anche
-- `tipo_compressore`, una ha gia' `tipo_compressore: PISTONI`): restarono vuote apposta,
-- perche' l'assenza del suffisso non e' prova di giri fissi, e il valore finisce in una
-- frase asseverata di una relazione firmata. Qui non decide un'euristica, decide chi
-- seleziona.
--
-- Una transazione sola invece di centinaia di scritture separate, come gia' fa
-- `apply_equipment_fixes` per le correzioni del motore di verifica: un'interruzione a meta'
-- lascerebbe il catalogo in uno stato misto.
--
-- Le chiavi ammesse sono due e sole. Non e' pignoleria: applicare lo stesso FAD o la stessa
-- PS a righe diverse cancellerebbe proprio cio' che distingue le varianti fra loro.

CREATE OR REPLACE FUNCTION set_equipment_property(
  p_ids     uuid[],
  p_chiave  text,
  p_valore  text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role    user_role;
  v_applied int := 0;
BEGIN
  SELECT role INTO v_role FROM users WHERE id = auth.uid();
  IF v_role IS NULL OR v_role NOT IN ('admin', 'userdm329') THEN
    RAISE EXCEPTION 'Permesso negato: solo admin e userdm329 possono modificare il catalogo'
      USING ERRCODE = '42501';
  END IF;

  -- `NOT IN` con un operando NULL restituisce NULL, non TRUE: la logica a tre valori di SQL
  -- farebbe scivolare oltre l'IF un p_chiave o un p_valore nullo senza sollevare eccezione.
  -- Il controllo del nullo va quindi esplicito, su tutte e tre le condizioni che seguono —
  -- non e' ridondanza, e' l'unico modo per cui un valore nullo finisca davvero rifiutato.
  IF p_chiave IS NULL OR p_chiave NOT IN ('giri', 'tipo_compressore') THEN
    RAISE EXCEPTION 'Chiave non ammessa alla modifica massiva: %', p_chiave;
  END IF;

  IF p_chiave = 'giri' AND (p_valore IS NULL OR p_valore NOT IN ('fissi', 'variabili')) THEN
    RAISE EXCEPTION 'Valore non ammesso per la regolazione giri: %', p_valore;
  END IF;

  IF p_chiave = 'tipo_compressore'
     AND (p_valore IS NULL OR p_valore NOT IN ('VITE', 'PISTONI', 'SCROLL', 'CENTRIFUGO')) THEN
    RAISE EXCEPTION 'Valore non ammesso per la tipologia costruttiva: %', p_valore;
  END IF;

  IF p_ids IS NULL OR array_length(p_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('applied', 0);
  END IF;

  -- Il filtro sul tipo non e' ridondante rispetto al client: e' la garanzia che una chiamata
  -- costruita altrove non scriva una proprieta' di compressore su un serbatoio.
  UPDATE equipment_catalog
  SET specs      = jsonb_set(COALESCE(specs, '{}'::jsonb), ARRAY[p_chiave], to_jsonb(p_valore), true),
      updated_at = now()
  WHERE id = ANY (p_ids)
    AND tipo_apparecchiatura = 'Compressori';

  GET DIAGNOSTICS v_applied = ROW_COUNT;

  RETURN jsonb_build_object('applied', v_applied);
END;
$$;

COMMENT ON FUNCTION set_equipment_property(uuid[], text, text) IS
  'Valorizza in un''unica transazione una proprieta'' costruttiva (giri, tipo_compressore) '
  'su piu'' righe di compressore. Verifica da se'' il ruolo del chiamante (admin o userdm329).';

REVOKE ALL ON FUNCTION set_equipment_property(uuid[], text, text) FROM public;
GRANT EXECUTE ON FUNCTION set_equipment_property(uuid[], text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';

-- Verifica:
--   SELECT set_equipment_property('{}'::uuid[], 'giri', 'fissi');   -- atteso {"applied": 0}
--   SELECT set_equipment_property('{}'::uuid[], 'fad', '1');        -- attesa eccezione
