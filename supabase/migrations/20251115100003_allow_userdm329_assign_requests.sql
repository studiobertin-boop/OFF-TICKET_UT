-- Migration: Allow userdm329 to assign DM329 requests
-- Description: userdm329 can update assigned_to field for DM329 requests
-- Date: 2025-11-15

-- Note: The existing policy "userdm329 can update DM329 requests" already allows
-- userdm329 to update DM329 requests. This migration serves as documentation that
-- the update permission includes the ability to modify the assigned_to field,
-- which is used by the AssignmentSection component.

-- No changes needed to RLS policies - existing policy already covers this:
-- CREATE POLICY "userdm329 can update DM329 requests"
--   ON requests FOR UPDATE
--   USING (
--     get_user_role() = 'userdm329' AND
--     request_type_id IN (SELECT id FROM request_types WHERE name = 'DM329')
--   )

COMMENT ON TABLE requests IS 'Richieste di assistenza tecnica. userdm329 può assegnare richieste DM329 a tecnicoDM329';
