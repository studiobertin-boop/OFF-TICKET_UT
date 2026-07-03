-- Migration: consenti a userdm329 di eliminare le pratiche DM329
-- Date: 2026-07-03
-- Description:
--   userdm329 può eliminare le pratiche di tipo DM329, in qualsiasi stato,
--   rispecchiando il comportamento effettivo dell'admin (che tramite la policy
--   "Admin can delete requests" può eliminare qualsiasi richiesta senza vincolo di stato).
--   Scope limitato alle sole pratiche DM329.
--   L'eliminazione singola non tocca deletion_archives (nessun trigger), quindi
--   è sufficiente questa policy DELETE su requests.

-- Nome legacy eventualmente creato da una versione precedente di questa migration
DROP POLICY IF EXISTS "Userdm329 can delete completed DM329 requests" ON requests;
DROP POLICY IF EXISTS "Userdm329 can delete DM329 requests" ON requests;

CREATE POLICY "Userdm329 can delete DM329 requests"
  ON requests FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'userdm329'
    ) AND
    request_type_id IN (SELECT id FROM request_types WHERE name = 'DM329')
  );

COMMENT ON POLICY "Userdm329 can delete DM329 requests" ON requests IS
'userdm329 può eliminare pratiche DM329 in qualsiasi stato, come l''admin.';
