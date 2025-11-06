-- =====================================================
-- MANUAL SCRIPT: Configure Database Settings for Email
-- =====================================================
-- ISTRUZIONI:
-- 1. Apri il Supabase Dashboard
-- 2. Vai su SQL Editor
-- 3. SOSTITUISCI i placeholder con i valori reali:
--    - YOUR_PROJECT_REF: il ref del tuo progetto (es: abcdefghijklmnopqrst)
--    - YOUR_ANON_KEY: la chiave pubblica anonima (Settings > API > anon public)
-- 4. Copia e incolla questo script modificato
-- 5. Esegui
-- =====================================================

-- Configura URL Supabase per pg_net
ALTER DATABASE postgres SET app.settings.supabase_url = 'https://YOUR_PROJECT_REF.supabase.co';

-- Configura anon key per pg_net
ALTER DATABASE postgres SET app.settings.supabase_anon_key = 'YOUR_ANON_KEY';

-- =====================================================
-- VERIFICA CONFIGURAZIONE
-- =====================================================
-- Esegui per verificare che i settings siano configurati:
SELECT name, setting
FROM pg_settings
WHERE name LIKE 'app.settings%';

-- =====================================================
-- NOTA IMPORTANTE
-- =====================================================
-- Se non vedi i settings, potresti dover ricaricare la configurazione:
-- SELECT pg_reload_conf();
--
-- Oppure riconnettiti al database dopo aver eseguito gli ALTER DATABASE
-- =====================================================

-- =====================================================
-- ESEMPIO VALORI REALI (DA SOSTITUIRE)
-- =====================================================
-- ALTER DATABASE postgres SET app.settings.supabase_url = 'https://abcdefghijklmnopqrst.supabase.co';
-- ALTER DATABASE postgres SET app.settings.supabase_anon_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3BxcnN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTk5OTk5OTksImV4cCI6MjAxNTU3NTk5OX0.example';
-- =====================================================
