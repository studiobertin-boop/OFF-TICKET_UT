-- Notifiche: modello unico broadcast a iscritti
-- Spec: docs/superpowers/specs/2026-07-03-notifiche-eventi-pratica-design.md
BEGIN;

-- 1) Nuove colonne toggle (opt-in, default false)
ALTER TABLE user_notification_preferences
  ADD COLUMN IF NOT EXISTS notify_request_created boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notify_request_blocked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notify_block_resolved  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notify_request_urgent  boolean NOT NULL DEFAULT false;

-- 2) Reset preferenze esistenti a "eventi tutti spenti" (canali in_app/email invariati)
UPDATE user_notification_preferences
SET status_transitions = '{}'::jsonb,
    notify_request_created = false,
    notify_request_blocked = false,
    notify_block_resolved  = false,
    notify_request_urgent  = false;

-- 3) create_notification: aggiunge i rami request_created/blocked/resolved/urgent,
--    rimuove request_suspended/request_unsuspended. Resta il punto unico di recapito.
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id uuid, p_request_id uuid, p_event_type text, p_message text,
  p_status_from text DEFAULT NULL, p_status_to text DEFAULT NULL, p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $function$
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
  v_transition_key TEXT;
  v_transition_enabled BOOLEAN;
BEGIN
  SELECT * INTO v_preferences FROM user_notification_preferences WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    INSERT INTO user_notification_preferences (user_id, in_app, email, status_transitions)
    VALUES (p_user_id, true, false, '{}')
    RETURNING * INTO v_preferences;
  END IF;

  IF p_event_type = 'request_created' THEN
    v_should_notify_in_app := v_preferences.notify_request_created AND v_preferences.in_app;
    v_should_notify_email  := v_preferences.notify_request_created AND v_preferences.email;
  ELSIF p_event_type = 'request_blocked' THEN
    v_should_notify_in_app := v_preferences.notify_request_blocked AND v_preferences.in_app;
    v_should_notify_email  := v_preferences.notify_request_blocked AND v_preferences.email;
  ELSIF p_event_type = 'block_resolved' THEN
    v_should_notify_in_app := v_preferences.notify_block_resolved AND v_preferences.in_app;
    v_should_notify_email  := v_preferences.notify_block_resolved AND v_preferences.email;
  ELSIF p_event_type = 'request_urgent' THEN
    v_should_notify_in_app := v_preferences.notify_request_urgent AND v_preferences.in_app;
    v_should_notify_email  := v_preferences.notify_request_urgent AND v_preferences.email;
  ELSIF p_event_type = 'status_change' AND p_status_from IS NOT NULL AND p_status_to IS NOT NULL THEN
    v_transition_key := p_status_from || '_' || p_status_to;
    v_transition_enabled := COALESCE((v_preferences.status_transitions->>v_transition_key)::boolean, false);
    v_should_notify_in_app := v_transition_enabled AND v_preferences.in_app;
    v_should_notify_email  := v_transition_enabled AND v_preferences.email;
  ELSE
    RETURN;
  END IF;

  IF v_should_notify_in_app THEN
    INSERT INTO notifications (user_id, request_id, type, message, status_from, status_to, event_type, metadata, read)
    VALUES (p_user_id, p_request_id, p_event_type, p_message, p_status_from, p_status_to, p_event_type, p_metadata, false);
  END IF;

  IF v_should_notify_email THEN
    BEGIN
      SELECT COALESCE(u.email, au.email) AS email, COALESCE(u.full_name, au.email) AS full_name
      INTO v_user_email, v_user_name
      FROM auth.users au LEFT JOIN users u ON u.id = au.id WHERE au.id = p_user_id;

      SELECT r.title, r.status, rt.name AS request_type_name, c.ragione_sociale AS customer_name,
             u_assigned.full_name AS assigned_to_name,
             CASE WHEN rt.name LIKE '%DM329%' THEN true ELSE false END AS is_dm329
      INTO v_request_data
      FROM requests r
      LEFT JOIN request_types rt ON r.request_type_id = rt.id
      LEFT JOIN customers c ON r.customer_id = c.id
      LEFT JOIN users u_assigned ON r.assigned_to = u_assigned.id
      WHERE r.id = p_request_id;

      v_email_payload := jsonb_build_object(
        'to', v_user_email, 'user_name', v_user_name, 'event_type', p_event_type,
        'message', p_message, 'request_id', p_request_id,
        'metadata', jsonb_build_object(
          'request_title', v_request_data.title, 'request_type_name', v_request_data.request_type_name,
          'customer_name', v_request_data.customer_name, 'current_status', v_request_data.status,
          'assigned_to_name', v_request_data.assigned_to_name, 'is_dm329', v_request_data.is_dm329
        ) || p_metadata
      );

      v_supabase_url := current_setting('app.settings.supabase_url', true);
      v_supabase_anon_key := current_setting('app.settings.supabase_anon_key', true);
      IF v_supabase_url IS NOT NULL AND v_supabase_anon_key IS NOT NULL THEN
        PERFORM net.http_post(
          url := v_supabase_url || '/functions/v1/send-notification-email',
          headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || v_supabase_anon_key),
          body := v_email_payload
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to send email notification to user %: %', p_user_id, SQLERRM;
    END;
  END IF;
END;
$function$;

-- 4) notify_event_subscribers: unico punto che sceglie i destinatari (broadcast a iscritti)
CREATE OR REPLACE FUNCTION public.notify_event_subscribers(
  p_event_type text, p_request_id uuid, p_message text, p_actor_id uuid,
  p_status_from text DEFAULT NULL, p_status_to text DEFAULT NULL, p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $function$
DECLARE
  v_uid uuid;
BEGIN
  FOR v_uid IN
    SELECT p.user_id FROM user_notification_preferences p
    WHERE p.user_id IS DISTINCT FROM p_actor_id
      AND CASE p_event_type
            WHEN 'request_created' THEN p.notify_request_created
            WHEN 'request_blocked' THEN p.notify_request_blocked
            WHEN 'block_resolved'  THEN p.notify_block_resolved
            WHEN 'request_urgent'  THEN p.notify_request_urgent
            WHEN 'status_change'   THEN COALESCE((p.status_transitions->>(p_status_from||'_'||p_status_to))::boolean, false)
            ELSE false
          END
  LOOP
    PERFORM create_notification(v_uid, p_request_id, p_event_type, p_message, p_status_from, p_status_to, p_metadata);
  END LOOP;
END;
$function$;
