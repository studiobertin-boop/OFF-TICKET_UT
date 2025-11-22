# Fix: Creazione Schede Dati per Richieste DM329 Vecchie

## Problema Risolto

Le richieste DM329 create **prima del 12 novembre 2025** non avevano un record corrispondente nella tabella `dm329_technical_data`, causando l'errore "Scheda dati tecnici non trovata" quando si tentava di accedere alla scheda dati.

## Soluzione Implementata

È stato implementato un **approccio ibrido** che risolve sia il problema UX immediato che il backfill dei dati esistenti.

### 1. Creazione Automatica On-Demand (Frontend)

**File modificato**: `src/pages/TechnicalDetails.tsx`

Quando un utente clicca sul pulsante "SCHEDA DATI" per una richiesta DM329 che non ha ancora una scheda tecnica:

1. Il sistema rileva che la scheda non esiste
2. Crea automaticamente un nuovo record in `dm329_technical_data`
3. Copia l'`indirizzo_impianto` dai `custom_fields` della richiesta (se disponibile)
4. Mostra un messaggio informativo all'utente: "Scheda dati creata automaticamente. Puoi ora compilare i dati tecnici."
5. Presenta il form vuoto pronto per la compilazione

**Vantaggi**:
- ✅ Risolve il problema immediatamente per tutti gli utenti
- ✅ Nessun intervento manuale richiesto
- ✅ Esperienza utente trasparente
- ✅ Funziona per tutte le richieste (vecchie e nuove)

### 2. Policy INSERT per tecnicoDM329

**File creato**: `supabase/migrations/20251122000000_add_tecnicodm329_insert_policy.sql`

È stata aggiunta una policy RLS che permette agli utenti con ruolo `tecnicoDM329` di creare schede dati tecniche **solo per le richieste a loro assegnate**.

```sql
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
```

**Permessi**:
- ✅ `admin`: può creare schede per qualsiasi richiesta
- ✅ `userdm329`: può creare schede per qualsiasi richiesta
- ✅ `tecnicoDM329`: può creare schede **solo per richieste assegnate**

### 3. Script Backfill (Opzionale)

**File creato**: `scripts/backfill-dm329-technical-data.ts`

Uno script TypeScript per creare in batch le schede dati mancanti per tutte le richieste DM329 esistenti.

**Vantaggi del backfill**:
- Evita il ritardo della creazione on-demand alla prima apertura
- Utile per assicurarsi che tutte le richieste esistenti abbiano la scheda
- Può essere eseguito in background

## Istruzioni di Deployment

### Step 1: Applicare la Migration (Database)

#### Opzione A: Via Supabase Dashboard (Consigliata se `db push` ha problemi)

