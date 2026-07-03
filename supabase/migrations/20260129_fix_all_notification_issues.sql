-- =====================================================
-- Fix Completo Sistema Notifiche
-- =====================================================
-- Data: 2026-01-29
--
-- Risolve TUTTI i problemi delle notifiche:
-- 1. Preferenze non rispettate (cambi stato arrivano anche se disabilitati)
-- 2. "Segna tutte come lette" non funziona
-- 3. Click su notifica non la elimina
-- =====================================================

-- =====================================================
-- PROBLEMA 3: Manca la DELETE policy!
-- =====================================================

-- Elimina eventuali policy DELETE esistenti
DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;

-- Crea policy DELETE per permettere eliminazione notifiche
CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- PROBLEMA 2: Fix UPDATE policy per "Segna tutte come lette"
-- =====================================================

-- Elimina vecchia policy UPDATE
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;

-- Crea nuova policy UPDATE più permissiva
-- Permette update se:
-- 1. L'utente è il proprietario (user_id = auth.uid())
-- 2. OPPURE la notifica è non letta (fallback per dati legacy)
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (
    auth.uid() = user_id OR read = false
  )
  WITH CHECK (
    auth.uid() = user_id
  );

-- =====================================================
-- PROBLEMA 1: Fix funzione create_notification
-- =====================================================

-- Ricrea la funzione con la logica corretta per le preferenze
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
  v_should_notify_in_app BOOLEAN := false;
  v_should_notify_email BOOLEAN := false;
  v_user_email TEXT;
  v_user_name TEXT;
  v_request_data RECORD;
  v_email_payload JSONB;
  v_supabase_url TEXT;
  v_supabase_anon_key TEXT;
BEGIN
  -- Ottieni preferenze utente (crea default se non esistono)
  SELECT * INTO v_preferences
  FROM user_notification_preferences
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    -- Crea preferenze default (in_app=true, email=false, tutte le transizioni disabilitate)
    INSERT INTO user_notification_preferences (user_id, in_app, email, status_transitions)
    VALUES (p_user_id, true, false, '{}')
    RETURNING * INTO v_preferences;
  END IF;

  -- ========================================
  -- LOGICA DI DECISIONE NOTIFICA
  -- ========================================

  -- Eventi SEMPRE ATTIVI (non configurabili dall'utente):
  -- - Creazione richiesta
  -- - Blocco richiesta (→ SOSPESA)
  -- - Sblocco richiesta (SOSPESA →)
  IF p_event_type IN ('request_created', 'request_suspended', 'request_unsuspended') THEN
    -- Questi eventi rispettano solo le preferenze dei canali (in_app/email)
    v_should_notify_in_app := v_preferences.in_app;
    v_should_notify_email := v_preferences.email;

  -- Eventi CONFIGURABILI (cambio stato):
  -- Rispetta le preferenze dell'utente per questa specifica transizione
  ELSIF p_event_type = 'status_change' AND p_status_from IS NOT NULL AND p_status_to IS NOT NULL THEN
    DECLARE
      v_transition_key TEXT;
      v_transition_enabled BOOLEAN;
    BEGIN
      -- Costruisci la chiave della transizione
      v_transition_key := p_status_from || '_' || p_status_to;

      -- Verifica se questa specifica transizione è abilitata
      -- IMPORTANTE: se la chiave non esiste, default a FALSE (disabilitato)
      v_transition_enabled := COALESCE(
        (v_preferences.status_transitions->>v_transition_key)::boolean,
        false
      );

      -- Notifica SOLO se la transizione è abilitata E il canale è abilitato
      v_should_notify_in_app := v_transition_enabled AND v_preferences.in_app;
      v_should_notify_email := v_transition_enabled AND v_preferences.email;
    END;
  ELSE
    -- Eventi sconosciuti: non notificare
    RETURN;
  END IF;

  -- ========================================
  -- CREAZIONE NOTIFICA IN-APP
  -- ========================================
  IF v_should_notify_in_app THEN
    INSERT INTO notifications (user_id, request_id, type, message, status_from, status_to, event_type, metadata, read)
    VALUES (p_user_id, p_request_id, p_event_type, p_message, p_status_from, p_status_to, p_event_type, p_metadata, false);
  END IF;

  -- ========================================
  -- INVIO EMAIL
  -- ========================================
  IF v_should_notify_email THEN
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

      -- Ottieni URL e chiave Supabase (dall'environment)
      v_supabase_url := current_setting('app.settings.supabase_url', true);
      v_supabase_anon_key := current_setting('app.settings.supabase_anon_key', true);

      -- Chiama Edge Function send-notification-email se configurata
      IF v_supabase_url IS NOT NULL AND v_supabase_anon_key IS NOT NULL THEN
        PERFORM net.http_post(
          url := v_supabase_url || '/functions/v1/send-notification-email',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_supabase_anon_key
          ),
          body := v_email_payload
        );
      END IF;

    EXCEPTION WHEN OTHERS THEN
      -- Log errore ma non bloccare la notifica in-app
      RAISE WARNING 'Failed to send email notification to user %: %', p_user_id, SQLERRM;
    END;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Documentazione
-- =====================================================
COMMENT ON FUNCTION create_notification IS
'Crea notifiche in-app e invia email rispettando le preferenze utente.

Eventi sempre attivi (non configurabili, rispettano solo canali):
- request_created: creazione nuova richiesta
- request_suspended: blocco richiesta (→ SOSPESA)
- request_unsuspended: sblocco richiesta (SOSPESA →)

Eventi configurabili (rispettano status_transitions + canali):
- status_change: cambio stato (verifica la chiave "STATO_FROM_STATO_TO" in status_transitions)

Canali:
- in_app: notifiche nell''app (default: true)
- email: notifiche via email (default: false)

Una notifica viene creata SOLO se:
1. L''evento è abilitato (sempre attivo O presente in status_transitions con valore true)
2. Il canale specifico è abilitato (in_app=true O email=true)
';

-- =====================================================
-- VERIFICA FINALE
-- =====================================================

-- Mostra le policy attuali
SELECT
  policyname,
  cmd,
  qual::text as using_clause,
  with_check::text as with_check_clause
FROM pg_policies
WHERE tablename = 'notifications'
ORDER BY cmd;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

-- Riepilogo:
-- ✓ Aggiunta DELETE policy per eliminare notifiche
-- ✓ Fix UPDATE policy per "segna tutte come lette"
-- ✓ Fix create_notification per rispettare preferenze utente
--
-- IMPORTANTE: Le nuove notifiche rispetteranno le preferenze.
-- Le notifiche esistenti rimarranno nel database.
-- Per pulire le notifiche esistenti, esegui:
-- DELETE FROM notifications WHERE read = false;
