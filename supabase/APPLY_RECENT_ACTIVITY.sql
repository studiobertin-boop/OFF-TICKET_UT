-- =====================================================
-- APPLY: Recent Activity Function
-- Da applicare manualmente al database
-- =====================================================

-- Funzione per recuperare attività recenti
CREATE OR REPLACE FUNCTION get_recent_activity(
  p_request_type_name TEXT DEFAULT NULL,
  p_limit INT DEFAULT 20
)
RETURNS TABLE (
  activity_id TEXT,
  activity_type TEXT,
  activity_description TEXT,
  request_id UUID,
  request_title TEXT,
  user_id UUID,
  user_name TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  WITH activity_feed AS (
    -- Aperture richieste (dalla tabella requests)
    SELECT
      'open_' || r.id::TEXT as activity_id,
      'APERTA' as activity_type,
      'Richiesta aperta' as activity_description,
      r.id as request_id,
      r.title as request_title,
      r.created_by as user_id,
      u.full_name as user_name,
      r.created_at as created_at
    FROM requests r
    INNER JOIN request_types rt ON r.request_type_id = rt.id
    INNER JOIN users u ON r.created_by = u.id
    WHERE
      CASE
        WHEN p_request_type_name IS NULL THEN rt.name != 'DM329'
        ELSE rt.name = p_request_type_name
      END

    UNION ALL

    -- Cambi stato (dalla tabella request_history)
    SELECT
      'status_' || h.id::TEXT as activity_id,
      'CAMBIO_STATO' as activity_type,
      CASE
        WHEN h.status_from IS NULL THEN 'Stato iniziale: ' || h.status_to
        ELSE 'Cambio stato: ' || h.status_from || ' → ' || h.status_to
      END as activity_description,
      h.request_id as request_id,
      r.title as request_title,
      h.changed_by as user_id,
      u.full_name as user_name,
      h.created_at as created_at
    FROM request_history h
    INNER JOIN requests r ON h.request_id = r.id
    INNER JOIN request_types rt ON r.request_type_id = rt.id
    INNER JOIN users u ON h.changed_by = u.id
    WHERE
      CASE
        WHEN p_request_type_name IS NULL THEN rt.name != 'DM329'
        ELSE rt.name = p_request_type_name
      END
      AND h.status_from IS NOT NULL  -- Escludi stato iniziale

    UNION ALL

    -- Blocchi richieste
    SELECT
      'block_' || rb.id::TEXT as activity_id,
      'BLOCCATA' as activity_type,
      'Richiesta bloccata: ' || COALESCE(rb.reason, 'Nessun motivo specificato') as activity_description,
      rb.request_id as request_id,
      r.title as request_title,
      rb.blocked_by as user_id,
      u.full_name as user_name,
      rb.blocked_at as created_at
    FROM request_blocks rb
    INNER JOIN requests r ON rb.request_id = r.id
    INNER JOIN request_types rt ON r.request_type_id = rt.id
    LEFT JOIN users u ON rb.blocked_by = u.id
    WHERE
      CASE
        WHEN p_request_type_name IS NULL THEN rt.name != 'DM329'
        ELSE rt.name = p_request_type_name
      END

    UNION ALL

    -- Sblocchi richieste
    SELECT
      'unblock_' || rb.id::TEXT as activity_id,
      'SBLOCCATA' as activity_type,
      'Richiesta sbloccata' as activity_description,
      rb.request_id as request_id,
      r.title as request_title,
      rb.unblocked_by as user_id,
      u.full_name as user_name,
      rb.unblocked_at as created_at
    FROM request_blocks rb
    INNER JOIN requests r ON rb.request_id = r.id
    INNER JOIN request_types rt ON r.request_type_id = rt.id
    LEFT JOIN users u ON rb.unblocked_by = u.id
    WHERE
      CASE
        WHEN p_request_type_name IS NULL THEN rt.name != 'DM329'
        ELSE rt.name = p_request_type_name
      END
      AND rb.unblocked_at IS NOT NULL

    UNION ALL

    -- Chiusure/Completamenti (da request_completions)
    SELECT
      'complete_' || rc.id::TEXT as activity_id,
      'COMPLETATA' as activity_type,
      CASE rc.status
        WHEN 'COMPLETATA' THEN 'Richiesta completata'
        WHEN '7-CHIUSA' THEN 'Pratica DM329 chiusa'
        ELSE 'Richiesta terminata'
      END as activity_description,
      rc.request_id as request_id,
      r.title as request_title,
      r.created_by as user_id,  -- Usa created_by come fallback
      u.full_name as user_name,
      rc.completed_at as created_at
    FROM request_completions rc
    LEFT JOIN requests r ON rc.request_id = r.id
    INNER JOIN users u ON r.created_by = u.id
    WHERE
      CASE
        WHEN p_request_type_name IS NULL THEN rc.request_type_name != 'DM329'
        ELSE rc.request_type_name = p_request_type_name
      END

  )
  SELECT
    af.activity_id::TEXT,
    af.activity_type::TEXT,
    af.activity_description::TEXT,
    af.request_id,
    af.request_title::TEXT,
    af.user_id,
    COALESCE(af.user_name, 'Sistema')::TEXT as user_name,
    af.created_at
  FROM activity_feed af
  ORDER BY af.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION get_recent_activity IS 'Recupera attività recenti (aperture, cambi stato, blocchi, sblocchi, chiusure) filtrabile per tipo richiesta';

-- Grant execute
GRANT EXECUTE ON FUNCTION get_recent_activity TO authenticated;

-- =====================================================
-- TEST: Verifica funzione
-- =====================================================

-- Test 1: Attività generali (escluse DM329)
SELECT
  'TEST Attività Generali (escluse DM329):' as test,
  COUNT(*) as total_activities
FROM get_recent_activity(NULL, 100);

-- Test 2: Attività DM329
SELECT
  'TEST Attività DM329:' as test,
  COUNT(*) as total_activities
FROM get_recent_activity('DM329', 100);

-- Test 3: Sample attività generali (prime 5)
SELECT
  'SAMPLE Attività Generali:' as test,
  *
FROM get_recent_activity(NULL, 5);

-- Test 4: Sample attività DM329 (prime 5)
SELECT
  'SAMPLE Attività DM329:' as test,
  *
FROM get_recent_activity('DM329', 5);
