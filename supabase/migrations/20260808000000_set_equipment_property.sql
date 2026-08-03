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

-- La firma e' passata da tre argomenti a quattro con `p_rimuovi` in coda. Il valore di
-- default rende la nuova funzione chiamabile anche con tre argomenti: se la vecchia restasse
-- a database, PostgREST si troverebbe due candidati per la stessa chiamata e non saprebbe
-- quale scegliere. Va quindi tolta esplicitamente, prima di ricreare.
DROP FUNCTION IF EXISTS set_equipment_property(uuid[], text, text);

CREATE OR REPLACE FUNCTION set_equipment_property(
  p_ids     uuid[],
  p_chiave  text,
  p_valore  text,
  p_rimuovi text[] DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role    user_role;
  v_attese  int := 0;
  v_applied int := 0;
BEGIN
  SELECT role INTO v_role FROM users WHERE id = auth.uid();
  IF v_role IS NULL OR v_role NOT IN ('admin', 'userdm329') THEN
    RAISE EXCEPTION 'Permesso negato: solo admin e userdm329 possono modificare il catalogo'
      USING ERRCODE = '42501';
  END IF;

  -- `NOT IN` con un operando NULL restituisce NULL, non TRUE: la logica a tre valori di SQL
  -- farebbe scivolare oltre l'IF un p_chiave o un p_valore nullo senza sollevare eccezione.
  -- Il controllo del nullo va quindi esplicito, su tutte le condizioni che seguono — non e'
  -- ridondanza, e' l'unico modo per cui un valore nullo finisca davvero rifiutato.
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

  -- Le chiavi da rimuovere sono quelle che la scrittura rende inapplicabili: marcare «a
  -- pistoni» un modello a giri variabili lascerebbe li' una regolazione che il form nasconde,
  -- che la verifica di coerenza non guarda e che la relazione firmata continuerebbe a
  -- riportare. Si tolgono nella stessa transazione, e sono ammesse le stesse due chiavi: cio'
  -- che questa funzione puo' scrivere e' esattamente cio' che puo' togliere.
  -- Stessa guardia del nullo di sopra, qui anche sui singoli elementi dell'array.
  IF p_rimuovi IS NULL OR EXISTS (
    SELECT 1 FROM unnest(p_rimuovi) AS k
    WHERE k IS NULL OR k NOT IN ('giri', 'tipo_compressore')
  ) THEN
    RAISE EXCEPTION 'Chiave non ammessa alla rimozione: %', p_rimuovi;
  END IF;

  IF p_ids IS NULL OR array_length(p_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('applied', 0);
  END IF;

  SELECT count(DISTINCT u) INTO v_attese FROM unnest(p_ids) AS u;

  -- Il filtro sul tipo non e' ridondante rispetto al client: e' la garanzia che una chiamata
  -- costruita altrove non scriva una proprieta' di compressore su un serbatoio. Per lo stesso
  -- motivo qui c'e' anche la condizione di applicabilita' dei giri — la stessa del backfill in
  -- 20260805000100_backfill_giri_compressori.sql — cosi' che nessuno possa dichiarare una
  -- regolazione giri su uno scroll passando da un'altra strada.
  -- La rimozione precede la scrittura, come in `apply_equipment_fixes`: se per qualsiasi
  -- motivo la chiave scritta comparisse anche fra quelle da togliere, a vincere e' il valore
  -- nuovo e non la cancellazione.
  UPDATE equipment_catalog
  SET specs      = jsonb_set(
                     COALESCE(specs, '{}'::jsonb) - p_rimuovi,
                     ARRAY[p_chiave],
                     to_jsonb(p_valore),
                     true
                   ),
      updated_at = now()
  WHERE id = ANY (p_ids)
    AND tipo_apparecchiatura = 'Compressori'
    AND (
      p_chiave <> 'giri'
      OR specs ->> 'tipo_compressore' IS NULL
      OR specs ->> 'tipo_compressore' = 'VITE'
    );

  GET DIAGNOSTICS v_applied = ROW_COUNT;

  -- Fra la conferma e la scrittura una riga puo' essere sparita, aver cambiato tipo o aver
  -- guadagnato una tipologia costruttiva che esclude i giri, per mano di un'altra sessione.
  -- Applicarne una parte in silenzio sarebbe la cosa peggiore: chi ha letto «Applica a 38
  -- righe» vedrebbe «35 righe aggiornate» e la differenza starebbe tutta nel confronto fra due
  -- numeri a un secondo di distanza. Meglio non applicare niente e dirlo.
  IF v_applied <> v_attese THEN
    RAISE EXCEPTION 'Modifica massiva annullata: erano % le righe da aggiornare, ne risultano modificabili %. Nel frattempo qualcuna e'' stata cancellata, ha cambiato tipo o non ammette piu'' questa proprieta''. Ricarica la pagina e ripeti la selezione.',
      v_attese, v_applied;
  END IF;

  RETURN jsonb_build_object('applied', v_applied);
END;
$$;

COMMENT ON FUNCTION set_equipment_property(uuid[], text, text, text[]) IS
  'Valorizza in un''unica transazione una proprieta'' costruttiva (giri, tipo_compressore) '
  'su piu'' righe di compressore, rimuovendo le chiavi che quella scrittura rende '
  'inapplicabili. Verifica da se'' il ruolo del chiamante (admin o userdm329) e annulla '
  'tutto se non riesce ad aggiornare esattamente le righe richieste.';

REVOKE ALL ON FUNCTION set_equipment_property(uuid[], text, text, text[]) FROM public;
GRANT EXECUTE ON FUNCTION set_equipment_property(uuid[], text, text, text[]) TO authenticated;

NOTIFY pgrst, 'reload schema';

-- Verifica:
--   SELECT set_equipment_property('{}'::uuid[], 'giri', 'fissi');   -- atteso {"applied": 0}
--   SELECT set_equipment_property('{}'::uuid[], 'fad', '1');        -- attesa eccezione
--   SELECT set_equipment_property('{}'::uuid[], 'giri', 'fissi', '{fad}');  -- attesa eccezione
