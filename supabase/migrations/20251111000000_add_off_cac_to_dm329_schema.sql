-- =============================================
-- Add off_cac field to DM329 request type schema
-- =============================================

-- Update the fields_schema for DM329 request type to include off_cac field
UPDATE request_types
SET fields_schema = '[
  {
    "name": "cliente",
    "type": "text",
    "label": "Nome Cliente",
    "required": true
  },
  {
    "name": "indirizzo_immobile",
    "type": "textarea",
    "label": "Indirizzo Immobile",
    "required": true
  },
  {
    "name": "tipologia_intervento",
    "type": "select",
    "label": "Tipologia Intervento",
    "required": true,
    "options": ["Nuova Costruzione", "Ristrutturazione", "Ampliamento", "Cambio Destinazione"]
  },
  {
    "name": "superficie",
    "type": "text",
    "label": "Superficie (mq)",
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
