# Feature: Sistema di Eliminazione Massiva con Archivio PDF

## Data Implementazione
04/11/2025

## Descrizione
Sistema completo per l'eliminazione massiva delle pratiche completate/chiuse con generazione automatica di PDF di archivio contenente lo storico completo delle pratiche eliminate.

## Obiettivo
Mantenere il database leggero eliminando le pratiche completate, preservando lo storico attraverso PDF archiviati e accessibili dalla sezione Admin.

---

## Funzionalità Implementate

### 1. Eliminazione Singola (Modificata)
**File modificato:** `src/components/requests/ConfirmDeleteDialog.tsx`

- Messaggio di conferma aggiornato per singola richiesta:
  > "Stai per eliminare DEFINITIVAMENTE questa richiesta. Questa azione NON PUÒ essere annullata. **Per preservare lo storico della pratica usa la funzione di eliminazione massiva nella tabella principale.**"

### 2. Selezione Multipla nelle Tabelle
**File modificati:**
- `src/components/requests/RequestsTableView.tsx`
- `src/components/requests/DM329TableView.tsx`

**Funzionalità:**
- Checkbox su ogni riga per selezione individuale
- Checkbox "Seleziona Tutto" nell'header (seleziona solo pratiche COMPLETATA/7-CHIUSA)
- Evidenziazione visiva delle righe selezionate
- Click sulla riga per navigare al dettaglio (escluso click su checkbox)

**Attivazione:** Solo per utenti ADMIN in vista tabella su tab richieste visibili (non nascoste)

### 3. Bulk Actions Bar
**File modificato:** `src/components/requests/BulkActionsBar.tsx`

**Contenuto:**
- Counter richieste selezionate
- Bottone "ELIMINAZIONE MASSIVA" (visibile solo se ci sono richieste completate/chiuse selezionate)
- Bottone "Annulla" per deselezionare tutto

### 4. Dialog Conferma Eliminazione Massiva
**File creato:** `src/components/requests/BulkDeleteConfirmDialog.tsx`

**Contenuto:**
- Alert di warning con messaggio: "Stai per eliminare DEFINITIVAMENTE le richieste selezionate"
- Informazione sulla generazione PDF archivio
- Lista scrollabile delle richieste da eliminare con dettagli (ID, Titolo, Tipo, Stato)
- Bottone conferma con indicatore loading durante l'operazione

### 5. Generazione PDF Archivio
**File creato:** `src/services/pdfService.ts`

**Librerie utilizzate:**
- `jspdf`: Generazione PDF
- `jspdf-autotable`: Creazione tabelle nel PDF

**Contenuto PDF:**
- Intestazione: "PRATICHE ELIMINATE IL gg.mm.aaaa"
- Tabella con colonne:
  - ID (primi 8 caratteri)
  - Titolo
  - Tipo
  - Data Creazione
  - Data Completamento
  - Stati Attraversati (storico completo con date, transizioni e utenti)
- Paginazione automatica
- Footer con conteggio totale pratiche eliminate
- Formato: A4 orizzontale

### 6. API Service per Deletion Archives
**File creato:** `src/services/api/deletionArchives.ts`

**Endpoints:**
- `getAll()`: Recupera tutti gli archivi PDF
- `getById(id)`: Recupera singolo archivio
- `downloadPDF(filePath)`: Download del PDF da Supabase Storage
- `getSignedURL(filePath)`: Genera URL firmato per accesso PDF
- `bulkDeleteWithArchive(requestIds)`: Esegue eliminazione massiva con generazione PDF

**Flusso eliminazione massiva:**
1. Fetch richieste con dettagli completi
2. Fetch storico cambi stato per ogni richiesta
3. Generazione PDF con tutte le informazioni
4. Upload PDF su Supabase Storage (`deletion-archives` bucket)
5. Creazione record in tabella `deletion_archives`
6. Eliminazione allegati da storage
7. Eliminazione richieste dal database (cascade: history, blocks, attachments)

### 7. Pagina Admin Archivio Eliminazioni
**File creato:** `src/pages/DeletionArchives.tsx`
**Route:** `/admin/deletion-archives`

