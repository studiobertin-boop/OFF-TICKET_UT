# Importazione CSV DM329

Script per importare le richieste DM329 da file CSV nel database Supabase.

## Prerequisiti

1. **File CSV**: Il file `DOCUMENTAZIONE/DASHBOARD_10-11-25.csv` deve esistere
2. **Variabile d'ambiente**: `SUPABASE_SERVICE_ROLE_KEY` deve essere configurata
3. **Dipendenze**: Eseguire `npm install` per installare le dipendenze necessarie

## Configurazione

### Opzione 1: Variabile d'ambiente temporanea (Consigliata)

```bash
# Windows PowerShell
$env:SUPABASE_SERVICE_ROLE_KEY="your-service-role-key-here"
npx tsx scripts/import-dm329-csv.ts

# Windows CMD
set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
npx tsx scripts/import-dm329-csv.ts

# Linux/Mac
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key-here"
npx tsx scripts/import-dm329-csv.ts
```

### Opzione 2: Aggiungere al file .env.local (Non consigliato per produzione)

Aggiungere al file `.env.local`:

```
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

⚠️ **ATTENZIONE**: NON committare mai il service role key su Git!

## Come trovare il Service Role Key

1. Vai su [Supabase Dashboard](https://supabase.com/dashboard)
2. Seleziona il tuo progetto
3. Vai su **Settings** → **API**
4. Copia il **service_role** key (NON l'anon key)

## Utilizzo

### Dry Run (Simulazione)

Prima di eseguire l'importazione reale, eseguire sempre un dry-run per verificare i dati:

```bash
npx tsx scripts/import-dm329-csv.ts --dry-run
```

Questo mostrerà:
- Quante richieste verranno importate
- Quanti record di history verranno creati
- Un esempio di richiesta trasformata
- Eventuali errori di parsing

### Importazione Reale

Dopo aver verificato il dry-run, eseguire l'importazione effettiva:

```bash
# Con variabile d'ambiente temporanea (PowerShell)
$env:SUPABASE_SERVICE_ROLE_KEY="your-service-role-key-here"
npx tsx scripts/import-dm329-csv.ts

# Oppure se già configurata in .env.local
npx tsx scripts/import-dm329-csv.ts
```

## Cosa fa lo script

### 1. Verifica Schema Database
- Controlla/crea il campo `off_cac` nella tabella `requests`
- Verifica che lo stato `ARCHIVIATA NON FINITA` esista

### 2. Parsing CSV
- Legge il file CSV
- Parse delle 200+ righe di richieste DM329

### 3. Trasformazione Dati

#### Mappatura Campi Principali:
```
CSV → Database
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CLIENTE          → title: "DM329 - {cliente pulito}"
STATO            → status: dm329_status ENUM
OFF / CAC        → off_cac: "off" | "cac" | ""
[data minima]    → created_at
[data massima]   → updated_at
```

#### Pulizia Nomi Cliente:
- Rimuove `(x2)`, `(x3)`, `(x5)` ecc.
- Rimuove asterischi e doppi slash
- Normalizza spazi

#### Mappatura Stati:
```
CSV                          → Database
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"1 - INCARICO RICEVUTO"      → "1-INCARICO_RICEVUTO"
"2- SCHEDA DATI PRONTA"      → "2-SCHEDA_DATI_PRONTA"
"3 - MAIL CLIENTE INVIATA"   → "3-MAIL_CLIENTE_INVIATA"
"4 - DOCUMENTI PRONTI"       → "4-DOCUMENTI_PRONTI"
"5 - ATTESA FIRMA"           → "5-ATTESA_FIRMA"
"6 - PRONTA PER CIVA"        → "6-PRONTA_PER_CIVA"
"7 - CHIUSA"                 → "7-CHIUSA"
"SOSPESA"                    → "ARCHIVIATA NON FINITA"
```

#### Mappatura OFF/CAC:
```
CSV          → Database off_cac
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"OFFICOMP"   → "off"
"CAC"        → "cac"
"GRATUITO"   → ""
[vuoto]      → ""
```

#### Date Workflow:
- Converte da formato italiano DD/MM/YYYY a ISO 8601
- Preserva tutte le 7 date workflow in `custom_fields.workflow_dates`
- Date vuote diventano `null`

### 4. Importazione Requests
- Inserisce le richieste in batch di 50
- Crea automaticamente i record in `requests` table

### 5. Generazione History
- Per ogni richiesta, crea i record di history per ogni transizione di stato
- Ordina cronologicamente basandosi sulle date workflow
- Genera ~985 record history totali per le 200 richieste

### 6. Verifica
- Mostra summary finale con conteggi
- Segnala eventuali errori

## Struttura Custom Fields

Ogni richiesta importata avrà questo formato nel campo `custom_fields`:

```json
{
  "cliente": "AGOSTINELLI SRL",
  "indirizzo_immobile": "",
  "tipologia_intervento": "Nuova Costruzione",
  "superficie": "",
  "note": "note dal CSV",
  "workflow_dates": {
    "1-INCARICO_RICEVUTO": "2025-10-29T00:00:00Z",
    "2-SCHEDA_DATI_PRONTA": null,
    "3-MAIL_CLIENTE_INVIATA": null,
    "4-DOCUMENTI_PRONTI": null,
    "5-ATTESA_FIRMA": null,
    "6-PRONTA_PER_CIVA": null,
    "7-CHIUSA": null
  },
  "assignment_category": "OFFICOMP",
  "original_csv_row": 2
}
```

## Output Atteso

### Dry Run:
```
🚀 DM329 CSV Import Script
============================================================
Mode: 🔍 DRY RUN
CSV File: .../DASHBOARD_10-11-25.csv
============================================================

