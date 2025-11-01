-- =============================================
-- SEED DATA FOR DEVELOPMENT
-- =============================================

-- NOTE: In production, users will be created through Supabase Auth
-- This seed file is for local development and testing only

-- =============================================
-- SEED USERS
-- =============================================
-- These users need to be created via Supabase Auth first
-- Then the trigger will automatically create their profiles

-- Example SQL to insert into auth.users (run via Supabase Dashboard or SQL Editor):
/*
-- Admin User
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  role,
  aud
) VALUES (
  'a1111111-1111-1111-1111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'admin@studiobertin.it',
  crypt('admin123', gen_salt('bf')),
  NOW(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Admin Ufficio Tecnico"}',
  NOW(),
  NOW(),
  'authenticated',
  'authenticated'
);

-- Tecnico User
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  role,
  aud
) VALUES (
  'b2222222-2222-2222-2222-222222222222',
  '00000000-0000-0000-0000-000000000000',
  'tecnico@studiobertin.it',
  crypt('tecnico123', gen_salt('bf')),
  NOW(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Marco Rossi"}',
  NOW(),
  NOW(),
  'authenticated',
  'authenticated'
);

-- Utente User
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  role,
  aud
) VALUES (
  'c3333333-3333-3333-3333-333333333333',
  '00000000-0000-0000-0000-000000000000',
  'utente@studiobertin.it',
  crypt('utente123', gen_salt('bf')),
  NOW(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Laura Bianchi"}',
  NOW(),
  NOW(),
  'authenticated',
  'authenticated'
);
*/

-- Update user roles (after trigger creates the profiles)
-- Run this AFTER creating auth users above
UPDATE users SET role = 'admin' WHERE email = 'admin@studiobertin.it';
UPDATE users SET role = 'tecnico' WHERE email = 'tecnico@studiobertin.it';
UPDATE users SET role = 'utente' WHERE email = 'utente@studiobertin.it';

-- =============================================
-- SEED REQUEST TYPES
-- =============================================

-- 1. DM329 Request Type (Custom Workflow)
INSERT INTO request_types (name, fields_schema, is_active) VALUES (
  'DM329',
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
      "name": "note",
      "type": "textarea",
      "label": "Note",
      "required": false
    }
  ]'::jsonb,
  true
);

-- 2. Supporto IT Request Type (Standard Workflow)
INSERT INTO request_types (name, fields_schema, is_active) VALUES (
  'Supporto IT',
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
      "name": "problema",
      "type": "textarea",
      "label": "Descrizione Problema",
      "required": true
    },
    {
      "name": "urgenza",
      "type": "select",
      "label": "Urgenza",
      "required": true,
      "options": ["Bassa", "Media", "Alta", "Critica"]
    },
    {
      "name": "dispositivo",
      "type": "select",
      "label": "Dispositivo",
      "required": false,
      "options": ["PC Desktop", "Laptop", "Tablet", "Smartphone", "Stampante", "Server", "Altro"]
    },
    {
      "name": "software",
      "type": "text",
      "label": "Software Coinvolto",
      "required": false
    }
  ]'::jsonb,
  true
);

-- 3. Richiesta Manutenzione (Standard Workflow)
INSERT INTO request_types (name, fields_schema, is_active) VALUES (
  'Richiesta Manutenzione',
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
      "name": "ubicazione",
      "type": "text",
      "label": "Ubicazione",
      "required": true
    },
    {
      "name": "tipo_manutenzione",
      "type": "select",
      "label": "Tipo Manutenzione",
      "required": true,
      "options": ["Elettrica", "Idraulica", "Riscaldamento", "Climatizzazione", "Edile", "Altro"]
    },
    {
      "name": "descrizione",
      "type": "textarea",
      "label": "Descrizione Intervento",
      "required": true
    },
    {
      "name": "accesso_necessario",
      "type": "boolean",
      "label": "Necessario Accesso ai Locali",
      "required": true
    },
    {
      "name": "orario_preferito",
      "type": "text",
      "label": "Orario Preferito",
      "required": false
    }
  ]'::jsonb,
  true
);

-- =============================================
-- SEED SAMPLE REQUESTS
-- =============================================

-- Sample DM329 Request
INSERT INTO requests (
  request_type_id,
  title,
  status,
  created_by,
  custom_fields
) VALUES (
  (SELECT id FROM request_types WHERE name = 'DM329' LIMIT 1),
  'DM329 - Nuova costruzione Via Roma 15',
  '1-INCARICO_RICEVUTO',
  (SELECT id FROM users WHERE email = 'utente@studiobertin.it' LIMIT 1),
  '{
    "cliente": "Società Costruzioni SRL",
    "indirizzo_immobile": "Via Roma 15, 10100 Torino",
    "tipologia_intervento": "Nuova Costruzione",
    "superficie": "250",
    "note": "Cliente richiede urgenza per scadenze comunali"
  }'::jsonb
);

-- Sample IT Support Request (assigned)
INSERT INTO requests (
  request_type_id,
  title,
  status,
  assigned_to,
  created_by,
  custom_fields
) VALUES (
  (SELECT id FROM request_types WHERE name = 'Supporto IT' LIMIT 1),
  'Stampante ufficio non funziona',
  'ASSEGNATA',
  (SELECT id FROM users WHERE email = 'tecnico@studiobertin.it' LIMIT 1),
  (SELECT id FROM users WHERE email = 'utente@studiobertin.it' LIMIT 1),
  '{
    "problema": "La stampante non si accende e non risponde",
    "urgenza": "Alta",
    "dispositivo": "Stampante",
    "software": "N/A"
  }'::jsonb
);

