-- Migration: Add 10 new compressor-related request types
-- Date: 2025-11-01
-- Description: Adds request types for compressor analysis and drawings with dynamic fields

-- =============================================================================
-- 1. DISEGNO - SALA COMPRESSORI – SCHEMA DI FLUSSO
-- =============================================================================
INSERT INTO request_types (name, fields_schema, is_active) VALUES (
  'DISEGNO - SALA COMPRESSORI – SCHEMA DI FLUSSO',
  '[
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
      "name": "stabilimento_sala",
      "type": "text",
      "label": "Stabilimento/Sala",
      "required": false,
      "maxLength": 200,
      "placeholder": "Es: Stabilimento Padova - Sala 2"
    },
    {
      "name": "file_attachment",
      "type": "file",
      "label": "File Attachment",
      "required": false,
      "accept": ".pdf,.dwg,.dxf,.jpg,.jpeg,.png,.xlsx,.docx",
      "maxFiles": 5,
      "maxFileSize": 10
    },
    {
      "name": "lista_apparecchi",
      "type": "textarea",
      "label": "Lista Apparecchi",
      "required": false,
      "maxLength": 2000,
      "placeholder": "Elencare gli apparecchi interessati (uno per riga)"
    },
    {
      "name": "commerciale_riferimento",
      "type": "select",
      "label": "Commerciale di Riferimento",
      "required": false,
      "options": ["VEDELAGO H.", "VEDELAGO M.", "SACCO D.", "ZONTA A.", "BELLINA M.", "ALTRO"]
    },
    {
      "name": "note",
      "type": "textarea",
      "label": "Note",
      "required": false,
      "maxLength": 5000,
      "placeholder": "Note aggiuntive..."
    }
  ]'::jsonb,
  true
);

-- =============================================================================
-- 2. DISEGNO - SALA COMPRESSORI – LAYOUT
-- =============================================================================
INSERT INTO request_types (name, fields_schema, is_active) VALUES (
  'DISEGNO - SALA COMPRESSORI – LAYOUT',
  '[
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
      "name": "stabilimento_sala",
      "type": "text",
      "label": "Stabilimento/Sala",
      "required": false,
      "maxLength": 200,
      "placeholder": "Es: Stabilimento Padova - Sala 2"
    },
    {
      "name": "file_attachment",
      "type": "file",
      "label": "File Attachment",
      "required": false,
      "accept": ".pdf,.dwg,.dxf,.jpg,.jpeg,.png,.xlsx,.docx",
      "maxFiles": 5,
      "maxFileSize": 10
    },
    {
      "name": "lista_apparecchi",
      "type": "textarea",
      "label": "Lista Apparecchi",
      "required": false,
      "maxLength": 2000,
      "placeholder": "Elencare gli apparecchi interessati (uno per riga)"
    },
    {
      "name": "commerciale_riferimento",
      "type": "select",
      "label": "Commerciale di Riferimento",
      "required": false,
      "options": ["VEDELAGO H.", "VEDELAGO M.", "SACCO D.", "ZONTA A.", "BELLINA M.", "ALTRO"]
    },
    {
      "name": "note",
      "type": "textarea",
      "label": "Note",
      "required": false,
      "maxLength": 5000,
      "placeholder": "Note aggiuntive..."
    }
  ]'::jsonb,
  true
);

-- =============================================================================
-- 3. DISEGNO - DISTRIBUZIONE – LAYOUT
-- =============================================================================
INSERT INTO request_types (name, fields_schema, is_active) VALUES (
  'DISEGNO - DISTRIBUZIONE – LAYOUT',
  '[
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
      "name": "stabilimento_sala",
      "type": "text",
      "label": "Stabilimento/Sala",
      "required": false,
      "maxLength": 200,
      "placeholder": "Es: Stabilimento Padova - Sala 2"
    },
    {
      "name": "file_attachment",
      "type": "file",
      "label": "File Attachment",
      "required": false,
      "accept": ".pdf,.dwg,.dxf,.jpg,.jpeg,.png,.xlsx,.docx",
      "maxFiles": 5,
      "maxFileSize": 10
    },
    {
      "name": "commerciale_riferimento",
      "type": "select",
      "label": "Commerciale di Riferimento",
      "required": false,
      "options": ["VEDELAGO H.", "VEDELAGO M.", "SACCO D.", "ZONTA A.", "BELLINA M.", "ALTRO"]
    },
    {
      "name": "note",
      "type": "textarea",
      "label": "Note",
      "required": false,
      "maxLength": 5000,
      "placeholder": "Note aggiuntive..."
    }
  ]'::jsonb,
  true
);

