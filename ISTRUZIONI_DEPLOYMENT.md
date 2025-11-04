# Istruzioni per il Deployment della Feature Eliminazione Massiva

## Stato Attuale
✅ **Codice TypeScript:** COMPLETATO e compilato senza errori
✅ **Componenti React:** IMPLEMENTATI
✅ **API Services:** CREATI
✅ **Types:** AGGIORNATI
✅ **Navigation:** CONFIGURATA

⚠️ **Migration Database:** DA APPLICARE MANUALMENTE

---

## Problema con Migration Automatica

Il database remoto ha già delle migration applicate manualmente, quindi il comando `supabase db push` tenta di riapplicare tutte le migration dall'inizio causando errori di conflitto (es. `user_role already exists`).

**Soluzione:** Applicare la migration manualmente tramite SQL Editor di Supabase.

---

## PASSO 1: Applicare la Migration al Database

### Opzione A: Tramite Supabase Dashboard (CONSIGLIATA)

1. **Apri il Supabase Dashboard**
   - Vai su [supabase.com](https://supabase.com)
   - Accedi al tuo progetto

2. **Apri SQL Editor**
   - Nel menu laterale sinistro, click su "SQL Editor"

3. **Copia il contenuto del file SQL**
   - Apri il file: `APPLY_DELETION_ARCHIVE_MIGRATION.sql`
   - Copia TUTTO il contenuto

4. **Incolla ed Esegui**
   - Incolla nel SQL Editor
   - Click su "Run" o Ctrl+Enter
   - Attendi il completamento

5. **Verifica Successo**
   - Dovresti vedere messaggi di successo
   - Controlla che non ci siano errori rossi

### Opzione B: Tramite CLI Supabase (Alternativa)

Se preferisci usare la CLI:

```bash
# Naviga nella cartella del progetto
cd "C:\Users\User14\OneDrive - Studio Bertin\STUDIOBERTIN\SVILUPPO\OFF-TICKET_UT"

# Applica manualmente il file SQL
npx supabase db execute --file APPLY_DELETION_ARCHIVE_MIGRATION.sql
```

---

## PASSO 2: Verificare l'Applicazione della Migration

### 2.1 Verifica Tabella `deletion_archives`

Nel SQL Editor di Supabase, esegui:

```sql
SELECT * FROM deletion_archives LIMIT 1;
```

✅ **Risultato atteso:** Query eseguita con successo (anche se restituisce 0 righe)
❌ **Errore:** Se dice "relation deletion_archives does not exist", ripeti PASSO 1

### 2.2 Verifica Storage Bucket

1. Nel Supabase Dashboard, vai su "Storage"
2. Cerca il bucket `deletion-archives`
3. ✅ Deve esistere e essere **privato** (non public)

### 2.3 Verifica RLS Policies

Nel SQL Editor, esegui:

```sql
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'deletion_archives';
```

✅ **Risultato atteso:** Dovresti vedere 2 policies:
- `Admin can view all deletion archives` (SELECT)
- `Admin can create deletion archives` (INSERT)

---

## PASSO 3: Build e Deploy Frontend

### 3.1 Build Locale (Verifica)

```bash
# Naviga nella cartella del progetto
cd "C:\Users\User14\OneDrive - Studio Bertin\STUDIOBERTIN\SVILUPPO\OFF-TICKET_UT"

# Build di produzione
npm run build
```

✅ **Risultato atteso:** Build completato senza errori
❌ **Se ci sono errori TypeScript:** Contattami per supporto

### 3.2 Deploy su Vercel (se stai usando Vercel)

#### Opzione A: Deploy Automatico (se configurato)

```bash
# Commit e push su Git
git add .
git commit -m "feat: Sistema eliminazione massiva con archivio PDF"
git push origin main
```

Vercel eseguirà automaticamente il deploy.

#### Opzione B: Deploy Manuale

```bash
# Usa Vercel CLI
npx vercel --prod
```

### 3.3 Verifica Deploy

1. Apri l'applicazione deployata
2. Login come Admin
3. Verifica che il menu Admin contenga "Archivio Eliminazioni"

---

## PASSO 4: Test della Funzionalità

### Test 1: Accesso Pagina Archivio

1. Login come **Admin**
2. Click su "Admin" → "Archivio Eliminazioni"
3. ✅ Dovresti vedere la pagina con messaggio "Nessun archivio di eliminazione disponibile"

### Test 2: Selezione Multipla

1. Vai su "Richieste"
2. Assicurati di essere in **vista Tabella**
3. Verifica che ci siano **checkbox** su ogni riga
4. ✅ Le checkbox sono visibili solo per Admin

### Test 3: Eliminazione Massiva (con richieste completate)

#### 3.1 Prepara Dati Test
- Assicurati di avere almeno 2-3 richieste con stato `COMPLETATA` o `7-CHIUSA`

#### 3.2 Esegui Test
1. Vai su "Richieste"
2. Seleziona 2-3 richieste completate tramite checkbox
3. Verifica che appaia la **Bulk Actions Bar** con:
   - Conteggio richieste selezionate
   - Bottone "ELIMINAZIONE MASSIVA"
4. Click su "ELIMINAZIONE MASSIVA"
5. Verifica che appaia il dialog di conferma con:
   - Lista richieste da eliminare
   - Avviso generazione PDF
6. Click su "ELIMINA X RICHIESTE"
7. Attendi il completamento (mostra spinner)
8. ✅ Dovresti vedere:
   - Toast verde "X richieste eliminate con successo. PDF archivio generato."
   - Richieste scomparse dalla tabella
   - Selezione pulita

#### 3.3 Verifica PDF Generato
1. Vai su "Admin" → "Archivio Eliminazioni"
2. ✅ Dovresti vedere un nuovo record con:
   - Data eliminazione (oggi)
   - Numero richieste eliminate
   - Tuo nome come "Eliminato da"
3. Click sul bottone "Download"
4. ✅ Dovresti scaricare un PDF con:
   - Intestazione "PRATICHE ELIMINATE IL gg.mm.aaaa"
   - Tabella con tutte le richieste eliminate
   - Storico completo dei cambi stato

### Test 4: Permessi (Utenti Non-Admin)

1. Login come **Tecnico** o **Utente**
2. Vai su "Richieste"
3. ✅ Verifica che **NON ci siano checkbox** nelle tabelle
4. Prova ad accedere direttamente a `/admin/deletion-archives`
5. ✅ Dovresti essere reindirizzato (ProtectedRoute)

### Test 5: Vincoli Eliminazione

1. Login come Admin
2. Prova a selezionare richieste con stati diversi da COMPLETATA/7-CHIUSA
3. Click su "ELIMINAZIONE MASSIVA"
4. ✅ L'eliminazione dovrebbe **fallire** con errore "Permessi insufficienti"
   (protetto da RLS a livello database)

---

## PASSO 5: Monitoraggio Post-Deploy

### Monitora Storage Usage

1. Supabase Dashboard → "Storage"
2. Bucket `deletion-archives`
3. Controlla dimensione crescente con eliminazioni

### Monitora Database Size

```sql
-- Controlla dimensione tabella deletion_archives
SELECT
  pg_size_pretty(pg_total_relation_size('deletion_archives')) as size,
  COUNT(*) as archives_count
FROM deletion_archives;

-- Controlla quante richieste possono essere eliminate
SELECT
  status,
  COUNT(*) as count
FROM requests
WHERE status IN ('COMPLETATA', '7-CHIUSA')
GROUP BY status;
```

---

## Troubleshooting

### Problema: "Tabella deletion_archives non esiste"

**Soluzione:** Ripeti PASSO 1 - La migration non è stata applicata correttamente

### Problema: "Bucket deletion-archives non trovato"

**Soluzione:**
1. Vai su Supabase Dashboard → Storage
2. Click "New bucket"
3. Nome: `deletion-archives`
4. Public: **NO** (disabilitato)
5. Click "Create"

### Problema: "403 Forbidden" quando download PDF

**Soluzione:** Verifica le storage policies (PASSO 2.3)

### Problema: Build TypeScript fallisce

**Soluzione:**
```bash
# Verifica errori
npx tsc --noEmit

# Se ci sono errori, contattami con l'output completo
```

### Problema: Checkbox non visibili

**Verifica:**
1. Sei loggato come Admin?
2. Sei in vista Tabella (non Griglia)?
3. Sei su tab "Richieste Generali" o "Richieste DM329" (non "Nascoste")?

### Problema: Toast notification non appare

**Verifica:** La libreria `react-hot-toast` è installata
```bash
npm list react-hot-toast
```

Se non installata:
```bash
npm install react-hot-toast --legacy-peer-deps
```

---

## Rollback (Se Necessario)

Se qualcosa va storto e vuoi fare rollback:

### Rollback Database

```sql
-- Rimuovi policies
DROP POLICY IF EXISTS "Admin can view all deletion archives" ON deletion_archives;
DROP POLICY IF EXISTS "Admin can create deletion archives" ON deletion_archives;
DROP POLICY IF EXISTS "Admin can upload deletion archive PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Admin can view deletion archive PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Admin can delete deletion archive PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Admin can delete completed requests" ON requests;

-- Rimuovi indexes
DROP INDEX IF EXISTS idx_deletion_archives_created_at;
DROP INDEX IF EXISTS idx_deletion_archives_deleted_by;
DROP INDEX IF EXISTS idx_requests_deletable;

-- Rimuovi tabella
DROP TABLE IF EXISTS deletion_archives CASCADE;

-- Rimuovi bucket (solo se vuoto)
DELETE FROM storage.buckets WHERE id = 'deletion-archives';
```

### Rollback Codice

```bash
# Torna al commit precedente
git log --oneline  # Trova hash commit precedente
git reset --hard <hash-commit-precedente>
git push --force origin main
```

---

## Checklist Finale

Prima di considerare il deployment completato:

- [ ] Migration database applicata con successo
- [ ] Tabella `deletion_archives` esiste
- [ ] Bucket storage `deletion-archives` esiste
- [ ] RLS policies attive e funzionanti
- [ ] Build TypeScript passa senza errori
- [ ] Frontend deployato con successo
- [ ] Menu "Archivio Eliminazioni" visibile per Admin
- [ ] Checkbox visibili nelle tabelle (solo Admin)
- [ ] Eliminazione massiva funzionante
- [ ] PDF generato correttamente
- [ ] Download PDF funzionante
- [ ] Permessi corretti (non-Admin non vedono funzionalità)
- [ ] Test su almeno 5 richieste completate

---

## Supporto

Se incontri problemi non coperti da questo documento:

1. Controlla i log del browser (F12 → Console)
2. Controlla i log di Supabase (Dashboard → Logs)
3. Verifica le policies RLS (potrebbero bloccare operazioni)
4. Contatta il team di sviluppo con:
   - Descrizione errore
   - Screenshot
   - Log del browser
   - Query SQL che fallisce (se applicabile)

---

## File di Riferimento

- **Migration SQL:** `APPLY_DELETION_ARCHIVE_MIGRATION.sql`
- **Documentazione Feature:** `DOCUMENTAZIONE/FEATURE_ELIMINAZIONE_MASSIVA.md`
- **Questo File:** `ISTRUZIONI_DEPLOYMENT.md`

---

**Data:** 04/11/2025
**Versione:** 1.0.0
**Status:** Pronto per deployment