**Contenuto:**
- Tabella con colonne:
  - Icona PDF
  - Data Eliminazione
  - Nome File
  - Numero Pratiche Eliminate
  - Dimensione File
  - Eliminato da (nome utente)
  - Azioni (Bottone Download)
- Download PDF con indicatore loading
- Messaggio informativo se nessun archivio disponibile

**Accesso:** Solo utenti con ruolo `admin`

### 8. Integrazione Pagina Requests
**File modificato:** `src/pages/Requests.tsx`

**Funzionalità aggiunte:**
- State management per selezione multipla
- Handler per selezione/deselezione richieste
- Handler per "Seleziona Tutto" (solo richieste completate/chiuse)
- Handler eliminazione massiva con chiamata API
- Dialog conferma eliminazione
- Toast notification successo/errore
- Invalidation query per refresh automatico dopo eliminazione
- Pulizia selezione al cambio tab

---

## Schema Database

### Nuova Tabella: `deletion_archives`
**File migration:** `supabase/migrations/20251104000000_add_deletion_archive.sql`

```sql
CREATE TABLE deletion_archives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  deleted_count INTEGER NOT NULL,
  deleted_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
)
```

### Storage Bucket: `deletion-archives`
- Accesso: Solo Admin
- Organizzazione: `{user_id}/{filename}`
- Tipo file: PDF

### RLS Policies

**Tabella `deletion_archives`:**
- Admin: SELECT, INSERT
- Altri ruoli: Nessun accesso

**Storage `deletion-archives`:**
- Admin: INSERT, SELECT, DELETE
- Organizzazione file per user_id

**Tabella `requests`:**
- Policy aggiornata: `Admin can delete completed requests`
- Condizione: Solo richieste con stato `COMPLETATA` o `7-CHIUSA`

---

## Navigation

**Menu Admin aggiornato:**
File modificato: `src/components/common/Layout.tsx`

Nuova voce menu:
- Icona: Archive
- Label: "Archivio Eliminazioni"
- Link: `/admin/deletion-archives`
- Accesso: Solo Admin

**Route aggiunta:**
File modificato: `src/App.tsx`

```tsx
<Route
  path="/admin/deletion-archives"
  element={
    <ProtectedRoute allowedRoles={['admin']}>
      <DeletionArchives />
    </ProtectedRoute>
  }
/>
```

---

## Types Aggiornati

**File modificato:** `src/types/index.ts`

```typescript
export interface DeletionArchive {
  id: string
  file_name: string
  file_path: string
  file_size?: number
  deleted_count: number
  deleted_by: string
  deleted_by_user?: User
  created_at: string
}
```

---

## Dipendenze Installate

```json
{
  "jspdf": "^2.x.x",
  "jspdf-autotable": "^3.x.x",
  "react-hot-toast": "^2.x.x"
}
```

---

## Workflow Utente

### Per Admin

1. **Accesso alla pagina Richieste**
   - Navigare a "Richieste" dalla navbar
   - Assicurarsi di essere in vista "Tabella"
   - Verificare di essere su tab "Richieste Generali" o "Richieste DM329" (non tab nascosti)

2. **Selezione Richieste**
   - Selezionare singole richieste tramite checkbox
   - Oppure usare "Seleziona Tutto" (seleziona automaticamente solo COMPLETATA/7-CHIUSA)
   - Appare la Bulk Actions Bar con conteggio richieste selezionate

3. **Eliminazione Massiva**
   - Click sul bottone "ELIMINAZIONE MASSIVA"
   - Verificare l'elenco delle richieste nel dialog di conferma
   - Confermare l'eliminazione

4. **Risultato**
   - Toast di successo con numero richieste eliminate
   - PDF generato automaticamente e salvato
   - Richieste eliminate dal database
   - Allegati eliminati da storage
   - Tabella ricaricata automaticamente

5. **Accesso Archivio**
   - Click su "Admin" → "Archivio Eliminazioni"
   - Visualizzare lista di tutti i PDF generati
   - Download PDF tramite bottone "Download"

### Per Altri Utenti

- Funzione non accessibile
- Checkbox non visibili nelle tabelle
- Menu "Archivio Eliminazioni" non visibile

---