-- =============================================================================
-- 4. ANALISI – DS500 CONSUMI
-- =============================================================================
INSERT INTO request_types (name, fields_schema, is_active) VALUES (
  'ANALISI – DS500 CONSUMI',
  '[
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
      "name": "stabilimento_sala",
      "type": "text",
      "label": "Stabilimento/Sala",
      "required": false,
      "maxLength": 200,
      "placeholder": "Es: Stabilimento Padova - Sala 2"
    },
    {
      "name": "file_attachment",
      "type": "file",
      "label": "File Attachment",
      "required": false,
      "accept": ".pdf,.dwg,.dxf,.jpg,.jpeg,.png,.xlsx,.docx",
      "maxFiles": 5,
      "maxFileSize": 10
    },
    {
      "name": "lista_apparecchi",
      "type": "textarea",
      "label": "Lista Apparecchi",
      "required": false,
      "maxLength": 2000,
      "placeholder": "Elencare gli apparecchi interessati (uno per riga)"
    },
    {
      "name": "tecnico_collegamento",
      "type": "select",
      "label": "Tecnico Collegamento",
      "required": false,
      "options": ["BOSCHIERO A.", "FARALLI R.", "FURLAN D.", "ALTRO"]
    },
    {
      "name": "tecnico_scollegamento",
      "type": "select",
      "label": "Tecnico Scollegamento",
      "required": false,
      "options": ["BOSCHIERO A.", "FARALLI R.", "FURLAN D.", "ALTRO"]
    },
    {
      "name": "commerciale_riferimento",
      "type": "select",
      "label": "Commerciale di Riferimento",
      "required": false,
      "options": ["VEDELAGO H.", "VEDELAGO M.", "SACCO D.", "ZONTA A.", "BELLINA M.", "ALTRO"]
    },
    {
      "name": "posizione_sensori",
      "type": "textarea",
      "label": "Posizione Sensori",
      "required": false,
      "maxLength": 1000,
      "placeholder": "Descrivere la posizione dei sensori installati"
    },
    {
      "name": "data_inizio",
      "type": "date",
      "label": "Data Inizio",
      "required": true
    },
    {
      "name": "strumento",
      "type": "select",
      "label": "Strumento",
      "required": false,
      "options": ["DS500 #1", "DS500 #2", "LD500", "ALTRO"]
    },
    {
      "name": "rilevate_perdite_da",
      "type": "datetime-local",
      "label": "Rilevate Perdite Da",
      "required": false
    },
    {
      "name": "rilevate_perdite_a",
      "type": "datetime-local",
      "label": "Rilevate Perdite A",
      "required": false
    },
    {
      "name": "note",
      "type": "textarea",
      "label": "Note",
      "required": false,
      "maxLength": 5000,
      "placeholder": "Note aggiuntive..."
    },
    {
      "name": "compressori",
      "type": "repeatable_group",
      "label": "Dati Compressori",
      "required": false,
      "minItems": 0,
      "maxItems": 4
    }
  ]'::jsonb,
  true
);

-- =============================================================================
-- 5. ANALISI – DS500 – SOLO GRAFICI
-- =============================================================================
INSERT INTO request_types (name, fields_schema, is_active) VALUES (
  'ANALISI – DS500 – SOLO GRAFICI',
  '[
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
      "name": "stabilimento_sala",
      "type": "text",
      "label": "Stabilimento/Sala",
      "required": false,
      "maxLength": 200,
      "placeholder": "Es: Stabilimento Padova - Sala 2"
    },
    {
      "name": "file_attachment",
      "type": "file",
      "label": "File Attachment",
      "required": false,
      "accept": ".pdf,.dwg,.dxf,.jpg,.jpeg,.png,.xlsx,.docx",
      "maxFiles": 5,
      "maxFileSize": 10
    },
    {
      "name": "lista_apparecchi",
      "type": "textarea",
      "label": "Lista Apparecchi",
      "required": false,
      "maxLength": 2000,
      "placeholder": "Elencare gli apparecchi interessati (uno per riga)"
    },
    {
      "name": "tecnico_collegamento",
      "type": "select",
      "label": "Tecnico Collegamento",
      "required": false,
      "options": ["BOSCHIERO A.", "FARALLI R.", "FURLAN D.", "ALTRO"]
    },
    {
      "name": "tecnico_scollegamento",
      "type": "select",
      "label": "Tecnico Scollegamento",
      "required": false,
      "options": ["BOSCHIERO A.", "FARALLI R.", "FURLAN D.", "ALTRO"]
    },
    {
      "name": "commerciale_riferimento",
      "type": "select",
      "label": "Commerciale di Riferimento",
      "required": false,
      "options": ["VEDELAGO H.", "VEDELAGO M.", "SACCO D.", "ZONTA A.", "BELLINA M.", "ALTRO"]
    },
    {
      "name": "data_inizio",
      "type": "date",
      "label": "Data Inizio",
      "required": true
    },
    {
      "name": "strumento",
      "type": "select",
      "label": "Strumento",
      "required": false,
      "options": ["DS500 #1", "DS500 #2", "LD500", "ALTRO"]
    },
    {
      "name": "rilevate_perdite_da",
      "type": "datetime-local",
      "label": "Rilevate Perdite Da",
      "required": false
    },
    {
      "name": "rilevate_perdite_a",
      "type": "datetime-local",
      "label": "Rilevate Perdite A",
      "required": false
    },
    {
      "name": "note",
      "type": "textarea",
      "label": "Note",
      "required": false,
      "maxLength": 5000,
      "placeholder": "Note aggiuntive..."
    }
  ]'::jsonb,
  true
);

