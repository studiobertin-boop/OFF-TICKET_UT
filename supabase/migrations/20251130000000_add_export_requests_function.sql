-- =============================================
-- FUNZIONE RPC PER EXPORT RICHIESTE
-- =============================================
-- Questa funzione recupera le richieste che hanno raggiunto
-- determinati stati in un periodo temporale specificato,
-- mostrando la data dell'ultima volta che hanno raggiunto quello stato.

CREATE OR REPLACE FUNCTION get_requests_for_export(
  p_date_from DATE,
  p_date_to DATE,
  p_statuses TEXT[],
  p_request_type_id UUID DEFAULT NULL
)
RETURNS TABLE (
  request_id UUID,
  request_type_name TEXT,
  status_change_date TIMESTAMPTZ,
  status_to TEXT,
  custom_fields JSONB,
  customer_ragione_sociale TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID;
  current_user_role TEXT;
BEGIN
  -- Get current user info
  current_user_id := auth.uid();

  SELECT role INTO current_user_role
  FROM users
  WHERE id = current_user_id;

  -- Return requests based on user role and RLS policies
  RETURN QUERY
  WITH latest_status_changes AS (
    -- Per ogni richiesta, trova l'ultima volta che è entrata in uno degli stati selezionati
    -- nel periodo temporale specificato
    SELECT DISTINCT ON (rh.request_id)
      rh.request_id,
      rh.status_to,
      rh.created_at as status_change_date
    FROM request_history rh
    WHERE rh.status_to = ANY(p_statuses)
      AND rh.created_at >= p_date_from::TIMESTAMPTZ
      AND rh.created_at <= (p_date_to::DATE + INTERVAL '1 day' - INTERVAL '1 second')::TIMESTAMPTZ
    ORDER BY rh.request_id, rh.created_at DESC
  )
  SELECT
    r.id as request_id,
    rt.name as request_type_name,
    lsc.status_change_date,
    lsc.status_to,
    r.custom_fields,
    c.ragione_sociale as customer_ragione_sociale
  FROM requests r
  INNER JOIN latest_status_changes lsc ON r.id = lsc.request_id
  INNER JOIN request_types rt ON r.request_type_id = rt.id
  LEFT JOIN customers c ON r.customer_id = c.id
  WHERE
    -- Apply request type filter if provided
    (p_request_type_id IS NULL OR r.request_type_id = p_request_type_id)
    -- Apply RLS-like filtering based on user role
    AND (
      -- Admin and userdm329 see all non-hidden requests
      (current_user_role IN ('admin', 'userdm329') AND r.is_hidden = false)
      OR
      -- Tecnico and tecnicoDM329 see assigned requests
      (current_user_role IN ('tecnico', 'tecnicoDM329') AND r.assigned_to = current_user_id AND r.is_hidden = false)
      OR
      -- Utente sees own requests
      (current_user_role = 'utente' AND r.created_by = current_user_id AND r.is_hidden = false)
    )
  ORDER BY lsc.status_change_date DESC;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_requests_for_export TO authenticated;

-- Add comment
COMMENT ON FUNCTION get_requests_for_export IS 'Recupera richieste per export filtrate per data di cambio stato e stati specifici';
