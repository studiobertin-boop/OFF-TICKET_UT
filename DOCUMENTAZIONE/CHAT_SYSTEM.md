# Sistema Chat Richieste - Documentazione

## Panoramica
Sistema di messaggistica integrato per le richieste che permette a tutti gli utenti autorizzati di comunicare in tempo reale all'interno di una richiesta.

## Funzionalità

### 📨 Messaggi
- **Invio messaggi**: Tutti gli utenti che possono vedere la richiesta possono inviare messaggi
- **Visualizzazione**: Cronologia completa dei messaggi con nome utente, data e ora
- **Eliminazione**: Ogni utente può eliminare solo i propri messaggi
- **Real-time**: Aggiornamenti in tempo reale via Supabase Realtime
- **Avatar**: Avatar colorati con iniziali per identificare rapidamente gli utenti

### 🎨 UI/UX
- Box chat sotto lo storico richiesta
- Messaggi propri allineati a destra (blu)
- Messaggi altri utenti allineati a sinistra (grigio)
- Auto-scroll ai nuovi messaggi
- Input multi-riga con invio tramite Enter
- Contatore messaggi nel titolo
- Timestamp formattato in italiano

## Struttura Tecnica

### File Principali

#### 1. Database Migration (`supabase/migrations/20251124000001_create_request_messages.sql`)

**Tabella `request_messages`:**
```sql
- id: uuid (PK)
- request_id: uuid (FK -> requests)
- user_id: uuid (FK -> users)
- message: text
- created_at: timestamp
- updated_at: timestamp
```

**Caratteristiche:**
- Cascade delete: eliminando una richiesta si eliminano tutti i suoi messaggi
- Indexes per performance su request_id, user_id, created_at
- Trigger per aggiornamento automatico di updated_at

#### 2. API Service (`src/services/api/requestMessages.ts`)

**Metodi:**
- `getByRequestId(requestId)`: Recupera tutti i messaggi di una richiesta
- `create({ request_id, message })`: Crea un nuovo messaggio
- `delete(messageId)`: Elimina un messaggio (solo propri)
- `subscribeToMessages(requestId, callback)`: Sottoscrizione real-time

**Caratteristiche:**
- Auto-fetch dati utente con join
- Gestione errori con messaggi user-friendly
- Supporto Supabase Realtime

#### 3. Componente UI (`src/components/requests/RequestChatBox.tsx`)

**Caratteristiche:**
- Query con TanStack Query per cache e refresh automatico
- Sottoscrizione real-time per nuovi messaggi
- Auto-scroll ai nuovi messaggi
- Avatar colorati generati da user ID
- Input con supporto Enter/Shift+Enter
- Polling fallback ogni 5 secondi
- Box scrollabile con max-height 400px

#### 4. Integrazione (`src/pages/RequestDetail.tsx`)

Posizionamento:
- Colonna destra sotto RequestHistoryPanel
- Layout responsive con Grid MUI
- Sticky positioning con gap tra componenti

## Row Level Security (RLS)

### Policy SELECT (Visualizzazione)
1. **Admin**: tutti i messaggi
2. **Tecnico/TecnicoDM329**: messaggi delle richieste assegnate
3. **Utente/UserDM329**: messaggi delle proprie richieste

### Policy INSERT (Invio)
1. **Admin**: può inviare ovunque
2. **Tecnico/TecnicoDM329**: solo su richieste assegnate
3. **Utente/UserDM329**: solo su proprie richieste

### Policy DELETE (Eliminazione)
- **Tutti**: solo i propri messaggi
- **Admin**: tutti i messaggi (policy aggiuntiva)

## Permessi per Ruolo

| Ruolo | Visualizza | Invia | Elimina Propri | Elimina Tutti |
|-------|-----------|-------|----------------|---------------|
| Admin | ✅ Tutti | ✅ Tutti | ✅ | ✅ |
| Tecnico | ✅ Assegnate | ✅ Assegnate | ✅ | ❌ |
| TecnicoDM329 | ✅ Assegnate | ✅ Assegnate | ✅ | ❌ |
| Utente | ✅ Proprie | ✅ Proprie | ✅ | ❌ |
| UserDM329 | ✅ Proprie | ✅ Proprie | ✅ | ❌ |

## Flussi Operativi

### Invio Messaggio
1. Utente digita testo nell'input
2. Preme Enter o click su icona invio
3. API crea messaggio con user_id automatico
4. Messaggio appare immediatamente (optimistic update)
5. Altri utenti ricevono notifica real-time
6. Auto-scroll al nuovo messaggio

