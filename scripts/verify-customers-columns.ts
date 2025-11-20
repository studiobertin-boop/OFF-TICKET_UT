import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyCustomersColumns() {
  console.log('🔍 Verifica dettagliata colonne tabella "customers"\n');

  const addressColumns = ['address_line1', 'address_line2', 'city', 'province', 'postal_code', 'country'];

  for (const column of addressColumns) {
    const { data, error } = await supabase
      .from('customers')
      .select(column)
      .limit(1);

    if (error) {
      console.log(`   ❌ Colonna "${column}" NON ESISTE`);
      console.log(`      Error: ${error.message}`);
    } else {
      console.log(`   ✅ Colonna "${column}" ESISTE`);
    }
  }

  // Provo a recuperare tutte le colonne disponibili
  console.log('\n📋 Elenco completo colonne disponibili in "customers":');
  const { data: sampleData, error: sampleError } = await supabase
    .from('customers')
    .select('*')
    .limit(1);

  if (sampleError) {
    console.log(`   ❌ Errore: ${sampleError.message}`);
  } else if (sampleData && sampleData.length > 0) {
    const availableColumns = Object.keys(sampleData[0]);
    console.log('   Colonne:', availableColumns.join(', '));
  } else {
    console.log('   ⚠️  Tabella vuota, impossibile determinare le colonne');
  }
}

verifyCustomersColumns().catch(console.error);
