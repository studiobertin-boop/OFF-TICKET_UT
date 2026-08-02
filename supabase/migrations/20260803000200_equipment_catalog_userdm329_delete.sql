-- Estende a userdm329 il permesso di eliminare voci dal catalogo apparecchiature.
--
-- Il nuovo modulo «Gestisci apparecchiature» e' a disposizione di admin e userdm329
-- con gli stessi poteri. Le policy di inserimento e modifica coprono gia' entrambi i
-- ruoli dalla creazione della tabella; restava fuori solo l'eliminazione, che era
-- riservata ad admin e avrebbe impedito a userdm329 di rimuovere duplicati.

DROP POLICY IF EXISTS "Only admin can delete equipment" ON equipment_catalog;

CREATE POLICY "Admin and userdm329 can delete equipment"
  ON equipment_catalog
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('admin', 'userdm329')
    )
  );

-- Verifica:
--   SELECT policyname, cmd FROM pg_policies
--   WHERE tablename = 'equipment_catalog' ORDER BY cmd;
