-- ============================================
-- APPLY THIS SQL IN SUPABASE SQL EDITOR NOW
-- ============================================
-- This updates DM329 form schema
-- Changes:
-- - Fixed cliente field: autocomplete instead of text
-- - Removed fields: tipologia_intervento, superficie
-- - Renamed "Indirizzo Immobile" to "Impianto" (optional)

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
SELECT name, fields_schema
FROM request_types
WHERE name = 'DM329';
