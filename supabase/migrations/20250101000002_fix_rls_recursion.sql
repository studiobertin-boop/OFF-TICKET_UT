-- =============================================
-- FIX: Infinite Recursion in RLS Policies
-- =============================================
-- PROBLEMA: Le policy RLS causavano ricorsione infinita perché:
-- 1. get_user_role() faceva SELECT su users ad ogni chiamata
-- 2. La policy "Utente can update own requests" faceva SELECT su requests
--    durante un UPDATE sulla stessa tabella
-- 3. Le policy su request_history/attachments facevano SELECT su requests
--    che ri-triggeravano le policy su requests
--
-- SOLUZIONE:
-- 1. Rendere get_user_role() STABLE per caching nella stessa transazione
-- 2. Usare OLD record nelle policy UPDATE invece di SELECT
-- 3. Usare SECURITY DEFINER dove appropriato per bypassare RLS nei check
-- =============================================

-- =============================================
-- 1. FIX: Ottimizza get_user_role() con caching
-- =============================================
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT role FROM users WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;
-- STABLE = risultato cachato nella stessa transazione
-- SECURITY DEFINER = esegue con permessi del creatore (bypassa RLS su users)

-- =============================================
-- 2. FIX: Rimuovi ricorsione nella policy UPDATE utente
-- =============================================

-- Drop e ricrea la policy problematica
DROP POLICY IF EXISTS "Utente can update own requests" ON requests;

-- SOLUZIONE: Non possiamo usare OLD in policy, quindi semplifichiamo
-- Il check sarà fatto a livello applicativo o trigger
CREATE POLICY "Utente can update own requests"
  ON requests FOR UPDATE
  USING (
    get_user_role() = 'utente' AND
    created_by = auth.uid()
  )
  WITH CHECK (
    created_by = auth.uid()
    -- Rimosso il check su assigned_to che causava ricorsione
    -- Sarà validato a livello applicativo
  );

-- =============================================
-- 3. ALTERNATIVA: Trigger per validare che utente non cambi assigned_to
-- =============================================
CREATE OR REPLACE FUNCTION validate_utente_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Se l'utente è 'utente' (non admin/tecnico), non può cambiare assigned_to
  IF EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role = 'utente'
  ) THEN
    -- Impedisci cambio di assigned_to
    IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
      RAISE EXCEPTION 'Gli utenti non possono modificare il tecnico assegnato';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Applica il trigger
DROP TRIGGER IF EXISTS validate_utente_request_update ON requests;
CREATE TRIGGER validate_utente_request_update
  BEFORE UPDATE ON requests
  FOR EACH ROW
  EXECUTE FUNCTION validate_utente_update();

-- =============================================
-- 4. COMMENTO: Le policy su request_history/attachments vanno bene
-- =============================================
-- Le policy che fanno:
--   EXISTS (SELECT 1 FROM requests WHERE ...)
-- NON causano ricorsione perché:
-- - Sono su tabelle diverse (request_history, attachments)
-- - Il SELECT è read-only e non triggera policy UPDATE
-- - PostgreSQL gestisce correttamente questo pattern
--
-- Manteniamo quindi le policy esistenti così come sono.