-- =============================================================================
-- 6. ANALISI – DS500 – OCV
-- =============================================================================
INSERT INTO request_types (name, fields_schema, is_active) VALUES (
  'ANALISI – DS500 – OCV',
  '[
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
      "name": "stabilimento_sala",
      "type": "text",
      "label": "Stabilimento/Sala",
      "required": false,
      "maxLength": 200,
      "placeholder": "Es: Stabilimento Padova - Sala 2"
    },
    {
      "name": "file_attachment",
      "type": "file",
      "label": "File Attachment",
      "required": false,
      "accept": ".pdf,.dwg,.dxf,.jpg,.jpeg,.png,.xlsx,.docx",
      "maxFiles": 5,
      "maxFileSize": 10
    },
    {
      "name": "lista_apparecchi",
      "type": "textarea",
      "label": "Lista Apparecchi",
      "required": false,
      "maxLength": 2000,
      "placeholder": "Elencare gli apparecchi interessati (uno per riga)"
    },
    {
      "name": "tecnico_collegamento",
      "type": "select",
      "label": "Tecnico Collegamento",
      "required": false,
      "options": ["BOSCHIERO A.", "FARALLI R.", "FURLAN D.", "ALTRO"]
    },
    {
      "name": "tecnico_scollegamento",
      "type": "select",
      "label": "Tecnico Scollegamento",
      "required": false,
      "options": ["BOSCHIERO A.", "FARALLI R.", "FURLAN D.", "ALTRO"]
    },
    {
      "name": "commerciale_riferimento",
      "type": "select",
      "label": "Commerciale di Riferimento",
      "required": false,
      "options": ["VEDELAGO H.", "VEDELAGO M.", "SACCO D.", "ZONTA A.", "BELLINA M.", "ALTRO"]
    },
    {
      "name": "data_inizio",
      "type": "date",
      "label": "Data Inizio",
      "required": true
    },
    {
      "name": "strumento",
      "type": "select",
      "label": "Strumento",
      "required": false,
      "options": ["DS500 #1", "DS500 #2", "LD500", "ALTRO"]
    },
    {
      "name": "note",
      "type": "textarea",
      "label": "Note",
      "required": false,
      "maxLength": 5000,
      "placeholder": "Note aggiuntive..."
    }
  ]'::jsonb,
  true
);

-- =============================================================================
-- 7. ANALISI – RICERCA PERDITE
-- =============================================================================
INSERT INTO request_types (name, fields_schema, is_active) VALUES (
  'ANALISI – RICERCA PERDITE',
  '[
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
      "name": "stabilimento_sala",
      "type": "text",
      "label": "Stabilimento/Sala",
      "required": false,
      "maxLength": 200,
      "placeholder": "Es: Stabilimento Padova - Sala 2"
    },
    {
      "name": "file_attachment",
      "type": "file",
      "label": "File Attachment",
      "required": false,
      "accept": ".pdf,.dwg,.dxf,.jpg,.jpeg,.png,.xlsx,.docx",
      "maxFiles": 5,
      "maxFileSize": 10
    },
    {
      "name": "lista_apparecchi",
      "type": "textarea",
      "label": "Lista Apparecchi",
      "required": false,
      "maxLength": 2000,
      "placeholder": "Elencare gli apparecchi interessati (uno per riga)"
    },
    {
      "name": "commerciale_riferimento",
      "type": "select",
      "label": "Commerciale di Riferimento",
      "required": false,
      "options": ["VEDELAGO H.", "VEDELAGO M.", "SACCO D.", "ZONTA A.", "BELLINA M.", "ALTRO"]
    },
    {
      "name": "data_inizio",
      "type": "date",
      "label": "Data Inizio",
      "required": true
    },
    {
      "name": "strumento",
      "type": "select",
      "label": "Strumento",
      "required": false,
      "options": ["DS500 #1", "DS500 #2", "LD500", "ALTRO"]
    },
    {
      "name": "note",
      "type": "textarea",
      "label": "Note",
      "required": false,
      "maxLength": 5000,
      "placeholder": "Note aggiuntive..."
    }
  ]'::jsonb,
  true
);