-- Sample Maintenance Request (in progress)
INSERT INTO requests (
  request_type_id,
  title,
  status,
  assigned_to,
  created_by,
  custom_fields
) VALUES (
  (SELECT id FROM request_types WHERE name = 'Richiesta Manutenzione' LIMIT 1),
  'Riparazione perdita acqua bagno',
  'IN_LAVORAZIONE',
  (SELECT id FROM users WHERE email = 'tecnico@studiobertin.it' LIMIT 1),
  (SELECT id FROM users WHERE email = 'utente@studiobertin.it' LIMIT 1),
  '{
    "ubicazione": "Piano 2 - Bagno ufficio est",
    "tipo_manutenzione": "Idraulica",
    "descrizione": "Perdita acqua dal rubinetto lavandino",
    "accesso_necessario": true,
    "orario_preferito": "Mattina 8-10"
  }'::jsonb
);

-- Sample completed request
INSERT INTO requests (
  request_type_id,
  title,
  status,
  assigned_to,
  created_by,
  custom_fields
) VALUES (
  (SELECT id FROM request_types WHERE name = 'Supporto IT' LIMIT 1),
  'Installazione nuovo software CAD',
  'COMPLETATA',
  (SELECT id FROM users WHERE email = 'tecnico@studiobertin.it' LIMIT 1),
  (SELECT id FROM users WHERE email = 'utente@studiobertin.it' LIMIT 1),
  '{
    "problema": "Necessaria installazione AutoCAD su nuova postazione",
    "urgenza": "Media",
    "dispositivo": "PC Desktop",
    "software": "AutoCAD 2024"
  }'::jsonb
);

-- =============================================
-- SEED REQUEST HISTORY
-- =============================================

-- History for DM329 request
INSERT INTO request_history (request_id, status_from, status_to, changed_by, notes)
SELECT
  r.id,
  NULL,
  '1-INCARICO_RICEVUTO',
  u.id,
  'Richiesta creata'
FROM requests r
JOIN users u ON u.email = 'utente@studiobertin.it'
WHERE r.title = 'DM329 - Nuova costruzione Via Roma 15';

-- History for IT Support request (creation)
INSERT INTO request_history (request_id, status_from, status_to, changed_by, notes)
SELECT
  r.id,
  NULL,
  'APERTA',
  u.id,
  'Richiesta creata'
FROM requests r
JOIN users u ON u.email = 'utente@studiobertin.it'
WHERE r.title = 'Stampante ufficio non funziona';

-- History for IT Support request (assignment)
INSERT INTO request_history (request_id, status_from, status_to, changed_by, notes)
SELECT
  r.id,
  'APERTA',
  'ASSEGNATA',
  u.id,
  'Assegnata a Marco Rossi'
FROM requests r
JOIN users u ON u.email = 'admin@studiobertin.it'
WHERE r.title = 'Stampante ufficio non funziona';

-- History for Maintenance request (creation)
INSERT INTO request_history (request_id, status_from, status_to, changed_by, notes)
SELECT
  r.id,
  NULL,
  'APERTA',
  u.id,
  'Richiesta creata'
FROM requests r
JOIN users u ON u.email = 'utente@studiobertin.it'
WHERE r.title = 'Riparazione perdita acqua bagno';

-- History for Maintenance request (assignment)
INSERT INTO request_history (request_id, status_from, status_to, changed_by, notes)
SELECT
  r.id,
  'APERTA',
  'ASSEGNATA',
  u.id,
  'Assegnata a Marco Rossi'
FROM requests r
JOIN users u ON u.email = 'admin@studiobertin.it'
WHERE r.title = 'Riparazione perdita acqua bagno';

-- History for Maintenance request (in progress)
INSERT INTO request_history (request_id, status_from, status_to, changed_by, notes)
SELECT
  r.id,
  'ASSEGNATA',
  'IN_LAVORAZIONE',
  u.id,
  'Presa in carico, idraulico contattato'
FROM requests r
JOIN users u ON u.email = 'tecnico@studiobertin.it'
WHERE r.title = 'Riparazione perdita acqua bagno';

-- =============================================
-- SEED NOTIFICATIONS
-- =============================================

-- Notification for tecnico assignment
INSERT INTO notifications (user_id, request_id, type, message, read)
SELECT
  u.id,
  r.id,
  'assignment',
  'Ti è stata assegnata una nuova richiesta: Stampante ufficio non funziona',
  false
FROM users u
JOIN requests r ON r.title = 'Stampante ufficio non funziona'
WHERE u.email = 'tecnico@studiobertin.it';

-- Notification for utente (request assigned)
INSERT INTO notifications (user_id, request_id, type, message, read)
SELECT
  u.id,
  r.id,
  'status_change',
  'La tua richiesta "Stampante ufficio non funziona" è stata assegnata',
  true
FROM users u
JOIN requests r ON r.title = 'Stampante ufficio non funziona'
WHERE u.email = 'utente@studiobertin.it';

-- Notification for utente (request in progress)
INSERT INTO notifications (user_id, request_id, type, message, read)
SELECT
  u.id,
  r.id,
  'status_change',
  'La tua richiesta "Riparazione perdita acqua bagno" è ora in lavorazione',
  false
FROM users u
JOIN requests r ON r.title = 'Riparazione perdita acqua bagno'
WHERE u.email = 'utente@studiobertin.it';

-- =============================================
-- VERIFICATION QUERIES
-- =============================================

-- Uncomment to verify seed data:
-- SELECT * FROM users;
-- SELECT * FROM request_types;
-- SELECT * FROM requests;
-- SELECT * FROM request_history;
-- SELECT * FROM notifications;