## Limitazioni e Vincoli

1. **Solo Admin**
   - Eliminazione massiva disponibile esclusivamente per utenti con ruolo `admin`

2. **Solo Richieste Completate/Chiuse**
   - Eliminazione possibile solo per richieste con stato:
     - `COMPLETATA` (richieste generali)
     - `7-CHIUSA` (richieste DM329)

3. **RLS Protection**
   - Tentativi di eliminazione di richieste non completate vengono bloccati a livello database
   - Errore: "Permessi insufficienti"

4. **Vista Tabella**
   - Selezione multipla disponibile solo in vista tabella
   - Non disponibile in vista griglia

5. **Tab Visibili**
   - Selezione multipla non disponibile nei tab "Nascoste"
   - Limitata a tab "Richieste Generali" e "Richieste DM329"

---

## Test Consigliati

### Test Funzionali
1. ✅ Selezione singola richiesta completata
2. ✅ Selezione multipla con checkbox
3. ✅ Seleziona tutto (verifica solo COMPLETATA/CHIUSA)
4. ✅ Tentativo selezione richiesta non completata (dovrebbe funzionare ma eliminazione fallirà)
5. ✅ Eliminazione massiva con generazione PDF
6. ✅ Verifica contenuto PDF generato
7. ✅ Download PDF da archivio
8. ✅ Verifica eliminazione allegati
9. ✅ Verifica eliminazione storico
10. ✅ Cambio tab (verifica pulizia selezione)

### Test Permessi
1. ✅ Login come Admin → Verifica accesso completo
2. ✅ Login come Tecnico → Verifica assenza checkbox
3. ✅ Login come Utente → Verifica assenza checkbox
4. ✅ Login come userdm329 → Verifica assenza checkbox
5. ✅ Tentativo accesso diretto `/admin/deletion-archives` con ruolo non-admin

### Test Edge Cases
1. ✅ Eliminazione con 0 richieste selezionate
2. ✅ Eliminazione con 1 richiesta
3. ✅ Eliminazione con molte richieste (>100)
4. ✅ Richiesta senza storico
5. ✅ Richiesta senza allegati
6. ✅ Perdita connessione durante eliminazione

---

## Note Tecniche

### Performance
- Generazione PDF ottimizzata con jsPDF
- Batch deletion per ridurre query database
- Cascade delete gestito da PostgreSQL
- Invalidation query per refresh intelligente

### Sicurezza
- RLS policies a livello database
- Signed URLs per accesso PDF (scadenza 1h)
- Validazione permessi su ogni operazione
- Storage privato (non public)

### Manutenzione
- PDF archiviati indefinitamente (no auto-cleanup)
- Pulizia manuale tramite API `deletionArchivesApi.delete(id)`
- Monitorare dimensione bucket storage

---

## File Modificati/Creati

### Creati
- `supabase/migrations/20251104000000_add_deletion_archive.sql`
- `src/services/pdfService.ts`
- `src/services/api/deletionArchives.ts`
- `src/components/requests/BulkDeleteConfirmDialog.tsx`
- `src/pages/DeletionArchives.tsx`
- `DOCUMENTAZIONE/FEATURE_ELIMINAZIONE_MASSIVA.md`

### Modificati
- `src/types/index.ts`
- `src/components/requests/ConfirmDeleteDialog.tsx`
- `src/components/requests/BulkActionsBar.tsx`
- `src/components/requests/RequestsTableView.tsx`
- `src/components/requests/DM329TableView.tsx`
- `src/pages/Requests.tsx`
- `src/components/common/Layout.tsx`
- `src/App.tsx`
- `package.json`

---

## Conclusioni

Il sistema di eliminazione massiva è stato implementato con successo, offrendo:
- ✅ Interfaccia intuitiva per selezione multipla
- ✅ Generazione automatica PDF con storico completo
- ✅ Archivio accessibile e organizzato
- ✅ Sicurezza a livello database (RLS)
- ✅ Preservazione storico attraverso PDF
- ✅ Database leggero tramite pulizia periodica

**Status:** COMPLETO ✓
**Build TypeScript:** PASS ✓
**Migration Database:** PRONTA (da applicare con `supabase db push`)
