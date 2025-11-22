/**
 * Script to apply tecnicoDM329 INSERT policy directly
 *
 * This script applies the policy that allows tecnicoDM329 users to create
 * technical data sheets for requests assigned to them.
 *
 * Usage: tsx scripts/apply-tecnicodm329-policy.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config({ path: resolve(__dirname, '../.env.local') })

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing environment variables')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function applyPolicy() {
  console.log('🚀 Applying tecnicoDM329 INSERT policy...\n')

  const sql = `
    -- Drop existing policy if it exists
    DROP POLICY IF EXISTS "tecnicoDM329 can create technical data for assigned requests" ON dm329_technical_data;

    -- Create the policy
    CREATE POLICY "tecnicoDM329 can create technical data for assigned requests"
      ON dm329_technical_data FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM users u
          JOIN requests r ON r.id = dm329_technical_data.request_id
          WHERE u.id = auth.uid()
          AND u.role = 'tecnicoDM329'
          AND r.assigned_to = auth.uid()
        )
      );
  `

  const { error } = await supabase.rpc('exec_sql', { sql_query: sql })

  if (error) {
    console.error('❌ Error applying policy:', error)
    console.log('\nℹ️  You may need to apply this migration manually via Supabase dashboard:')
    console.log('   SQL Editor -> Run the following:\n')
    console.log(sql)
    process.exit(1)
  }

  console.log('✅ Policy applied successfully!')
}

applyPolicy()
