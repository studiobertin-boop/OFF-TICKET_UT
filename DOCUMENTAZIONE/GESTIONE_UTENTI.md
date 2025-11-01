# Gestione Utenti - Sistema Ticketing UT

## Panoramica

È stata implementata una pagina completa di gestione utenti accessibile solo agli amministratori del sistema. La funzionalità permette di creare, modificare, sospendere ed eliminare utenti, oltre a gestire le password e assegnare i ruoli.

## Nuove Funzionalità

### 1. Pagina Gestione Utenti
**Percorso:** `/admin/users`

**Accesso:** Solo utenti con ruolo `admin`

**Funzionalità disponibili:**
- Visualizzazione tabella completa di tutti gli utenti
- Creazione nuovo utente
- Modifica dati utente esistente
- Reset password utente
- Sospensione/Riattivazione utente
- Eliminazione utente

### 2. Nuovo Ruolo: userdm329

È stato aggiunto il ruolo `userdm329` con i seguenti permessi:

**Permessi:**
- Può vedere solo la dashboard DM329
- Può vedere tutte le richieste di tipo DM329
- Può modificare tutte le richieste di tipo DM329

**RLS Policies:**
- SELECT: Solo richieste con `request_type_id` di tipo DM329
- UPDATE: Solo richieste con `request_type_id` di tipo DM329

### 3. Funzionalità di Sospensione

Gli utenti possono ora essere sospesi dagli amministratori. Quando un utente è sospeso:
- Non può effettuare il login
- Se già loggato, viene disconnesso automaticamente
- Il profilo viene visualizzato con opacità ridotta nella tabella
- Il badge mostra lo stato "Sospeso"

## Ruoli e Permessi

### Admin
- Può fare e vedere tutto
- Accesso completo a tutte le funzionalità
- Gestione utenti
- Gestione tipi di richieste
- Dashboard completa
- Tutte le richieste

### Tecnico
- Può vedere tutto
- Può modificare solo le pratiche assegnate a lui
- Dashboard con filtri sulle proprie richieste
- Non può accedere alle pagine admin

### Utente
- Può vedere solo le pratiche assegnate a lui
- Riceve notifiche quando lo stato è impostato su INFO_NECESSARIE
- Quando lo stato è INFO_NECESSARIE, può modificare il campo NOTE e aggiungere files
- Non può vedere la dashboard generale
- Redirect automatico a /requests

### UserDM329
- Può vedere solo la dashboard DM329
- Può vedere tutte le richieste di tipo DM329
- Può modificare tutte le richieste di tipo DM329
- Non può vedere altre richieste

## Struttura File Implementati

### 1. Migration Database
**File:** `supabase/migrations/20250101000003_add_userdm329_role_and_suspension.sql`

**Modifiche:**
- Aggiunto valore `userdm329` all'enum `user_role`
- Aggiunto campo `is_suspended BOOLEAN` alla tabella `users`
- Creato indice per `is_suspended`
- Creata funzione helper `is_user_suspended(user_id)`
- Aggiunte RLS policies per il ruolo `userdm329`

### 2. Types
**File:** `src/types/index.ts`

**Modifiche:**
- Aggiunto `userdm329` a `UserRole`
- Aggiunto campo `is_suspended: boolean` all'interfaccia `User`
- Aggiunto campo `updated_at: string` all'interfaccia `User`

### 3. Servizi API
**File:** `src/services/api/users.ts`

**Funzioni implementate:**
```typescript
getAllUsers(): Promise<User[]>
getUserById(userId: string): Promise<User>
createUser(userData: CreateUserData): Promise<User>
updateUser(userId: string, updates: UpdateUserData): Promise<User>
deleteUser(userId: string): Promise<void>
suspendUser(userId: string): Promise<User>
unsuspendUser(userId: string): Promise<User>
resetUserPassword(userId: string, newPassword: string): Promise<void>
getTechnicians(): Promise<User[]>
```

**Note tecniche:**
- Usa `supabase.auth.admin` API per operazioni su auth.users
- Gestisce transazioni con rollback in caso di errori
- Valida utenti sospesi prima del login

### 4. Hook React Query
**File:** `src/hooks/useUsers.ts`

**Hook disponibili:**
```typescript
useUsers() // Recupera tutti gli utenti
useUser(userId: string) // Recupera un singolo utente
useTechnicians() // Recupera solo tecnici attivi
useCreateUser() // Crea nuovo utente
useUpdateUser() // Aggiorna utente
useDeleteUser() // Elimina utente
useSuspendUser() // Sospende utente
useUnsuspendUser() // Riattiva utente
useResetUserPassword() // Reset password
```

**Query Keys:**
```typescript
userKeys.list() // Lista utenti
userKeys.detail(id) // Dettaglio utente
userKeys.technicians() // Lista tecnici
```

### 5. Componenti UI

#### UserDialog
**File:** `src/components/admin/UserDialog.tsx`

**Modalità:**
- Creazione: Form con email, password, nome, ruolo
- Modifica: Form con nome e ruolo (email readonly)

**Validazione:**
- Email valida
- Password minimo 8 caratteri
- Nome completo richiesto
- Selezione ruolo con descrizioni

#### ResetPasswordDialog
**File:** `src/components/admin/ResetPasswordDialog.tsx`

**Funzionalità:**
- Form con doppio campo password (conferma)
- Validazione corrispondenza password
- Feedback successo/errore
- Auto-chiusura dopo successo

#### AdminUsers (Pagina principale)
**File:** `src/pages/admin/AdminUsers.tsx`

