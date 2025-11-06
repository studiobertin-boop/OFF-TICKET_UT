# Sistema Notifiche In-App - Setup e Test

## Implementazione Completata

Il sistema di notifiche in-app è stato implementato con le seguenti funzionalità:

### 1. Database
- **Tabella `user_notification_preferences`**: memorizza le preferenze notifiche di ogni utente
- **Tabella `notifications`**: aggiornata con nuove colonne per gestire eventi e metadati
- **Trigger automatici**: creano notifiche quando:
  - Viene creata una nuova richiesta
  - Una richiesta viene bloccata (→ SOSPESA)
  - Una richiesta viene sbloccata (SOSPESA →)
  - Cambio stato configurato dall'utente

### 2. Frontend
- **Badge notifiche**: icona con counter nel menu principale
- **Drawer notifiche**: pannello laterale per visualizzare le notifiche
- **Pagina impostazioni**: `/notification-settings` per configurare preferenze
- **Realtime updates**: notifiche in tempo reale tramite Supabase Realtime
- **Notifiche browser**: supporto per notifiche native del browser

### 3. Destinatari Notifiche
Le notifiche vengono inviate a:
- Creatore della richiesta
- Tecnico assegnato (se presente)
- Tutti gli admin

## Applicazione Migration al Database

Per applicare le modifiche al database, esegui il seguente SQL nel database Supabase:

```bash
# Opzione 1: Tramite Supabase Dashboard
# 1. Vai su https://app.supabase.com
# 2. Seleziona il progetto
# 3. SQL Editor
# 4. Copia e incolla il contenuto di supabase/migrations/APPLY_NOTIFICATION_SYSTEM.sql
# 5. Esegui

# Opzione 2: Tramite CLI (se le migrations locali sono allineate)
npx supabase db push
```

Il file SQL da eseguire si trova in:
`supabase/migrations/APPLY_NOTIFICATION_SYSTEM.sql`

## Test del Sistema

### Test 1: Verifica Badge e Drawer
1. Accedi all'applicazione
2. Verifica che appaia l'icona campanella nel menu principale
3. Clicca sull'icona per aprire il drawer delle notifiche
4. Inizialmente dovrebbe essere vuoto

### Test 2: Notifica Creazione Richiesta
1. Crea una nuova richiesta (standard o DM329)
2. Verifica che:
   - Il badge mostri "1" notifica non letta
   - Nel drawer appaia la notifica "Nuova richiesta creata: [titolo]"
   - Se admin, tutti gli admin ricevono la notifica
3. Clicca sulla notifica per aprire la richiesta
4. Il badge dovrebbe azzerarsi

### Test 3: Notifica Blocco/Sblocco
1. Passa una richiesta allo stato SOSPESA
2. Verifica che appaia notifica di blocco
3. Sblocca la richiesta (SOSPESA → altro stato)
4. Verifica che appaia notifica di sblocco

### Test 4: Impostazioni Notifiche
1. Vai su menu utente → "Impostazioni Notifiche"
2. Verifica che le notifiche in-app siano attive di default
3. Attiva alcune transizioni di stato personalizzate (es. APERTA → ASSEGNATA)
4. Esegui quella transizione su una richiesta
5. Verifica di ricevere la notifica

### Test 5: Notifiche Realtime
1. Apri due browser/tab con due utenti diversi
2. Con utente A, crea una richiesta assegnata all'utente B
3. Verifica che l'utente B riceva immediatamente la notifica (senza refresh)

### Test 6: Notifiche Browser
1. Quando richiesto, accetta le notifiche browser
2. Crea una notifica (es. nuova richiesta)
3. Verifica che appaia anche la notifica nativa del browser

## Funzionalità Principali

### Badge Notifiche
- **Posizione**: Menu principale, a destra del toggle tema
- **Counter**: Mostra il numero di notifiche non lette
- **Colore**: Rosso per evidenziare

### Drawer Notifiche
- **Apertura**: Click sul badge notifiche
- **Contenuto**:
  - Header con titolo e counter
  - Pulsante "Segna tutte come lette"
  - Lista notifiche con icone colorate
  - Link diretto alla richiesta
- **Comportamento**: Le notifiche vengono eliminate dal database dopo essere state visualizzate/aperte

### Impostazioni Notifiche
- **Modalità**: In-app (attiva) / Email (fase 2, disabilitata)
- **Notifiche automatiche**: Sempre attive
  - Creazione nuove richieste
  - Blocco richieste
  - Sblocco richieste
- **Notifiche configurabili**: Switch per ogni transizione di stato
  - Richieste Standard
  - Richieste DM329

## Prossimi Passi (Fase 2)

Quando questa implementazione funzionerà correttamente, implementeremo:
1. **Notifiche via email** con Resend
2. **Template email** personalizzati
3. **Batch processing** per evitare spam
4. **Digest giornaliero** (opzionale)

## Note Tecniche

### Files Modificati/Creati
- `supabase/migrations/20251105000003_add_notification_system.sql`
- `src/types/index.ts`
- `src/services/api/notifications.ts`
- `src/hooks/useNotifications.ts`
- `src/components/common/NotificationDrawer.tsx`
- `src/components/common/Layout.tsx`
- `src/pages/NotificationSettings.tsx`
- `src/App.tsx`

### Dipendenze
- Tutte le dipendenze esistenti sono sufficienti
- Utilizza Supabase Realtime per aggiornamenti in tempo reale
- Utilizza TanStack Query per gestione stato server
- Utilizza date-fns per formattazione date

### Performance
- Le notifiche vengono eliminate dopo la visualizzazione (no accumulo)
- Indici database per query veloci
- Realtime subscription efficiente
- Query con paginazione (max 50 notifiche)

## Troubleshooting

### Badge non aggiorna
- Verifica che Realtime sia attivo su Supabase
- Controlla la console per errori di subscription
- Verifica le policies RLS sulla tabella notifications

### Notifiche non vengono create
- Verifica che il trigger sia stato creato correttamente
- Controlla che l'utente abbia preferenze (vengono create automaticamente)
- Verifica che la transizione di stato sia configurata

### Errori di permessi
- Verifica le policies RLS su `notifications` e `user_notification_preferences`
- Controlla che l'utente sia autenticato correttamente
