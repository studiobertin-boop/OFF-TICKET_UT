# Feature: Nascondi ed Elimina Richieste (Admin)

## Panoramica
Questa funzionalità permette agli amministratori di nascondere temporaneamente o eliminare definitivamente le richieste, sia generali che DM329.

## Funzionalità Implementate

### 1. Nascondere Richieste (Soft Delete)
- **Azione reversibile**: Le richieste nascoste possono essere ripristinate
- **Visibilità**: Solo gli admin vedono le richieste nascoste
- **Accesso**: Richieste nascoste accessibili tramite tab dedicati

### 2. Eliminare Richieste (Hard Delete)
- **Azione irreversibile**: Eliminazione permanente dal database
- **Eliminazione allegati**: Gli allegati vengono rimossi anche da Supabase Storage
- **Cascade**: Elimina automaticamente anche storico e record correlati

### 3. Azioni Bulk
- **Selezione multipla**: Checkbox per selezionare più richieste
- **Barra azioni**: Appare quando si seleziona almeno una richiesta
- **Operazioni di massa**: Nascondi/Elimina multiple richieste contemporaneamente

## Interfaccia Utente

### Pagina Richieste
#### Tab Disponibili (Admin)
- **Richieste Generali**: Richieste visibili non-DM329
- **Richieste DM329**: Richieste visibili DM329
- **Nascoste Generali**: Richieste generali nascoste (solo admin)
- **Nascoste DM329**: Richieste DM329 nascoste (solo admin)

#### Barra Azioni Bulk
Quando si selezionano richieste, appare una barra con:
- Contatore richieste selezionate
- Pulsante "Nascondi" (tab visibili) o "Ripristina" (tab nascoste)
- Pulsante "Elimina"
- Pulsante "Annulla" per deselezionare

### Pagina Dettaglio Richiesta
#### Pulsanti Admin (in alto a destra)
- **Nascondi**: Nasconde la richiesta (soft delete)
- **Elimina**: Elimina definitivamente la richiesta

### Dialog di Conferma

#### Nascondi Richiesta
```
⚠️ Nascondere questa richiesta?

La richiesta sarà nascosta dalla vista principale ma rimarrà
accessibile nel tab "Nascoste" (solo admin).

[Annulla]  [Nascondi richiesta]
```

#### Elimina Richiesta
```
🚨 ATTENZIONE: Eliminazione definitiva

Stai per eliminare DEFINITIVAMENTE questa richiesta.
Questa azione NON PUÒ essere annullata.

Tutti i dati, allegati e storico verranno eliminati permanentemente.

[Annulla]  [⚠️ ELIMINA DEFINITIVAMENTE]
```

## Database

### Modifiche Schema
Aggiunta colonna `is_hidden` alla tabella `requests`:
```sql
ALTER TABLE requests
ADD COLUMN is_hidden BOOLEAN NOT NULL DEFAULT false;
```

### Indici Creati
```sql
-- Indice per filtrare richieste nascoste/visibili
CREATE INDEX idx_requests_hidden ON requests(is_hidden);

-- Indice composito per query comuni
CREATE INDEX idx_requests_type_hidden ON requests(request_type_id, is_hidden);
```

## API

### Nuovi Endpoint
Tutti gli endpoint richiedono ruolo `admin`:

#### Nascondi Singola Richiesta
```typescript
requestsApi.hide(id: string): Promise<void>
```

#### Ripristina Singola Richiesta
```typescript
requestsApi.unhide(id: string): Promise<void>
```

#### Nascondi Multiple Richieste
```typescript
requestsApi.bulkHide(ids: string[]): Promise<void>
```

#### Ripristina Multiple Richieste
```typescript
requestsApi.bulkUnhide(ids: string[]): Promise<void>
```

#### Elimina Multiple Richieste
```typescript
requestsApi.bulkDelete(ids: string[]): Promise<void>
// Elimina anche allegati da Storage
```

### Filtri
Il filtro `is_hidden` è stato aggiunto all'interfaccia `RequestFilters`:
```typescript
export interface RequestFilters {
  status?: string
  request_type_id?: string
  assigned_to?: string
  created_by?: string
  is_hidden?: boolean  // NUOVO
}
```

**Default**: Se `is_hidden` non è specificato, vengono mostrate solo le richieste visibili (`is_hidden = false`)

## Hooks React

### Nuovi Hook
```typescript
useHideRequest()          // Nascondi singola richiesta
useUnhideRequest()        // Ripristina singola richiesta
useBulkHideRequests()     // Nascondi multiple richieste
useBulkUnhideRequests()   // Ripristina multiple richieste
useBulkDeleteRequests()   // Elimina multiple richieste
```

## Componenti