📋 Step 1: Verifying database schema...
🔍 Dry run: Would verify/create off_cac column

📋 Step 2: Getting DM329 request type...
🔍 Dry run: Using dummy DM329 type ID: ...

📋 Step 3: Getting admin user...
🔍 Dry run: Using dummy admin user ID: ...

📋 Step 4: Parsing CSV file...
✅ Parsed 200 rows from CSV

📋 Step 5: Transforming data...
✅ Transformed 200 requests

📋 Sample transformed request:
{...}

📋 Step 7: Simulating requests...
🔍 Dry run: Would import 200 requests

✅ Requests import complete: 200 success, 0 errors

📋 Step 8: Simulating history records...
Total history records to import: 985
🔍 Dry run: Would import 985 history records

============================================================
📊 IMPORT SUMMARY
============================================================
Mode: 🔍 DRY RUN
CSV Rows Parsed: 200
Requests Imported: 200
History Records Imported: 985
Errors: 0
============================================================

💡 Run without --dry-run flag to perform actual import
```

### Live Import:
- Same as above but with real database operations
- Shows batch progress: `✅ Inserted batch 1 (50 requests)`
- Shows history batch progress: `✅ Inserted history batch 1 (100 records)`

## Troubleshooting

### Errore: "SUPABASE_SERVICE_ROLE_KEY environment variable is required"
**Soluzione**: Configurare la variabile d'ambiente come descritto sopra

### Errore: "CSV file not found"
**Soluzione**: Verificare che il file `DOCUMENTAZIONE/DASHBOARD_10-11-25.csv` esista

### Errore: "DM329 request type not found in database"
**Soluzione**: Verificare che il request type "DM329" esista nel database

### Errore: "Admin user not found"
**Soluzione**: Verificare che esista un utente con email `admin@studiobertin.it`

### Errore di inserimento batch
**Soluzione**: Verificare i log per identificare quali richieste hanno causato l'errore

## Note Importanti

1. **Idempotenza**: Lo script NON è idempotente. Eseguirlo più volte creerà richieste duplicate.

2. **Rollback**: Non c'è funzione di rollback automatica. In caso di errore parziale, sarà necessario eliminare manualmente le richieste importate.

3. **Performance**: L'importazione di 200 richieste + 985 history records richiede circa 30-60 secondi.

4. **Limiti**: Il batch size è impostato a 50 per le richieste e 100 per la history. Modificare se necessario per dataset più grandi.

## Dopo l'Importazione

Verificare i dati importati:

```sql
-- Contare le richieste DM329 importate
SELECT COUNT(*) FROM requests r
JOIN request_types rt ON r.request_type_id = rt.id
WHERE rt.name = 'DM329';

-- Contare per stato
SELECT status, COUNT(*) as count
FROM requests r
JOIN request_types rt ON r.request_type_id = rt.id
WHERE rt.name = 'DM329'
GROUP BY status
ORDER BY status;

-- Contare per off_cac
SELECT off_cac, COUNT(*) as count
FROM requests r
JOIN request_types rt ON r.request_type_id = rt.id
WHERE rt.name = 'DM329'
GROUP BY off_cac;

-- Verificare history records
SELECT COUNT(*) FROM request_history rh
WHERE rh.request_id IN (
  SELECT r.id FROM requests r
  JOIN request_types rt ON r.request_type_id = rt.id
  WHERE rt.name = 'DM329'
);
```

## Manutenzione

Per aggiornare lo script in futuro:

1. Modificare `scripts/import-dm329-csv.ts`
2. Testare sempre con `--dry-run` prima dell'import reale
3. Verificare la mappatura stati se cambia l'ENUM `dm329_status`
4. Aggiornare questo README se cambiano i requisiti