**Componenti:**
- Tabella Material-UI con tutte le informazioni utente
- Badge colorati per ruoli
- Badge stato (Attivo/Sospeso)
- Pulsanti azione:
  - Modifica (icona matita)
  - Reset Password (icona chiave)
  - Sospendi/Riattiva (icona lucchetto)
  - Elimina (icona cestino)
- Dialog conferma eliminazione

**Gestione stati:**
- Loading state con CircularProgress
- Error state con Alert
- Empty state quando nessun utente

### 6. Routing
**File:** `src/App.tsx`

**Route aggiunta:**
```tsx
<Route
  path="/admin/users"
  element={
    <ProtectedRoute allowedRoles={['admin']}>
      <AdminUsers />
    </ProtectedRoute>
  }
/>
```

### 7. Layout Navigation
**File:** `src/components/common/Layout.tsx`

**Modifiche:**
- Aggiunto menu dropdown per Admin
- Voci menu:
  - Tipi Richieste (con icona Category)
  - Gestione Utenti (con icona People)
- Menu accessibile solo per utenti admin

### 8. Auth Hook
**File:** `src/hooks/useAuth.tsx`

**Modifiche:**
- Aggiunto helper `isUserDM329`
- Controllo sospensione utente in `loadUserProfile()`
- Auto-logout se utente sospeso
- Error message personalizzato per account sospesi

## Flussi di Utilizzo

### Creazione Utente
1. Admin naviga su Admin > Gestione Utenti
2. Clicca "Nuovo Utente"
3. Compila form con email, password, nome, ruolo
4. Conferma creazione
5. Sistema crea utente in `auth.users` e profilo in `public.users`
6. Utente può effettuare login con le credenziali fornite

### Modifica Utente
1. Admin clicca icona modifica su un utente
2. Dialog mostra nome e ruolo (email readonly)
3. Admin modifica campi desiderati
4. Conferma salvataggio
5. Profilo aggiornato immediatamente

### Reset Password
1. Admin clicca icona chiave su un utente
2. Dialog richiede nuova password + conferma
3. Admin inserisce password (min 8 caratteri)
4. Sistema aggiorna password usando Admin API
5. Utente può loggarsi con nuova password

### Sospensione Utente
1. Admin clicca icona lucchetto chiuso
2. Utente viene sospeso (flag `is_suspended = true`)
3. Se loggato, viene disconnesso automaticamente
4. Non può più effettuare login
5. Tabella mostra badge "Sospeso" e riga opaca

### Riattivazione Utente
1. Admin clicca icona lucchetto aperto
2. Utente viene riattivato (flag `is_suspended = false`)
3. Può nuovamente effettuare login

### Eliminazione Utente
1. Admin clicca icona cestino
2. Dialog conferma con warning
3. Admin conferma eliminazione
4. Sistema elimina da `auth.users` (CASCADE a `public.users`)
5. Tutte le richieste associate vengono eliminate

## Considerazioni di Sicurezza

### RLS Policies
Tutte le operazioni rispettano le Row Level Security policies:
- Solo admin può vedere/modificare/eliminare utenti
- Tecnici possono vedere utenti (per assegnazioni)
- Utenti normali possono vedere solo il proprio profilo

### Admin API
Le operazioni su `auth.users` usano Supabase Admin API che richiede:
- Service role key (configurata server-side)
- Non esposta al client
- Validazione ruolo admin lato server tramite RLS

### Validazione Password
- Minimo 8 caratteri richiesti
- Validazione sia client-side (Zod) che server-side (Supabase)
- Password hashate automaticamente da Supabase Auth

### Prevenzione Accessi Sospesi
- Controllo in `useAuth` a ogni caricamento profilo
- Auto-logout se utente sospeso
- Messaggio errore chiaro all'utente

## Note Tecniche

### Dipendenze Aggiunte
- `date-fns`: Formattazione date in tabella utenti

### Cache Management
TanStack Query gestisce automaticamente la cache:
- Invalidazione dopo create/update/delete
- Refetch automatico dopo mutations
- Stale time: 5 minuti

### Error Handling
Tutti i servizi gestiscono errori con:
- Try/catch blocks
- Console error logging
- Throw error con messaggi user-friendly
- Alert UI per feedback utente

## Testing

### Test Manuali Raccomandati

1. **Creazione Utente:**
   - Email duplicata (dovrebbe fallire)
   - Password < 8 caratteri (validazione)
   - Tutti i ruoli (admin, tecnico, utente, userdm329)

2. **Modifica Utente:**
   - Cambio ruolo
   - Cambio nome
   - Verifica readonly email

3. **Reset Password:**
   - Password mismatch (validazione)
   - Password valida
   - Login con nuova password

4. **Sospensione:**
   - Sospendi utente loggato (verifica logout)
   - Tentativo login utente sospeso
   - Riattivazione e login

5. **Eliminazione:**
   - Conferma dialog
   - Verifica CASCADE su richieste
   - Eliminazione da auth.users

6. **Ruolo userdm329:**
   - Accesso solo dashboard DM329
   - Visibilità solo richieste DM329
   - Modifica richieste DM329
   - Negazione accesso altre richieste

### Migration Database

Per applicare le migration al database Supabase:

```bash
# Se Supabase CLI è installato localmente
supabase db push

# Oppure applicare manualmente via Dashboard Supabase
# SQL Editor > Incollare contenuto migration file
```

## Conclusioni

L'implementazione fornisce una soluzione completa per la gestione utenti con:
- UI intuitiva e user-friendly
- Sicurezza tramite RLS e Admin API
- Gestione stati e errori robusta
- Integrazione seamless con sistema esistente
- Supporto per nuovo ruolo userdm329
- Funzionalità di sospensione utenti

Tutte le operazioni sono protette e accessibili solo agli amministratori, garantendo la sicurezza del sistema.