-- =============================================================================
-- 8. ANALISI – COMPARATIVA
-- =============================================================================
INSERT INTO request_types (name, fields_schema, is_active) VALUES (
  'ANALISI – COMPARATIVA',
  '[
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
      "name": "stabilimento_sala",
      "type": "text",
      "label": "Stabilimento/Sala",
      "required": false,
      "maxLength": 200,
      "placeholder": "Es: Stabilimento Padova - Sala 2"
    },
    {
      "name": "file_attachment",
      "type": "file",
      "label": "File Attachment",
      "required": false,
      "accept": ".pdf,.dwg,.dxf,.jpg,.jpeg,.png,.xlsx,.docx",
      "maxFiles": 5,
      "maxFileSize": 10
    },
    {
      "name": "commerciale_riferimento",
      "type": "select",
      "label": "Commerciale di Riferimento",
      "required": false,
      "options": ["VEDELAGO H.", "VEDELAGO M.", "SACCO D.", "ZONTA A.", "BELLINA M.", "ALTRO"]
    },
    {
      "name": "note",
      "type": "textarea",
      "label": "Note",
      "required": false,
      "maxLength": 5000,
      "placeholder": "Note aggiuntive..."
    }
  ]'::jsonb,
  true
);

-- =============================================================================
-- 9. DI.CO.
-- =============================================================================
INSERT INTO request_types (name, fields_schema, is_active) VALUES (
  'DI.CO.',
  '[
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
      "name": "stabilimento_sala",
      "type": "text",
      "label": "Stabilimento/Sala",
      "required": false,
      "maxLength": 200,
      "placeholder": "Es: Stabilimento Padova - Sala 2"
    },
    {
      "name": "file_attachment",
      "type": "file",
      "label": "File Attachment",
      "required": false,
      "accept": ".pdf,.dwg,.dxf,.jpg,.jpeg,.png,.xlsx,.docx",
      "maxFiles": 5,
      "maxFileSize": 10
    },
    {
      "name": "commerciale_riferimento",
      "type": "select",
      "label": "Commerciale di Riferimento",
      "required": false,
      "options": ["VEDELAGO H.", "VEDELAGO M.", "SACCO D.", "ZONTA A.", "BELLINA M.", "ALTRO"]
    },
    {
      "name": "note",
      "type": "textarea",
      "label": "Note",
      "required": false,
      "maxLength": 5000,
      "placeholder": "Note aggiuntive..."
    }
  ]'::jsonb,
  true
);

-- =============================================================================
-- 10. RICHIESTA LIBERA
-- =============================================================================
INSERT INTO request_types (name, fields_schema, is_active) VALUES (
  'RICHIESTA LIBERA',
  '[
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
      "name": "stabilimento_sala",
      "type": "text",
      "label": "Stabilimento/Sala",
      "required": false,
      "maxLength": 200,
      "placeholder": "Es: Stabilimento Padova - Sala 2"
    },
    {
      "name": "file_attachment",
      "type": "file",
      "label": "File Attachment",
      "required": false,
      "accept": ".pdf,.dwg,.dxf,.jpg,.jpeg,.png,.xlsx,.docx",
      "maxFiles": 5,
      "maxFileSize": 10
    },
    {
      "name": "commerciale_riferimento",
      "type": "select",
      "label": "Commerciale di Riferimento",
      "required": false,
      "options": ["VEDELAGO H.", "VEDELAGO M.", "SACCO D.", "ZONTA A.", "BELLINA M.", "ALTRO"]
    },
    {
      "name": "note",
      "type": "textarea",
      "label": "Note",
      "required": false,
      "maxLength": 5000,
      "placeholder": "Note aggiuntive..."
    }
  ]'::jsonb,
  true
);
