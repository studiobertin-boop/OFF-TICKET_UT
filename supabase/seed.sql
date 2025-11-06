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

-- =============================================
-- SEED NOTIFICATIONS
-- =============================================

-- =============================================
-- VERIFICATION QUERIES
-- =============================================

-- Uncomment to verify seed data:
-- SELECT * FROM users;
-- SELECT * FROM request_types;
-- SELECT * FROM requests;
-- SELECT * FROM request_history;
-- SELECT * FROM notifications;
