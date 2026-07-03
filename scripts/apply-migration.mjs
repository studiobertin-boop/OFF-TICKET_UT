#!/usr/bin/env node
/**
 * Applica una migration SQL al database Supabase remoto usando la Management API.
 *
 * Usa SOLO il Personal Access Token (SUPABASE_ACCESS_TOKEN) — la password del
 * database NON viene mai richiesta. È lo stesso meccanismo del SQL Editor della
 * dashboard, quindi equivale ad "incollare l'SQL a mano", ma automatizzato.
 *
 * Uso:
 *   node scripts/apply-migration.mjs <file.sql>            # applica
 *   node scripts/apply-migration.mjs <file.sql> --dry-run  # mostra solo l'SQL
 *   node scripts/apply-migration.mjs --check               # verifica connessione/token
 *
 * Requisiti in .env.local (NON usare prefisso VITE_ — sono segreti backend):
 *   SUPABASE_ACCESS_TOKEN=sbp_xxxxxxxxxxxx
 */
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

// project-ref: dal file di link della CLI, con fallback su config.toml
function readProjectRef() {
  const refFile = path.join(process.cwd(), 'supabase', '.temp', 'project-ref');
  if (fs.existsSync(refFile)) return fs.readFileSync(refFile, 'utf8').trim();
  const cfg = fs.readFileSync(path.join(process.cwd(), 'supabase', 'config.toml'), 'utf8');
  const m = cfg.match(/project_id\s*=\s*"([^"]+)"/);
  if (m) return m[1];
  throw new Error('project-ref non trovato');
}

async function runQuery(sql) {
  const ref = readProjectRef();
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function main() {
  if (!TOKEN) {
    console.error('❌ SUPABASE_ACCESS_TOKEN mancante in .env.local');
    console.error('   Crea un token su https://supabase.com/dashboard/account/tokens');
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const check = args.includes('--check');
  const file = args.find((a) => !a.startsWith('--'));

  if (check) {
    console.log('🔌 Verifico token e connessione...');
    const rows = await runQuery('select current_database() as db, current_user as usr, version() as pg;');
    console.log('✅ Connessione OK:', JSON.stringify(rows, null, 2));
    return;
  }

  if (!file) {
    console.error('❌ Specifica il file di migration. Es: node scripts/apply-migration.mjs supabase/migrations/xxx.sql');
    process.exit(1);
  }

  const fullPath = path.isAbsolute(file) ? file : path.join(process.cwd(), file);
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ File non trovato: ${fullPath}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(fullPath, 'utf8');
  console.log(`📄 Migration: ${path.basename(fullPath)} (${sql.length} caratteri)`);

  if (dryRun) {
    console.log('\n--- DRY RUN (nessuna modifica applicata) ---\n');
    console.log(sql);
    return;
  }

  console.log('🚀 Applico al database remoto...');
  const result = await runQuery(sql);
  console.log('✅ Migration applicata con successo.');
  if (Array.isArray(result) && result.length) {
    console.log('Risultato:', JSON.stringify(result, null, 2));
  }
}

main().catch((err) => {
  console.error('❌ Errore:', err.message);
  process.exit(1);
});
