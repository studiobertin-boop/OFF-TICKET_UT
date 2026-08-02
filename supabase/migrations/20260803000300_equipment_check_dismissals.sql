-- Archiviazione delle segnalazioni di coerenza, e applicazione transazionale
-- delle correzioni al catalogo apparecchiature.
--
-- Il modulo «Gestisci apparecchiature» produce segnalazioni sui dati del catalogo.
-- Alcune sono euristiche e hanno falsi positivi noti — due taglie della stessa serie
-- possono appartenere a generazioni diverse — quindi devono poter essere valutate una
-- volta e messe da parte con una motivazione, senza ricomparire a ogni verifica.
--
-- L'archiviazione vale pero' per lo stato dei dati al momento della valutazione:
-- `payload_hash` fotografa i valori coinvolti, e quando cambiano la segnalazione
-- riemerge invece di restare sepolta. La chiave `finding_key` e' costruita dal motore
-- con soli identificatori semantici (regola, marca, modello, pressione) e mai con gli
-- id delle righe, cosi' che fondere o ricreare una voce non faccia ricomparire cio'
-- che era gia' stato valutato.

CREATE TABLE IF NOT EXISTS equipment_check_dismissals (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_key  text NOT NULL UNIQUE,
  rule_id      text NOT NULL,
  payload_hash text NOT NULL,
  scope        text NOT NULL CHECK (scope IN ('catalogo', 'scheda')),
  -- Non serve al riconoscimento, che avviene su finding_key: permette di ripulire
  -- le archiviazioni quando le righe a cui si riferiscono vengono eliminate.
  entity_ids   uuid[] NOT NULL DEFAULT '{}',
  motivazione  text NOT NULL CHECK (length(btrim(motivazione)) >= 5),
  dismissed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_equipment_dismissals_rule
  ON equipment_check_dismissals (rule_id);
CREATE INDEX IF NOT EXISTS idx_equipment_dismissals_entities
  ON equipment_check_dismissals USING gin (entity_ids);

DROP TRIGGER IF EXISTS trg_equipment_dismissals_updated_at ON equipment_check_dismissals;
CREATE TRIGGER trg_equipment_dismissals_updated_at
  BEFORE UPDATE ON equipment_check_dismissals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE equipment_check_dismissals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Dismissals are viewable by authenticated users" ON equipment_check_dismissals;
CREATE POLICY "Dismissals are viewable by authenticated users"
  ON equipment_check_dismissals FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admin and userdm329 can manage dismissals" ON equipment_check_dismissals;
CREATE POLICY "Admin and userdm329 can manage dismissals"
  ON equipment_check_dismissals FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'userdm329'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'userdm329'))
  );

COMMENT ON TABLE equipment_check_dismissals IS
  'Segnalazioni di coerenza del catalogo valutate e archiviate. Riemergono da sole '
  'quando i valori coinvolti cambiano: vedi payload_hash.';

-- ---------------------------------------------------------------------------
-- Applicazione transazionale delle correzioni
-- ---------------------------------------------------------------------------
--
-- Le correzioni arrivano dal motore in forma dichiarativa e possono essere molte:
-- portare l'intero catalogo al formato corrente significa circa 1200 aggiornamenti.
-- Farli uno alla volta dal client sarebbe lento e non atomico, e un'interruzione a
-- meta' lascerebbe il catalogo in uno stato misto.
--
-- La funzione e' SECURITY DEFINER per poter scrivere in blocco, quindi verifica da
-- sola il ruolo di chi la invoca: senza questo controllo aggirerebbe le policy.

