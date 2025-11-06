-- Fix completo sistema notifiche:
-- 1. Evita duplicati destinatari
-- 2. Esclude chi esegue l'azione
-- 3. Pulisce vecchie notifiche senza i nuovi campi

-- 1. Aggiorna la funzione per ottenere destinatari (evita duplicati e esclude chi esegue)
CREATE OR REPLACE FUNCTION get_notification_recipients(p_request_id UUID)
RETURNS TABLE(user_id UUID) AS $$
DECLARE
  v_current_user UUID;
BEGIN
  -- Ottieni l'utente corrente (chi sta eseguendo l'azione)
  v_current_user := auth.uid();

  RETURN QUERY
  SELECT DISTINCT u.id
  FROM users u
  WHERE
    -- Esclude l'utente che sta eseguendo l'azione
    u.id != COALESCE(v_current_user, '00000000-0000-0000-0000-000000000000'::uuid)
    AND (
      -- Creatore della richiesta (solo se diverso da chi esegue l'azione)
      u.id = (SELECT created_by FROM requests WHERE id = p_request_id)
      OR
      -- Tecnico assegnato (solo se diverso da chi esegue l'azione)
      u.id = (SELECT assigned_to FROM requests WHERE id = p_request_id)
      OR
      -- Admin (solo se diverso da chi esegue l'azione)
      u.role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. OPZIONALE: Elimina vecchie notifiche che non hanno i nuovi campi
-- DECOMMENTARE se vuoi ripulire le notifiche vecchie:
-- DELETE FROM notifications WHERE event_type IS NULL OR status_to IS NULL;

-- 3. OPZIONALE: Segna tutte le notifiche esistenti come lette per evitare confusione
-- DECOMMENTARE se vuoi marcare le vecchie notifiche come lette:
-- UPDATE notifications SET read = true WHERE event_type IS NULL OR status_to IS NULL;