1. Aprire [Supabase Dashboard](https://supabase.com/dashboard)
2. Selezionare il progetto
3. Andare su **SQL Editor**
4. Copiare il contenuto di `supabase/migrations/20251122000000_add_tecnicodm329_insert_policy.sql`
5. Incollare ed eseguire

#### Opzione B: Via CLI (Se il database è allineato)

```bash
supabase db push
```

Se ci sono migration non applicate, usare:
```bash
supabase db push --include-all
```

### Step 2: Deploy Frontend

Il frontend è già stato modificato. Basta fare il deploy come al solito:

```bash
# Se usi Vercel
vercel --prod

# Oppure
git add .
git commit -m "fix: Add auto-creation for missing DM329 technical data sheets"
git push
```

### Step 3: Eseguire Backfill (Opzionale)

Se vuoi pre-popolare tutte le schede dati mancanti:

1. Assicurati di avere `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`
2. Esegui lo script:

```bash
tsx scripts/backfill-dm329-technical-data.ts
```

**Output esempio**:
```
🚀 Starting backfill process for DM329 technical data...

📋 Step 1: Finding DM329 request type...
✓ Found DM329 request type: abc123...

📋 Step 2: Finding DM329 requests without technical data...
✓ Found 15 requests that already have technical data
✓ Found 42 total DM329 requests
✓ Found 27 requests WITHOUT technical data

📋 Step 3: Creating technical data records...
  ✓ Created technical data for req-001
  ✓ Created technical data for req-002
  ...

============================================================
📊 BACKFILL SUMMARY
============================================================
Total DM329 requests:              42
Already had technical data:        15
Needed backfill:                   27
Successfully created:              27
Errors:                            0
============================================================

✅ Backfill completed successfully!
```

## Testing

### Test 1: Creazione Automatica

1. Trovare una richiesta DM329 creata prima del 12/11/2025 (o cancellare manualmente una scheda dati esistente)
2. Accedere alla richiesta come utente con permessi (admin, userdm329, o tecnicoDM329 assegnato)
3. Cliccare sul pulsante "SCHEDA DATI"
4. **Risultato atteso**:
   - Messaggio informativo blu: "Scheda dati creata automaticamente. Puoi ora compilare i dati tecnici."
   - Form vuoto pronto per compilazione
   - Se la richiesta aveva `indirizzo_impianto`, questo dovrebbe essere pre-compilato

### Test 2: Verifica Permessi tecnicoDM329

1. Accedere come utente `tecnicoDM329`
2. Tentare di aprire scheda dati per richiesta **non assegnata**
3. **Risultato atteso**: Errore "Impossibile creare la scheda dati. Verifica i permessi."
4. Tentare di aprire scheda dati per richiesta **assegnata**
5. **Risultato atteso**: Creazione automatica con successo

### Test 3: Funzionamento Trigger per Nuove Richieste

1. Creare una nuova richiesta DM329
2. Verificare in database che venga creato automaticamente un record in `dm329_technical_data`
3. **Query di verifica**:

```sql
SELECT
  r.id,
  r.title,
  td.id as technical_data_id,
  td.created_at
FROM requests r
LEFT JOIN dm329_technical_data td ON td.request_id = r.id
WHERE r.request_type_id = (SELECT id FROM request_types WHERE name = 'DM329')
ORDER BY r.created_at DESC
LIMIT 10;
```

## Rollback (Se Necessario)

Se qualcosa va storto, è possibile fare rollback:

### Rollback Frontend

```bash
git revert <commit-hash>
git push
```

### Rollback Database (Policy)

```sql
DROP POLICY IF EXISTS "tecnicoDM329 can create technical data for assigned requests"
  ON dm329_technical_data;
```

### Pulizia Schede Create dal Backfill

Se vuoi rimuovere le schede create dal backfill (mantenendo solo quelle create dal trigger):

```sql
-- ATTENZIONE: Questo elimina TUTTE le schede create prima del 12/11/2025
DELETE FROM dm329_technical_data
WHERE created_at < '2025-11-12 00:00:00';
```

## File Modificati/Creati

### Frontend
- ✏️ `src/pages/TechnicalDetails.tsx` - Aggiunta logica creazione automatica

### Database
- ➕ `supabase/migrations/20251122000000_add_tecnicodm329_insert_policy.sql` - Nuova policy

### Script
- ➕ `scripts/backfill-dm329-technical-data.ts` - Script backfill batch
- ➕ `scripts/apply-tecnicodm329-policy.ts` - Helper per applicare policy (opzionale)

### Documentazione
- ➕ `DOCUMENTAZIONE/FIX_SCHEDE_DATI_DM329_VECCHIE.md` - Questo documento

## Impatto

- **Utenti interessati**: Tutti gli utenti che accedono a richieste DM329 vecchie
- **Richieste interessate**: ~27 richieste DM329 create prima del 12/11/2025 (numero stimato)
- **Breaking changes**: Nessuno
- **Rischi**: Bassi - la creazione è sicura e reversibile

## Note Tecniche

### Perché il Problema Esisteva?

Il trigger automatico per creare schede dati è stato implementato nella migration `20251112100002_create_dm329_technical_data.sql`:

```sql
CREATE TRIGGER trigger_create_technical_data_for_dm329
  AFTER INSERT ON requests
  FOR EACH ROW
  EXECUTE FUNCTION create_technical_data_for_dm329();
```

Questo trigger si attiva **solo per nuove richieste** inserite DOPO la data della migration. Le richieste pre-esistenti (create prima o importate da CSV) non hanno mai attivato il trigger.

### Perché Non Usare una Migration per il Backfill?

Abbiamo scelto uno script TypeScript invece di una migration SQL perché:

1. **Flessibilità**: Può essere eseguito in qualsiasi momento senza impattare il flusso di deploy
2. **Logging dettagliato**: Lo script fornisce output dettagliato per ogni operazione
3. **Sicurezza**: Può essere testato in locale prima di eseguirlo in produzione
4. **Reversibilità**: Non modifica lo schema, solo i dati
5. **Opzionalità**: Non è strettamente necessario grazie alla creazione on-demand

## Riferimenti

- **Issue originale**: Richieste DM329 vecchie senza scheda dati
- **Data implementazione**: 22 novembre 2025
- **Autore**: Claude Code
- **Reviewers**: User14
