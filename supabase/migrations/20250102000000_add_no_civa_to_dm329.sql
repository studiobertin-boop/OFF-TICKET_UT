-- =============================================
-- Add no_civa field to DM329 request type
-- =============================================

-- Update the fields_schema for DM329 request type to include no_civa field
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