### Nuovi Componenti
- **BulkActionsBar**: Barra azioni per selezione multipla
- **ConfirmHideDialog**: Dialog conferma nascondere richieste
- **ConfirmDeleteDialog**: Dialog conferma eliminazione definitiva
- **HiddenRequestsView**: Vista tabella richieste nascoste con azioni ripristina/elimina

### Componenti Modificati
- **Requests**: Aggiunto supporto per tab nascoste (admin only)
- **RequestDetail**: Aggiunti pulsanti Nascondi/Elimina (admin only)

## Permessi

### Controllo Accessi
- **Nascondere richieste**: Solo admin
- **Ripristinare richieste**: Solo admin
- **Eliminare richieste**: Solo admin
- **Visualizzare tab "Nascoste"**: Solo admin

### RLS Policies
Le policy RLS esistenti devono permettere agli admin di modificare il campo `is_hidden`:
- Le richieste nascoste NON sono visibili nelle query standard (filtro automatico)
- Solo query esplicite con `is_hidden: true` le recuperano
- Solo gli admin possono eseguire query con `is_hidden: true`

## Impatto su Analytics
Le richieste nascoste:
- ❌ **NON** compaiono nei conteggi dashboard
- ❌ **NON** compaiono nei grafici analytics
- ❌ **NON** compaiono nelle query standard

## Installazione

### 1. Applicare Migration Database
Eseguire la migration `20251102000000_add_is_hidden_to_requests.sql`:

#### Opzione A: Via Supabase CLI
```bash
npx supabase db push
```

#### Opzione B: Manuale via Dashboard Supabase
1. Accedi a [Supabase Dashboard](https://supabase.com/dashboard)
2. Seleziona il progetto
3. Vai su "SQL Editor"
4. Copia e incolla il contenuto di `supabase/migrations/20251102000000_add_is_hidden_to_requests.sql`
5. Esegui la query

### 2. Verificare Migration
Verifica che la colonna sia stata aggiunta:
```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'requests' AND column_name = 'is_hidden';
```

Risultato atteso:
```
column_name | data_type | is_nullable | column_default
------------|-----------|-------------|---------------
is_hidden   | boolean   | NO          | false
```

### 3. Verificare Indici
```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'requests' AND indexname LIKE '%hidden%';
```

## Testing

### Test Funzionali
1. **Nascondi richiesta singola** (pagina dettaglio):
   - Login come admin
   - Aprire una richiesta
   - Cliccare "Nascondi"
   - Confermare
   - Verificare redirect a `/requests`
   - Verificare che la richiesta non appaia più nella lista principale

2. **Visualizza richieste nascoste**:
   - Login come admin
   - Andare su tab "Nascoste Generali" o "Nascoste DM329"
   - Verificare che la richiesta nascosta appaia con badge "NASCOSTA"

3. **Ripristina richiesta**:
   - Dal tab nascoste, selezionare una richiesta
   - Cliccare "Ripristina"
   - Verificare che torni nella lista principale

4. **Elimina richiesta**:
   - Login come admin
   - Selezionare una richiesta di test
   - Cliccare "Elimina"
   - Confermare l'eliminazione
   - Verificare che la richiesta sia stata eliminata dal database

5. **Selezione multipla**:
   - Selezionare multiple richieste con checkbox
   - Verificare che appaia la barra azioni
   - Testare "Nascondi" su selezione multipla
   - Testare "Elimina" su selezione multipla

### Test Permessi
1. **Utente non-admin**:
   - Login come tecnico o utente
   - Verificare che i tab "Nascoste" NON appaiano
   - Verificare che i pulsanti Nascondi/Elimina NON appaiano

## File Modificati

### Nuovi File
- `supabase/migrations/20251102000000_add_is_hidden_to_requests.sql`
- `src/components/requests/BulkActionsBar.tsx`
- `src/components/requests/ConfirmHideDialog.tsx`
- `src/components/requests/ConfirmDeleteDialog.tsx`
- `src/components/requests/HiddenRequestsView.tsx`

### File Modificati
- `src/types/index.ts` - Aggiunto campo `is_hidden` all'interfaccia `Request`
- `src/services/api/requests.ts` - Aggiunti metodi hide/unhide/bulkDelete
- `src/hooks/useRequests.ts` - Aggiunti hook per nuove azioni
- `src/pages/Requests.tsx` - Aggiunti tab nascoste e gestione richieste nascoste
- `src/pages/RequestDetail.tsx` - Aggiunti pulsanti Nascondi/Elimina

## Note Importanti

⚠️ **ATTENZIONE**:
- L'eliminazione di richieste è **IRREVERSIBILE**
- Gli allegati vengono eliminati da Supabase Storage
- Lo storico viene eliminato (cascade)
- Testare sempre su dati di test prima di usare in produzione

## Supporto
Per problemi o domande su questa funzionalità, contattare l'amministratore di sistema.
