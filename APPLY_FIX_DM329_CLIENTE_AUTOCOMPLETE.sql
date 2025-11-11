-- ============================================
-- UPDATE DM329 FORM SCHEMA
-- APPLY THIS SQL IN SUPABASE SQL EDITOR NOW
-- ============================================
-- Changes:
-- - Fixed cliente field: autocomplete instead of text
-- - Removed fields: tipologia_intervento, superficie
-- - Renamed "Indirizzo Immobile" to "Impianto" (optional field)
-- - All users (admin and userdm329) now see the same correct form

UPDATE request_types
SET fields_schema = '[
  {
    "name": "cliente",
    "type": "autocomplete",
    "label": "Cliente",
    "required": true,
    "dataSource": "customers",
    "displayField": "ragione_sociale",
    "valueField": "id"
  },
  {
    "name": "indirizzo_immobile",
    "type": "textarea",
    "label": "Impianto",
    "required": false
  },
  {
    "name": "off_cac",
    "type": "select",
    "label": "OFF / CAC",
    "required": false,
    "options": ["off", "cac"]
  },
  {
    "name": "no_civa",
    "type": "boolean",
    "label": "No CIVA",
    "required": false
  },
  {
    "name": "note",
    "type": "textarea",
    "label": "Note",
    "required": false
  }
]'::jsonb
WHERE name = 'DM329';

-- Verify the update
SELECT
  name,
  jsonb_pretty(fields_schema) as schema
FROM request_types
WHERE name = 'DM329';
