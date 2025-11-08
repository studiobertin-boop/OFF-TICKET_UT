-- =====================================================
-- APPLICAZIONE MANUALE: Supporto Email nelle Notifiche
-- =====================================================
-- Questo script applica manualmente la funzione create_notification
-- con supporto per l'invio di email tramite Edge Function
-- =====================================================

-- 1. Verifica che pg_net sia installato
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Applica la funzione create_notification aggiornata
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
  v_user_email TEXT;
  v_user_name TEXT;
  v_request_data RECORD;
  v_email_payload JSONB;
  v_http_response BIGINT;
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

  -- Invia email se abilitata
  IF v_should_notify AND v_preferences.email THEN
    BEGIN
      -- Ottieni email e nome utente
      SELECT
        COALESCE(u.email, au.email) as email,
        COALESCE(u.full_name, au.email) as full_name
      INTO v_user_email, v_user_name
      FROM auth.users au
      LEFT JOIN users u ON u.id = au.id
      WHERE au.id = p_user_id;

      -- Ottieni dati completi della richiesta per email
      SELECT
        r.title,
        r.status,
        rt.name as request_type_name,
        c.ragione_sociale as customer_name,
        u_assigned.full_name as assigned_to_name,
        CASE WHEN rt.name LIKE '%DM329%' THEN true ELSE false END as is_dm329
      INTO v_request_data
      FROM requests r
      LEFT JOIN request_types rt ON r.request_type_id = rt.id
      LEFT JOIN customers c ON r.customer_id = c.id
      LEFT JOIN users u_assigned ON r.assigned_to = u_assigned.id
      WHERE r.id = p_request_id;

      -- Costruisci payload per Edge Function
      v_email_payload := jsonb_build_object(
        'to', v_user_email,
        'user_name', v_user_name,
        'event_type', p_event_type,
        'message', p_message,
        'request_id', p_request_id,
        'metadata', jsonb_build_object(
          'request_title', v_request_data.title,
          'request_type_name', v_request_data.request_type_name,
          'customer_name', v_request_data.customer_name,
          'current_status', v_request_data.status,
          'assigned_to_name', v_request_data.assigned_to_name,
          'is_dm329', v_request_data.is_dm329
        ) || p_metadata
      );

      -- Chiama Edge Function send-notification-email usando pg_net
      -- NOTA: Sostituisci 'uphftgpwisdiubuhohnc' con il tuo project ref
      SELECT net.http_post(
        url := 'https://uphftgpwisdiubuhohnc.supabase.co/functions/v1/send-notification-email',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVwaGZ0Z3B3aXNkaXVidWhvaG5jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzA5MjYyMzQsImV4cCI6MjA0NjUwMjIzNH0.Nt3n1axV5TaDPSXrzaO0PLd78pJ-T2CdhTIKJdmhEPY'
        ),
        body := v_email_payload
      ) INTO v_http_response;

      -- Log successo
      RAISE NOTICE 'Email notification queued for user % (request_id: %, response: %)', p_user_id, p_request_id, v_http_response;

    EXCEPTION WHEN OTHERS THEN
      -- Log errore ma non bloccare la notifica in-app
      RAISE WARNING 'Failed to send email notification to user %: %', p_user_id, SQLERRM;
      -- Continua senza errore
    END;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION create_notification IS 'Crea notifiche in-app e invia email se abilitato. Usa pg_net per chiamare Edge Function send-notification-email.';

-- =====================================================
-- TEST: Verifica che la funzione sia stata applicata
-- =====================================================
SELECT
  'create_notification function updated' as status,
  prosrc::text LIKE '%pg_net%' as has_email_support
FROM pg_proc
WHERE proname = 'create_notification';

-- =====================================================
-- NEXT STEPS
-- =====================================================
-- 1. Esegui questo script nel SQL Editor di Supabase Dashboard
-- 2. Verifica che has_email_support sia true
-- 3. Testa creando una nuova richiesta con email notifications abilitate
-- =====================================================
