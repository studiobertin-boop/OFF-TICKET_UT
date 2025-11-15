-- =============================================
-- SCRIPT DI VERIFICA MIGRATION GIÀ APPLICATE
-- =============================================
-- Esegui questo script su Supabase Dashboard SQL Editor
-- per verificare quali migration sono già state applicate

-- 1. Verifica migration registrate nel sistema
SELECT
  version,
  name,
  inserted_at
FROM supabase_migrations.schema_migrations
WHERE version IN (
  '20251112100000',
  '20251112100001',
  '20251112100002',
  '20251112100003',
  '20251113100000',
  '20251114000000'
)
ORDER BY version;

-- 2. Verifica esistenza tabelle
SELECT
  'feature_flags' as table_check,
  CASE
    WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'feature_flags')
    THEN '✅ ESISTE'
    ELSE '❌ NON ESISTE - Applicare SQL_01'
  END as status
UNION ALL
SELECT
  'customer_users',
  CASE
    WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customer_users')
    THEN '✅ ESISTE'
    ELSE '❌ NON ESISTE - Applicare SQL_02'
  END
UNION ALL
SELECT
  'dm329_technical_data',
  CASE
    WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'dm329_technical_data')
    THEN '✅ ESISTE'
    ELSE '❌ NON ESISTE - Applicare SQL_03'
  END
UNION ALL
SELECT
  'equipment_catalog',
  CASE
    WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'equipment_catalog')
    THEN '✅ ESISTE'
    ELSE '❌ NON ESISTE - Applicare SQL_04'
  END;

-- 3. Verifica ENUM equipment_catalog_type
SELECT
  'equipment_catalog_type ENUM' as enum_check,
  CASE
    WHEN EXISTS (SELECT FROM pg_type WHERE typname = 'equipment_catalog_type')
    THEN '✅ ESISTE (' || (SELECT COUNT(*)::text FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'equipment_catalog_type')) || ' valori)'
    ELSE '❌ NON ESISTE - Applicare SQL_05'
  END as status;

-- 4. Verifica colonna attributed_to in requests
SELECT
  'requests.attributed_to' as column_check,
  CASE
    WHEN EXISTS (
      SELECT FROM information_schema.columns
      WHERE table_name = 'requests'
      AND column_name = 'attributed_to'
    )
    THEN '✅ ESISTE'
    ELSE '❌ NON ESISTE - Applicare SQL_06'
  END as status;

-- 5. Verifica funzioni create
SELECT
  'search_equipment_fuzzy()' as function_check,
  CASE
    WHEN EXISTS (
      SELECT FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
      AND p.proname = 'search_equipment_fuzzy'
    )
    THEN '✅ ESISTE'
    ELSE '❌ NON ESISTE'
  END as status
UNION ALL
SELECT
  'attribute_request()',
  CASE
    WHEN EXISTS (
      SELECT FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
      AND p.proname = 'attribute_request'
    )
    THEN '✅ ESISTE'
    ELSE '❌ NON ESISTE'
  END
UNION ALL
SELECT
  'get_marche_by_tipo()',
  CASE
    WHEN EXISTS (
      SELECT FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
      AND p.proname = 'get_marche_by_tipo'
    )
    THEN '✅ ESISTE'
    ELSE '❌ NON ESISTE'
  END
UNION ALL
SELECT
  'customer_user_has_access_to_request()',
  CASE
    WHEN EXISTS (
      SELECT FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
      AND p.proname = 'customer_user_has_access_to_request'
    )
    THEN '✅ ESISTE'
    ELSE '❌ NON ESISTE'
  END;

-- 6. Verifica feature flag dm329_full_workflow
SELECT
  'Feature flag: dm329_full_workflow' as flag_check,
  CASE
    WHEN EXISTS (SELECT FROM feature_flags WHERE flag_name = 'dm329_full_workflow')
    THEN '✅ ESISTE (enabled: ' || (SELECT is_enabled::text FROM feature_flags WHERE flag_name = 'dm329_full_workflow') || ')'
    ELSE '❌ NON ESISTE'
  END as status;

-- 7. Riepilogo: quale migration applicare
SELECT
  '=' as separator,
  '=' as col2,
  '=' as col3,
  '=' as col4,
  '=' as col5
UNION ALL
SELECT
  'RIEPILOGO' as check_type,
  'Migration' as name,
  'File SQL' as file,
  'Dipende da' as dependencies,
  'Priorità' as priority
UNION ALL
SELECT
  '=' as separator,
  '=' as col2,
  '=' as col3,
  '=' as col4,
  '=' as col5
UNION ALL
SELECT
  CASE
    WHEN NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'feature_flags')
    THEN '❌ DA APPLICARE'
    ELSE '✅ GIÀ APPLICATA'
  END,
  '20251112100000_create_feature_flags',
  'SQL_01_feature_flags.sql',
  'Nessuna',
  'ALTA'
UNION ALL
SELECT
  CASE
    WHEN NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'customer_users')
    THEN '❌ DA APPLICARE'
    ELSE '✅ GIÀ APPLICATA'
  END,
  '20251112100001_create_customer_users',
  'SQL_02_customer_users.sql',
  'Tabella customers',
  'MEDIA'
UNION ALL
SELECT
  CASE
    WHEN NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'dm329_technical_data')
    THEN '❌ DA APPLICARE'
    ELSE '✅ GIÀ APPLICATA'
  END,
  '20251112100002_create_dm329_technical_data',
  'SQL_03_dm329_technical_data.sql',
  'Request type DM329',
  'ALTA'
UNION ALL
SELECT
  CASE
    WHEN NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'equipment_catalog')
    THEN '❌ DA APPLICARE'
    ELSE '✅ GIÀ APPLICATA'
  END,
  '20251112100003_create_equipment_catalog',
  'SQL_04_equipment_catalog.sql',
  'Estensione pg_trgm',
  'ALTA'
UNION ALL
SELECT
  CASE
    WHEN NOT EXISTS (SELECT FROM pg_type WHERE typname = 'equipment_catalog_type')
    THEN '❌ DA APPLICARE'
    ELSE '✅ GIÀ APPLICATA'
  END,
  '20251113100000_enhance_equipment_catalog',
  'SQL_05_enhance_equipment_catalog.sql',
  'SQL_04 (equipment_catalog)',
  'ALTA'
UNION ALL
SELECT
  CASE
    WHEN NOT EXISTS (
      SELECT FROM information_schema.columns
      WHERE table_name = 'requests' AND column_name = 'attributed_to'
    )
    THEN '❌ DA APPLICARE'
    ELSE '✅ GIÀ APPLICATA'
  END,
  '20251114000000_add_request_attribution',
  'SQL_06_request_attribution.sql',
  'Tabella requests',
  'MEDIA';
