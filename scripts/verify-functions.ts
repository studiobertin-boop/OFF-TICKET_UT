import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyFunctions() {
  console.log('🔍 Verifica funzioni database\n');

  const functions = [
    'get_dashboard_stats',
    'get_recent_activity',
    'validate_status_transition'
  ];

  for (const funcName of functions) {
    try {
      const { data, error } = await supabase.rpc(funcName as any);

      if (error) {
        if (error.message.includes('does not exist')) {
          console.log(`   ❌ Funzione "${funcName}" NON ESISTE`);
        } else {
          console.log(`   ✅ Funzione "${funcName}" ESISTE (ma ha restituito errore: ${error.message})`);
        }
      } else {
        console.log(`   ✅ Funzione "${funcName}" ESISTE`);
      }
    } catch (error: any) {
      console.log(`   ❌ Funzione "${funcName}" NON ESISTE o non è accessibile`);
    }
  }
}

verifyFunctions().catch(console.error);