CREATE OR REPLACE FUNCTION apply_equipment_fixes(fixes jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  f          jsonb;
  v_role     user_role;
  v_remove   text[];
  v_drop_ids uuid[];
  v_keep_id  uuid;
  v_applied  int := 0;
BEGIN
  SELECT role INTO v_role FROM users WHERE id = auth.uid();
  IF v_role IS NULL OR v_role NOT IN ('admin', 'userdm329') THEN
    RAISE EXCEPTION 'Permesso negato: solo admin e userdm329 possono correggere il catalogo'
      USING ERRCODE = '42501';
  END IF;

  IF fixes IS NULL OR jsonb_typeof(fixes) <> 'array' THEN
    RAISE EXCEPTION 'Le correzioni devono essere un array JSON';
  END IF;

  FOR f IN SELECT value FROM jsonb_array_elements(fixes) LOOP
    -- Le chiavi da rimuovere si tolgono PRIMA di applicare i nuovi valori, cosi'
    -- che una chiave presente in entrambi finisca comunque valorizzata.
    v_remove := COALESCE(ARRAY(SELECT jsonb_array_elements_text(f -> 'removeKeys')), '{}'::text[]);

    CASE f ->> 'kind'

      WHEN 'set_specs' THEN
        UPDATE equipment_catalog
        SET specs = (COALESCE(specs, '{}'::jsonb) - v_remove) || COALESCE(f -> 'patch', '{}'::jsonb)
        WHERE id = (f ->> 'rowId')::uuid;

      WHEN 'set_modello' THEN
        UPDATE equipment_catalog
        SET modello = f ->> 'modello',
            specs   = (COALESCE(specs, '{}'::jsonb) - v_remove) || COALESCE(f -> 'patch', '{}'::jsonb)
        WHERE id = (f ->> 'rowId')::uuid;

      WHEN 'set_tipo' THEN
        UPDATE equipment_catalog
        SET tipo_apparecchiatura = (f ->> 'tipoApparecchiatura')::equipment_catalog_type,
            tipo                 = f ->> 'tipoApparecchiatura'
        WHERE id = (f ->> 'rowId')::uuid;

      WHEN 'delete_row' THEN
        DELETE FROM equipment_catalog WHERE id = (f ->> 'rowId')::uuid;

      WHEN 'merge_rows' THEN
        v_keep_id  := (f ->> 'keepId')::uuid;
        v_drop_ids := ARRAY(SELECT jsonb_array_elements_text(f -> 'dropIds'))::uuid[];

        -- Gli utilizzi delle righe assorbite si sommano a quella conservata:
        -- e' il dato che dice quali voci sono davvero in uso.
        UPDATE equipment_catalog k
        SET specs       = COALESCE(f -> 'mergedSpecs', k.specs),
            aliases     = ARRAY(
                            SELECT DISTINCT a FROM unnest(
                              COALESCE(k.aliases, '{}'::text[]) ||
                              COALESCE(ARRAY(SELECT jsonb_array_elements_text(f -> 'mergedAliases')), '{}'::text[])
                            ) AS a WHERE a IS NOT NULL AND btrim(a) <> ''
                          ),
            usage_count = k.usage_count + COALESCE(
                            (SELECT sum(d.usage_count) FROM equipment_catalog d WHERE d.id = ANY(v_drop_ids)), 0
                          )
        WHERE k.id = v_keep_id;

        DELETE FROM equipment_catalog WHERE id = ANY(v_drop_ids);
        DELETE FROM equipment_check_dismissals WHERE entity_ids && v_drop_ids;

      WHEN 'create_row' THEN
        INSERT INTO equipment_catalog (
          tipo, tipo_apparecchiatura, marca, modello, specs, is_active, is_user_defined, created_by
        ) VALUES (
          f #>> '{row,tipoApparecchiatura}',
          (f #>> '{row,tipoApparecchiatura}')::equipment_catalog_type,
          f #>> '{row,marca}',
          f #>> '{row,modello}',
          COALESCE(f #> '{row,specs}', '{}'::jsonb),
          true,
          true,
          auth.uid()
        );

      ELSE
        RAISE EXCEPTION 'Tipo di correzione non riconosciuto: %', COALESCE(f ->> 'kind', '(assente)');
    END CASE;

    v_applied := v_applied + 1;
  END LOOP;

  RETURN jsonb_build_object('applied', v_applied);
END;
$$;

COMMENT ON FUNCTION apply_equipment_fixes(jsonb) IS
  'Applica in un''unica transazione le correzioni dichiarative prodotte dal motore di '
  'verifica del catalogo. Verifica da se'' il ruolo del chiamante (admin o userdm329).';

REVOKE ALL ON FUNCTION apply_equipment_fixes(jsonb) FROM public;
GRANT EXECUTE ON FUNCTION apply_equipment_fixes(jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';

-- Verifica:
--   SELECT count(*) FROM equipment_check_dismissals;                      -- attesa 0
--   SELECT policyname, cmd FROM pg_policies
--   WHERE tablename = 'equipment_check_dismissals';                       -- attese 2
--   SELECT apply_equipment_fixes('[]'::jsonb);                            -- atteso {"applied": 0}
