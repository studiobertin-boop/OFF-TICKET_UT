# Guida: Reset Migration Manuale (via Dashboard)

## Problema
I comandi `supabase db pull` e `supabase migration repair` si bloccano durante la connessione al database remoto.

## Soluzione: Download Schema Manuale

### STEP 1: Scarica Schema da Dashboard

1. Vai su [Supabase Dashboard](https://supabase.com/dashboard)
2. Apri progetto **OFF-TICKET_UT**
3. Vai su **Database** → **Schema Visualizer**
4. In alto a destra clicca **Export Schema**
5. Seleziona:
   - ✅ `public` schema
   - ✅ Include RLS policies
   - ✅ Include functions
   - ✅ Include triggers
6. Clicca **Download SQL**

Salva il file come: `supabase_production_schema.sql`

### STEP 2: Backup Migration Esistenti

```powershell
# Crea cartella backup
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
New-Item -ItemType Directory -Path "supabase\migrations_backup_$timestamp"

# Copia tutte le migration
Copy-Item "supabase\migrations\*.sql" -Destination "supabase\migrations_backup_$timestamp"
Copy-Item "supabase\migrations\README_MIGRATION_ORDER.md" -Destination "supabase\migrations_backup_$timestamp" -ErrorAction SilentlyContinue
```

### STEP 3: Crea Nuova Migration Pulita

```powershell
# Genera timestamp per nuova migration
$newTimestamp = Get-Date -Format "yyyyMMddHHmmss"
$newMigrationName = "${newTimestamp}_production_schema.sql"

# Copia lo schema scaricato come nuova migration
Copy-Item "supabase_production_schema.sql" -Destination "supabase\migrations\$newMigrationName"
```

### STEP 4: Pulizia Migration Vecchie

```powershell
# Elimina tutte le vecchie migration TRANNE la nuova
Get-ChildItem "supabase\migrations\*.sql" |
Where-Object { $_.Name -ne $newMigrationName } |
Remove-Item -Force

# Elimina README vecchio
Remove-Item "supabase\migrations\README_MIGRATION_ORDER.md" -Force -ErrorAction SilentlyContinue
```

### STEP 5: Verifica e Test

```powershell
# Lista migration rimaste (dovrebbe essercene solo 1)
Get-ChildItem "supabase\migrations\*.sql"

# OPZIONALE: Reset DB locale per testare
# Assicurati che Docker sia in esecuzione
supabase start
supabase db reset
```

### STEP 6: Commit Cambiamenti

```bash
git add supabase/migrations/
git commit -m "chore: reset migrations from production schema"
```

---

## Vantaggi di Questo Approccio

✅ Non dipende dal CLI che si blocca
✅ Schema esportato direttamente da Supabase (100% accurato)
✅ Backup automatico delle vecchie migration
✅ Production rimane completamente invariato

---

## Note Importanti

⚠️ **Dopo questo reset:**
- Le vecchie 48 migration sono nel backup
- Hai 1 sola migration pulita che rappresenta lo stato production
- Tutte le future migration partiranno da questo punto
- Il database production NON è stato modificato

⚠️ **Se lavori in team:**
- Gli altri sviluppatori dovranno sincronizzare le migration
- Avvisali prima di fare il commit

---

## Troubleshooting

### Problema: "Export Schema" non disponibile in Dashboard

**Soluzione alternativa:**
1. Vai su **SQL Editor**
2. Copia e incolla questo script:

\`\`\`sql
-- Genera schema dump completo
SELECT
    'CREATE TABLE IF NOT EXISTS ' ||
    quote_ident(table_schema) || '.' || quote_ident(table_name) ||
    ' (' || string_agg(column_definition, ', ') || ');' as ddl
FROM (
    SELECT
        table_schema,
        table_name,
        quote_ident(column_name) || ' ' ||
        data_type ||
        CASE WHEN character_maximum_length IS NOT NULL
             THEN '(' || character_maximum_length || ')'
             ELSE '' END ||
        CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END as column_definition
    FROM information_schema.columns
    WHERE table_schema = 'public'
) cols
GROUP BY table_schema, table_name;
\`\`\`

3. Esegui e salva il risultato

### Problema: File SQL troppo grande

Non è un problema. Le migration possono essere grandi. Supabase le gestisce normalmente.

