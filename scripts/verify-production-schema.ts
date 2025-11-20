import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Carica .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Errore: VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY devono essere configurate in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyProductionSchema() {
  console.log('🔍 Verifica Schema Database Production\n');
  console.log('=' .repeat(60));

  // Verifica 1: Colonna is_urgent in requests
  console.log('\n1️⃣  Verificando colonna "is_urgent" in tabella "requests"...');
  const { data: requestsData, error: requestsError } = await supabase
    .from('requests')
    .select('id, is_urgent')
    .limit(1);

  if (requestsError) {
    if (requestsError.message.includes('column') && requestsError.message.includes('does not exist')) {
      console.log('   ❌ Colonna "is_urgent" NON ESISTE');
    } else {
      console.log(`   ⚠️  Errore: ${requestsError.message}`);
    }
  } else {
    console.log('   ✅ Colonna "is_urgent" ESISTE');
  }

  // Verifica 2: Colonne address in customers
  console.log('\n2️⃣  Verificando colonne indirizzo in tabella "customers"...');
  const { data: customersData, error: customersError } = await supabase
    .from('customers')
    .select('id, address_line1, address_line2, city, province, postal_code, country')
    .limit(1);

  if (customersError) {
    if (customersError.message.includes('column') && customersError.message.includes('does not exist')) {
      const missingColumn = customersError.message.match(/column "([^"]+)"/)?.[1];
      console.log(`   ❌ Colonna "${missingColumn}" NON ESISTE`);
    } else {
      console.log(`   ⚠️  Errore: ${customersError.message}`);
    }
  } else {
    console.log('   ✅ Colonne indirizzo ESISTONO');
  }

  // Verifica 3: Tabella notifications
  console.log('\n3️⃣  Verificando tabella "notifications"...');
  const { data: notificationsData, error: notificationsError } = await supabase
    .from('notifications')
    .select('id')
    .limit(1);

  if (notificationsError) {
    if (notificationsError.message.includes('does not exist')) {
      console.log('   ❌ Tabella "notifications" NON ESISTE');
    } else {
      console.log(`   ⚠️  Errore: ${notificationsError.message}`);
    }
  } else {
    console.log('   ✅ Tabella "notifications" ESISTE');
  }

  // Verifica 4: Tabella dm329_technical_data
  console.log('\n4️⃣  Verificando tabella "dm329_technical_data"...');
  const { data: dm329Data, error: dm329Error } = await supabase
    .from('dm329_technical_data')
    .select('id')
    .limit(1);

  if (dm329Error) {
    if (dm329Error.message.includes('does not exist')) {
      console.log('   ❌ Tabella "dm329_technical_data" NON ESISTE');
    } else {
      console.log(`   ⚠️  Errore: ${dm329Error.message}`);
    }
  } else {
    console.log('   ✅ Tabella "dm329_technical_data" ESISTE');
  }

  // Verifica 5: RPC functions (dashboard analytics)
  console.log('\n5️⃣  Verificando funzione RPC "get_dashboard_stats"...');
  try {
    const { data: statsData, error: statsError } = await supabase.rpc('get_dashboard_stats');

    if (statsError) {
      if (statsError.message.includes('does not exist')) {
        console.log('   ❌ Funzione "get_dashboard_stats" NON ESISTE');
      } else {
        console.log(`   ⚠️  Errore: ${statsError.message}`);
      }
    } else {
      console.log('   ✅ Funzione "get_dashboard_stats" ESISTE');
    }
  } catch (error: any) {
    console.log(`   ❌ Funzione "get_dashboard_stats" NON ESISTE`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Verifica completata\n');
}

verifyProductionSchema().catch(console.error);
