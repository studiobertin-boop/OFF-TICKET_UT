-- Fix destinatari notifiche: evita duplicati e esclude chi esegue l'azione

-- Aggiorna la funzione per ottenere destinatari notifica
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
    u.id != v_current_user
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
