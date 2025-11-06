-- Tabella preferenze notifiche utente
CREATE TABLE IF NOT EXISTS user_notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  in_app BOOLEAN DEFAULT true,
  email BOOLEAN DEFAULT false,
  status_transitions JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- Aggiorna tabella notifications esistente
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS status_from TEXT,
  ADD COLUMN IF NOT EXISTS status_to TEXT,
  ADD COLUMN IF NOT EXISTS event_type TEXT NOT NULL DEFAULT 'status_change',
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read) WHERE read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_request ON notifications(request_id);
CREATE INDEX IF NOT EXISTS idx_user_notification_preferences_user ON user_notification_preferences(user_id);

-- RLS per user_notification_preferences
ALTER TABLE user_notification_preferences ENABLE ROW LEVEL SECURITY;

-- Politiche RLS per user_notification_preferences
CREATE POLICY "Users can view own preferences"
  ON user_notification_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON user_notification_preferences FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
  ON user_notification_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS per notifications (aggiorna se necessario)
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Function per creare notifiche
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_request_id UUID,
  p_event_type TEXT,
  p_message TEXT,
  p_status_from TEXT DEFAULT NULL,
  p_status_to TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
) RETURNS void AS $$
DECLARE
  v_preferences RECORD;
  v_should_notify BOOLEAN := false;
BEGIN
  -- Ottieni preferenze utente (crea default se non esistono)
  SELECT * INTO v_preferences
  FROM user_notification_preferences
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    -- Crea preferenze default
    INSERT INTO user_notification_preferences (user_id, in_app, email, status_transitions)
    VALUES (p_user_id, true, false, '{}')
    RETURNING * INTO v_preferences;
  END IF;

  -- Verifica se notificare
  IF p_event_type IN ('request_created', 'request_suspended', 'request_unsuspended') THEN
    -- Eventi sempre attivi
    v_should_notify := true;
  ELSIF p_event_type = 'status_change' AND p_status_from IS NOT NULL AND p_status_to IS NOT NULL THEN
    -- Verifica se la transizione è nelle preferenze
    v_should_notify := COALESCE(
      (v_preferences.status_transitions->>(p_status_from || '_' || p_status_to))::boolean,
      false
    );
  END IF;

  -- Crea notifica in-app se abilitata
  IF v_should_notify AND v_preferences.in_app THEN
    INSERT INTO notifications (user_id, request_id, type, message, status_from, status_to, event_type, metadata, read)
    VALUES (p_user_id, p_request_id, p_event_type, p_message, p_status_from, p_status_to, p_event_type, p_metadata, false);
  END IF;

  -- TODO: Email notification (fase 2)
  -- IF v_should_notify AND v_preferences.email THEN
  --   -- Chiamata edge function per email
  -- END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function per ottenere destinatari notifica
CREATE OR REPLACE FUNCTION get_notification_recipients(p_request_id UUID)
RETURNS TABLE(user_id UUID) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT u.id
  FROM users u
  WHERE
    -- Creatore della richiesta
    u.id = (SELECT created_by FROM requests WHERE id = p_request_id)
    OR
    -- Tecnico assegnato
    u.id = (SELECT assigned_to FROM requests WHERE id = p_request_id)
    OR
    -- Admin
    u.role = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger per notifiche su cambio stato richiesta
CREATE OR REPLACE FUNCTION notify_request_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_recipient UUID;
  v_message TEXT;
  v_request_title TEXT;
  v_event_type TEXT;
  v_is_suspension BOOLEAN := false;
  v_is_unsuspension BOOLEAN := false;
BEGIN
  -- Ottieni titolo richiesta
  SELECT title INTO v_request_title FROM requests WHERE id = NEW.id;

  -- Determina tipo evento
  IF OLD.status IS NULL THEN
    -- Nuova richiesta
    v_event_type := 'request_created';
    v_message := 'Nuova richiesta creata: ' || v_request_title;
  ELSIF NEW.status = 'SOSPESA' AND OLD.status != 'SOSPESA' THEN
    -- Blocco
    v_event_type := 'request_suspended';
    v_message := 'Richiesta bloccata: ' || v_request_title;
    v_is_suspension := true;
  ELSIF OLD.status = 'SOSPESA' AND NEW.status != 'SOSPESA' THEN
    -- Sblocco
    v_event_type := 'request_unsuspended';
    v_message := 'Richiesta sbloccata: ' || v_request_title;
    v_is_unsuspension := true;
  ELSE
    -- Cambio stato normale
    v_event_type := 'status_change';
    v_message := 'Richiesta ' || v_request_title || ' cambiata da ' || OLD.status || ' a ' || NEW.status;
  END IF;

  -- Notifica tutti i destinatari
  FOR v_recipient IN
    SELECT * FROM get_notification_recipients(NEW.id)
  LOOP
    PERFORM create_notification(
      v_recipient,
      NEW.id,
      v_event_type,
      v_message,
      OLD.status,
      NEW.status,
      jsonb_build_object(
        'request_title', v_request_title,
        'is_suspension', v_is_suspension,
        'is_unsuspension', v_is_unsuspension
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crea trigger
DROP TRIGGER IF EXISTS trigger_notify_request_status_change ON requests;
CREATE TRIGGER trigger_notify_request_status_change
  AFTER INSERT OR UPDATE OF status ON requests
  FOR EACH ROW
  EXECUTE FUNCTION notify_request_status_change();

-- Aggiorna timestamp su modifica preferenze
CREATE OR REPLACE FUNCTION update_notification_preferences_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_notification_preferences_timestamp
  BEFORE UPDATE ON user_notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_preferences_timestamp();
