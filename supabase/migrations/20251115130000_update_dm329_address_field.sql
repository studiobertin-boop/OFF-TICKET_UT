-- =============================================
-- Update DM329 request type schema
-- =============================================
-- Changes:
-- - Rename "Impianto" to "Indirizzo impianto"
-- - Change field type from textarea to address-autocomplete
-- =============================================

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
    "type": "address-autocomplete",
    "label": "Indirizzo impianto",
    "required": false,
    "placeholder": "Via, Città, CAP..."
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
