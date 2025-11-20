import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Errore: VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY devono essere configurate');
  process.exit(1);
}

// Nota: Questo script richiede SUPABASE_SERVICE_ROLE_KEY per accedere alla tabella supabase_migrations
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
  console.error('❌ Errore: Questo script richiede SUPABASE_SERVICE_ROLE_KEY in .env.local');
  console.error('   Ottienila da: Supabase Dashboard → Settings → API → service_role key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});

// Migration da registrare come "applied"
const migrationsToRepair = [
  '20251105000003',
  '20251105000004',
  '20251112000001',
  '20251118000000',
];

async function repairMigrations() {
  console.log('🔧 Repair Migration - Registrazione Diretta\n');
  console.log('=' .repeat(60));

  for (const version of migrationsToRepair) {
    console.log(`\n📝 Registrando migration ${version}...`);

    // Verifica se esiste già
    const { data: existing, error: checkError } = await supabase
      .from('supabase_migrations.schema_migrations')
      .select('version')
      .eq('version', version)
      .single();

    if (existing) {
      console.log(`   ⚠️  Migration già registrata, skip`);
      continue;
    }

    // Inserisci nella tabella schema_migrations
    const { error: insertError } = await supabase
      .from('supabase_migrations.schema_migrations')
      .insert({
        version: version,
        statements: [],
        name: version,
      });

    if (insertError) {
      console.log(`   ❌ Errore: ${insertError.message}`);

      // Prova con query diretta se la tabella non è accessibile via API
      console.log(`   🔄 Tentativo con SQL diretto...`);

      const { error: sqlError } = await supabase.rpc('exec_sql', {
        sql: `
          INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
          VALUES ('${version}', '${version}', ARRAY[]::text[])
          ON CONFLICT (version) DO NOTHING;
        `
      });

      if (sqlError) {
        console.log(`   ❌ Fallito anche SQL diretto: ${sqlError.message}`);
      } else {
        console.log(`   ✅ Registrata con SQL diretto`);
      }
    } else {
      console.log(`   ✅ Registrata correttamente`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Repair completato\n');
  console.log('💡 Verifica con: supabase migration list');
}

repairMigrations().catch(console.error);
