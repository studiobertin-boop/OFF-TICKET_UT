# Gestione Allegati - Documentazione

## Panoramica
Sistema completo per la gestione degli allegati nelle richieste, che permette di:
- **Visualizzare** gli allegati esistenti
- **Scaricare** gli allegati
- **Caricare** nuovi allegati dopo la creazione della richiesta
- **Eliminare** allegati esistenti

## Permessi

### Caricamento Allegati
Possono caricare allegati:
- **Admin**: su tutte le richieste
- **Creatore della richiesta**: sulle proprie richieste
- **Tecnico assegnato**: sulle richieste a lui assegnate

### Eliminazione Allegati
Possono eliminare allegati:
- **Admin**: tutti gli allegati
- **Creatore della richiesta**: allegati sulle proprie richieste
- **Tecnico assegnato**: allegati sulle richieste a lui assegnate
- **Chi ha caricato l'allegato**: i propri allegati

### Visualizzazione e Download
Tutti gli utenti che possono vedere una richiesta possono visualizzare e scaricare i suoi allegati.

## Struttura Tecnica

### File Principali

#### 1. API Service (`src/services/api/attachments.ts`)
Gestisce tutte le operazioni sugli allegati:
- `getByRequestId()`: recupera allegati di una richiesta
- `upload()`: carica un nuovo allegato
- `delete()`: elimina un allegato
- `download()`: scarica un allegato

**Caratteristiche:**
- Validazione dimensione file (max 10MB)
- Sanitizzazione nome file
- Path strutturato: `requests/{requestId}/{timestamp}_{filename}`
- Cleanup automatico in caso di errori

#### 2. Componente UI (`src/components/requests/AttachmentsSection.tsx`)
Visualizza e gestisce gli allegati nella pagina di dettaglio:
- Lista allegati con informazioni (nome, dimensione, uploader, data)
- Pulsante upload (se permessi)
- Pulsanti download e delete per ogni allegato
- Dialog di conferma eliminazione
- Feedback visivo per operazioni in corso
- Gestione errori

#### 3. Pagina Dettaglio (`src/pages/RequestDetail.tsx`)
Integra il componente AttachmentsSection passando i parametri necessari:
```tsx
<AttachmentsSection
  requestId={request.id}
  requestCreatedBy={request.created_by}
  requestAssignedTo={request.assigned_to}
/>
```

### Database e Storage

#### Tabella `attachments`
```sql
- id: uuid (PK)
- request_id: uuid (FK -> requests)
- file_name: text
- file_path: text
- file_size: bigint
- uploaded_by: uuid (FK -> users)
- created_at: timestamp
```

#### Storage Bucket: `attachments`
- Bucket privato (non pubblico)
- Struttura path: `requests/{requestId}/{timestamp}_{filename}`
- Policies RLS per controllo accessi
- **Nota**: Il bucket si chiama `attachments` (bucket già esistente)

### Row Level Security (RLS)

#### Policy Tabella Attachments
1. **Admin**: accesso completo (SELECT, INSERT, DELETE)
2. **Tecnico/TecnicoDM329**:
   - SELECT/INSERT/DELETE per richieste assegnate
3. **Utente/UserDM329**:
   - SELECT/INSERT/DELETE per proprie richieste

#### Policy Storage Bucket
1. **Upload**: tutti gli utenti autenticati
2. **Download**: tutti gli utenti autenticati
3. **Delete**: solo utenti con accesso alla richiesta o admin

## Flussi Operativi

### Upload Allegato
1. Utente clicca su "Carica File"
2. Seleziona file dal file picker
3. Frontend valida dimensione (max 10MB)
4. API carica file su Storage
5. API crea record in tabella `attachments`
6. Lista allegati si aggiorna automaticamente
7. In caso di errore, cleanup automatico

### Download Allegato
1. Utente clicca icona download
2. API scarica file da Storage
3. Browser avvia download del file
4. Nome originale preservato

### Eliminazione Allegato
1. Utente clicca icona elimina
2. Dialog di conferma
3. API elimina file da Storage
4. API elimina record da tabella
5. Lista allegati si aggiorna

## Gestione Errori

### Errori Validazione
- File troppo grande: "Il file supera la dimensione massima di 10MB"
- Utente non autenticato: "Non autenticato"

### Errori Upload
- Fallimento storage: "Errore nel caricamento del file"
- Fallimento database: rollback storage + messaggio errore
- Display errore in Alert rosso dismissibile

### Errori Delete
- Attachment non trovato: "Allegato non trovato"
- Fallimento eliminazione: messaggio specifico

### Errori Download
- Fallimento download: "Errore nel download del file"
- Alert browser

## UI/UX

### Indicatori Visivi
- **Loading spinner** durante upload
- **Progress indicator** durante download
- **Icone colorate**: download (default), delete (rosso)
- **Tooltips** su hover dei pulsanti

### Stati
- **Empty state**: "Nessun allegato presente"
- **Loading state**: spinner centrato
- **Error state**: alert dismissibile
- **Upload in progress**: box grigio con spinner + testo

### Responsive
- Layout adattivo mobile/desktop
- Pulsanti dimensioni ottimizzate
- Lista scrollabile

## Migrazione Database

File: `supabase/migrations/20251124000000_update_attachments_policies.sql`

**Cosa fa:**
1. Aggiorna policy RLS tabella `attachments` per includere nuovi ruoli (userdm329, tecnicoDM329)
2. Permette a tecnici di eliminare allegati dalle richieste assegnate
3. Aggiorna policy storage per bucket `attachments` esistente
4. Implementa controllo granulare permessi su upload/download/delete
5. Gestisce correttamente la struttura path `requests/{request_id}/{filename}`

**Come applicare:**
```bash
npx supabase db push
```

## Testing

### Test Manuali Consigliati
1. **Upload**:
   - File < 10MB ✓
   - File > 10MB ✗ (errore)
   - Più file sequenziali

2. **Download**:
   - Verifica nome file originale
   - Verifica contenuto corretto

3. **Delete**:
   - Conferma dialog
   - Refresh lista dopo delete
   - Verifica permessi per ruolo

4. **Permessi**:
   - Admin vede tutto
   - Creatore vede proprie
   - Tecnico vede assegnate
   - Utente non assegnato non vede

## Note Implementative

### Limitazioni Attuali
- Max 10MB per file
- No preview file (solo download)
- No drag-and-drop (solo file picker)
- Upload singolo (no batch)

### Possibili Estensioni Future
- Preview per PDF/immagini
- Drag-and-drop area
- Upload multiplo
- Compressione automatica immagini
- Generazione thumbnails
- Categorizzazione allegati

## Troubleshooting

### "Errore nel caricamento del file"
- Verificare bucket esistente
- Verificare policy RLS storage
- Controllare dimensione file

### "Permessi insufficienti"
- Verificare ruolo utente
- Verificare assigned_to / created_by
- Controllare policy RLS tabella attachments

### File non scaricabile
- Verificare file_path corretto
- Verificare bucket name
- Verificare policy storage SELECT