### Ricezione Real-time
1. Componente si sottoscrive a `request_messages:${requestId}`
2. Supabase invia notifica INSERT
3. API fetcha messaggio completo con dati utente
4. Messaggio aggiunto alla lista via callback
5. Auto-scroll al nuovo messaggio

### Eliminazione Messaggio
1. Utente clicca icona delete sul proprio messaggio
2. Conferma (opzionale via alert)
3. API elimina messaggio
4. Lista si aggiorna automaticamente

## Design Patterns

### Real-time + Polling Hybrid
- **Real-time**: Per aggiornamenti immediati
- **Polling (5s)**: Fallback per garantire sincronizzazione

### Optimistic Updates
- Nuovo messaggio appare subito dopo invio
- Rollback automatico in caso di errore

### Subscription Cleanup
```typescript
useEffect(() => {
  const unsubscribe = requestMessagesApi.subscribeToMessages(...)
  return () => unsubscribe() // Cleanup on unmount
}, [requestId])
```

## Styling

### Colori Avatar
8 colori predefiniti assegnati deterministicamente:
- Blu, Verde, Rosso, Arancione, Viola, Teal, Rosa, Marrone
- Hash dello user_id per consistenza

### Layout Messaggi
```
┌─────────────────────────────────────┐
│  [Avatar] Testo messaggio           │
│           Nome • Data/Ora           │
├─────────────────────────────────────┤
│           Testo messaggio [Avatar]  │
│           Nome • Data/Ora           │
└─────────────────────────────────────┘
```

## Performance

### Ottimizzazioni
- Query con cache TanStack Query
- Indexes database su colonne filtrate
- Lazy loading con scroll virtuale (future)
- Real-time solo per nuovi messaggi
- Polling limitato a 5 secondi

### Limits
- Nessun limite hard sul numero messaggi
- Max-height box: 400px (scrollabile)
- Max-rows input: 3 righe

## Gestione Errori

### Errori Comuni
- **Non autenticato**: Redirect a login
- **Permessi insufficienti**: Alert user-friendly
- **Connessione persa**: Fallback a polling
- **Real-time fail**: Polling garantisce sync

### User Feedback
- Alert rosso per errori invio
- Loading spinner durante invio
- Disable input durante operazioni
- Conferma eliminazione (alert browser)

## Migrazione Database

File: `supabase/migrations/20251124000001_create_request_messages.sql`

**Come applicare:**
```bash
# Via Supabase SQL Editor (CONSIGLIATO)
Copia il contenuto del file e esegui nel SQL Editor

# Via CLI (se no conflitti)
npx supabase db push
```

## Testing

### Test Manuali Consigliati

1. **Invio Messaggio**:
   - ✅ Messaggio appare nella lista
   - ✅ Auto-scroll al nuovo messaggio
   - ✅ Timestamp corretto

2. **Real-time**:
   - ✅ Apri 2 browser con utenti diversi
   - ✅ Invia messaggio da browser A
   - ✅ Verifica appaia in browser B

3. **Permessi**:
   - ✅ Admin vede tutti i messaggi
   - ✅ Tecnico vede solo richieste assegnate
   - ✅ Utente vede solo proprie richieste

4. **Eliminazione**:
   - ✅ Delete solo su propri messaggi
   - ✅ Messaggio scompare immediatamente

5. **UI/UX**:
   - ✅ Avatar colorati corretti
   - ✅ Allineamento messaggi (destra/sinistra)
   - ✅ Scroll funziona correttamente
   - ✅ Input multi-riga con Enter

## Estensioni Future

### Possibili Miglioramenti
- ⚡ **Edit messaggi**: Modifica messaggi già inviati
- 📎 **Allegati**: Invia file nella chat
- 🔔 **Notifiche**: Push notification per nuovi messaggi
- 👁️ **Typing indicator**: "X sta scrivendo..."
- ✅ **Read receipts**: Indicatori di lettura
- 🔍 **Ricerca**: Cerca messaggi nella chat
- 📌 **Pin messaggi**: Messaggi importanti in evidenza
- 😀 **Emoji picker**: Selettore emoji
- 🎨 **Markdown**: Supporto formattazione testo

## Troubleshooting

### "Permessi insufficienti"
- Verifica ruolo utente
- Controlla assigned_to / created_by
- Verifica policy RLS applicate

### Real-time non funziona
- Verifica Supabase Realtime abilitato
- Controlla console per errori WebSocket
- Fallback polling garantisce funzionamento

### Messaggi non appaiono
- Verifica query `getByRequestId`
- Controlla filtro request_id
- Verifica join con tabella users

### Performance lente
- Verifica indexes su request_messages
- Considera paginazione per > 100 messaggi
- Monitor query via Supabase Dashboard
